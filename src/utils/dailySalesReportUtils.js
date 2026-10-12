import { toInputDate } from './dateUtils';

export const DAILY_SALES_QUICK_FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last-week', label: 'Last Week' },
  { id: 'current-month', label: 'Current Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'this-year', label: 'This Year' },
  { id: 'last-year', label: 'Last Year' }
];

const atLocalMidnight = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const addDays = (value, days) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);

export const getDailySalesDateRange = (preset = 'yesterday', referenceDate = new Date()) => {
  const today = atLocalMidnight(referenceDate);

  if (preset === 'today') {
    const date = toInputDate(today);
    return { fromDate: date, toDate: date };
  }

  if (preset === 'last-week') {
    const currentWeekMondayOffset = (today.getDay() + 6) % 7;
    const currentWeekMonday = addDays(today, -currentWeekMondayOffset);
    return {
      fromDate: toInputDate(addDays(currentWeekMonday, -7)),
      toDate: toInputDate(addDays(currentWeekMonday, -1))
    };
  }

  if (preset === 'current-month') {
    return {
      fromDate: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      toDate: toInputDate(today)
    };
  }

  if (preset === 'last-month') {
    return {
      fromDate: toInputDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      toDate: toInputDate(new Date(today.getFullYear(), today.getMonth(), 0))
    };
  }

  if (preset === 'this-year') {
    return {
      fromDate: toInputDate(new Date(today.getFullYear(), 0, 1)),
      toDate: toInputDate(today)
    };
  }

  if (preset === 'last-year') {
    return {
      fromDate: toInputDate(new Date(today.getFullYear() - 1, 0, 1)),
      toDate: toInputDate(new Date(today.getFullYear() - 1, 11, 31))
    };
  }

  const yesterday = addDays(today, -1);
  const date = toInputDate(yesterday);
  return { fromDate: date, toDate: date };
};

export const formatDailySalesDateRange = ({ fromDate, toDate }) => {
  const format = (value) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return fromDate === toDate ? format(fromDate) : `${format(fromDate)} - ${format(toDate)}`;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const salesAmount = (payment) => {
  const values = [payment?.splitSaleAmount, payment?.amount, payment?.saleAmount];
  for (const value of values) {
    const number = toNumber(value);
    if (number !== null) return number;
  }
  return 0;
};

const leadAmount = (lead) => {
  const count = toNumber(lead?.leadCount);
  if (count !== null) return count;
  if (Array.isArray(lead?.leads)) return lead.leads.length;
  return 0;
};

const fullName = (record) =>
  [record?.firstName, record?.lastName]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');

const displayName = (...records) => {
  for (const record of records) {
    const name = fullName(record);
    if (name) return name;

    const fallback = record?.entUserName ?? record?.userName ?? record?.username ?? record?.displayName;
    if (String(fallback || '').trim()) return String(fallback).trim();
  }
  return '';
};

const recordKey = (record) => {
  const id = Number(record?.userId ?? record?.id ?? 0);
  if (id > 0) return `user:${id}`;

  const name = displayName(record).toLowerCase().replace(/\s+/g, '-');
  const locationId = Number(record?.locationId ?? 0);
  return `unknown:${name || 'user'}:${locationId}`;
};

export const buildDailySalesRows = ({ userSalePayments = [], userLeads = [] }, users = [], locations = []) => {
  const userLookup = new Map(users.map((user) => [Number(user?.userId ?? user?.id ?? 0), user]).filter(([id]) => id > 0));
  const locationLookup = new Map(
    locations
      .map((location) => [Number(location?.locationId ?? location?.id ?? 0), String(location?.name ?? location?.locationName ?? '').trim()])
      .filter(([id]) => id > 0)
  );
  const rows = new Map();

  const ensureRow = (record) => {
    const key = recordKey(record);
    if (!rows.has(key)) {
      const userId = Number(record?.userId ?? record?.id ?? 0);
      rows.set(key, {
        key,
        userId,
        salesAmount: 0,
        leads: 0,
        salesClosed: 0,
        sourceRecords: []
      });
    }
    const row = rows.get(key);
    row.sourceRecords.push(record);
    return row;
  };

  userSalePayments.forEach((payment) => {
    const row = ensureRow(payment);
    row.salesAmount += salesAmount(payment);
    row.salesClosed += 1;
  });

  userLeads.forEach((lead) => {
    const row = ensureRow(lead);
    row.leads += leadAmount(lead);
  });

  return Array.from(rows.values())
    .map((row) => {
      const user = userLookup.get(row.userId);
      const locationRecord = row.sourceRecords.find((record) => Number(record?.locationId ?? 0) > 0);
      const locationNameRecord = row.sourceRecords.find((record) => String(record?.locationName || '').trim());
      const locationId = Number(locationRecord?.locationId ?? user?.locationId ?? 0);
      const userName = displayName(...row.sourceRecords, user) || (row.userId > 0 ? `User ${row.userId}` : 'Unknown User');
      const locationName =
        String(locationNameRecord?.locationName || '').trim() ||
        String(user?.locationName || '').trim() ||
        locationLookup.get(locationId) ||
        'Unassigned';
      const revenuePerLead = row.leads > 0 ? row.salesAmount / row.leads : 0;
      const conversionRate = row.leads > 0 ? (row.salesClosed / row.leads) * 100 : 0;

      return {
        key: row.key,
        userId: row.userId,
        userName,
        locationId,
        locationName,
        salesAmount: row.salesAmount,
        leads: row.leads,
        salesClosed: row.salesClosed,
        revenuePerLead,
        conversionRate
      };
    })
    .filter((row) => row.salesAmount !== 0 || row.leads > 0 || row.salesClosed > 0);
};

export const filterDailySalesRows = (rows, { locationId = '', search = '' } = {}) => {
  const locationFilter = String(locationId || '');
  const term = String(search || '')
    .trim()
    .toLowerCase();

  return rows.filter((row) => {
    if (locationFilter && String(row.locationId) !== locationFilter) return false;
    if (!term) return true;

    return [row.userName, row.locationName, row.salesAmount, row.leads].some((value) =>
      String(value ?? '')
        .toLowerCase()
        .includes(term)
    );
  });
};

export const sortDailySalesRows = (rows, sort = { key: 'salesAmount', direction: 'desc' }) => {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = left?.[sort.key];
    const rightValue = right?.[sort.key];
    if (typeof leftValue === 'number' || typeof rightValue === 'number') {
      return ((Number(leftValue) || 0) - (Number(rightValue) || 0)) * direction;
    }
    return String(leftValue || '').localeCompare(String(rightValue || '')) * direction;
  });
};

export const calculateDailySalesSummary = (rows) => {
  const summary = rows.reduce(
    (totals, row) => ({
      totalSales: totals.totalSales + row.salesAmount,
      totalLeads: totals.totalLeads + row.leads,
      salesClosed: totals.salesClosed + row.salesClosed,
      activeSalesAgents: totals.activeSalesAgents + 1
    }),
    { totalSales: 0, totalLeads: 0, salesClosed: 0, activeSalesAgents: 0 }
  );

  return {
    ...summary,
    revenuePerLead: summary.totalLeads > 0 ? summary.totalSales / summary.totalLeads : 0,
    conversionRate: summary.totalLeads > 0 ? (summary.salesClosed / summary.totalLeads) * 100 : 0
  };
};

export const groupDailySalesByLocation = (rows) => {
  const groups = new Map();

  rows.forEach((row) => {
    const key = row.locationId > 0 ? `location:${row.locationId}` : 'location:unassigned';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        locationId: row.locationId,
        locationName: row.locationName || 'Unassigned',
        agents: []
      });
    }
    groups.get(key).agents.push(row);
  });

  return Array.from(groups.values())
    .map((group) => ({ ...group, ...calculateDailySalesSummary(group.agents) }))
    .sort((left, right) => right.totalSales - left.totalSales || left.locationName.localeCompare(right.locationName));
};

export const formatDailySalesCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

export const formatDailySalesPercentage = (value) => `${(Number(value) || 0).toFixed(1)}%`;

const csvValue = (value) => {
  let safeValue = String(value ?? '');
  if (/^[=+\-@]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replaceAll('"', '""')}"`;
};

export const buildDailySalesCsv = (rows) => {
  const columns = [
    ['userName', 'User Name'],
    ['locationName', 'Location'],
    ['salesAmount', 'Sales Amount'],
    ['leads', 'Leads'],
    ['salesClosed', 'Sales Closed'],
    ['revenuePerLead', 'Revenue Per Lead'],
    ['conversionRate', 'Conversion Rate']
  ];

  return [
    columns.map(([, label]) => csvValue(label)).join(','),
    ...rows.map((row) =>
      columns
        .map(([key]) => {
          if (key === 'salesAmount' || key === 'revenuePerLead') return csvValue((Number(row[key]) || 0).toFixed(2));
          if (key === 'conversionRate') return csvValue((Number(row[key]) || 0).toFixed(1));
          return csvValue(row[key]);
        })
        .join(',')
    )
  ].join('\r\n');
};
