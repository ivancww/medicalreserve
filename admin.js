atus.textContent = '正在驗證並同步…';  const rows = collect(resource), validation = validateAdminRows(resource, rows, { requiredFlowIds: ['protection_importance', 'premium_budget_awareness', 'premium_need_setup', 'premium_need_result', 'funding_source', 'reserve_intro', 'reserve_setup', 'reserve_result', 'summary'], writableSystemKeys: ['checkpoint_interval', 'chart_type', 'allowed_visibility', 'default_result_mode'] });  if (!validation.ok) { status.textContent = `未同步：${validation.errors.join('；')}`; status.className = 'status error'; return; }  try {    const result = await jsonRequest({ action: 'writeOfficial', appId: APP_ID, adminSessionProof: state.adminSessionProof, operation: `medicalreserve:official-write:${resource}`, resource, rows });    if (!result.readBack || result.version == null) throw new Error('GAS 未提供讀回確認或新版本');    state.drafts[resource] = result.readBack; state.health.data_version = result.version;    status.textContent = `已同步至 Official Google Sheet · data version ${result.version}`; status.className = 'status success';  } catch (error) { status.textContent = `同步失敗：${error.message}`; status.className = 'status error'; }}document.addEventListener('click', event => { const button = event.target.closest('[data-admin-save]'); if (button) save(button.dataset.adminSave); });async function start() {
  render();
  try {
    const params = new URLSearchParams(location.search), ticket = params.get('avaAdminLaunch'), launchNonce = params.get('avaAdminLaunchNonce');
    if (!ticket || !launchNonce || !window.opener) throw new Error('缺少 AVA Admin browser launch');
    const openerOrigin = 'https://ivancww.github.io';
    const browser = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('AVA Admin browser binding expired')), 10000);
      const onMessage = event => { const data = event.data || {}; if (event.source !== window.opener || event.origin !== openerOrigin || data.type !== 'ava-admin-session-response' || data.appId !== APP_ID || data.launchTicket !== ticket || data.launchNonce !== launchNonce || !data.browserProof) return; clearTimeout(timer); window.removeEventListener('message', onMessage); resolve(data); };
      window.addEventListener('message', onMessage);
      window.opener.postMessage({ type: 'ava-admin-session-request', appId: APP_ID, launchTicket: ticket, launchNonce }, openerOrigin);
    });
    const exchange = await jsonRequest({ action: 'exchangeAdminSession', appId: APP_ID, launchTicket: ticket, launchNonce, browserProof: browser.browserProof });
    if (exchange.success !== true || exchange.appId !== APP_ID || !exchange.adminSessionProof || exchange.contract !== 'ava-admin-session-v1' || !exchange.expiresAt || Date.parse(exchange.expiresAt) <= Date.now()) throw new Error('AVA Admin session exchange failed');
    state.adminSessionProof = exchange.adminSessionProof; state.expiresAt = exchange.expiresAt;
    const [health, bootstrap] = await Promise.all([readRequest('health'), readRequest('bootstrap')]);
    state.health = health; state.config = normalizeConfig(bootstrap); state.status = 'ready'; render();
  } catch (error) { state.status = 'error'; state.error = error.message; render(); }
}
