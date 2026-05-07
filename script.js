// === 強制更新版本控制 (Version Control) ===
const APP_VERSION = "2.0.3"; // 版本已統一更新至 2.0.3

if (localStorage.getItem('MEDICAL_APP_VERSION') !== APP_VERSION) {
    console.log("版本更新，清理舊數據...");
    localStorage.clear(); // 清理舊版本可能遺留的不相容數據
    localStorage.setItem('MEDICAL_APP_VERSION', APP_VERSION);
    alert("系統已自動更新至 Version 2.0.3 最新版本！");
    location.reload(true);
}

// === 格式化與工具函數 ===
function formatNumber(value) { return new Intl.NumberFormat('en-US', {maximumFractionDigits: 0}).format(value); }
function parseFormattedNumber(str) { return parseFloat(String(str).replace(/,/g, '')) || 0; }

let premiumData = {}; // 儲存 Excel 匯入的保費表 { age: premium_amount }
let medicalChart = null; // Chart.js 實例

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
    // 顯示版本號確保前後端一致
    const versionDisplay = document.getElementById('app-version-display');
    if(versionDisplay) {
        versionDisplay.textContent = `Version ${APP_VERSION}`;
    }

    const inputsToWatch = [
        'start-age', 'medical-plan', 'deductible', 'medical-inflation-rate', 'retirement-age', 'life-expectancy',
        'plan1-contribution', 'plan2-contribution', 'plan3-contribution', 'plan4-contribution',
        'plan1-strategy', 'plan2-strategy', 'plan3-strategy', 'plan4-strategy'
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
            let basePrem = premiumData[age] || (age * 300); 
            totalPremNoInf += basePrem;
            totalPremWithInf += basePrem * Math.pow(1 + inflationRate, age - startAge);
        }

        document.getElementById('total-premium-no-inflation').textContent = '$' + formatNumber(totalPremNoInf);
        document.getElementById('total-premium-with-inflation').textContent = '$' + formatNumber(totalPremWithInf);
        document.getElementById('inflation-difference').textContent = '+$' + formatNumber(totalPremWithInf - totalPremNoInf);
        document.getElementById('display-inflated-medical-value').textContent = '$' + formatNumber(totalPremWithInf);

        // --- 2. 計算 4 個儲備金庫與生成累計表格 ---
        const contributions = [
            parseFormattedNumber(document.getElementById('plan1-contribution').value),
            parseFormattedNumber(document.getElementById('plan2-contribution').value),
            parseFormattedNumber(document.getElementById('plan3-contribution').value),
            parseFormattedNumber(document.getElementById('plan4-contribution').value)
        ];
        
        const strategies = [
            document.getElementById('plan1-strategy').value,
            document.getElementById('plan2-strategy').value,
            document.getElementById('plan3-strategy').value,
            document.getElementById('plan4-strategy').value
        ];

        const thead = document.getElementById('results-table-head');
        const tbody = document.getElementById('results-table-body');
        
        // 取消了 (通脹後) 字眼，保持簡潔
        thead.innerHTML = `<tr>
            <th>保單年度 (歲數)</th>
            <th>累計供款</th>
            <th>對沖醫療保費</th>
            <th>累積對沖醫療保費</th>
            <th style="color:#dc3545;">醫療保費</th>
            <th>總已繳保費</th>
            <th>總戶口餘額</th>
        </tr>`;
        tbody.innerHTML = '';

        const maxYears = lifeExp - startAge + 1;
        const startOffsets = [1, 6, 11, 16];
        
        let cumulativeContribution = 0;
        let cumulativeWithdrawal = 0;
        let latestTotalValue = 0;

        // 準備給 Chart.js 用的數據
        let chartLabels = [];
        let chartWithdrawalData = [];
        let chartPremiumData = [];

        for(let yr = 1; yr <= maxYears; yr++) {
            let currentAge = startAge + yr - 1;
            
            let rowTotalValue = 0;
            let rowTotalWithdrawal = 0;
            let rowContributedThisYear = 0;

            for(let i=0; i<4; i++) {
                const pA = yr - (startOffsets[i] - 1);
                const aC = contributions[i];
                const strategy = strategies[i];
                const totalPrincipal = aC * 5;
                
                let cV = 0, cA = 0;

                if (pA > 0) {
                    if (pA <= 5) {
                        rowContributedThisYear += aC;
                    }

                    if (strategy === 'withdraw8_from8' && pA >= 8) { cA = totalPrincipal * 0.08; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw8_from8, pA); }
                    else if (strategy === 'withdraw13_from15' && pA >= 15) { cA = totalPrincipal * 0.13; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw13_from15, pA); }
                    else if (strategy === 'withdraw18_from20' && pA >= 20) { cA = totalPrincipal * 0.18; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw18_from20, pA); }
                    else if (strategy === 'withdraw23_from25' && pA >= 25) { cA = totalPrincipal * 0.23; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw23_from25, pA); }
                    else if (strategy === 'withdraw29_from30' && pA >= 30) { cA = totalPrincipal * 0.29; cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_withdraw29_from30, pA); }
                    else { cV = totalPrincipal * getInterpolatedMultiplier(returnMultipliers_none, pA); }
                    
                    if(pA < 5 && strategy !== 'none') { cV = Math.min(pA, 5) * aC; }
                }
                
                rowTotalValue += cV;
                rowTotalWithdrawal += cA;
            }

            cumulativeContribution += rowContributedThisYear;
            cumulativeWithdrawal += rowTotalWithdrawal;

            let baseMedPrem = premiumData[currentAge] || (currentAge * 300);
            let inflatedMedPrem = baseMedPrem * Math.pow(1 + inflationRate, currentAge - startAge);

            // 儲存圖表數據
            chartLabels.push(currentAge);
            chartWithdrawalData.push(rowTotalWithdrawal);
            chartPremiumData.push(inflatedMedPrem);

            // 每 5 年、最後一年 顯示一行表格
            if (yr % 5 === 0 || yr === maxYears) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${yr} (${currentAge})</td>
                    <td>$${formatNumber(cumulativeContribution)}</td>
                    <td style="color:var(--gain-color); font-weight:bold;">$${formatNumber(rowTotalWithdrawal)}</td>
                    <td>$${formatNumber(cumulativeWithdrawal)}</td>
                    <td style="color:#dc3545; font-weight:bold;">$${formatNumber(inflatedMedPrem)}</td>
                    <td>$${formatNumber(cumulativeContribution)}</td>
                    <td style="font-weight:bold; color:#6f42c1;">$${formatNumber(rowTotalValue)}</td>
                `;
                tbody.appendChild(tr);
            }

            if (currentAge === retAge) {
                latestTotalValue = rowTotalValue;
            }
        }

        document.getElementById('display-total-contribution-value').textContent = '$' + formatNumber(cumulativeContribution);
        document.getElementById('display-policy-value-value').textContent = '$' + formatNumber(latestTotalValue);

        // --- 3. 繪製動態圖表 (Chart.js) ---
        const ctx = document.getElementById('medicalChart').getContext('2d');
        if (medicalChart) {
            medicalChart.destroy();
        }
        medicalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        type: 'line',
                        label: '醫療保費成本', // 這裡也移除了「通脹後」字眼
                        data: chartPremiumData,
                        borderColor: '#dc3545',
                        backgroundColor: '#dc3545',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointRadius: 0
                    },
                    {
                        type: 'bar',
                        label: '對沖醫療保費 (金庫提取)',
                        data: chartWithdrawalData,
                        backgroundColor: 'rgba(40, 167, 69, 0.7)',
                        borderColor: '#28a745',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: { title: { display: true, text: '歲數' } },
                    y: { title: { display: true, text: '金額 (HK$)' }, beginAtZero: true }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + formatNumber(context.raw);
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }

    // 初次載入執行
    calculateAll();
});
