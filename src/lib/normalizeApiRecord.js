const booleanFields = new Set([
  'isVoid', 'isDeleted', 'isChargeBack', 'isRetrieval', 'isAlert', 'isChequeCleared', 'isFulfilled', 'isActive'
]);

export const normalizeApiRecord = (value) => {
  if (Array.isArray(value)) return value.map(normalizeApiRecord);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const name = key.charAt(0).toLowerCase() + key.slice(1);
    if (booleanFields.has(name)) {
      const flag = String(item).trim().toLowerCase();
      if (flag === 'true' || flag === '1') return [name, true];
      if (flag === 'false' || flag === '0') return [name, false];
    }
    return [name, normalizeApiRecord(item)];
  }));
};
