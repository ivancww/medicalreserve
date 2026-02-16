document.addEventListener('DOMContentLoaded', function() {
    const allInputIds = ['client-name', 'start-age', 'plan1-contribution', 'plan2-contribution', 'plan3-contribution', 'plan4-contribution', 'medical-plan', 'deductible', 'medical-inflation-rate', 'retirement-age', 'life-expectancy', 'manual-year-input'];
    const inputs = {};
    allInputIds.forEach(id => inputs[id] = document.getElementById(id));
    
    // 修正：確保日期顯示元素存在
    const dateDisplay = document.getElementById('date-display');
    
    const medicalInflationValueSpan = document.getElementById('medical-inflation-value');
    const tableHead = document.getElementById('results-table-head');
    const tableBody = document.getElementById('results-table-body');
    
    const totalPremiumNoInflationEl = document.getElementById('total-premium-no-inflation');
    const totalPremiumWithInflationEl = document.getElementById('total-premium-with-inflation');
    const inflationDifferenceEl = document.getElementById('inflation-difference');
    
    const shareBtn = document.getElementById('share-btn');
    const shareModal = document.getElementById('share-modal');
    const closeBtn = document.querySelector('.close-btn');
    const shareClientName = document.getElementById('share-client-name');
    const qrcodeContainer = document.getElementById('qrcode');
    let qrcode = null;

    // 按鈕事件綁定
    const btnMap = {
        'save-client': saveClient,
        'delete-client': deleteClient,
        'export-data': exportData
    };
    for (const [id, func] of Object.entries(btnMap)) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', func);
    }

    const importBtn = document.getElementById('import-data-btn');
    if (importBtn) importBtn.addEventListener('click', () => document.getElementById('import-data').click());
    
    const importInput = document.getElementById('import-data');
    if (importInput) importInput.addEventListener('change', importData);

    const medicalFileBtn = document.getElementById('medical-premium-file-btn');
    if (medicalFileBtn) medicalFileBtn.addEventListener('click', () => document.getElementById('medical-premium-file').click());

    const medicalFileInput = document.getElementById('medical-premium-file');
    if (medicalFileInput) medicalFileInput.addEventListener('change', loadMedicalFile);

    const loadClientSelect = document.getElementById('load-client');
    if (loadClientSelect) loadClientSelect.addEventListener('change', loadClient);

    const manualYearAgeSpan = document.getElementById('manual-year-age');
    let medicalPremiumData = null;

    // 定義倍數表
    const returnMultipliers = { 
        10: 1.32, 15: 1.86, 20: 2.71, 25: 4.11, 30: 5.85, 
        35: 8.02, 40: 10.99, 45: 15.06, 50: 20.63, 55: 28.27, 
        60: 38.73, 65: 53.06, 70: 72.69, 75: 99.60, 80: 136.46, 
        85: 186.96, 90: 256.15, 95: 350.94, 100: 480.82 
    };
    
    const CLIENT_DATA_KEY = 'financialToolClients_v35'; 

    // 新增：獲取倍數的函數，支援內插法，恢復平滑累積效果
    function getMultiplier(age) {
        if (age < 10) return null; // 10年以下尚未有倍數增長（視為本金或依保單條款）
        if (returnMultipliers[age]) return returnMultipliers[age];

        // 進行線性內插，計算中間年份的倍數
        const ages = Object.keys(returnMultipliers).map(Number).sort((a, b) => a - b);
        let lowerAge = null;
        let upperAge = null;

        for (let a of ages) {
            if (a <= age) lowerAge = a;
            if (a > age) {
                upperAge = a;
                break;
            }
        }

        if (lowerAge && upperAge) {
            const valLower = returnMultipliers[lowerAge];
            const valUpper = returnMultipliers[upperAge];
            const fraction = (age - lowerAge) / (upperAge - lowerAge);
            return valLower + (valUpper - valLower) * fraction;
        } else if (lowerAge) {
            return returnMultipliers[lowerAge]; // 超過最大年份時使用最大值
        }
        return null;
    }

    // 分享功能優化：確保生成圖片以便長按識別
    if(shareBtn) {
        shareBtn.addEventListener('click', () => {
            const clientName = inputs['client-name'].value.trim() || '客戶';
            shareClientName.textContent = clientName;
            
            const state = getCurrentState();
            const params = new URLSearchParams(state).toString();
            const shareUrl = `${window.location.origin}${window.location.pathname}?${params}&mode=read`;
            
            qrcodeContainer.innerHTML = '';
            
            try {
                if (typeof QRCode !== 'undefined') {
                    // 先生成 QR Code
                    new QRCode(qrcodeContainer, {
                        text: shareUrl,
                        width: 160,
                        height: 160,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.L
                    });

                    // 延遲轉換為圖片，解決手機端長按無法識別 Canvas 的問題
                    setTimeout(() => {
                        const canvas = qrcodeContainer.querySelector('canvas');
                        if (canvas) {
                            const img = document.createElement('img');
                            img.src = canvas.toDataURL("image/png");
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.alt = "QR Code";
                            qrcodeContainer.innerHTML = ''; // 清空 Canvas
                            qrcodeContainer.appendChild(img); // 放入圖片
                            
                            // 重新加入 Logo 容器（如果被清空的話，但在 HTML 結構中 Logo 是 sibling 應該不受影響，這裡只清空 qrcodeContainer）
                        }
                    }, 50);

                    shareModal.style.display = 'flex';
                } else {
                    alert("QR Code 生成功能暫時無法使用 (網絡問題)，但您仍可截圖分享。");
                }
            } catch (e) {
                console.error("QR Code Error:", e);
                alert("QR Code 生成失敗。");
            }
        });
    }

    if(closeBtn) closeBtn.addEventListener('click', () => { shareModal.style.display = 'none'; });
    if(shareModal) window.addEventListener('click', (event) => { if (event.target == shareModal) shareModal.style.display = 'none'; });

    // 核心計算功能
    function loadFromUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('client-name') || urlParams.toString().length > 20) {
            const state = {};
            for (const [key, value] of urlParams.entries()) {
                if(key !== 'mode') state[key] = value;
            }
            setTimeout(() => {
                loadState(state);
                if (urlParams.get('mode') === 'read') {
                    activateReadOnlyMode();
                }
                window.history.replaceState({}, document.title, window.location.pathname);
            }, 100);
        }
    }

    function activateReadOnlyMode() {
        document.querySelectorAll('input, select').forEach(el => {
            el.disabled = true;
            el.style.backgroundColor = '#f0f0f0'; 
            el.style.color = '#555';
        });
        const idsToHide = ['save-client', 'delete-client', 'import-data-btn', 'medical-premium-file-btn', 'load-client'];
        idsToHide.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                if(el.parentElement && el.parentElement.classList.contains('input-group')) {
                    el.parentElement.style.display = 'none';
                } else {
                    el.style.display = 'none';
                }
            }
        });
        const headerP = document.querySelector('header p');
        if(headerP) headerP.innerHTML += ' <span style="color: #28a745; font-weight: bold;">(唯讀預覽模式)</span>';
        alert("歡迎！您正在檢視專屬的醫療儲備方案 (唯讀模式)。");
    }

    function formatNumber(value) { return new Intl.NumberFormat('en-US', {maximumFractionDigits: 0}).format(value); }
    function parseFormattedNumber(str) { return parseFloat(String(str).replace(/,/g, '')) || 0; }
    
    function getCalculatedYearData(year, planContributions, planStartYears) {
        const currentPlanValues = planStartYears.map((startYear, index) => {
            const planAge = year - (startYear - 1);
            if (planAge < 0) return 0;
            
            // 使用新函數獲取倍數 (支援內插法)
            const multiplier = getMultiplier(planAge);
            
            // 若有倍數則使用倍數計算，否則顯示已供款本金 (上限5年)
            return multiplier ? (5 * planContributions[index]) * multiplier : Math.min(planAge, 5) * planContributions[index];
        });

        let totalContribution = 0;
        planStartYears.forEach((startYear, index) => {
            totalContribution += Math.max(0, Math.min(5, year - (startYear - 1))) * planContributions[index];
        });
        const totalValue = currentPlanValues.reduce((sum, v) => sum + v, 0);
        return { currentPlanValues, totalContribution, totalValue };
    }

    function calculateManualRow() {
        const year = parseInt(inputs['manual-year-input'].value) || 0;
        const startAge = parseInt(inputs['start-age'].value) || 30;
        manualYearAgeSpan.textContent = year > 0 ? `(${startAge + year - 1}歲)` : '';

        // 更新圖片上的數值
        const displayTotal = document.getElementById('display-total-contribution-value');
        const displayPolicy = document.getElementById('display-policy-value-value');

        if (year <= 0) {
            document.getElementById('manual-year-plan1').textContent = '-';
            document.getElementById('manual-year-plan2').textContent = '-';
            document.getElementById('manual-year-plan3').textContent = '-';
            document.getElementById('manual-year-plan4').textContent = '-';
            document.getElementById('manual-year-contribution').textContent = '-';
            document.getElementById('manual-year-total').textContent = '-';
            if(displayTotal) displayTotal.textContent = '-';
            if(displayPolicy) displayPolicy.textContent = '-';
            return;
        }

        const planContributions = [inputs['plan1-contribution'], inputs['plan2-contribution'], inputs['plan3-contribution'], inputs['plan4-contribution']].map(input => parseFormattedNumber(input.value));
        const planStartYears = [1, 6, 11, 16];
        const data = getCalculatedYearData(year, planContributions, planStartYears);

        document.getElementById('manual-year-plan1').textContent = `$${formatNumber(data.currentPlanValues[0])}`;
        document.getElementById('manual-year-plan2').textContent = `$${formatNumber(data.currentPlanValues[1])}`;
        document.getElementById('manual-year-plan3').textContent = `$${formatNumber(data.currentPlanValues[2])}`;
        document.getElementById('manual-year-plan4').textContent = `$${formatNumber(data.currentPlanValues[3])}`;
        
        const contributionCell = document.getElementById('manual-year-contribution');
        contributionCell.textContent = `$${formatNumber(data.totalContribution)}`;

        const totalCell = document.getElementById('manual-year-total');
        totalCell.textContent = `$${formatNumber(data.totalValue)}`;

        // 實時更新圖片框框
        if(displayTotal) displayTotal.textContent = contributionCell.textContent;
        if(displayPolicy) displayPolicy.textContent = totalCell.textContent;
    }

    function calculateAndDisplay() {
        try {
            const startAge = parseInt(inputs['start-age'].value) || 30;
            const planContributions = [
                parseFormattedNumber(inputs['plan1-contribution'].value),
                parseFormattedNumber(inputs['plan2-contribution'].value),
                parseFormattedNumber(inputs['plan3-contribution'].value),
                parseFormattedNumber(inputs['plan4-contribution'].value)
            ];
            const retirementAge = parseInt(inputs['retirement-age'].value);
            const reportingYears = [10, 15, 20, 25];
            const planStartYears = [1, 6, 11, 16];
            
            updateTableHeader(startAge, planStartYears);
            
            tableBody.innerHTML = '';
            
            reportingYears.forEach(year => {
                const currentAge = startAge + year - 1;
                const data = getCalculatedYearData(year, planContributions, planStartYears);
                const row = tableBody.insertRow();
                row.insertCell().textContent = `${year} (${currentAge})`;
                row.insertCell().textContent = `$${formatNumber(data.currentPlanValues[0])}`;
                row.insertCell().textContent = `$${formatNumber(data.currentPlanValues[1])}`;
                row.insertCell().textContent = `$${formatNumber(data.currentPlanValues[2])}`;
                row.insertCell().textContent = `$${formatNumber(data.currentPlanValues[3])}`;
                const contributionCell = row.insertCell();
                contributionCell.className = 'contribution-cell';
                contributionCell.textContent = `$${formatNumber(data.totalContribution)}`;
                const policyCell = row.insertCell();
                policyCell.className = 'policy-value-cell';
                policyCell.textContent = `$${formatNumber(data.totalValue)}`;
            });

            calculateManualRow();
            
            const medicalInflation = parseFloat(inputs['medical-inflation-rate'].value) / 100;
            const lifeExpectancy = parseInt(inputs['life-expectancy'].value);
            medicalInflationValueSpan.textContent = `${(medicalInflation * 100).toFixed(1)}%`;
            let totalNoInflation = 0;
            let totalWithInflation = 0;

            if (medicalPremiumData && retirementAge > 0 && lifeExpectancy > retirementAge) {
                const premiumMap = new Map(medicalPremiumData);
                for (let age = retirementAge; age <= lifeExpectancy; age++) {
                    const basePremium = premiumMap.get(age) || 0;
                    if(basePremium > 0){
                         totalNoInflation += basePremium;
                         const inflationYears = age - startAge;
                         totalWithInflation += basePremium * Math.pow(1 + medicalInflation, inflationYears > 0 ? inflationYears : 0);
                    }
                }
            }
            totalPremiumNoInflationEl.textContent = `$${formatNumber(totalNoInflation)}`;
            totalPremiumWithInflationEl.textContent = `$${formatNumber(totalWithInflation)}`;
            inflationDifferenceEl.textContent = `$${formatNumber(totalWithInflation - totalNoInflation)}`;
            
            const displayMedical = document.getElementById('display-inflated-medical-value');
            if(displayMedical) displayMedical.textContent = '$' + formatNumber(totalWithInflation);
            
        } catch (error) {
            console.error("An error occurred during calculation and display:", error);
        }
    }

    function updateTableHeader(startAge, planStartYears) {
        tableHead.innerHTML = `<tr><th>年份 (歲數)</th><th>儲備金庫一 <br><span class="plan-age">(${startAge + planStartYears[0] - 1}歲起)</span></th><th>儲備金庫二 <br><span class="plan-age">(${startAge + planStartYears[1] - 1}歲起)</span></th><th>儲備金庫三 <br><span class="plan-age">(${startAge + planStartYears[2] - 1}歲起)</span></th><th>儲備金庫四 <br><span class="plan-age">(${startAge + planStartYears[3] - 1}歲起)</span></th><th>供款總額</th><th>保單總值</th></tr>`;
    }
    
    function updateDeductibleState() {
        inputs['deductible'].disabled = inputs['medical-plan'].value === 'flexi';
        if (inputs['deductible'].disabled) inputs['deductible'].value = '0';
    }

    function getCurrentState() {
        const state = {};
        allInputIds.forEach(id => { const el = document.getElementById(id); if (el) state[id] = el.value; });
        return state;
    }
    function loadState(state) {
        if (!state) return;
        allInputIds.forEach(id => { const el = document.getElementById(id); if (el && state[id] !== undefined) el.value = state[id]; });
        updateDeductibleState();
        calculateAndDisplay();
    }
    function getSavedClients() { return JSON.parse(localStorage.getItem(CLIENT_DATA_KEY) || '{}'); }
    function saveClients(clients) { localStorage.setItem(CLIENT_DATA_KEY, JSON.stringify(clients)); }
    function updateClientDropdown() {
        const clients = getSavedClients();
        const currentSelection = loadClientSelect.value;
        loadClientSelect.innerHTML = '<option value="">-- 選擇已儲存方案 --</option>';
        Object.keys(clients).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            loadClientSelect.appendChild(option);
        });
        if (clients[currentSelection]) loadClientSelect.value = currentSelection;
    }
    function saveClient() {
        const clientName = inputs['client-name'].value.trim();
        if (!clientName) { alert('請先輸入客戶名稱。'); return; }
        const clients = getSavedClients();
        clients[clientName] = getCurrentState();
        saveClients(clients);
        updateClientDropdown();
        loadClientSelect.value = clientName; 
        alert(`方案 "${clientName}" 已成功儲存！`);
    }
    function loadClient() {
        const clientName = loadClientSelect.value;
        if (!clientName) { inputs['client-name'].value = ''; return; };
        const clients = getSavedClients();
        loadState(clients[clientName]);
    }
    function deleteClient() {
        const clientName = loadClientSelect.value;
        if (!clientName) { alert('請先從下拉選單中選擇一個方案。'); return; }
        if (confirm(`您確定要刪除方案 "${clientName}" 嗎？此操作無法復原。`)) {
            const clients = getSavedClients();
            delete clients[clientName];
            saveClients(clients);
            if (inputs['client-name'].value === clientName) inputs['client-name'].value = '';
            updateClientDropdown();
            alert(`方案 "${clientName}" 已被刪除。`);
        }
    }
    
    function exportData() {
        const state = getCurrentState();
        const clientName = state['client-name'] ? state['client-name'].trim() : '未命名方案';
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${clientName}_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }
    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                loadState(JSON.parse(e.target.result));
                alert(`檔案 "${file.name}" 已成功匯入！`);
            } catch (error) { alert(`匯入失敗：${error.message}`); }
        };
        reader.readAsText(file);
        event.target.value = ''; 
    }
    function loadMedicalFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, {header: 1}); 
                medicalPremiumData = json.filter(row => row.length >= 2 && !isNaN(row[0]) && !isNaN(row[1]));
                alert(`保費檔案 "${file.name}" 已成功上載並處理！`);
                calculateAndDisplay();
            } catch (error) { alert(`上載失敗：${error.message}`); }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }

    function initializeFormattingAndCalculation() {
         ['plan1-contribution', 'plan2-contribution', 'plan3-contribution', 'plan4-contribution'].forEach(id => { 
            const input = document.getElementById(id);
            if(input){
                const val = parseFormattedNumber(input.value);
                input.value = val > 0 ? formatNumber(val) : '0';
            }
        });
        calculateAndDisplay();
    }
    function initialize() {
        // 優化：自動顯示今日日期 (格式：YYYY-MM-DD)
        if(dateDisplay) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            dateDisplay.textContent = `${year}-${month}-${day}`;
        }

        updateClientDropdown();
        updateDeductibleState();
        
        document.querySelectorAll('input, select').forEach(input => {
            const eventType = (input.type === 'range' || input.type === 'number') ? 'input' : 'change';
            input.addEventListener(eventType, calculateAndDisplay);
             if (input.getAttribute('inputmode') === 'numeric') {
                input.addEventListener('focus', (e) => { e.target.value = parseFormattedNumber(e.target.value) || ''; });
                input.addEventListener('blur', (e) => { 
                    const val = parseFormattedNumber(e.target.value);
                    e.target.value = val > 0 ? formatNumber(val) : '0'; 
                    calculateAndDisplay();
                });
            }
        });
        inputs['medical-plan'].addEventListener('change', updateDeductibleState);
        
        loadFromUrlParams();
        initializeFormattingAndCalculation();
    }
    initialize();
});
