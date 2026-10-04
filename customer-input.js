export function formatMoneyInput(value) {
  if (value == null || value === '') return '';
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
}

export function parseMoneyInput(value) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : null;
}

export function validateSupportAgeRange({ start, end, minimum, maximum }) {
  if (!Number.isInteger(start) || start < minimum || start > maximum) {
    return { ok: false, message: `預計開始年歲必須是 ${minimum}–${maximum} 歲的整數。` };
  }
  if (!Number.isInteger(end) || end < minimum || end > maximum) {
    return { ok: false, message: `預計終結年歲必須是 ${minimum}–${maximum} 歲的整數。` };
  }
  if (end < start) return { ok: false, message: '預計終結年歲不可早於預計開始年歲。' };
  return { ok: true, message: '' };
}
