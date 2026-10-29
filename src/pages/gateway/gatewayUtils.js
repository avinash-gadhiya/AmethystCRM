export const PAGE_SIZES = [10, 25, 50];
export const GATEWAY_TYPES = [
  { value: 0, label: 'Unknown' },
  { value: 1, label: 'Authorize.Net' },
  { value: 2, label: 'NMI' },
  { value: 3, label: 'Nuvei' }
];
export const STATUS_OPTIONS = [
  [0, 'Unknown'],
  [1, 'Pending'],
  [2, 'Authorized'],
  [3, 'Settled'],
  [4, 'Declined'],
  [5, 'Voided'],
  [6, 'Refunded'],
  [7, 'Chargeback'],
  [8, 'Error']
];

export const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

export const formatMoney = (value, currency = 'USD') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  try {
    return amount.toLocaleString(undefined, { style: 'currency', currency: currency || 'USD' });
  } catch {
    return `${amount.toLocaleString()} ${currency || ''}`.trim();
  }
};

export const statusVariant = (status) => {
  const value = String(status || '').toLowerCase();
  if (/(settle|success|capture|paid|complete)/.test(value)) return 'success';
  if (/(pending|author|running|process)/.test(value)) return 'warning';
  if (/(declin|fail|error|charge)/.test(value)) return 'danger';
  if (/(refund|void|cancel)/.test(value)) return 'info';
  return 'secondary';
};

export const getGatewayType = (value) => GATEWAY_TYPES.find((item) => item.value === Number(value))?.label || `Type ${value}`;
export const getNormalizedStatus = (row) =>
  row?.transactionStatus || STATUS_OPTIONS.find(([value]) => value === Number(row?.normalizedStatus))?.[1] || 'Unknown';

export const getGatewaySummary = (section, rows, total) => {
  const count = (predicate) => rows.filter(predicate).length;
  const sum = (key) => rows.reduce((result, row) => result + (Number(row[key]) || 0), 0);
  const summaries = {
    gateways: [
      { label: 'Gateways', value: total, icon: 'server' },
      { label: 'Active on page', value: count((row) => row.isActive), icon: 'check' },
      { label: 'Credentials on page', value: count((row) => row.hasCredentials), icon: 'shield' },
      { label: 'Sandbox on page', value: count((row) => row.isSandbox), icon: 'sandbox' }
    ],
    paymentTypes: [
      { label: 'Payment mappings', value: total, icon: 'link' },
      { label: 'Active on page', value: count((row) => row.isActive !== false), icon: 'check' },
      { label: 'Inactive on page', value: count((row) => row.isActive === false), icon: 'pause' },
      {
        label: 'Gateways on page',
        value: new Set(rows.map((row) => row.gatewayId).filter((id) => id !== undefined && id !== null)).size,
        icon: 'server'
      }
    ],
    transactions: [
      { label: 'Transactions', value: total, icon: 'card' },
      { label: 'Completed on page', value: count((row) => statusVariant(getNormalizedStatus(row)) === 'success'), icon: 'check' },
      { label: 'Pending on page', value: count((row) => statusVariant(getNormalizedStatus(row)) === 'warning'), icon: 'clock' },
      { label: 'Issues on page', value: count((row) => statusVariant(getNormalizedStatus(row)) === 'danger'), icon: 'alert' }
    ],
    syncLogs: [
      { label: 'Sync runs', value: total, icon: 'history' },
      { label: 'Fetched on page', value: sum('fetchedCount'), icon: 'card' },
      { label: 'Inserted on page', value: sum('insertedCount'), icon: 'plus' },
      { label: 'Updated on page', value: sum('updatedCount'), icon: 'refresh' }
    ]
  };
  return summaries[section] || summaries.gateways;
};
