// === 強制更新版本控制 ===
const APP_VERSION = "2.0.7"; // 動態年齡標籤、戶口補貼柱狀圖、移走總已繳本金、加入圖表切換按鈕

if (localStorage.getItem('MEDICAL_APP_VERSION') !== APP_VERSION) {
    console.log("版本更新，清理舊數據...");
    localStorage.clear();
    localStorage.setItem('MEDICAL_APP_VERSION', APP_VERSION);
    alert("系統已自動更新至 Version 2.0.7 最新版本！");
    location.reload(true);
}

// === 格式化與工具函數 ===
function formatNumber(value) { return new Intl.NumberFormat('en-US', {maximumFractionDigits: 0}).format(value); }
function parseFormattedNumber(str) { return parseFloat(String(str).replace(/,/g, '')) || 0; }

let premiumData = {}; 
let medicalChart = null; 
let isCumulativeView = false; // 控制圖表顯示模式

// === 提取策略與回報乘數 ===
const returnMultipliers_none = { 10: 1.32, 15: 1.86, 20: 2.71, 25: 4.11, 30: 5.85, 35: 8.02, 40: 10.99, 45: 15.06, 50: 20.63, 55: 28.27, 60: 38.73, 65: 53.06, 70: 72.69 };
const returnMultipliers_withdraw8_from8 = { 10: 1.0658, 15: 1.0606, 20: 1.0931, 25: 1.186, 30: 1.237, 35: 1.229, 40: 1.22, 45: 1.226, 50: 1.235, 55: 1.241, 60: 1.248, 65: 1.259, 70: 1.269 };
const returnMultipliers_withdraw13_from15 = { 15: 1.731, 20: 1.784, 25: 1.94, 30: 2.0272, 35: 2.0196, 40: 2.0143, 45: 2.0353, 50: 2.068, 55: 2.0995, 60: 2.142, 65: 2.199, 70: 2.276 };
const returnMultipliers_withdraw18_from20 = { 20: 2.527, 25: 2.772, 30: 2.93, 35: 2.964, 40: 3.017, 45: 3.133, 50: 3.298, 55: 3.504, 60: 3.786, 65: 4.171, 70: 4.696, 75: 5.416, 80: 6.402, 85: 7.752, 90: 9.6, 95: 12.134, 100: 15.604 };
const returnMultipliers_withdraw23_from25 = { 25: 3.447, 30: 3.475, 35: 3.492, 40: 3.401, 45: 3.329, 50: 3.23, 55: 3.0943, 60: 2.911 };
const returnMultipliers_withdraw29_from30 = { 30: 4.754, 35: 4.841, 40: 4.805, 45: 4.821, 50: 4.838, 55: 4.858, 60: 4.866 };

// 插值計算函數
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

    // 切換圖表按鈕
    document.getElementById('toggle-chart-btn').addEventListener('click', function() {
        isCumulativeView = !isCumulativeView;
        this.textContent = isCumulativeView ? '🔄 切換至：每年現金流與補貼視角' : '🔄 切換至：累積保費與餘額視角';
        document.getElementById('chart-title').textContent = isCumulativeView ? '累積保費成本 vs 總戶口餘額' : '先支出，後享增值同時慳保費';
        calculateAll();
    });

    // 匯出 PDF 報告
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

    // Excel 匯入保費表
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
        
        // 更新金庫標籤上的歲數
        document.getElementById('label-plan1').textContent = `儲備金庫一 (${startAge}-${startAge+4}歲)`;
        document.getElementById('label-plan2').textContent = `儲備金庫二 (${startAge+5}-${startAge+9}歲)`;
        document.getElementById('label-plan3').textContent = `儲備金庫三 (${startAge+10}-${startAge+14}歲)`;
        document.getElementById('label-plan4').textContent = `儲備金庫四 (${startAge+15}-${startAge+19}歲)`;

        let inflationInput = parseFloat(document.getElementById('medical-inflation-rate').value);
        const inflationRate = isNaN(inflationInput) ? 0.05 : inflationInput / 100;

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
        
        // 表格移走「總已繳本金」
        thead.innerHTML = `<tr>
            <th>保單年度 (歲數)</th>
            <th>累計供款</th>
            <th>對沖醫療保費 (提取)</th>
            <th style="color:#dc3545;">醫療保費</th>
            <th>總戶口餘額</th>
        </tr>`;
        tbody.innerHTML = '';

        const maxYears = lifeExp - startAge + 1;
        const startOffsets = [1, 6, 11, 16];
        
        let cumulativeContribution = 0;
        let cumulativeWithdrawal = 0;
        let cumulativeMedPrem = 0;
        let cumulativeShortfall = 0; // 用於從戶口餘額中扣除補貼

        // Chart Data Arrays
        let chartLabels = [];
        let chartWithdrawalData = [];
        let chartSubsidizedData = []; // 戶口餘額補貼
        let chartPremiumData = [];
        let chartCumWithdrawalData = [];
        let chartCumPremiumData = [];
        let chartAccountValueData = [];

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
            cumulativeMedPrem += inflatedMedPrem;

            // 計算戶口餘額補貼差額 (當開始提取長糧，且長糧不夠交保費時)
            let shortfall = 0;
            if (rowTotalWithdrawal > 0 && inflatedMedPrem > rowTotalWithdrawal) {
                shortfall = inflatedMedPrem - rowTotalWithdrawal;
            }
            
            // 從總戶口餘額中概念性扣除補貼
            cumulativeShortfall += shortfall;
            rowTotalValue = Math.max(0, rowTotalValue - cumulativeShortfall);

            // 儲存圖表數據
            chartLabels.push(currentAge);
            chartWithdrawalData.push(rowTotalWithdrawal);
            chartSubsidizedData.push(shortfall);
            chartPremiumData.push(inflatedMedPrem);
            
            chartCumWithdrawalData.push(cumulativeWithdrawal);
            chartCumPremiumData.push(cumulativeMedPrem);
            chartAccountValueData.push(rowTotalValue);

            // 每 5 年、最後一年 顯示一行表格
            if (yr % 5 === 0 || yr === maxYears) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${yr} (${currentAge})</td>
                    <td>$${formatNumber(cumulativeContribution)}</td>
                    <td style="color:var(--gain-color); font-weight:bold;">$${formatNumber(rowTotalWithdrawal)}</td>
                    <td style="color:#dc3545; font-weight:bold;">$${formatNumber(inflatedMedPrem)}</td>
                    <td style="font-weight:bold; color:#6f42c1;">$${formatNumber(rowTotalValue)}</td>
                `;
                tbody.appendChild(tr);
            }
        }

        // --- 3. 繪製動態圖表 (視角切換) ---
        const ctx = document.getElementById('medicalChart').getContext('2d');
        if (medicalChart) {
            medicalChart.destroy();
        }

        if (isCumulativeView) {
            // 累積視角
            medicalChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [
                        {
                            label: '累計對沖提取總額',
                            data: chartCumWithdrawalData,
                            borderColor: '#28a745',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            tension: 0.3,
                            pointRadius: 0
                        },
                        {
                            label: '累計醫療保費成本',
                            data: chartCumPremiumData,
                            borderColor: '#dc3545',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            tension: 0.3,
                            pointRadius: 0
                        },
                        {
                            label: '總戶口餘額',
                            data: chartAccountValueData,
                            borderColor: '#6f42c1',
                            backgroundColor: 'rgba(111, 66, 193, 0.2)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { title: { display: true, text: '歲數' } },
                        y: { title: { display: true, text: '累積金額 (HK$)' }, beginAtZero: true }
                    },
                    plugins: {
                        tooltip: { callbacks: { label: (context) => context.dataset.label + ': $' + formatNumber(context.raw) } },
                        legend: { position: 'top' }
                    }
                }
            });
        } else {
            // 每年現金流視角 (預設)
            medicalChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [
                        {
                            type: 'line',
                            label: '醫療保費成本',
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
                            backgroundColor: 'rgba(40, 167, 69, 0.8)',
                            stack: 'Stack 0' // 確保柱狀圖堆疊
                        },
                        {
                            type: 'bar',
                            label: '戶口餘額自動補貼 (補足差額)',
                            data: chartSubsidizedData,
                            backgroundColor: 'rgba(255, 193, 7, 0.8)', // 醒目黃色
                            stack: 'Stack 0' // 與提取疊加
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { stacked: true, title: { display: true, text: '歲數' } },
                        y: { stacked: true, title: { display: true, text: '金額 (HK$)' }, beginAtZero: true }
                    },
                    plugins: {
                        tooltip: { callbacks: { label: (context) => context.dataset.label + ': $' + formatNumber(context.raw) } },
                        legend: { position: 'top' }
                    }
                }
            });
        }
    }

    // 初次載入執行
    calculateAll();
});
