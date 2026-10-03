import { normalizeReserveRows, premiumTotal, validateBackup } from './domain.js';

const CONFIG = Object.freeze({
  version: '1.0.1',
  api: 'https://script.google.com/macros/s/AKfycbzq07F_WpjaCtW3BK5_Bziiq9Ap1-DOT47Z7mz5-JSN-9m7nDvn9cqfZBvw9otAeZPr/exec',
  returnToAva: 'https://ivancww.github.io/avaplatform/',
  cacheKey: 'medical-reserve:official-cache:v2', userKey: 'medical-reserve:user-layer:v1', backupSchema: 'medical-reserve-backup-v1'
});

const SAFE_FALLBACK_FLOW = Object.freeze([
  { id: 'entry', title: '開始規劃醫療儲備', kind: 'entry' }, { id: 'funding', title: '資金來源', kind: 'funding' },
  { id: 'timeline', title: '你的退休時間線', kind: 'timeline' }, { id: 'coverage', title: '醫療保障至幾多歲？', kind: 'coverage' },
  { id: 'plan', title: '選擇醫療計劃', kind: 'plan' }, { id: 'premium', title: '看見未來醫療保費', kind: 'premium' },
  { id: 'transition', title: '從醫療需要到 Medical Reserve', kind: 'transition' }, { id: 'build', title: '建立 Medical Reserve', kind: 'build' },
  { id: 'support', title: 'Medical Reserve Support', kind: 'support' }, { id: 'summary', title: '你的醫療儲備重點', kind: 'summary' }
]);
const SAFE_FALLBACK_CONFIG = Object.freeze({ systemSettings: { currency: 'HKD', checkpointInterval: 5 }, appFlow: SAFE_FALLBACK_FLOW, flowOptions: { funding: ['銀行存款', '投資資產', '家庭財務', '退休生活資金'], retirementAge: [55, 60, 65, 70], coverageAge: [80, 85, 90, 95, 100] }, medicalPlans: [], reserveStrategies: [], visualization: {} });
const entry = new URLSearchParams(location.search).get('avaEntry');
const state = {
  step: 0, mode: entry === 'user' ? 'edit' : new URLSearchParams(location.search).get('mode') === 'presentation' ? 'presentation' : 'use',
  dev: ['1', 'user', 'admin'].includes(new URLSearchParams(location.search).get('dev') || entry),
  currentAge: 40, retirementAge: 65, coverageAge: 90, funding: '', planId: '', plans: [], premiumRange: null,
  supportStartAge: 65, supportEndAge: 90, selectedSupportAge: 65, arrangement: 5,
  phaseContributions: { phase1: 100000, phase2: 130000, phase3: 150000 }, flow: SAFE_FALLBACK_FLOW, officialConfig: SAFE_FALLBACK_CONFIG,
  official: { status: 'not_loaded', version: null, updatedAt: null, warnings: [] }, user: loadUser(),
  forward: { status: 'blocked', reason: '現有官方部署尚未提供支援期範圍及已驗證的生產 Forward Calculation。' }
};

function loadUser() { try { return JSON.parse(localStorage.getItem(CONFIG.userKey)) || { overrides: {}, pages: [] }; } catch { return { overrides: {}, pages: [] }; } }
function saveUser() { localStorage.setItem(CONFIG.userKey, JSON.stringify(state.user)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function money(value) { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(value) : '未有資料'; }
function getTitle(page) { return state.user.overrides[page.id]?.title || page.title; }
function getSubtitle(page) { return state.user.overrides[page.id]?.subtitle || page.subtitle || ''; }
function getSupport(page) { return state.user.overrides[page.id]?.supportingText || page.supportingText || ''; }
function normalizeOption(value) { return typeof value === 'object' ? (value.value ?? value.id ?? value.label ?? value.name) : value; }
function normalizeFlowOptions(rawOptions) {
  if (Array.isArray(rawOptions)) { const grouped = {}; rawOptions.forEach(row => { const key = row.flow_id ?? row.flowId ?? row.option_group ?? row.group ?? row.key; const value = normalizeOption(row.option_value ?? row.optionValue ?? row.value ?? row.label ?? row.name); if (key && value != null) (grouped[key] ||= []).push(value); }); rawOptions = grouped; }
  const source = rawOptions && typeof rawOptions === 'object' ? rawOptions : {};
  const read = (...keys) => { for (const key of keys) if (source[key] != null) return Array.isArray(source[key]) ? source[key].map(normalizeOption).filter(Boolean) : source[key]; return undefined; };
  return { ...source, funding: read('funding', 'fundingSource', 'funding_source') || SAFE_FALLBACK_CONFIG.flowOptions.funding, retirementAge: read('retirementAge', 'retirement_age', 'retirementAges', 'retirement_ages') || SAFE_FALLBACK_CONFIG.flowOptions.retirementAge, coverageAge: read('coverageAge', 'coverage_age', 'coverageAges', 'coverage_ages') || SAFE_FALLBACK_CONFIG.flowOptions.coverageAge };
}
function canonicalRole(id, kind) {
  const key = String(kind || id || '').toLowerCase();
  if (['entry', 'e0', 'start'].includes(key)) return 'entry';
  if (['funding', 'choice'].includes(key)) return 'funding';
  if (key === 'timeline') return 'timeline';
  if (key === 'coverage') return 'coverage';
  if (key === 'plan') return 'plan';
  if (['journey', 'total', 'premium'].includes(key)) return 'premium';
  if (['transition', 'reserve-transition'].includes(key)) return 'transition';
  if (['strategy', 'build'].includes(key)) return 'build';
  if (key === 'support') return 'support';
  if (key === 'summary') return 'summary';
  return kind || id || 'content';
}
function normalizeFlow(rawFlow) {
  if (rawFlow && !Array.isArray(rawFlow) && Array.isArray(rawFlow.pages) && Array.isArray(rawFlow.hiddenRoles)) return rawFlow;
  if (rawFlow && !Array.isArray(rawFlow)) rawFlow = rawFlow.pages || rawFlow.items || rawFlow.rows;
  if (!Array.isArray(rawFlow) || !rawFlow.length) return { pages: SAFE_FALLBACK_FLOW, hiddenRoles: [] };
  const hiddenRoles = new Set();
  const rows = rawFlow.map((page, index) => {
    const id = String(page.id ?? page.page_id ?? `official-page-${index + 1}`);
    const role = canonicalRole(id, page.kind ?? page.page_type ?? page.type);
    if (page.visible === false) hiddenRoles.add(role);
    return { id, title: String(page.title ?? page.display_name ?? page.name ?? `Medical Reserve ${index + 1}`), subtitle: page.subtitle ?? '', supportingText: page.supportingText ?? page.supporting_text ?? page.description ?? '', kind: role, options: Array.isArray(page.options) ? page.options.map(normalizeOption).filter(Boolean) : [], visible: page.visible !== false, sortOrder: Number(page.sortOrder ?? page.sort_order ?? index) };
  }).filter(page => page.visible).sort((a, b) => a.sortOrder - b.sortOrder);
  return { pages: rows, hiddenRoles: [...hiddenRoles] };
}
function reconcileCustomerFlow(officialFlow) {
  const source = officialFlow?.pages?.length ? officialFlow.pages : SAFE_FALLBACK_FLOW;
  const hiddenRoles = new Set(officialFlow?.hiddenRoles || []);
  const seen = new Set(), result = [];
  for (const page of source) {
    const role = canonicalRole(page.id, page.kind);
    if (seen.has(role)) continue;
    seen.add(role); result.push({ ...page, kind: role });
  }
  if (!seen.has('entry')) result.unshift({ ...SAFE_FALLBACK_FLOW[0] });
  for (const fallback of SAFE_FALLBACK_FLOW) {
    if (!seen.has(fallback.kind) && !hiddenRoles.has(fallback.kind)) result.push({ ...fallback });
  }
  return result;
}
function normalizeBootstrap(data) {
  const root = data?.data || data || {}, config = root.config || root.configuration || root;
  const plans = config.MedicalPlans || config.medicalPlans || config.medical_plans || [];
  const flow = normalizeFlow(config.AppFlow || config.appFlow || config.app_flow || config.flow || config.pages);
  return { systemSettings: config.SystemSettings || config.systemSettings || config.system_settings || {}, appFlow: flow, flowOptions: normalizeFlowOptions(config.FlowOptions || config.flowOptions || config.flow_options || {}), medicalPlans: Array.isArray(plans) ? plans : Object.values(plans), reserveStrategies: config.ReserveStrategies || config.reserveStrategies || config.reserve_strategies || [], visualization: config.Visualization || config.visualization || {} };
}
function applyOfficialConfig(config) { const officialFlow = config.appFlow?.pages ? config.appFlow : normalizeFlow(config.appFlow); state.officialConfig = { ...SAFE_FALLBACK_CONFIG, ...config, appFlow: officialFlow, flowOptions: normalizeFlowOptions(config.flowOptions) }; state.flow = reconcileCustomerFlow(officialFlow); state.plans = (state.officialConfig.medicalPlans || []).map(plan => ({ ...plan, plan_id: plan.plan_id ?? plan.planId ?? plan.id, premium_sheet: plan.premium_sheet ?? plan.premiumSheet ?? plan.sheet })); state.reserveStrategies = normalizeReserveRows(state.officialConfig.reserveStrategies); }
function apiUrl(action, params = {}) { const url = new URL(CONFIG.api); url.searchParams.set('action', action); Object.entries(params).forEach(([key, value]) => { if (value !== '' && value != null) url.searchParams.set(key, value); }); return url; }
async function api(action, params = {}) { const response = await fetch(apiUrl(action, params), { headers: { Accept: 'application/json' } }); const json = await response.json(); if (!json.ok) throw new Error(json.error?.message || '官方資料暫時無法使用'); return json; }
function cacheOfficial(data) { localStorage.setItem(CONFIG.cacheKey, JSON.stringify(data)); }
function readOfficialCache() { try { return JSON.parse(localStorage.getItem(CONFIG.cacheKey)); } catch { return null; } }
async function loadOfficial() {
  const cached = readOfficialCache(); if (cached?.config) { applyOfficialConfig(cached.config); state.official = { ...cached.meta, status: 'local' }; } render();
  try { const health = await api('health'), bootstrap = await api('bootstrap'), config = normalizeBootstrap(bootstrap); applyOfficialConfig(config); state.official = { status: 'cloud', version: health.data_version, updatedAt: health.updated_at, warnings: health.data?.control_sheets?.filter(x => !x.exists).map(x => x.sheet) || [], bootstrapStatus: 'ok' }; cacheOfficial({ meta: state.official, config: state.officialConfig }); if (!state.planId && state.plans.length) state.planId = state.plans.find(p => p.plan_id === 'prestige_0')?.plan_id || state.plans[0].plan_id; }
  catch (error) { state.official.status = cached ? 'local' : 'unavailable'; state.official.bootstrapStatus = 'unavailable'; state.official.error = error.message; } render();
}
async function loadPremiumRange() { if (!state.planId) return false; state.premiumRange = null; state.official.premiumError = null; render(); try { state.premiumRange = (await api('premiumRange', { plan_id: state.planId, retirement_age: state.retirementAge, coverage_age: state.coverageAge })).data; return true; } catch (error) { state.official.premiumError = error.message; render(); return false; } }

function currentPage() { return state.flow[state.step] || state.flow[0]; }
function selected(id, value) { return String(state[id]) === String(value) ? 'true' : 'false'; }
function choices(id, items) { return `<div class="choice-grid">${items.map(item => `<button class="choice-card" aria-pressed="${selected(id, item.value)}" data-action="set" data-key="${id}" data-value="${escapeHtml(item.value)}"><span class="choice-title">${escapeHtml(item.label)}</span>${item.detail ? `<span class="choice-detail">${escapeHtml(item.detail)}</span>` : ''}</button>`).join('')}</div>`; }
function pageShell(label, message, explanation, content, extra = '') { return `<div class="presentation-card"><div class="eyebrow">${escapeHtml(label)}</div><h2 class="question">${escapeHtml(message)}</h2>${explanation ? `<p class="lead">${escapeHtml(explanation)}</p>` : ''}${content}${extra}</div>`; }
function renderTimeline() { const ages = state.officialConfig.flowOptions?.retirementAge || SAFE_FALLBACK_CONFIG.flowOptions.retirementAge; return `<div class="form-grid"><div class="field"><label class="label" for="currentAge">目前年齡</label><input class="input" id="currentAge" type="number" min="18" max="100" value="${state.currentAge}" data-action="number" data-key="currentAge"><span class="help">用來建立你的規劃時間線。</span></div><div class="field"><label class="label" for="retirementAge">預計退休年齡</label><select class="select" id="retirementAge" data-action="number" data-key="retirementAge">${ages.map(v => `<option value="${Number(v)}" ${state.retirementAge === Number(v) ? 'selected' : ''}>${escapeHtml(v)} 歲</option>`).join('')}</select></div></div><div class="timeline-card"><div><span class="timeline-age">${state.currentAge}</span><span class="timeline-label">目前</span></div><div class="timeline-line"><span style="left:${Math.max(0, Math.min(100, (state.currentAge - 18) / 82 * 100))}%"></span></div><div><span class="timeline-age">${state.retirementAge}</span><span class="timeline-label">退休</span></div></div><p class="support">距離退休約 ${Math.max(0, state.retirementAge - state.currentAge)} 年。</p>`; }
function renderPlan() { if (!state.plans.length) return `<div class="status-box warning"><strong>官方醫療計劃暫時未能載入</strong><p>請稍後重試；未有官方資料時，不會顯示假設保費。</p><button class="button secondary" data-action="retry">重試</button></div>`; return choices('planId', state.plans.map(plan => ({ value: plan.plan_id, label: plan.display_name || plan.name || plan.plan_id, detail: `${plan.gender && plan.gender !== 'ALL' ? `${plan.gender} · ` : ''}${plan.deductible != null ? `自付額 ${money(Number(plan.deductible))}` : ''}` }))); }
function renderPremium() { const data = state.premiumRange; if (!data || !Array.isArray(data.annual_premiums)) return `<div class="status-box ${state.official.premiumError ? 'error-box' : 'warning'}"><strong>官方年度醫療保費暫時未能顯示</strong><p>${escapeHtml(state.official.premiumError || '請先選擇醫療計劃，或稍後重試。')}</p><button class="button secondary" data-action="retry">重試</button></div>`; const total = premiumTotal(data.annual_premiums), max = Math.max(...data.annual_premiums.map(row => Number(row.annual_premium))); return `<div class="metric-hero"><span class="metric-label">預計累積 Medical Premium Need</span><strong class="metric-number">${money(total)}</strong><span class="metric-unit">${data.retirement_age} 歲 → ${data.coverage_age} 歲 · ${data.years} 年官方年度資料合計</span></div><div class="age-rail premium-rail" aria-label="年度醫療保費進程">${data.checkpoints.map(point => `<div class="rail-point"><span class="rail-age">${point.age} 歲</span><span class="rail-bar"><i style="height:${Math.max(8, Number(point.annual_premium) / max * 100)}%"></i></span><span class="rail-value">${money(Number(point.annual_premium))}<small>每年</small></span></div>`).join('')}</div><details class="details"><summary>查看年度保費詳情</summary><div class="detail-table" tabindex="0" aria-label="年度醫療保費詳情">${data.annual_premiums.map(row => `<div><span>${row.age} 歲</span><strong>${money(Number(row.annual_premium))}</strong></div>`).join('')}</div></details>`; }
function renderBuild() { const phases = state.arrangement / 5, labels = ['第一期', '第二期', '第三期']; return `<div class="arrangement-grid">${[5, 10, 15].map(years => `<button class="arrangement-card" aria-pressed="${state.arrangement === years}" data-action="arrangement" data-value="${years}"><strong>${years}年</strong><span>${years / 5} 個五年階段</span></button>`).join('')}</div><div class="phase-band">${Array.from({ length: phases }, (_, index) => `<div class="phase-segment"><strong>${labels[index]}</strong><span>第 ${index * 5 + 1}–${index * 5 + 5} 年</span></div>`).join('')}</div><div class="phase-inputs">${Array.from({ length: phases }, (_, index) => { const id = `phase${index + 1}`; return `<div class="phase-input"><div><strong>${labels[index]}</strong><span>每年 HKD</span></div><input class="input" type="number" min="40000" max="200000" step="1000" value="${state.phaseContributions[id]}" data-action="contribution" data-phase="${id}" aria-label="${labels[index]} 每年儲蓄金額"><small>支援範圍 HKD 40,000–200,000</small></div>`; }).join('')}</div>`; }
function supportAges() { return Array.from({ length: Math.max(1, state.supportEndAge - state.supportStartAge + 1) }, (_, index) => state.supportStartAge + index); }
function renderSupport() { const ages = supportAges(), invalid = state.supportEndAge < state.supportStartAge || state.supportStartAge < state.currentAge; return `<div class="form-grid"><div class="field"><label class="label" for="supportStartAge">Medical Reserve Support 開始年齡</label><input class="input" id="supportStartAge" type="number" min="${state.currentAge}" max="100" value="${state.supportStartAge}" data-action="support-age" data-key="supportStartAge"><span class="help">這是獨立的 Support period，不會自動等同退休年齡。</span></div><div class="field"><label class="label" for="supportEndAge">Medical Reserve Support 結束年齡</label><input class="input" id="supportEndAge" type="number" min="${state.supportStartAge}" max="100" value="${state.supportEndAge}" data-action="support-age" data-key="supportEndAge"><span class="help">這是獨立的 Support period，不會自動等同保障終點。</span></div></div>${invalid ? `<div class="status-box error-box">請確認 Support 年齡範圍有效。</div>` : `<div class="support-result-layout"><div class="age-selector"><div class="selector-label">選擇年齡查看結果</div><div class="age-rail-scroll" tabindex="0" aria-label="Medical Reserve Support 年齡選擇">${ages.map(age => `<button class="age-pill" aria-pressed="${state.selectedSupportAge === age}" data-action="support-select" data-value="${age}">${age}</button>`).join('')}</div></div><div class="status-box unavailable"><strong>Forward Calculation 暫未能提供生產結果</strong><p>${escapeHtml(state.forward.reason)}</p><p>你仍可先檢視 Support period；當官方部署及資料驗證完成後，這裡會顯示當年醫療保費、Medical Reserve Support 及預計剩餘醫療儲備。</p></div></div>`}`; }
function renderSummary() { const data = state.premiumRange, plan = state.plans.find(item => item.plan_id === state.planId), total = data ? premiumTotal(data.annual_premiums) : null, phases = state.arrangement / 5; return `<div class="summary-grid"><div><span class="summary-label">醫療需要期間</span><strong>${state.retirementAge} 歲 → ${state.coverageAge} 歲</strong></div><div><span class="summary-label">醫療計劃</span><strong>${escapeHtml(plan?.display_name || '未選擇')}</strong><small>${plan?.deductible != null ? `自付額 ${money(Number(plan.deductible))}` : '官方資料狀態未確定'}</small></div><div><span class="summary-label">預計累積 Medical Premium Need</span><strong>${money(total)}</strong></div><div><span class="summary-label">Medical Reserve arrangement</span><strong>${state.arrangement}年 · ${phases} 個五年階段</strong><small>${Array.from({ length: phases }, (_, index) => `第${index + 1}期 ${money(Number(state.phaseContributions[`phase${index + 1}`]))} / 年`).join(' · ')}</small></div><div><span class="summary-label">Medical Reserve Support period</span><strong>${state.supportStartAge} 歲 → ${state.supportEndAge} 歲</strong></div></div><div class="takeaway"><span class="eyebrow">規劃重點</span><p>先看見退休後的醫療保費需要，再用分階段 Medical Reserve 探索如何提供支援。這次規劃仍未確認生產 Forward 結果，請以官方資料可用後的結果為準。</p></div><div class="summary-actions"><button class="button secondary" data-action="edit-journey">再調整</button><button class="button primary" data-action="return-ava">返回 AVA</button></div>`; }
function renderPage(page) {
  const options = state.officialConfig.flowOptions || SAFE_FALLBACK_CONFIG.flowOptions;
  switch (page.kind) {
    case 'entry': return pageShell('醫療儲備規劃', '退休之後，醫療保費仍然可能繼續。', '這段旅程會先看見未來 Medical Premium need，再探索 Medical Reserve 如何提供支援。', `<div class="story-flow"><span>BUILD</span><b>→</b><span>RESERVE</span><b>→</b><span>SUPPORT</span></div><button class="button primary start-button" data-action="start">開始</button>`);
    case 'funding': return pageShell('了解規劃背景', '未來醫療保費，你原本會用邊一部分資源應付？', '這個選擇只用來了解你的規劃背景，不會在目前流程中改變官方保費計算。', choices('funding', (options.funding || SAFE_FALLBACK_CONFIG.flowOptions.funding).map(value => ({ value, label: value }))));
    case 'timeline': return pageShell('先設定規劃年齡', '把目前年齡和退休時間線放在一起看。', '這兩個數值會建立 Medical Premium need 的起點和退休參考點。', renderTimeline(), `<button class="button primary next-button" data-action="next">下一步</button>`);
    case 'coverage': return pageShell('設定保障規劃終點', '醫療保障希望規劃至幾多歲？', `退休年齡 ${state.retirementAge} 歲 → 保障終點，定義未來 Medical Premium need period；這不會自動定義 Support period。`, choices('coverageAge', (options.coverageAge || SAFE_FALLBACK_CONFIG.flowOptions.coverageAge).map(value => ({ value: Number(value), label: `${value} 歲`, detail: `退休後約 ${Math.max(0, Number(value) - state.retirementAge)} 年` }))));
    case 'plan': return pageShell('使用官方保費資料', '選擇醫療計劃。', '只會使用官方 MedicalPlans 及其對應的年度保費資料。', renderPlan());
    case 'premium': return pageShell('官方年度保費資料', '看見未來醫療保費。', '年保費是每一年的需要；下方累積金額是整個退休至保障終點期間的 Medical Premium need。', renderPremium(), `<button class="button primary next-button" data-action="next">下一步</button>`);
    case 'transition': return pageShell('BUILD → RESERVE', '從醫療需要到 Medical Reserve。', '你剛剛看見的是未來的醫療保費需要。下一步可以探索在工作期間建立一個 Medical Reserve，讓未來 Support 有更清晰的結構。', `<div class="bridge-card"><span>NEED</span><b>→</b><span>RESERVE</span><b>→</b><span>SUPPORT</span></div><p class="support">這是規劃探索，不代表所有未來保費一定會被覆蓋。</p><button class="button primary next-button" data-action="next">探索 Medical Reserve</button>`);
    case 'build': return pageShell('BUILD', '建立 Medical Reserve。', '選擇五年階段安排；每個啟用階段都可以有自己的年度儲蓄金額。', renderBuild(), `<p class="help">5年、10年、15年是客戶易明的安排語言；每個階段仍是獨立的五年 Saving block。</p><button class="button primary next-button" data-action="next">下一步</button>`);
    case 'support': return pageShell('SUPPORT', '看看 Medical Reserve Support。', 'Support 開始和結束年齡可以獨立設定，然後按年齡查看結果。', renderSupport(), `<button class="button primary next-button" data-action="next">查看規劃重點</button>`);
    case 'summary': return pageShell('規劃摘要', '你的醫療儲備重點。', '以下整理今次探索的 Medical Premium need、分階段安排和 Support period。', renderSummary());
    default: return pageShell('Medical Reserve', getTitle(page), getSupport(page), `<p>${escapeHtml(getSubtitle(page))}</p>`);
  }
}
function renderCustomPages(position) { return state.user.pages.filter(page => page.visible !== false && page.flowPosition === position).map(page => `<section class="custom-page presentation-card"><h2>${escapeHtml(page.title)}</h2>${page.subtitle ? `<p class="support">${escapeHtml(page.subtitle)}</p>` : ''}<p>${escapeHtml(page.content || '')}</p></section>`).join(''); }
function renderEditPanel(page) { if (state.mode !== 'edit') return ''; return `<div class="edit-panel"><strong>Customer Presentation content</strong><div class="form-grid"><div class="field"><label class="label" for="edit-title">Page title</label><input class="input" id="edit-title" data-edit-field="title" data-page-id="${page.id}" value="${escapeHtml(getTitle(page))}"></div><div class="field"><label class="label" for="edit-subtitle">Supporting label</label><input class="input" id="edit-subtitle" data-edit-field="subtitle" data-page-id="${page.id}" value="${escapeHtml(getSubtitle(page))}"></div></div><div class="field"><label class="label" for="edit-support">Supporting explanation</label><textarea class="textarea" id="edit-support" data-edit-field="supportingText" data-page-id="${page.id}">${escapeHtml(getSupport(page))}</textarea></div></div>`; }
function render() {
  const page = currentPage(), isEntry = page.kind === 'entry', progress = isEntry ? 0 : Math.round((state.step / (state.flow.length - 1)) * 100), statusText = state.official.status === 'unavailable' ? '官方資料暫時無法載入；未有官方資料時不會顯示假設保費。' : state.official.status === 'local' ? '已使用本機官方資料快取。' : state.official.status === 'cloud' ? '官方資料已更新。' : '正在讀取官方資料…';
  document.title = `${getTitle(page)} · AVA Medical Reserve`; const devControls = state.dev ? `<button class="button subtle agent-only" data-action="mode" data-mode="edit">User Edit</button>` : ''; const devFooter = state.dev ? `<button class="button subtle agent-only" data-action="backup">匯出備份</button><label class="button subtle agent-only">匯入備份<input hidden type="file" accept="application/json" data-action="restore"></label><button class="button subtle agent-only" data-action="media" data-media-type="image">新增 IMAGE PAGE</button><button class="button subtle agent-only" data-action="media" data-media-type="video">新增 VIDEO PAGE</button>` : '';
  document.getElementById('app').dataset.avaMode = state.mode; document.getElementById('app').className = `ava-front ${state.mode === 'presentation' ? 'presentation' : ''}`;
  document.getElementById('app').innerHTML = `<div class="shell"><header class="header"><div class="header-identity"><a class="brand" href="./" aria-label="AVA Medical Reserve"><img class="brand-mark" src="icon.svg" alt=""><span>AVA MEDICAL RESERVE · v${CONFIG.version}</span></a><span class="journey-title">${escapeHtml(getTitle(page))}</span></div><div class="header-actions"><a class="button secondary return-ava" href="${CONFIG.returnToAva}">返回 AVA</a><button class="button subtle agent-only" data-action="mode" data-mode="presentation">Customer View</button>${devControls}</div></header><div class="container">${state.mode !== 'use' ? `<div class="modebar ${state.mode}"><strong>${state.mode === 'presentation' ? 'Customer Presentation' : state.mode === 'edit' ? 'User Edit Mode' : 'Preview Mode'}</strong><div class="actions">${state.mode === 'edit' ? '<button class="button primary" data-action="save">Save Local</button>' : ''}<button class="button secondary" data-action="mode" data-mode="use">返回使用模式</button></div></div>` : ''}${!isEntry ? `<div class="journey-nav"><button class="back-link" data-action="prev" ${state.step === 0 ? 'disabled' : ''}>← 返回</button><div class="progress-wrap"><span>${state.step} / ${state.flow.length - 1}</span><div class="progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div></div></div>` : ''}${renderCustomPages(`before:${page.id}`)}${renderPage(page)}${renderEditPanel(page)}${renderCustomPages(`after:${page.id}`)}<p class="status ${state.official.status === 'unavailable' ? 'error' : ''}">${statusText}</p><footer class="footer"><span class="caption">AVA Medical Reserve · v${CONFIG.version}</span><div class="actions">${devFooter}</div></footer></div></div>`;
}

document.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]'); if (!el) return; const action = el.dataset.action;
  if (action === 'start') { state.step = 1; render(); }
  if (action === 'set') { state[el.dataset.key] = el.dataset.key === 'coverageAge' ? Number(el.dataset.value) : el.dataset.value; if (el.dataset.key === 'funding' || el.dataset.key === 'coverageAge') { state.step += 1; render(); } if (el.dataset.key === 'planId') { const loaded = await loadPremiumRange(); if (loaded) { state.step += 1; render(); } } }
  if (action === 'arrangement') { state.arrangement = Number(el.dataset.value); render(); }
  if (action === 'support-select') { state.selectedSupportAge = Number(el.dataset.value); render(); }
  if (action === 'retry') { if (state.step === 4) await loadPremiumRange(); else await loadOfficial(); }
  if (action === 'next') { if (!validateStep()) return; state.step = Math.min(state.flow.length - 1, state.step + 1); render(); }
  if (action === 'prev') { state.step = Math.max(0, state.step - 1); render(); }
  if (action === 'edit-journey') { state.step = 1; render(); }
  if (action === 'return-ava') location.href = CONFIG.returnToAva;
  if (action === 'mode') { state.mode = el.dataset.mode; render(); }
  if (action === 'save') { document.querySelectorAll('[data-edit-field]').forEach(node => { const pageId = node.dataset.pageId; state.user.overrides[pageId] = { ...(state.user.overrides[pageId] || {}), [node.dataset.editField]: node.value }; }); saveUser(); state.mode = 'preview'; render(); }
  if (action === 'backup') exportBackup();
  if (action === 'media') addUnavailableMediaPage(el.dataset.mediaType);
});
document.addEventListener('input', event => { const el = event.target; if (el.dataset.action === 'contribution') state.phaseContributions[el.dataset.phase] = Number(el.value); });
document.addEventListener('change', async event => { const el = event.target; if (el.dataset.action === 'restore' && el.files[0]) await restoreBackup(el.files[0]); if (el.dataset.action === 'number') { state[el.dataset.key] = Number(el.value); render(); } if (el.dataset.action === 'support-age') { state[el.dataset.key] = Number(el.value); state.selectedSupportAge = state.supportStartAge; render(); } });
function validateStep() { const page = currentPage(); if (page.kind === 'timeline' && (!Number.isInteger(state.currentAge) || state.currentAge < 18 || state.retirementAge < state.currentAge)) { alert('請確認目前年齡和退休年齡。'); return false; } if (page.kind === 'build') { const values = Object.entries(state.phaseContributions).slice(0, state.arrangement / 5); if (values.some(([, value]) => !Number.isFinite(value) || value < 40000 || value > 200000)) { alert('每個啟用階段的年度儲蓄金額需為 HKD 40,000–200,000。'); return false; } } if (page.kind === 'support' && (state.supportStartAge < state.currentAge || state.supportEndAge < state.supportStartAge)) { alert('請確認 Support 開始及結束年齡。'); return false; } return true; }
function sanitizePortable(value) { if (Array.isArray(value)) return value.map(sanitizePortable); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['mediaBinary', 'blob', 'base64', 'binary'].includes(key)).map(([key, item]) => [key, sanitizePortable(item)])); return value; }
async function exportBackup() { const payload = { schema: CONFIG.backupSchema, appVersion: CONFIG.version, createdAt: new Date().toISOString(), user: sanitizePortable({ overrides: state.user.overrides, pages: state.user.pages }) }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'medical-reserve-backup.json'; link.click(); URL.revokeObjectURL(link.href); }
async function restoreBackup(file) { try { const data = JSON.parse(await file.text()); if (!validateBackup(data, CONFIG.backupSchema)) throw new Error('備份內容不完整'); state.user = sanitizePortable({ overrides: data.user.overrides || {}, pages: data.user.pages }); saveUser(); render(); alert('備份已還原。官方資料及計算來源沒有被覆蓋。'); } catch (error) { alert(`備份未能還原：${error.message}`); } }
function addUnavailableMediaPage(type) { const pageType = type === 'video' ? 'video' : 'image'; state.user.pages.push({ id: `page-${crypto.randomUUID()}`, pageType, title: `新增 ${pageType === 'image' ? 'IMAGE' : 'VIDEO'} PAGE`, subtitle: `${pageType === 'image' ? 'IMAGE PAGE' : 'VIDEO PAGE'} — 需要連接 Cloud Storage`, content: '媒體上載能力目前未連接。未有二進制資料會儲存在本機。', flowPosition: 'after:summary', sortOrder: state.user.pages.length, visible: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), media: [] }); saveUser(); render(); }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
loadOfficial();

export { CONFIG, SAFE_FALLBACK_FLOW, money };
