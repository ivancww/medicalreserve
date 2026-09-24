const CONFIG = Object.freeze({
  api: 'https://script.google.com/macros/s/AKfycbzq07F_WpjaCtW3BK5_Bziiq9Ap1-DOT47Z7mz5-JSN-9m7nDvn9cqfZBvw9otAeZPr/exec',
  returnToAva: 'https://ivancww.github.io/avaplatform/',
  cacheKey: 'medical-reserve:official-cache:v1',
  userKey: 'medical-reserve:user-layer:v1',
  backupSchema: 'medical-reserve-backup-v1'
});

const STATIC_FLOW = [
  { id: 'funding', title: '退休後，你預計主要會用哪方面的資金支付醫療保費？', kind: 'choice', options: ['銀行存款', '投資資產', '家庭財務', '退休生活資金'] },
  { id: 'timeline', title: '先看看你的退休時間線', kind: 'timeline' },
  { id: 'coverage', title: '你希望醫療保障大約維持到幾多歲？', kind: 'coverage' },
  { id: 'plan', title: '選擇醫療計劃', kind: 'plan' },
  { id: 'journey', title: '醫療保費旅程', kind: 'journey' },
  { id: 'total', title: '退休期間的醫療保費需要', kind: 'total' },
  { id: 'transition', title: '由醫療需要，走到 Medical Reserve', kind: 'transition' },
  { id: 'strategy', title: '建立 Medical Reserve', kind: 'strategy' },
  { id: 'support', title: 'Medical Reserve Support', kind: 'support' },
  { id: 'summary', title: '重點總結', kind: 'summary' }
];
const state = {
  step: 0, mode: new URLSearchParams(location.search).get('mode') === 'presentation' ? 'presentation' : 'use',
  currentAge: 40, retirementAge: 65, coverageAge: 90, funding: '', planId: '', plans: [], premiumRange: null,
  official: { status: 'not_loaded', version: null, updatedAt: null, warnings: [] }, user: loadUser()
};

function loadUser() { try { return JSON.parse(localStorage.getItem(CONFIG.userKey)) || { overrides: {}, pages: [] }; } catch { return { overrides: {}, pages: [] }; } }
function saveUser() { localStorage.setItem(CONFIG.userKey, JSON.stringify(state.user)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function money(value) { return typeof value === 'number' ? new Intl.NumberFormat('zh-HK', { style:'currency', currency:'HKD', maximumFractionDigits:0 }).format(value) : '未有資料'; }
function percent(value) { return typeof value === 'number' ? `${value.toFixed(2)}%` : '—'; }
function getTitle(page) { return state.user.overrides[page.id]?.title || page.title; }
function apiUrl(action, params = {}) { const url = new URL(CONFIG.api); url.searchParams.set('action', action); Object.entries(params).forEach(([k,v]) => { if (v !== '' && v != null) url.searchParams.set(k, v); }); return url; }

async function api(action, params = {}) {
  const response = await fetch(apiUrl(action, params), { headers: { Accept: 'application/json' } });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error?.message || '官方資料暫時無法使用');
  return json;
}
function cacheOfficial(data) { localStorage.setItem(CONFIG.cacheKey, JSON.stringify(data)); }
function readOfficialCache() { try { return JSON.parse(localStorage.getItem(CONFIG.cacheKey)); } catch { return null; } }

async function loadOfficial() {
  const cached = readOfficialCache();
  if (cached) { state.official = { ...cached.meta, status:'local' }; state.plans = cached.plans || []; }
  render();
  try {
    const health = await api('health');
    let bootstrapError = '';
    try { await api('bootstrap'); } catch (error) { bootstrapError = error.message; }
    const mapped = (health.data?.mapped_data_sheets || []).filter(x => x.type === 'premium' && x.exists);
    const plans = [];
    for (const item of mapped) {
      try {
        const result = await api('premium', { plan_id: item.id, age: state.retirementAge });
        plans.push({ plan_id:item.id, premium_sheet:item.sheet, display_name:result.data.display_name, gender:result.data.gender, deductible:result.data.deductible });
      } catch { /* An unavailable plan is not shown as valid data. */ }
    }
    state.plans = plans;
    state.official = { status:'cloud', version:health.data_version, updatedAt:health.updated_at, warnings: health.data?.control_sheets?.filter(x => !x.exists).map(x => x.sheet) || [], bootstrapError };
    cacheOfficial({ meta: state.official, plans });
    if (!state.planId && plans.length) state.planId = plans.find(p => p.plan_id === 'prestige_0')?.plan_id || plans[0].plan_id;
  } catch (error) {
    state.official.status = cached ? 'local' : 'unavailable';
    state.official.error = error.message;
  }
  render();
}
async function loadPremiumRange() {
  if (!state.planId) return;
  state.premiumRange = null; render();
  try { state.premiumRange = (await api('premiumRange', { plan_id:state.planId, retirement_age:state.retirementAge, coverage_age:state.coverageAge })).data; }
  catch (error) { state.official.premiumError = error.message; }
  render();
}

function currentPage() { return STATIC_FLOW[state.step]; }
function selected(id, value) { return state[id] === value ? 'true' : 'false'; }
function choices(id, items) { return `<div class="grid">${items.map(item => `<button class="choice" aria-pressed="${selected(id,item.value)}" data-action="set" data-key="${id}" data-value="${escapeHtml(item.value)}"><span class="choice-title">${escapeHtml(item.label)}</span>${item.detail ? `<span class="choice-detail">${escapeHtml(item.detail)}</span>` : ''}</button>`).join('')}</div>`; }
function renderTimeline() { return `<div class="grid"><div class="field"><label class="label" for="currentAge">目前年齡</label><input class="input" id="currentAge" type="number" min="18" max="100" value="${state.currentAge}" data-action="number" data-key="currentAge"></div><div class="field"><label class="label" for="retirementAge">預計退休年齡</label><select class="select" id="retirementAge" data-action="number" data-key="retirementAge">${[55,60,65,70].map(v=>`<option ${state.retirementAge===v?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="card"><div class="journey-row"><strong>${state.currentAge}</strong><div class="journey-track"><div class="journey-fill" style="width:${Math.min(100,Math.max(0,(state.currentAge-18)/82*100))}%"></div></div><span class="caption">目前</span></div><p class="support">距離退休約 ${Math.max(0,state.retirementAge-state.currentAge)} 年</p><div class="journey-row"><strong>${state.retirementAge}</strong><div class="journey-track"><div class="journey-fill" style="width:60%"></div></div><span class="caption">退休</span></div></div>`; }
function renderPlan() { if (!state.plans.length) return `<div class="warning">官方 MedicalPlans 暫時未能載入。請稍後重試；未有官方計劃資料時，不會顯示假設保費。</div>`; return choices('planId', state.plans.map(p => ({ value:p.plan_id, label:p.display_name, detail:`${p.gender && p.gender !== 'ALL' ? p.gender+' · ' : ''}自付額 ${money(p.deductible)}` }))); }
function renderJourney() { const data=state.premiumRange; if (!data) return `<div class="warning">請先選擇官方醫療計劃並載入保費旅程。</div>`; const max=Math.max(...data.annual_premiums.map(x=>x.annual_premium)); return `<div class="card journey"><p class="support">由 ${data.retirement_age} 歲至 ${data.coverage_age} 歲，官方資料共 ${data.years} 年。</p>${data.checkpoints.map((x,i)=>`<div class="journey-row"><span class="journey-age">${x.age}</span><div class="journey-track"><div class="journey-fill" style="width:${x.annual_premium/max*100}%"></div></div><span class="journey-value">${money(x.annual_premium)}</span></div><p class="caption">${i===0?'起點':`較上一個五年節點 ${percent(x.growth_from_previous_checkpoint_percent)}`}</p>`).join('')}</div>`; }
function renderTotals() { const d=state.premiumRange; if (!d) return `<div class="warning">總額會在官方保費旅程載入後顯示。</div>`; return `<div class="metrics"><div class="metric card"><span class="support">退休醫療保費總額</span><strong class="metric-value">${money(d.total_premium)}</strong><span class="metric-unit">${d.currency} · ${d.years} 年</span></div><div class="metric card"><span class="support">開始年齡</span><strong class="metric-value">${d.retirement_age}</strong><span class="metric-unit">退休</span></div><div class="metric card"><span class="support">保障至</span><strong class="metric-value">${d.coverage_age}</strong><span class="metric-unit">歲</span></div></div>`; }
function renderReserveUnavailable() { return `<div class="warning"><strong>Medical Reserve Support 暫未能計算</strong><p>官方 ReserveStrategies 資料目前未提供。為保障數據正確性，本頁不會自行估算儲備、支援額或剩餘醫療費用。</p></div>`; }
function renderStep(page) {
  const content = { funding:choices('funding',page.options.map(x=>({value:x,label:x}))), timeline:renderTimeline(), coverage:choices('coverageAge',[80,85,90,95,100].map(v=>({value:v,label:`${v} 歲`,detail:`退休後約 ${Math.max(0,v-state.retirementAge)} 年`}))), plan:renderPlan(), journey:renderJourney(), total:renderTotals(), transition:`<div class="card"><h3>先理解需要，再談 Medical Reserve</h3><p class="support">退休醫療保費是一段長期需要。當你看見保費旅程和總額後，下一步才是思考如何建立 Medical Reserve，為未來提供 Medical Reserve Support。</p></div>`, strategy:renderReserveUnavailable(), support:renderReserveUnavailable(), summary:`<div class="card-body">${renderTotals()}${renderReserveUnavailable()}</div>` }[page.kind];
  return `<section class="section"><h2 class="section-title editable" data-page-id="${page.id}">${escapeHtml(getTitle(page))}</h2>${content}</section>`;
}
function renderCustomPages() { return state.user.pages.filter(p=>p.visible!==false).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(p=>`<section class="section custom-page card"><h2>${escapeHtml(p.title)}</h2>${p.subtitle?`<p class="support">${escapeHtml(p.subtitle)}</p>`:''}<p>${escapeHtml(p.content||'')}</p>${p.pageType==='image' || p.pageType==='video'?`<div class="media-placeholder">媒體暫未連接<br><small>Cloud Storage capability unavailable — no binary stored locally</small></div>`:''}</section>`).join(''); }
function render() {
  const page=currentPage(), presentation=state.mode==='presentation'; document.title=`${getTitle(page)} · Medical Reserve`;
  const progress=(state.step+1)/STATIC_FLOW.length*100;
  document.getElementById('app').dataset.avaMode=state.mode; document.getElementById('app').className=`ava-front ${presentation?'presentation':''}`;
  document.getElementById('app').innerHTML=`<div class="shell"><header class="header"><a class="brand" href="./" aria-label="Medical Reserve"><img class="brand-mark" src="icon.svg" alt=""><span>Medical Reserve</span></a><div class="header-actions"><a class="button secondary" href="${CONFIG.returnToAva}">← 返回 AVA</a><button class="button subtle agent-only" data-action="mode" data-mode="presentation">Customer View</button><button class="button subtle agent-only" data-action="mode" data-mode="edit">User Edit</button></div></header><div class="container">${state.mode!=='use'?`<div class="modebar ${state.mode}"><strong>${state.mode==='presentation'?'Customer Presentation':state.mode==='edit'?'User Edit Mode':'Preview Mode'}</strong><div class="actions">${state.mode==='edit'?'<button class="button primary" data-action="save">Save Local</button>':''}<button class="button secondary" data-action="mode" data-mode="use">返回使用模式</button></div></div>`:''}<div class="hero"><p class="caption">Easy for Agent · Natural Conversation · Instant Visualization</p><h1 class="title">${escapeHtml(page.title)}</h1><p class="support">由未來醫療需要開始，逐步看見保費、時間與 Medical Reserve Support。</p><div class="progress" aria-label="流程進度"><span style="width:${progress}%"></span></div><p class="caption">第 ${state.step+1} / ${STATIC_FLOW.length} 步</p></div>${renderStep(page)}${renderCustomPages()}<div class="actions"><button class="button secondary" data-action="prev" ${state.step===0?'disabled':''}>上一步</button><button class="button primary" data-action="next">${state.step===STATIC_FLOW.length-1?'重新開始':'繼續'}</button></div><p class="status ${state.official.status==='unavailable'?'error':''}">${state.official.status==='local'?'已使用本機官方資料快取。':state.official.status==='cloud'?'官方資料已更新。':state.official.status==='unavailable'?'官方資料暫時無法載入，請稍後重試。':'正在讀取官方資料…'}</p><footer class="footer"><span class="caption">Medical Reserve · Phase 1</span><div class="actions"><button class="button subtle agent-only" data-action="backup">匯出備份</button><label class="button subtle agent-only">匯入備份<input hidden type="file" accept="application/json" data-action="restore"></label><button class="button subtle agent-only" data-action="media">新增媒體頁面</button></div></footer></div></div>`;
}

document.addEventListener('click', async event => { const el=event.target.closest('[data-action]'); if(!el) return; const action=el.dataset.action;
  if(action==='set'){ state[el.dataset.key]=el.dataset.value; if(el.dataset.key==='planId') await loadPremiumRange(); render(); }
  if(action==='number'){ state[el.dataset.key]=Number(el.value); if(el.dataset.key==='retirementAge'||el.dataset.key==='coverageAge') await loadPremiumRange(); else render(); }
  if(action==='next'){ if(state.step===STATIC_FLOW.length-1) state.step=0; else state.step++; if(currentPage().kind==='journey'||currentPage().kind==='total') await loadPremiumRange(); else render(); }
  if(action==='prev'){ state.step=Math.max(0,state.step-1); render(); }
  if(action==='mode'){ state.mode=el.dataset.mode; render(); }
  if(action==='save'){ document.querySelectorAll('[data-page-id]').forEach(node=>{ const title=node.textContent.trim(); state.user.overrides[node.dataset.pageId]={ ...(state.user.overrides[node.dataset.pageId]||{}), title }; }); saveUser(); state.mode='preview'; render(); }
  if(action==='backup') exportBackup();
  if(action==='media') addUnavailableMediaPage();
});
document.addEventListener('change', async event => { const el=event.target; if(el.dataset.action==='restore' && el.files[0]) await restoreBackup(el.files[0]); });
async function exportBackup(){ const payload={schema:CONFIG.backupSchema,createdAt:new Date().toISOString(),user:{overrides:state.user.overrides,pages:state.user.pages}}; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='medical-reserve-backup.json'; a.click(); URL.revokeObjectURL(a.href); }
async function restoreBackup(file){ try { const data=JSON.parse(await file.text()); if(data.schema!==CONFIG.backupSchema) throw new Error('不支援的備份版本'); if(!data.user||!Array.isArray(data.user.pages)) throw new Error('備份內容不完整'); state.user={overrides:data.user.overrides||{},pages:data.user.pages.map(p=>({...p,mediaBinary:undefined}))}; saveUser(); render(); alert('備份已還原。官方資料及計算來源沒有被覆蓋。'); } catch(error){ alert(`備份未能還原：${error.message}`); } }
function addUnavailableMediaPage(){ state.user.pages.push({id:`page-${crypto.randomUUID()}`,pageType:'image',title:'新增媒體頁面',subtitle:'IMAGE PAGE — 需要連接 Cloud Storage',content:'媒體上載能力目前未連接。未有二進制資料會儲存在本機。',flowPosition:'after-summary',sortOrder:state.user.pages.length,visible:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),media:[]}); saveUser(); render(); }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
loadOfficial();

export { CONFIG, STATIC_FLOW, money, percent };
