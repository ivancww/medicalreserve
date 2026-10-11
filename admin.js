import { ADMIN_RESOURCES, ADMIN_WRITABLE_SYSTEM_KEYS, officialRecordKey, validateAdminRows } from './domain.js';
import { APP_VERSION } from './version.js';

const API = 'https://script.google.com/macros/s/AKfycbzq07F_WpjaCtW3BK5_Bziiq9Ap1-DOT47Z7mz5-JSN-9m7nDvn9cqfZBvw9otAeZPr/exec';
const APP_ID = 'medicalreserve';
const RETURN_TO_AVA = 'https://ivancww.github.io/avaplatform/';
const ADMIN_SESSION_CONTRACT = 'ava-admin-session-v1';
const READ_OPERATION = 'medicalreserve:official-read';
const WRITABLE_SYSTEM_KEYS = ADMIN_WRITABLE_SYSTEM_KEYS;

const RESOURCE_LABELS = Object.freeze({
  AppFlow: '流程頁面',
  FlowOptions: '流程選項',
  MedicalPlans: '醫療計劃',
  Visualization: '視覺化設定',
  SystemSettings: '系統設定'
});

const FIELD_LABELS = Object.freeze({
  step_id: '流程穩定 ID',
  option_id: '選項穩定 ID',
  visual_id: '視覺穩定 ID',
  setting: '設定名稱',
  plan_id: '計劃穩定 ID',
  key: '系統設定 Key',
  title: '標題',
  subtitle: '副標題',
  type: '頁面類型',
  label: '選項顯示文字',
  value: '設定值',
  display_name: '顯示名稱',
  gender: '性別',
  deductible: '自付額',
  premium_sheet: '保費資料表',
  enabled: '啟用',
  visible: '顯示',
  sort_order: '排序'
});

const FIELD_ORDER = Object.freeze({
  AppFlow: ['step_id', 'title', 'subtitle', 'type', 'enabled', 'visible', 'sort_order'],
  FlowOptions: ['step_id', 'option_id', 'label', 'value', 'enabled', 'sort_order'],
  MedicalPlans: ['plan_id', 'display_name', 'gender', 'deductible', 'premium_sheet', 'enabled', 'sort_order'],
  Visualization: ['visual_id', 'setting', 'value'],
  SystemSettings: ['key', 'value', 'description']
});

const state = {
  status: 'authorizing',
  error: '',
  adminSessionProof: '',
  expiresAt: '',
  health: null,
  confirmedConfig: {},
  drafts: {},
  dirty: {},
  selectedRecord: {},
  activeResource: ADMIN_RESOURCES[0],
  messages: {},
  view: 'loading'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function jsonRequest(body) {
  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify(body)
  }).then(async response => {
    const payload = await response.json();
    if (!response.ok || payload.success === false || payload.ok === false) {
      throw new Error(payload.error?.message || payload.error || '官方同步失敗');
    }
    return payload;
  });
}

function rowsFor(resource) {
  const value = state.drafts[resource] ?? state.confirmedConfig[resource] ?? [];
  if (Array.isArray(value)) return value;
  return Object.entries(value || {}).map(([key, item]) => typeof item === 'object' ? { key, ...item } : { key, value: item });
}

function fieldsFor(resource, rows) {
  const present = new Set(rows.flatMap(row => Object.keys(row || {})));
  return (FIELD_ORDER[resource] || []).filter(field => present.has(field));
}

function selectedIndex(resource, rows) {
  const selected = state.selectedRecord[resource];
  const index = rows.findIndex(row => officialRecordKey(resource, row) === selected);
  return index >= 0 ? index : 0;
}

function currentRow(resource, rows = rowsFor(resource)) {
  return rows[selectedIndex(resource, rows)] || rows[0] || null;
}

function isSystemWritable(row) {
  return row && WRITABLE_SYSTEM_KEYS.includes(String(row.key ?? '').trim());
}

function isEditable(resource, field, row) {
  if (['step_id', 'page_id', 'id', 'option_id', 'flow_id', 'visual_id', 'setting', 'plan_id', 'key'].includes(field)) return false;
  if (resource === 'MedicalPlans' && field === 'premium_sheet') return false;
  if (resource === 'SystemSettings') return isSystemWritable(row) && field === 'value';
  if (resource === 'Visualization') return field === 'value';
  return true;
}

function isBooleanField(field) {
  return ['enabled', 'visible'].includes(field);
}

function isNumberField(resource, field, row) {
  return ['deductible', 'sort_order'].includes(field)
    || (resource === 'Visualization' && String(row?.setting || '').toLowerCase().includes('interval'))
    || (resource === 'SystemSettings' && String(row?.key || '') === 'checkpoint_interval');
}

function typedValue(resource, field, input, row) {
  if (isBooleanField(field)) return Boolean(input.checked);
  if (isNumberField(resource, field, row)) return input.value === '' ? '' : Number(input.value);
  return input.value;
}

function stableDescription(resource, row) {
  const key = officialRecordKey(resource, row);
  return key || '未有穩定身份';
}

function renderEditorField(resource, row, field, rowIndex) {
  const editable = isEditable(resource, field, row);
  const label = FIELD_LABELS[field] || field;
  const value = row?.[field] ?? '';
  const inputId = `admin-${resource}-${rowIndex}-${field}`;
  const common = `id="${escapeHtml(inputId)}" data-admin-field="${escapeHtml(field)}" data-admin-row="${rowIndex}" ${editable ? '' : 'readonly'}`;

  if (isBooleanField(field)) {
    return `<label class="admin-field admin-check"><span>${escapeHtml(label)}</span><input type="checkbox" ${common.replace('readonly', editable ? '' : 'disabled')} ${value === true || value === 'true' || value === 1 || value === '1' ? 'checked' : ''}></label>`;
  }

  const type = isNumberField(resource, field, row) ? 'number' : (field === 'subtitle' || field === 'description' || field === 'value' && String(row?.setting || '').includes('text') ? 'text' : 'text');
  const control = field === 'subtitle' || field === 'description'
    ? `<textarea class="textarea" ${common}>${escapeHtml(value)}</textarea>`
    : `<input class="input" type="${type}" ${common} value="${escapeHtml(value)}">`;
  return `<label class="admin-field"><span>${escapeHtml(label)}</span>${control}${editable ? '' : '<small class="caption">只讀欄位</small>'}</label>`;
}

function renderPanel(resource) {
  const rows = rowsFor(resource);
  if (!rows.length) {
    return `<section id="admin-panel-${resource}" class="admin-panel" role="tabpanel" aria-labelledby="admin-tab-${resource}"><div class="card"><h2 class="section-title">${escapeHtml(RESOURCE_LABELS[resource])}</h2><p class="support">Official Read 沒有回傳可管理記錄；不會由前端自行新增欄位或記錄。</p></div></section>`;
  }

  const index = selectedIndex(resource, rows);
  const row = rows[index];
  const fields = fieldsFor(resource, rows);
  const options = rows.map((item, itemIndex) => `<option value="${escapeHtml(officialRecordKey(resource, item))}" ${itemIndex === index ? 'selected' : ''}>${escapeHtml(officialRecordKey(resource, item))}</option>`).join('');
  const status = state.messages[resource] || '未有未儲存變更。';
  const disabledNote = resource === 'SystemSettings' ? '只有明確 allowlist 內的設定可寫入；data_version、資料來源及研究／回報設定保持只讀。' : '穩定身份及資料來源欄位保持只讀，未知欄位會隨官方資料保留。';

  return `<section id="admin-panel-${resource}" class="admin-panel" role="tabpanel" aria-labelledby="admin-tab-${resource}">
    <div class="admin-panel-head">
      <div><p class="caption">Official Data Domain</p><h2 class="section-title">${escapeHtml(RESOURCE_LABELS[resource])}</h2><p class="support">${escapeHtml(disabledNote)}</p></div>
      <button class="button primary" type="button" data-admin-save="${escapeHtml(resource)}" ${state.messages[resource] === '正在同步…' ? 'disabled' : ''}>儲存至 Official</button>
    </div>
    <div class="admin-record-bar">
      <label class="admin-selector"><span>選擇記錄</span><select class="select" data-admin-record="${escapeHtml(resource)}">${options}</select></label>
      <div class="admin-identity"><span>穩定身份</span><code>${escapeHtml(stableDescription(resource, row))}</code></div>
    </div>
    <div class="admin-form-grid">${fields.map(field => renderEditorField(resource, row, field, index)).join('')}</div>
    <p class="status ${state.messages[resource]?.startsWith('同步失敗') || state.messages[resource]?.startsWith('未同步') ? 'error' : 'success'}" role="status">${escapeHtml(status)}</p>
  </section>`;
}

function shell(content) {
  return `<div class="shell">
    <header class="header">
      <div class="header-identity"><a class="brand" href="./" aria-label="AVA Medical Reserve Admin"><img class="brand-mark" src="icon.svg" alt=""><span>AVA MEDICAL RESERVE · Admin · v${escapeHtml(APP_VERSION)}</span></a><span class="journey-title">Official Default 管理</span></div>
      <div class="header-actions"><a class="button secondary return-ava" href="${RETURN_TO_AVA}">← 返回 AVA</a></div>
    </header>
    <main class="container admin-container">${content}</main>
  </div>`;
}

function render() {
  const app = document.getElementById('app');
  if (state.status === 'authorizing') {
    app.innerHTML = shell('<section class="card"><h1 class="title">Medical Reserve Admin</h1><p class="support">正在驗證 AVA Studio browser-bound Admin 授權…</p></section>');
    return;
  }
  if (state.status === 'error') {
    app.innerHTML = shell(`<section class="card"><h1 class="title">Admin 存取未獲授權</h1><p class="warning">${escapeHtml(state.error || '授權無效或已過期。Official Read/Write 已鎖定。')}</p><a class="button secondary" href="${RETURN_TO_AVA}">返回 AVA</a></section>`);
    return;
  }

  const health = state.health?.data || state.health || {};
  const active = state.activeResource;
  const tabs = ADMIN_RESOURCES.map(resource => `<button id="admin-tab-${resource}" class="admin-tab" type="button" role="tab" aria-selected="${resource === active}" aria-controls="admin-panel-${resource}" data-admin-tab="${resource}" tabindex="${resource === active ? '0' : '-1'}">${escapeHtml(RESOURCE_LABELS[resource])}</button>`).join('');
  const panels = ADMIN_RESOURCES.map(resource => {
    const panel = renderPanel(resource);
    return resource === active ? panel : panel.replace(' class="admin-panel"', ' class="admin-panel" hidden');
  }).join('');

  const overall = state.view === 'ready' ? 'Official Read 已完成；草稿與 Official Data 分離。' : '正在讀取 Official Data…';
  const healthText = health.status === 'ok' ? 'Official sources 狀態正常。' : 'Official sources 有警告；請先核對資料狀態。';

  app.innerHTML = shell(`<div class="hero"><p class="caption">AVA Studio · ${APP_ID}</p><h1 class="title">Medical Reserve Official Default</h1><p class="support">${escapeHtml(overall)} ${escapeHtml(healthText)}</p><div class="status-line"><span class="status-chip ${health.status === 'ok' ? 'ok' : 'bad'}">data version ${escapeHtml(health.data_version ?? '—')}</span><span class="status-chip">Admin session expires: ${escapeHtml(state.expiresAt || '—')}</span></div></div>
    <div class="admin-tabs" role="tablist" aria-label="Medical Reserve Admin domains">${tabs}</div>
    <div class="admin-panels">${panels}</div>
    <details class="admin-system-info"><summary>系統資訊</summary><dl><div><dt>App</dt><dd>${escapeHtml(APP_ID)}</dd></div><div><dt>前端版本</dt><dd>${escapeHtml(APP_VERSION)}</dd></div><div><dt>Official API</dt><dd>browser-bound ${escapeHtml(ADMIN_SESSION_CONTRACT)}</dd></div><div><dt>Official Read</dt><dd>${escapeHtml(READ_OPERATION)}</dd></div><div><dt>來源</dt><dd>App-owned Google Sheets · 不顯示 credentials / tokens</dd></div></dl></details>`);
  bind();
}

function showMessage(resource, message) {
  state.messages[resource] = message;
  render();
}

function draftRows(resource) {
  const rows = rowsFor(resource).map(row => ({ ...row }));
  return resource === 'SystemSettings'
    ? rows.filter(row => WRITABLE_SYSTEM_KEYS.includes(String(row.key ?? '').trim()))
    : rows;
}

function readBackMatches(requested, readBack) {
  if (!Array.isArray(readBack) || readBack.length !== requested.length) return false;
  const keys = new Set(requested.flatMap(row => Object.keys(row || {})));
  return requested.every((row, index) => keys.size > 0 && [...keys].every(key => String(readBack[index]?.[key] ?? '') === String(row?.[key] ?? '')));
}

async function save(resource) {
  const rows = draftRows(resource);
  const validation = validateAdminRows(resource, rows, {
    requiredFlowIds: ['protection_importance', 'premium_budget_awareness', 'premium_need_setup', 'premium_need_result', 'funding_source', 'reserve_intro', 'reserve_setup', 'reserve_result', 'summary'],
    writableSystemKeys: WRITABLE_SYSTEM_KEYS
  });
  if (!validation.ok) {
    showMessage(resource, `未同步：${validation.errors.join('；')}`);
    return;
  }

  state.messages[resource] = '正在同步…';
  render();
  try {
    const expectedVersion = Number(state.health?.data_version ?? state.health?.data?.data_version);
    const operation = `medicalreserve:official-write:${resource}`;
    const result = await jsonRequest({ action: 'writeOfficial', appId: APP_ID, adminSessionProof: state.adminSessionProof, operation, expectedVersion, resource, rows });
    if (result.appId !== APP_ID || result.contract !== ADMIN_SESSION_CONTRACT || result.resource !== resource || result.version == null || result.persisted !== true || result.readAfterWrite !== true || result.synchronized !== true || !readBackMatches(rows, result.readBack)) {
      throw new Error('Official Write 缺少完整 read-after-write persistence evidence');
    }
    state.confirmedConfig[resource] = clone(result.readBack);
    delete state.drafts[resource];
    state.dirty[resource] = false;
    state.health.data_version = result.version;
    state.messages[resource] = `已確認寫入 Official · data version ${result.version}`;
    state.view = 'ready';
    render();
  } catch (error) {
    // Keep the draft and confirmed Official cache separate after every failure.
    state.messages[resource] = `同步失敗：${error.message}`;
    render();
  }
}

function updateDraft(input) {
  const resource = input.dataset.adminResource;
  const rows = rowsFor(resource);
  const rowIndex = Number(input.dataset.adminRow);
  if (!resource || !rows[rowIndex]) return;
  const row = { ...rows[rowIndex] };
  row[input.dataset.adminField] = typedValue(resource, input.dataset.adminField, input, row);
  const draft = state.drafts[resource] ? state.drafts[resource].map(item => ({ ...item })) : rows.map(item => ({ ...item }));
  draft[rowIndex] = row;
  state.drafts[resource] = draft;
  state.dirty[resource] = true;
  const status = document.querySelector(`#admin-panel-${resource} .status`);
  if (status) { status.textContent = '有未儲存變更；Official cache 尚未更新。'; status.className = 'status'; }
}

function confirmSwitch(resource) {
  if (!state.dirty[resource]) return true;
  return window.confirm('目前有未儲存變更。按「確定」保留草稿並切換；按「取消」留在目前頁面。');
}

function selectTab(resource) {
  if (!confirmSwitch(state.activeResource)) return;
  state.activeResource = resource;
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function selectRecord(resource, key) {
  if (!confirmSwitch(resource)) return;
  state.selectedRecord[resource] = key;
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function bind() {
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.adminTab)));
  document.querySelectorAll('[data-admin-record]').forEach(select => select.addEventListener('change', event => selectRecord(select.dataset.adminRecord, event.target.value)));
  document.querySelectorAll('[data-admin-save]').forEach(button => button.addEventListener('click', () => save(button.dataset.adminSave)));
  document.querySelectorAll('[data-admin-field]').forEach(input => {
    input.dataset.adminResource = state.activeResource;
    input.addEventListener('input', () => updateDraft(input));
    input.addEventListener('change', () => updateDraft(input));
  });
  const tabs = [...document.querySelectorAll('[data-admin-tab]')];
  tabs.forEach((button, index) => button.addEventListener('keydown', event => {
    const move = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : event.key === 'Home' ? -index : event.key === 'End' ? tabs.length - 1 - index : 0;
    if (!move) return;
    event.preventDefault();
    const next = tabs[(index + move + tabs.length) % tabs.length];
    selectTab(next.dataset.adminTab);
    document.getElementById(`admin-tab-${next.dataset.adminTab}`)?.focus();
  });
}

window.addEventListener('beforeunload', event => {
  if (Object.values(state.dirty).some(Boolean)) {
    event.preventDefault();
    event.returnValue = '';
  }
});

async function start() {
  render();
  try {
    const params = new URLSearchParams(location.search);
    const ticket = params.get('avaAdminLaunch');
    const launchNonce = params.get('avaAdminLaunchNonce');
    if (!ticket || !launchNonce || !window.opener) throw new Error('缺少 AVA Studio browser launch；直接複製 Admin URL 不會獲得授權');

    const openerOrigin = 'https://ivancww.github.io';
    const browser = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('AVA Admin browser binding expired')), 10000);
      const onMessage = event => {
        const data = event.data || {};
        if (event.source !== window.opener || event.origin !== openerOrigin || data.type !== 'ava-admin-session-response' || data.appId !== APP_ID || data.launchTicket !== ticket || data.launchNonce !== launchNonce || !data.browserProof) return;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(data);
      };
      window.addEventListener('message', onMessage);
      window.opener.postMessage({ type: 'ava-admin-session-request', appId: APP_ID, launchTicket: ticket, launchNonce }, openerOrigin);
    });

    const exchange = await jsonRequest({ action: 'exchangeAdminSession', appId: APP_ID, launchTicket: ticket, launchNonce, browserProof: browser.browserProof });
    if (exchange.success !== true || exchange.appId !== APP_ID || exchange.adminSessionProof == null || exchange.contract !== ADMIN_SESSION_CONTRACT || !exchange.expiresAt || Date.parse(exchange.expiresAt) <= Date.now()) throw new Error('AVA Admin session exchange failed');
    state.adminSessionProof = exchange.adminSessionProof;
    state.expiresAt = exchange.expiresAt;

    const official = await jsonRequest({ action: 'readOfficial', appId: APP_ID, adminSessionProof: state.adminSessionProof, operation: READ_OPERATION });
    if (official.success !== true || official.appId !== APP_ID || official.contract !== ADMIN_SESSION_CONTRACT || official.officialRead !== true || !official.data) throw new Error('Official Read authorization or payload invalid');
    state.confirmedConfig = clone(official.data);
    state.health = official.health || { data_version: official.data_version };
    state.health.data_version = official.data_version ?? state.health.data_version;
    state.status = 'ready';
    state.view = 'ready';
    render();
  } catch (error) {
    state.status = 'error';
    state.error = error.message;
    render();
  }
}

start();
