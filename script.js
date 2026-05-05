// === 格式化與工具函數 ===
function formatNumber(value) { return new Intl.NumberFormat('en-US', {maximumFractionDigits: 0}).format(value); }
function parseFormattedNumber(str) { return parseFloat(String(str).replace(/,/g, '')) || 0; }

const STORAGE_KEY = 'MEDICAL_RESERVE_PLANS';
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
    // === 1. 初始化與事件綁定 ===
    const today = new Date();
    document.getElementById('date-display').textContent = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const inputsToWatch = [
        'start-age', 'medical-plan', 'deductible', 'medical-inflation-rate', 'retirement-age', 'life-expectancy',
        'plan1-contribution', 'plan2-contribution', 'plan3-contribution', 'plan4-contribution',
        'plan1-strategy', 'plan2-strategy', 'plan3-strategy', 'plan4-strategy', 'manual-year-input'
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

    // === 2. Excel 匯入保費表 ===
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

    // === 3. 核心計算邏輯 ===
    function calculateAll() {
        const startAge = parseInt(document.getElementById('start-age').value) || 30;
        const retAge = parseInt(document.getElementById('retirement-age').value) || 65;
        const lifeExp = parseInt(document.getElementById('life-expectancy').value) || 99;
        const inflationRate = parseFloat(document.getElementById('medical-inflation-rate').value) / 100 || 0.05;

        // --- 計算醫療保費 ---
        let totalPremNoInf = 0;
        let totalPremWithInf = 0;

        for(let age = retAge; age <= lifeExp; age++) {
            // 如果沒有上傳保費表，會使用簡單預設值作示範顯示，避免空白
            let basePrem = premiumData[age] || (age * 300); 
            totalPremNoInf += basePrem;
            totalPremWithInf += basePrem * Math.pow(1 + inflationRate, age - startAge);
        }

        document.getElementById('total-premium-no-inflation').textContent = '$' + formatNumber(totalPremNoInf);
        document.getElementById('total-premium-with-inflation').textContent = '$' + formatNumber(totalPremWithInf);
        document.getElementById('inflation-difference').textContent = '+$' + formatNumber(totalPremWithInf - totalPremNoInf);
        document.getElementById('display-inflated-medical-value').textContent = '$' + formatNumber(totalPremWithInf);

        // --- 計算儲備金庫 ---
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
        
        thead.innerHTML = `<tr><th>保單年度 (歲數)</th><th>金庫一提取</th><th>金庫一餘額</th><th>金庫二提取</th><th>金庫二餘額</th><th>金庫三提取</th><th>金庫三餘額</th><th>金庫四提取</th><th>金庫四餘額</th><th>總已繳保費</th><th>總戶口餘額</th></tr>`;
        tbody.innerHTML = '';

        let totalContributedAllYears = 0;
        const maxYears = lifeExp - startAge + 1;
        const startOffsets = [1, 6, 11, 16]; 

        let latestTotalValue = 0;
        const manualYear = parseInt(document.getElementById('manual-year-input').value) || 30;
        let manualRowData = null;

        for(let yr = 1; yr <= maxYears; yr++) {
            let currentAge = startAge + yr - 1;
            let rowTotalWithdraw = 0;
            let rowTotalValue = 0;
            let rowTotalContribute = 0;
            let tds = '';

            for(let i=0; i<4; i++) {
                const pA = yr - (startOffsets[i] - 1);
                const aC = contributions[i];
                const strategy = strategies[i];
                const tP = 5 * aC; // 預設5年總本金
                let cV = 0, cA = 0, cW = 0;

                if (pA > 0) {
                    rowTotalContribute += Math.min(pA, 5) * aC;
                    
                    if (strategy === 'withdraw8_from8' && pA >= 8) { cA = tP * 0.08; cV = tP * getInterpolatedMultiplier(returnMultipliers_withdraw8_from8, pA); }
                    else if (strategy === 'withdraw13_from15' && pA >= 15) { cA = tP * 0.13; cV = tP * getInterpolatedMultiplier(returnMultipliers_withdraw13_from15, pA); }
                    else if (strategy === 'withdraw18_from20' && pA >= 20) { cA = tP * 0.18; cV = tP * getInterpolatedMultiplier(returnMultipliers_withdraw18_from20, pA); }
                    else if (strategy === 'withdraw23_from25' && pA >= 25) { cA = tP * 0.23; cV = tP * getInterpolatedMultiplier(returnMultipliers_withdraw23_from25, pA); }
                    else if (strategy === 'withdraw29_from30' && pA >= 30) { cA = tP * 0.29; cV = tP * getInterpolatedMultiplier(returnMultipliers_withdraw29_from30, pA); }
                    else { cV = tP * getInterpolatedMultiplier(returnMultipliers_none, pA); }
                    
                    if(pA < 5 && strategy !== 'none') { cV = Math.min(pA, 5) * aC; }
                }
                
                rowTotalWithdraw += cA;
                rowTotalValue += cV;
                
                if (yr % 5 === 0 || yr === maxYears || yr === manualYear) {
                    tds += `<td style="color:var(--primary-color)">$${formatNumber(cA)}</td><td>$${formatNumber(cV)}</td>`;
                }
            }

            if (yr === maxYears) totalContributedAllYears = rowTotalContribute;

            if (yr % 5 === 0 || yr === maxYears || yr === manualYear) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${yr} (${currentAge})</td>${tds}<td>$${formatNumber(rowTotalContribute)}</td><td style="font-weight:bold; color:#d84315;">$${formatNumber(rowTotalValue)}</td>`;
                tbody.appendChild(tr);
            }

            if (yr === manualYear) {
                manualRowData = { age: currentAge, contribute: rowTotalContribute, val: rowTotalValue };
            }

            if (currentAge === retAge) {
                latestTotalValue = rowTotalValue;
            }
        }

        document.getElementById('display-total-contribution-value').textContent = '$' + formatNumber(totalContributedAllYears);
        document.getElementById('display-policy-value-value').textContent = '$' + formatNumber(latestTotalValue);

        if(manualRowData) {
            document.getElementById('manual-year-age').textContent = ` (${manualRowData.age}歲)`;
            document.getElementById('manual-year-contribution').textContent = '$' + formatNumber(manualRowData.contribute);
            document.getElementById('manual-year-total').textContent = '$' + formatNumber(manualRowData.val);
        }
    }

    // === 4. 客戶資料與分享管理 ===
    function updateClientDropdown() {
        const plans = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const select = document.getElementById('load-client');
        select.innerHTML = '<option value="">-- 選擇已儲存方案 --</option>';
        Object.keys(plans).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k; opt.textContent = k;
            select.appendChild(opt);
        });
    }
    
    document.getElementById('save-client').addEventListener('click', () => {
        const name = document.getElementById('client-name').value.trim();
        if(!name) return alert('請輸入客戶名稱');
        const plans = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        
        const data = {};
        inputsToWatch.forEach(id => {
            const el = document.getElementById(id);
            if(el) data[id] = el.value;
        });
        
        plans[name] = data;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
        updateClientDropdown();
        document.getElementById('load-client').value = name;
        alert('方案已儲存！');
    });

    document.getElementById('load-client').addEventListener('change', (e) => {
        const name = e.target.value;
        if(!name) return;
        const plans = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if(plans[name]) {
            document.getElementById('client-name').value = name;
            Object.keys(plans[name]).forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    el.value = plans[name][id];
                    if(el.getAttribute('inputmode') === 'numeric') {
                        el.value = formatNumber(parseFormattedNumber(el.value));
                    }
                }
            });
            calculateAll();
        }
    });

    document.getElementById('delete-client').addEventListener('click', () => {
        const name = document.getElementById('load-client').value;
        if(!name) return alert('請選擇要刪除的方案');
        if(confirm(`確定刪除 ${name} 嗎？`)) {
            const plans = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            delete plans[name];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
            updateClientDropdown();
            document.getElementById('client-name').value = '';
        }
    });

    document.getElementById('export-data').addEventListener('click', () => {
        const data = localStorage.getItem(STORAGE_KEY) || '{}';
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `醫療儲備備份_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    });

    document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-data').click());
    document.getElementById('import-data').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const imported = JSON.parse(evt.target.result);
                const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
                localStorage.setItem(STORAGE_KEY, JSON.stringify({...existing, ...imported}));
                updateClientDropdown();
                alert('匯入成功！');
            } catch(err) { alert('檔案錯誤！'); }
        };
        reader.readAsText(file);
    });

    document.getElementById('share-btn').addEventListener('click', () => {
        const clientName = document.getElementById('client-name').value || '尊貴客戶';
        document.getElementById('share-client-name').textContent = clientName;
        
        // 分享時將資料編碼進URL，以便在客端載入
        const dataToEncode = {};
        inputsToWatch.forEach(id => {
            const el = document.getElementById(id);
            if(el) dataToEncode[id] = el.value;
        });
        const encodedData = btoa(encodeURIComponent(JSON.stringify(dataToEncode)));
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = baseUrl + '?data=' + encodedData;
        
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: shareUrl,
            width: 200, height: 200,
            colorDark : "#000000", colorLight: "#ffffff",
            correctLevel : QRCode.CorrectLevel.L 
        });

        setTimeout(() => {
            const canvas = qrContainer.querySelector('canvas');
            if (canvas) {
                const imgData = canvas.toDataURL('image/png');
                const imgElement = document.createElement('img');
                imgElement.src = imgData;
                imgElement.style.cssText = "display: block; margin: 0 auto; width: 200px; height: 200px; pointer-events: auto; -webkit-touch-callout: default; user-select: auto;";
                qrContainer.innerHTML = '';
                qrContainer.appendChild(imgElement);
            }
        }, 150);

        document.getElementById('share-modal').style.display = 'flex';
    });

    document.querySelector('.close-btn').addEventListener('click', () => {
        document.getElementById('share-modal').style.display = 'none';
    });

    // 解析由URL進來的分享資料
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('data')) {
        try {
            const sharedData = JSON.parse(decodeURIComponent(atob(urlParams.get('data'))));
            Object.keys(sharedData).forEach(id => {
                const el = document.getElementById(id);
                if (el) { 
                    el.value = sharedData[id]; 
                    if(el.getAttribute('inputmode') === 'numeric'){
                        el.value = formatNumber(sharedData[id]);
                    }
                }
            });
            document.querySelector('.management-section').style.display = 'none';
        } catch (e) { console.error("解析分享連結失敗", e); }
    }

    // 初始化執行
    updateClientDropdown();
    calculateAll();
});
