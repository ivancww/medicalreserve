import { normalizeReserveRows, premiumTotal } from './domain.js';

const CONFIG = Object.freeze({
  version: '1.0.1',
  api: 'https://script.google.com/macros/s/AKfycbzq07F_WpjaCtW3BK5_Bziiq9Ap1-DOT47Z7mz5-JSN-9m7nDvn9cqfZBvw9otAeZPr/exec',
  returnToAva: 'https://ivancww.github.io/avaplatform/',
  cacheKey: 'medical-reserve:official-cache:v2',
  userKey: 'medical-reserve:user-layer:v1',
  backupSchema: 'medical-reserve-backup-v1'
});

const SAFE_FALLBACK_FLOW = [
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
const STATIC_FLOW = SAFE_FALLBACK_FLOW;
const SAFE_FALLBACK_CONFIG = Object.freeze({
  systemSettings: { currency: 'HKD', checkpointInterval: 5 },
  appFlow: SAFE_FALLBACK_FLOW,
  flowOptions: {
    funding: ['銀行存款', '投資資產', '家庭財務', '退休生活資金'],
    retirementAge: [55, 60, 65, 70],
    coverageAge: [80, 85, 90, 95, 100]
  },
  medicalPlans: [],
  reserveStrategies: [],
  visualization: {}
});
const state = {
  step: 0, mode: new URLSearchParams(location.search).get('mode') === 'presentation' ? 'presentation' : 'use',
  dev: ['1', 'user', 'admin'].includes(new URLSearchParams(location.search).get('dev') || new URLSearchParams(location.search).get('avaEntry')),
  currentAge: 40, retirementAge: 65, coverageAge: 90, funding: '', planId: '', plans: [], premiumRange: null,
  flow: SAFE_FALLBACK_FLOW, officialConfig: SAFE_FALLBACK_CONFIG,
  official: { status: 'not_loaded', version: null, updatedAt: null, warnings: [] }, user: loadUser()
};

function loadUser() { try { return JSON.parse(localStorage.getItem(CONFIG.userKey)) || { overrides: {}, pages: [] }; } catch { return { overrides: {}, pages: [] }; } }
function saveUser() { localStorage.setItem(CONFIG.userKey, JSON.stringify(state.user)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function money(value) { return typeof value === 'number' ? new Intl.NumberFormat('zh-HK', { style:'currency', currency:'HKD', maximumFractionDigits:0 }).format(value) : '未有資料'; }
function percent(value) { return typeof value === 'number' ? `${value.toFixed(2)}%` : '—'; }
function getTitle(page) { return state.user.overrides[page.id]?.title || page.title; }
function getSubtitle(page) { return state.user.overrides[page.id]?.subtitle || page.subtitle || ''; }
function getSupport(page) { return state.user.overrides[page.id]?.supportingText || page.supportingText || ''; }
function currentFlow() { return state.flow?.length ? state.flow : SAFE_FALLBACK_FLOW; }
function normalizeOption(value) { return typeof value === 'object' ? (value.value ?? value.id ?? value.label ?? value.name) : value; }
function normalizeFlowOptions(rawOptions) {
  if (Array.isArray(rawOptions)) {
    const grouped = {};
    rawOptions.forEach(row => {
      const key = row.flow_id ?? row.flowId ?? row.option_group ?? row.group ?? row.key;
      const value = normalizeOption(row.option_value ?? row.optionValue ?? row.value ?? row.label ?? row.name);
      if (key && value != null) (grouped[key] ||= []).push(value);
    });
    rawOptions = grouped;
  }
  const source = rawOptions && typeof rawOptions === 'object' ? rawOptions : {};
  const read = (...keys) => { for (const key of keys) if (source[key] != null) return Array.isArray(source[key]) ? source[key].map(normalizeOption).filter(Boolean) : source[key]; return undefined; };
  return {
    ...source,
    funding: read('funding', 'fundingSource', 'funding_source') || SAFE_FALLBACK_CONFIG.flowOptions.funding,
    retirementAge: read('retirementAge', 'retirement_age', 'retirementAges', 'retirement_ages') || SAFE_FALLBACK_CONFIG.flowOptions.retirementAge,
    coverageAge: read('coverageAge', 'coverage_age', 'coverageAges', 'coverage_ages') || SAFE_FALLBACK_CONFIG.flowOptions.coverageAge
  };
}
function normalizeFlow(rawFlow) {
  if (rawFlow && !Array.isArray(rawFlow)) rawFlow = rawFlow.pages || rawFlow.items || rawFlow.rows;
  if (!Array.isArray(rawFlow) || !rawFlow.length) return SAFE_FALLBACK_FLOW;
  return rawFlow.map((page, index) => ({
    id: String(page.id ?? page.page_id ?? `official-page-${index + 1}`),
    title: String(page.title ?? page.display_name ?? page.name ?? `Medical Reserve ${index + 1}`),
    subtitle: page.subtitle ?? '', supportingText: page.supportingText ?? page.supporting_text ?? page.description ?? '',
    kind: page.kind ?? page.page_type ?? page.type ?? 'content',
    options: Array.isArray(page.options) ? page.options.map(normalizeOption).filter(Boolean) : [],
    visible: page.visible !== false, sortOrder: Number(page.sortOrder ?? page.sort_order ?? index)
  })).filter(page => page.visible).sort((a,b) => a.sortOrder - b.sortOrder);
}
function normalizeBootstrap(data) {
  const root = data?.data || data || {};
  const config = root.config || root.configuration || root;
  const flow = normalizeFlow(config.AppFlow || config.appFlow || config.app_flow || config.flow || config.pages);
  const options = config.FlowOptions || config.flowOptions || config.flow_options || {};
  const plans = config.MedicalPlans || config.medicalPlans || config.medical_plans || [];
  const strategies = config.ReserveStrategies || config.reserveStrategies || config.reserve_strategies || [];
  return {
    systemSettings: config.SystemSettings || config.systemSettings || config.system_settings || {},
    appFlow: flow,
    flowOptions: normalizeFlowOptions(options),
    medicalPlans: Array.isArray(plans) ? plans : Object.values(plans),
    reserveStrategies: Array.isArray(strategies) ? strategies : Object.values(strategies),
    visualization: config.Visualization || config.visualization || {}
  };
}
function applyOfficialConfig(config) {
  const flow = normalizeFlow(config.appFlow);
  state.officialConfig = { ...SAFE_FALLBACK_CONFIG, ...config, appFlow: flow };
  state.flow = flow;
  const configuredPlans = state.officialConfig.medicalPlans || [];
  state.plans = configuredPlans.map(plan => ({ ...plan, plan_id: plan.plan_id ?? plan.planId ?? plan.id, premium_sheet: plan.premium_sheet ?? plan.premiumSheet ?? plan.sheet }));
  state.reserveStrategies = normalizeReserveRows(state.officialConfig.reserveStrategies);
}
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
  if (cached?.config) { applyOfficialConfig(cached.config); state.official = { ...cached.meta, status:'local' }; }
  render();
  let health = null;
  try {
    health = await api('health');
    const bootstrap = await api('bootstrap');
    const config = normalizeBootstrap(bootstrap);
    applyOfficialConfig(config);
    state.official = { status:'cloud', version:health.data_version, updatedAt:health.updated_at, warnings: health.data?.control_sheets?.filter(x => !x.exists).map(x => x.sheet) || [], bootstrapStatus:'ok' };
    cacheOfficial({ meta: state.official, config: state.officialConfig });
    if (!state.planId && state.plans.length) state.planId = state.plans.find(p => p.plan_id === 'prestige_0')?.plan_id || state.plans[0].plan_id;
  } catch (error) {
    state.official.status = cached ? 'local' : 'unavailable';
    state.official.bootstrapStatus = 'unavailable';
    state.official.error = error.message;
    if (!state.plans.length && health?.data?.mapped_data_sheets) {
      state.plans = [];
      for (const item of health.data.mapped_data_sheets.filter(item => item.type === 'premium' && item.exists)) {
        try {
          const result = await api('premium', { plan_id: item.id, age: state.retirementAge });
          state.plans.push({ plan_id:item.id, premium_sheet:item.sheet, display_name:result.data.display_name, gender:result.data.gender, deductible:result.data.deductible, source:'health-degraded-plan-availability' });
        } catch { /* An unavailable official plan remains unavailable. */ }
      }
      state.official.degradedPlanMapping = true;
    }
    if (!state.planId && state.plans.length) state.planId = state.plans.find(p => p.plan_id === 'prestige_0')?.plan_id || state.plans[0].plan_id;
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

function currentPage() { return currentFlow()[state.step] || currentFlow()[0]; }
function selected(id, value) { return String(state[id]) === String(value) ? 'true' : 'false'; }
function choices(id, items) { return `<div class="grid">${items.map(item => `<button class="choice" aria-pressed="${selected(id,item.value)}" data-action="set" data-key="${id}" data-value="${escapeHtml(item.value)}"><span class="choice-title">${escapeHtml(item.label)}</span>${item.detail ? `<span class="choice-detail">${escapeHtml(item.detail)}</span>` : ''}</button>`).join('')}</div>`; }
function renderTimeline() { const ages=state.officialConfig.flowOptions?.retirementAge || SAFE_FALLBACK_CONFIG.flowOptions.retirementAge; return `<div class="grid"><div class="field"><label class="label" for="currentAge">目前年齡</label><input class="input" id="currentAge" type="number" min="18" max="100" value="${state.currentAge}" data-action="number" data-key="currentAge"></div><div class="field"><label class="label" for="retirementAge">預計退休年齡</label><select class="select" id="retirementAge" data-action="number" data-key="retirementAge">${ages.map(v=>`<option ${state.retirementAge===Number(v)?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></div></div><div class="card"><div class="journey-row"><strong>${state.currentAge}</strong><div class="journey-track"><div class="journey-fill" style="width:${Math.min(100,Math.max(0,(state.currentAge-18)/82*100))}%"></div></div><span class="caption">目前</span></div><p class="support">距離退休約 ${Math.max(0,state.retirementAge-state.currentAge)} 年</p><div class="journey-row"><strong>${state.retirementAge}</strong><div class="journey-track"><div class="journey-fill" style="width:60%"></div></div><span class="caption">退休</span></div></div>`; }
function renderPlan() { if (!state.plans.length) return `<div class="warning">官方 MedicalPlans 暫時未能載入。請稍後重試；未有官方計劃資料時，不會顯示假設保費。</div>`; return choices('planId', state.plans.map(p => ({ value:p.plan_id, label:p.display_name || p.name || p.plan_id, detail:`${p.gender && p.gender !== 'ALL' ? p.gender+' · ' : ''}${p.deductible != null ? '自付額 '+money(Number(p.deductible)) : p.premium_sheet || ''}` }))); }
function renderJourney() { const data=state.premiumRange; if (!data || !Array.isArray(data.annual_premiums) || !Array.isArray(data.checkpoints)) return `<div class="warning">官方保費旅程資料暫時不可用。</div>`; const max=Math.max(...data.annual_premiums.map(x=>Number(x.annual_premium))); return `<div class="card journey"><p class="support">由 ${data.retirement_age} 歲至 ${data.coverage_age} 歲，官方資料共 ${data.years} 年。</p>${data.checkpoints.map((x,i)=>`<div class="journey-row"><span class="journey-age">${x.age}</span><div class="journey-track"><div class="journey-fill" style="width:${x.annual_premium/max*100}%"></div></div><span class="journey-value">${money(Number(x.annual_premium))}</span></div><p class="caption">${i===0?'起點':`較上一個五年節點 ${percent(x.growth_from_previous_checkpoint_percent)}`}</p>`).join('')}</div>`; }
function renderTotals() { const d=state.premiumRange; if (!d) return `<div class="warning">總額會在官方保費旅程載入後顯示。</div>`; const total=premiumTotal(d.annual_premiums); return `<div class="metrics"><div class="metric card"><span class="support">退休醫療保費總額</span><strong class="metric-value">${money(total)}</strong><span class="metric-unit">${d.currency} · ${d.years} 年 · 官方年度資料合計</span></div><div class="metric card"><span class="support">開始年齡</span><strong class="metric-value">${d.retirement_age}</strong><span class="metric-unit">退休</span></div><div class="metric card"><span class="support">保障至</span><strong class="metric-value">${d.coverage_age}</strong><span class="metric-unit">歲</span></div></div>`; }
function renderReserveUnavailable() { return `<div class="warning"><strong>Medical Reserve Support 暫未能計算</strong><p>官方 ReserveStrategies 資料目前未提供。為保障數據正確性，本頁不會自行估算儲備、支援額或剩餘醫療費用。</p></div>`; }
function renderStep(page) {
  const options = state.officialConfig.flowOptions || SAFE_FALLBACK_CONFIG.flowOptions;
  const kind = page.kind || page.id;
  const content = { funding:choices('funding',(page.options.length ? page.options : options.funding).map(x=>({value:x,label:x}))), timeline:renderTimeline(), coverage:choices('coverageAge',(options.coverageAge || SAFE_FALLBACK_CONFIG.flowOptions.coverageAge).map(v=>({value:Number(v),label:`${v} 歲`,detail:`退休後約 ${Math.max(0,Number(v)-state.retirementAge)} 年`}))), plan:renderPlan(), journey:renderJourney(), total:renderTotals(), transition:`<div class="card"><h3>先理解需要，再談 Medical Reserve</h3><p class="support">退休醫療保費是一段長期需要。當你看見保費旅程和總額後，下一步才是思考如何建立 Medical Reserve，為未來提供 Medical Reserve Support。</p></div>`, strategy:renderReserveUnavailable(), support:renderReserveUnavailable(), summary:`<div class="card-body">${renderTotals()}${renderReserveUnavailable()}</div>` }[kind] || `<div class="card"><p>${escapeHtml(getSupport(page) || getSubtitle(page))}</p></div>`;
  const editFields = state.mode === 'edit' ? `<div class="card edit-only"><div class="field"><label class="label">Page Title</label><input class="input" data-edit-field="title" data-page-id="${page.id}" value="${escapeHtml(getTitle(page))}"></div><div class="field"><label class="label">Subtitle</label><input class="input" data-edit-field="subtitle" data-page-id="${page.id}" value="${escapeHtml(getSubtitle(page))}"></div><div class="field"><label class="label">Supporting Text</label><textarea class="textarea" data-edit-field="supportingText" data-page-id="${page.id}">${escapeHtml(getSupport(page))}</textarea></div></div>` : '';
  return `<section class="section"><h2 class="section-title editable" data-page-id="${page.id}">${escapeHtml(getTitle(page))}</h2>${getSubtitle(page)?`<p class="support">${escapeHtml(getSubtitle(page))}</p>`:''}${content}${editFields}</section>`;
}
function renderCustomPages(position) { return state.user.pages.filter(p=>p.visible!==false && (p.flowPosition===position || (position.startsWith('after:') && p.flowPosition===currentPage().id))).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(p=>`<section class="section custom-page card"><h2>${escapeHtml(p.title)}</h2>${p.subtitle?`<p class="support">${escapeHtml(p.subtitle)}</p>`:''}<p>${escapeHtml(p.content||'')}</p>${p.pageType==='image' || p.pageType==='video'?`<div class="media-placeholder">${p.pageType==='image'?'IMAGE PAGE':'VIDEO PAGE'}<br>媒體暫未連接<br><small>Cloud Storage capability unavailable — no binary stored locally</small></div>`:''}</section>`).join(''); }
function render() {
  const page=currentPage(), presentation=state.mode==='presentation'; document.title=`${getTitle(page)} · Medical Reserve`;
  const progress=(state.step+1)/currentFlow().length*100;
  const devControls = state.dev ? `<button class="button subtle agent-only" data-action="mode" data-mode="edit">User Edit</button>` : '';
  const devFooter = state.dev ? `<button class="button subtle agent-only" data-action="backup">匯出備份</button><label class="button subtle agent-only">匯入備份<input hidden type="file" accept="application/json" data-action="restore"></label><button class="button subtle agent-only" data-action="media" data-media-type="image">新增 IMAGE PAGE</button><button class="button subtle agent-only" data-action="media" data-media-type="video">新增 VIDEO PAGE</button>` : '';
  document.getElementById('app').dataset.avaMode=state.mode; document.getElementById('app').className=`ava-front ${presentation?'presentation':''}`;
  const statusText = state.official.bootstrapStatus==='unavailable' ? '官方 Bootstrap 暫未可用；已保留安全本機/降級資料邊界。' : state.official.status==='local' ? '已使用本機官方資料快取。' : state.official.status==='cloud' ? '官方資料已更新。' : state.official.status==='unavailable' ? '官方資料暫時無法載入，請稍後重試。' : '正在讀取官方資料…';
  document.getElementById('app').innerHTML=`<div class="shell"><header class="header"><a class="brand" href="./" aria-label="Medical Reserve"><img class="brand-mark" src="icon.svg" alt=""><span>Medical Reserve</span></a><div class="header-actions"><a class="button secondary" href="${CONFIG.returnToAva}">← 返回 AVA</a><button class="button subtle agent-only" data-action="mode" data-mode="presentation">Customer View</button>${devControls}</div></header><div class="container">${state.mode!=='use'?`<div class="modebar ${state.mode}"><strong>${state.mode==='presentation'?'Customer Presentation':state.mode==='edit'?'User Edit Mode':'Preview Mode'}</strong><div class="actions">${state.mode==='edit'?'<button class="button primary" data-action="save">Save Local</button>':''}<button class="button secondary" data-action="mode" data-mode="use">返回使用模式</button></div></div>`:''}<div class="hero"><p class="caption">Easy for Agent · Natural Conversation · Instant Visualization</p><h1 class="title">${escapeHtml(getTitle(page))}</h1><p class="support">${escapeHtml(getSupport(page) || '由未來醫療需要開始，逐步看見保費、時間與 Medical Reserve Support。')}</p><div class="progress" aria-label="流程進度"><span style="width:${progress}%"></span></div><p class="caption">第 ${state.step+1} / ${currentFlow().length} 步</p></div>${renderCustomPages('before:'+page.id)}${renderStep(page)}${renderCustomPages('after:'+page.id)}<div class="actions"><button class="button secondary" data-action="prev" ${state.step===0?'disabled':''}>上一步</button><button class="button primary" data-action="next">${state.step===currentFlow().length-1?'重新開始':'繼續'}</button></div><p class="status ${state.official.status==='unavailable'?'error':''}">${statusText}</p><footer class="footer"><span class="caption">Medical Reserve · v${CONFIG.version}</span><div class="actions">${devFooter}</div></footer></div></div>`;
}

document.addEventListener('click', async event => { const el=event.target.closest('[data-action]'); if(!el) return; const action=el.dataset.action;
  if(action==='set'){ state[el.dataset.key]=el.dataset.key==='coverageAge' ? Number(el.dataset.value) : el.dataset.value; if(el.dataset.key==='planId') await loadPremiumRange(); render(); }
  if(action==='number'){ state[el.dataset.key]=Number(el.value); if(el.dataset.key==='retirementAge'||el.dataset.key==='coverageAge') await loadPremiumRange(); else render(); }
  if(action==='next'){ if(state.step===currentFlow().length-1) state.step=0; else state.step++; if(['journey','total'].includes(currentPage().kind)) await loadPremiumRange(); else render(); }
  if(action==='prev'){ state.step=Math.max(0,state.step-1); render(); }
  if(action==='mode'){ state.mode=el.dataset.mode; render(); }
  if(action==='save'){ document.querySelectorAll('[data-edit-field]').forEach(node=>{ const pageId=node.dataset.pageId; state.user.overrides[pageId]={ ...(state.user.overrides[pageId]||{}), [node.dataset.editField]:node.value }; }); saveUser(); state.mode='preview'; render(); }
  if(action==='backup') exportBackup();
  if(action==='media') addUnavailableMediaPage(el.dataset.mediaType);
});
document.addEventListener('change', async event => { const el=event.target; if(el.dataset.action==='restore' && el.files[0]) await restoreBackup(el.files[0]); });
function sanitizePortable(value){ if(Array.isArray(value)) return value.map(sanitizePortable); if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([key])=>!['mediaBinary','blob','base64','binary'].includes(key)).map(([key,item])=>[key,sanitizePortable(item)])); return value; }
async function exportBackup(){ const payload={schema:CONFIG.backupSchema,appVersion:CONFIG.version,createdAt:new Date().toISOString(),user:sanitizePortable({overrides:state.user.overrides,pages:state.user.pages})}; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='medical-reserve-backup.json'; a.click(); URL.revokeObjectURL(a.href); }
async function restoreBackup(file){ try { const data=JSON.parse(await file.text()); if(data.schema!==CONFIG.backupSchema) throw new Error('不支援的備份版本'); if(!data.user||!Array.isArray(data.user.pages)) throw new Error('備份內容不完整'); state.user=sanitizePortable({overrides:data.user.overrides||{},pages:data.user.pages}); saveUser(); render(); alert('備份已還原。官方資料及計算來源沒有被覆蓋。'); } catch(error){ alert(`備份未能還原：${error.message}`); } }
function addUnavailableMediaPage(type){ const pageType=type==='video'?'video':'image'; state.user.pages.push({id:`page-${crypto.randomUUID()}`,pageType,title:`新增 ${pageType==='image'?'IMAGE':'VIDEO'} PAGE`,subtitle:`${pageType==='image'?'IMAGE PAGE':'VIDEO PAGE'} — 需要連接 Cloud Storage`,content:'媒體上載能力目前未連接。未有二進制資料會儲存在本機。',flowPosition:'after:summary',sortOrder:state.user.pages.length,visible:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),media:[]}); saveUser(); render(); }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
loadOfficial();

export { CONFIG, STATIC_FLOW, money, percent };
