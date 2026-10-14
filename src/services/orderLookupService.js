import apiClient from './core/apiClient';

const SETTING_KEY_ALIASES = {
  Card_Type: ['Card_Type', 'card_type', 'CardType', 'card_types'],
  DiscountType: ['DiscountType', 'discount_type', 'discount_types'],
  SaleTypes: ['SaleTypes', 'sale_types', 'SaleType'],
  sales_share_type: ['sales_share_type', 'SalesShareType', 'sales_share_types']
};

const normalizeKey = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const pick = (source, ...keys) => {
  if (!source || typeof source !== 'object') return undefined;

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }

  const entries = Object.entries(source);
  for (const key of keys) {
    const normalized = normalizeKey(key);
    const match = entries.find(([entryKey]) => normalizeKey(entryKey) === normalized);
    if (match && match[1] !== undefined && match[1] !== null) return match[1];
  }

  return undefined;
};

const unwrapRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidates = [
    payload.data?.data,
    payload.data?.items,
    payload.data?.records,
    payload.data?.results,
    payload.data?.options,
    payload.data,
    payload.items,
    payload.records,
    payload.results,
    payload.options,
    payload.values
  ];

  return candidates.find(Array.isArray) || [];
};

const isEnabled = (row) => {
  const active = pick(row, 'isActive', 'active', 'enabled', 'status');
  const deleted = pick(row, 'isDeleted', 'deleted');
  const normalizedActive = String(active ?? 'true').trim().toLowerCase();
  const normalizedDeleted = String(deleted ?? 'false').trim().toLowerCase();

  return !['false', '0', 'inactive', 'disabled'].includes(normalizedActive)
    && !['true', '1'].includes(normalizedDeleted);
};

export const normalizeOrderSettingOptions = (payload) => {
  const seen = new Set();

  return unwrapRows(payload)
    .map((row, index) => {
      if (row === null || row === undefined) return null;

      if (typeof row !== 'object') {
        const name = String(row).trim();
        return name ? { id: name, name } : null;
      }

      if (!isEnabled(row)) return null;

      const rawId = pick(row, 'settingValueId', 'id', 'valueId', 'key', 'value');
      const rawName = pick(row, 'settingValueText', 'label', 'name', 'text', 'title', 'displayName');
      const fallbackName = typeof rawId === 'string' && !/^\d+$/.test(rawId.trim()) ? rawId : '';
      const name = String(rawName ?? fallbackName).trim();
      if (!name) return null;

      const numericId = Number(rawId);
      const id = Number.isFinite(numericId) && numericId > 0
        ? numericId
        : String(rawId ?? `${normalizeKey(name)}-${index}`);

      return { id, name };
    })
    .filter(Boolean)
    .filter((option) => {
      const key = normalizeKey(option.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const findOptionsInSettings = (payload, requestedKeys) => {
  const requested = new Set(requestedKeys.map(normalizeKey));
  const setting = unwrapRows(payload).find((row) => {
    const key = pick(row, 'settingKey', 'key', 'settingName', 'name');
    return requested.has(normalizeKey(key));
  });

  if (!setting) return [];
  const values = pick(setting, 'settingValueDTOs', 'settingValues', 'values', 'options');
  return normalizeOrderSettingOptions(Array.isArray(values) ? values : []);
};

const getSettingOptions = async (settingKey, signal) => {
  const keys = [...new Set(SETTING_KEY_ALIASES[settingKey] || [settingKey])];
  let lastError = null;

  for (const key of keys) {
    try {
      const response = await apiClient.get(
        '/SettingValue/SettingValueDropDown',
        { settingKey: key },
        signal
      );
      const options = normalizeOrderSettingOptions(response);
      if (options.length > 0) return { data: options, settingKey: key };
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const settings = await apiClient.get(
      '/Setting',
      {
        Text: '',
        PageNumber: 1,
        PageSize: 1000,
        SortProperty: 'settingId',
        IsDescending: false
      },
      signal
    );
    const options = findOptionsInSettings(settings, keys);
    if (options.length > 0) return { data: options, settingKey };
  } catch (error) {
    lastError = lastError || error;
  }

  if (lastError) throw lastError;
  return { data: [], settingKey };
};

const orderLookupService = {
  getSettingOptions,
  getCardTypes: (signal) => getSettingOptions('Card_Type', signal),
  getDiscountTypes: (signal) => getSettingOptions('DiscountType', signal),
  getSaleTypes: (signal) => getSettingOptions('SaleTypes', signal),
  getSalesShareTypes: (signal) => getSettingOptions('sales_share_type', signal)
};

export default orderLookupService;
