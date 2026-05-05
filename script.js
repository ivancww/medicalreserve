// === 強制更新版本控制 (Version Control) ===
const APP_VERSION = "2.0.0"; // 如果未來改咗代碼，只需要改呢個數字，客戶端就會自動刷新

if (localStorage.getItem('APP_VERSION') !== APP_VERSION) {
    console.log("版本更新，清理舊數據...");
    localStorage.clear(); // 清理舊版本可能遺留的不相容數據
    localStorage.setItem('APP_VERSION', APP_VERSION);
    alert("系統已自動更新至最新版本！");
    location.reload(true);
}

// === 格式化與工具函數 ===
function formatNumber(value) { return new Intl.NumberFormat('en-US', {maximumFractionDigits: 0}).format(value); }
function parseFormattedNumber(str) { return parseFloat(String(str).replace(/,/g, '')) || 0; }

let premiumData = {}; // 儲存 Excel 匯入的保費表 { age: premium_amount }

// === 提取策略與回報乘數 ===
const returnMultipliers_none = { 10: 1.32, 15: 1.86, 20: 2.71, 25: 4.11, 30: 5.85, 35: 8.02, 40: 10.99, 45: 15.06, 50: 20.63, 55: 28.27, 60: 38.73, 65: 53.06, 70: 72.69 };
const returnMultipliers_withdraw8_from8 = { 10: 1.0658, 15: 1.0606, 20: 1.0931, 25: 1.186, 30: 1.237, 35: 1.229, 40: 1.22, 45: 1.226, 50: 1.235, 55: 1.241, 60: 1.248, 65: 1.259, 70: 1.269 };
const returnMultipliers_withdraw13_from15 = { 15: 1.731, 20: 1.784, 25: 1.94, 30: 2.0272, 35: 2.0196, 40: 2.0143, 45: 2.0353, 50: 2.068, 55: 2.0995, 60: 2.142, 65: 2.199, 70: 2.276 };
const returnMultipliers_withdraw18_from20 = { 20: 2.527, 25: 2.772, 30: 2.93, 35: 2.964, 40: 3.017, 45: 3.133, 50: 3.298, 55: 3.504, 60: 3.786, 65: 4.171, 70: 4.696, 75: 5.416, 80: 6.402, 85: 7.752, 90: 9.6, 95: 12.134, 100: 15.604 };
const returnMultipliers_withdraw23_from25 = { 25: 3.447, 30: 3.475, 35: 3.492, 40: 3.401, 45: 3.329, 50: 3.23, 55: 3.0943, 60: 2.911 };
const returnMultipliers_withdraw29_from30 = { 30: 4.754, 35: 4.841, 40: 4.805, 45: 4.821, 50: 4.838, 55: 4.858, 60: 4.866 };

// 插值計算函數 (Interpolation)
function getInterpolatedMultiplier(multipliersObj, year) {
    const keys = Object.keys(multipliersObj).map(Number).sort((a,b)=>a-b);
    if (year <= keys[0]) return year <= 5 ? year / 5 : 1.0 + (multipliersObj[keys[0]] - 1.0) * ((year - 5) / (keys[0] - 5));
    if (year >= keys[keys.length-1]) return multipliersObj[keys[keys.length-1]];
    let lower = keys[0], upper = keys[keys.length-1];
    for(let i=0; i<keys.length-1; i++) { if(year >= keys[i] && year <= keys[i+1]) { lower = keys[i]; upper = keys[i+1]; break; } }
    const ratio = (year - lower) / (upper - lower);
    return multipliersObj[lower] + ratio * (multipliersObj[upper] - multipliersObj[lower]);
}

document.addEventListener('DOMContentLoaded', () => {
    // 顯示版本號
    document.getElementById('app-version-display').textContent = `Version ${APP_VERSION}`;

    const inputsToWatch = [
        'start-age', 'medical-plan', 'deductible', 'medical-inflation-rate', 'retirement-age', 'life-expectancy',
        'reserve-contribution', 'reserve-strategy'
    ];

    inputsToWatch.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', calculateAll);
            el.addEventListener('change', calculateAll);
            if(el.getAttribute('inputmode') === 'numeric') {
                el.addEventListener('blur', function() { this.value = formatNumber(parseFormattedNumber(this.value)); });
                el.addEventListener('focus', function() { this.value = parseFormattedNumber(this.value) || ''; });
            }
        }
    });

    document.getElementById('medical-inflation-rate').addEventListener('input', function() {
        document.getElementById('medical-inflation-value').textContent = parseFloat(this.value).toFixed(1) + '%';
    });

    // === 匯出 PDF 報告 ===
    document.getElementById('generate-pdf-btn').addEventListener('click', () => {
        const element = document.getElementById('pdf-content');
        // 隱藏不必要的按鈕
        const noPrintElements = document.querySelectorAll('.no-print');
        noPrintElements.forEach(el => el.style.display = 'none');

        const opt = {
            margin:       0.5,
            filename:     '醫療儲備方案報告.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            // 恢復顯示
            noPrintElements.forEach(el => el.style.display = '');
        });
    });

    // === Excel 匯入保費表 ===
    document.getElementById('medical-premium-file-btn').addEventListener('click', () => {
        document.getElementById('medical-premium-file').click();
    });

    document.getElementById('medical-premium-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            
            premiumData = {};
            json.forEach(row => {
                const keys = Object.keys(row);
                if(keys.length >= 2) {
                    const age = parseInt(row[keys[0]]);
                    const prem = parseFloat(row[keys[1]]);
                    if(!isNaN(age) && !isNaN(prem)) {
                        premiumData[age] = prem;
                    }
                }
            });
            alert('保費表載入成功！');
            calculateAll();
        };
        reader.readAsArrayBuffer(file);
    });

    // === 核心計算邏輯 ===
    function calculateAll() {
        const startAge = parseInt(document.getElementById('start-age').value) || 30;
        const retAge = parseInt(document.getElementById('retirement-age').value) || 65;
        const lifeExp = parseInt(document.getElementById('life-expectancy').value) || 99;
        const inflationRate = parseFloat(document.getElementById('medical-inflation-rate').value) / 100 || 0.05;

        // --- 1. 計算退休後醫療保費總額 ---
        let totalPremNoInf = 0;
        let totalPremWithInf = 0;

        for(let age = retAge; age <= lifeExp; age++) {
            // 若無 Excel 數據，預設使用 (年齡 * 300) 作為演示
            let basePrem = premiumData[age] || (age * 300); 
            totalPremNoInf += basePrem;
            totalPremWithInf += basePrem * Math.pow(1 + inflationRate, age - startAge);
        }

        document.getElementById('total-premium-no-inflation').textContent = '$' + formatNumber(totalPremNoInf);
        document.getElementById('total-premium-with-inflation').textContent = '$' + formatNumber(totalPremWithInf);
        document.getElementById('inflation-difference').textContent = '+$' + formatNumber(totalPremWithInf - totalPremNoInf);
        document.getElementById('display-inflated-medical-value').textContent = '$' + formatNumber(totalPremWithInf);

        // --- 2. 計算儲備金庫與生成表格 ---
        const annualContribution = parseFormattedNumber(document.getElementById('reserve-contribution').value);
        const strategy = document.getElementById('reserve-strategy').value;
        const totalPrincipal = annualContribution * 5; // 假設供5年

        const thead = document.getElementById('results-table-head');
        const tbody = document.getElementById('results-table-body');
        
        // 更新表頭：加入醫療保費欄位，並將被動收入改為對沖醫療保費
        thead.innerHTML = `<tr>
            <th>保單年度 (歲數)</th>
            <th>累計供款</th>
            <th>對沖醫療保費</th>
            <th>累積對沖醫療保費</th>
            <th style="color:#dc3545;">醫療保費 (通脹後)</th>
            <th>總已繳保費</th>
            <th>總戶口餘額</th>
        </tr>`;
        tbody.innerHTML = '';

        const maxYears = lifeExp - startAge + 1;
        
        let cumulativeContribution = 0;
        let cumulativeWithdrawal = 0;
        let latestTotalValue = 0;

        for(let yr = 1; yr <= maxYears; yr++) {
            let currentAge = startAge + yr - 1;
            let pA = yr;
            
            let cV = 0; // 戶口餘額
            let cA = 0; // 當年提取 (對沖醫療保費)

            // 計算累計供款 (首5年)
            if (pA <= 5) {
                cumulativeContribution += annualContribution;
            }

            // 根據策略計算戶口餘額及提取
            if (pA > 0) {
                if (strategy === 'withdraw8_from8' && pA >= 8) { cA = totalPrincipal * 0.08; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw8_from8, pA); }
                else if (strategy === 'withdraw13_from15' && pA >= 15) { cA = totalPrincipal * 0.13; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw13_from15, pA); }
                else if (strategy === 'withdraw18_from20' && pA >= 20) { cA = totalPrincipal * 0.18; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw18_from20, pA); }
                else if (strategy === 'withdraw23_from25' && pA >= 25) { cA = totalPrincipal * 0.23; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw23_from25, pA); }
                else if (strategy === 'withdraw29_from30' && pA >= 30) { cA = totalPrincipal * 0.29; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw29_from30, pA); }
                else { cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_none, pA); }
                
                // 供款期內未開始回報倍增的顯示邏輯
                if(pA < 5 && strategy !== 'none') { cV = cumulativeContribution; }
            }

            cumulativeWithdrawal += cA;

            // 計算該年的醫療保費 (基於保費表及通脹)
            let baseMedPrem = premiumData[currentAge] || (currentAge * 300);
            let inflatedMedPrem = baseMedPrem * Math.pow(1 + inflationRate, currentAge - startAge);

            // 每 5 年、最後一年 顯示一行
            if (yr % 5 === 0 || yr === maxYears) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${yr} (${currentAge})</td>
                    <td>$${formatNumber(cumulativeContribution)}</td>
                    <td style="color:var(--gain-color); font-weight:bold;">$${formatNumber(cA)}</td>
                    <td>$${formatNumber(cumulativeWithdrawal)}</td>
                    <td style="color:#dc3545; font-weight:bold;">$${formatNumber(inflatedMedPrem)}</td>
                    <td>$${formatNumber(cumulativeContribution)}</td>
                    <td style="font-weight:bold; color:#6f42c1;">$${formatNumber(cV)}</td>
                `;
                tbody.appendChild(tr);
            }

            if (currentAge === retAge) {
                latestTotalValue = cV;
            }
        }

        // 更新圖片上的數字
        document.getElementById('display-total-contribution-value').textContent = '$' + formatNumber(cumulativeContribution);
        document.getElementById('display-policy-value-value').textContent = '$' + formatNumber(latestTotalValue);
    }

    // 初次載入執行
    calculateAll();
});
