export const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  const commonKeys = ['items', 'rows', 'tickets', 'records', 'users', 'groups', 'series', 'data', 'result'];
  for (const key of commonKeys) {
    if (Array.isArray(value[key])) return value[key];
    if (value[key] && typeof value[key] === 'object') {
      const nested = asArray(value[key]);
      if (nested.length) return nested;
    }
  }
  return [];
};

export const textValue = (item, keys, fallback = '-') => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return fallback;
};

export const numberValue = (item, keys, fallback = 0) => {
  for (const key of keys) {
    const value = Number(item?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
};

export const findNumber = (value, keys, fallback = 0) => {
  if (!value || typeof value !== 'object') return fallback;
  const wanted = keys.map((key) => key.toLowerCase());
  for (const [key, entry] of Object.entries(value)) {
    if (wanted.includes(key.toLowerCase()) && Number.isFinite(Number(entry))) return Number(entry);
  }
  for (const entry of Object.values(value)) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const found = findNumber(entry, keys, Number.NaN);
      if (Number.isFinite(found)) return found;
    }
  }
  return fallback;
};

export const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
