// Helpers for turning arbitrary CRM API payloads into table rows, columns and readable values.

const LIST_KEYS = ['data', 'Data', 'items', 'Items', 'results', 'Results', 'rows', 'Rows', 'list', 'List', 'users', 'leads', 'report', 'result', 'Result'];
const TOTAL_KEYS = ['totalCount', 'TotalCount', 'totalRecords', 'TotalRecords', 'total', 'Total', 'count', 'Count'];
const ENVELOPE_KEYS = new Set(['success', 'Success', 'message', 'Message', 'statusCode', 'StatusCode', 'status', 'errors', 'Errors']);
const DATE_KEY = /(date|time|on$|at$)/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const HIDDEN_COLUMN = /(password|token|secret|hash)/i;
const MAX_COLUMNS = 12;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const readTotal = (...sources) => {
  for (const source of sources) {
    for (const key of TOTAL_KEYS) {
      const value = Number(source?.[key]);
      if (Number.isFinite(value) && value >= 0 && source?.[key] !== '' && source?.[key] !== null) return value;
    }
  }
  return undefined;
};

/**
 * Finds the list of records inside a payload, plus its total count.
 * Non-list payloads come back as `summary` so the UI can render them as key/value details.
 */
export const unwrapApiPayload = (payload) => {
  if (Array.isArray(payload)) return { rows: payload, totalCount: payload.length, summary: null };
  if (!isPlainObject(payload)) return { rows: [], totalCount: 0, summary: payload ?? null };

  const visited = new Set();
  const findRows = (value, depth) => {
    if (Array.isArray(value)) return { rows: value, parent: null };
    if (!isPlainObject(value) || depth > 4 || visited.has(value)) return null;
    visited.add(value);
    for (const key of LIST_KEYS) {
      if (Array.isArray(value[key])) return { rows: value[key], parent: value };
    }
    for (const key of LIST_KEYS) {
      const found = findRows(value[key], depth + 1);
      if (found) return { rows: found.rows, parent: found.parent || value };
    }
    for (const nested of Object.values(value)) {
      if (Array.isArray(nested) && nested.some(isPlainObject)) return { rows: nested, parent: value };
    }
    return null;
  };

  const found = findRows(payload, 0);
  if (found) {
    const total = readTotal(found.parent, payload?.data, payload);
    return { rows: found.rows, totalCount: total ?? found.rows.length, summary: null };
  }

  const inner = payload.data ?? payload.Data ?? payload;
  const summary = isPlainObject(inner)
    ? Object.fromEntries(Object.entries(inner).filter(([key]) => inner !== payload || !ENVELOPE_KEYS.has(key)))
    : inner;
  return { rows: [], totalCount: 0, summary };
};

export const humanizeKey = (key) =>
  String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\bid\b/gi, 'ID')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();

const looksLikeDate = (key, value) => typeof value === 'string' && ISO_DATE.test(value) && (DATE_KEY.test(key) || value.includes('T'));

export const formatApiValue = (value, key = '') => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (looksLikeDate(key, value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()) && date.getFullYear() > 1900) {
      return value.includes('T') ? date.toLocaleString() : date.toLocaleDateString();
    }
    return '—';
  }
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (isPlainObject(value)) {
    const label = value.name ?? value.Name ?? value.title ?? value.fullName ?? value.label;
    return label ? String(label) : `${Object.keys(value).length} fields`;
  }
  return String(value);
};

/** Builds column descriptors from the union of row keys, preferring scalar fields and capping the count. */
export const inferApiColumns = (rows) => {
  const stats = new Map();
  rows.slice(0, 50).forEach((row) => {
    if (!isPlainObject(row)) return;
    Object.entries(row).forEach(([key, value]) => {
      if (HIDDEN_COLUMN.test(key)) return;
      const entry = stats.get(key) || { key, filled: 0, complex: 0 };
      if (value !== null && value !== undefined && value !== '') entry.filled += 1;
      if (typeof value === 'object' && value !== null) entry.complex += 1;
      stats.set(key, entry);
    });
  });

  const all = [...stats.values()];
  const scalar = all.filter((item) => item.complex === 0 && item.filled > 0);
  const chosen = (scalar.length ? scalar : all).slice(0, MAX_COLUMNS);
  return { columns: chosen.map((item) => item.key), hiddenCount: Math.max(0, all.length - chosen.length) };
};

/** Searches every primitive field of a row; used for client-side filtering of the loaded page. */
export const rowMatches = (row, query) => {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (!isPlainObject(row)) return String(row).toLowerCase().includes(needle);
  return Object.values(row).some((value) => value !== null && typeof value !== 'object' && String(value).toLowerCase().includes(needle));
};

export const toCsv = (rows, columns) => {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.map(escape).join(','), ...rows.map((row) => columns.map((key) => escape(row?.[key])).join(','))].join('\n');
};
