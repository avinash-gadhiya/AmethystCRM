const DAY_MS = 86400000;

export const toYmd = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const currentMonthRange = () => {
  const today = new Date();
  return { fromDate: toYmd(new Date(today.getFullYear(), today.getMonth(), 1)), toDate: toYmd(today) };
};

export const getQuickDateRange = (filter) => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const value = String(filter || 'Current Month').toLowerCase();

  if (value === 'today') return { fromDate: toYmd(startOfToday), toDate: toYmd(startOfToday) };
  if (value === 'yesterday') {
    const yesterday = new Date(startOfToday.getTime() - DAY_MS);
    return { fromDate: toYmd(yesterday), toDate: toYmd(yesterday) };
  }
  if (value === 'last week') {
    const day = startOfToday.getDay() || 7;
    const thisMonday = new Date(startOfToday.getTime() - (day - 1) * DAY_MS);
    return {
      fromDate: toYmd(new Date(thisMonday.getTime() - 7 * DAY_MS)),
      toDate: toYmd(new Date(thisMonday.getTime() - DAY_MS))
    };
  }
  if (value === 'last month') {
    return {
      fromDate: toYmd(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      toDate: toYmd(new Date(today.getFullYear(), today.getMonth(), 0))
    };
  }
  if (value === 'this year' || value === 'current year') {
    return { fromDate: toYmd(new Date(today.getFullYear(), 0, 1)), toDate: toYmd(startOfToday) };
  }
  if (value === 'last year' || value === 'previous year') {
    return {
      fromDate: toYmd(new Date(today.getFullYear() - 1, 0, 1)),
      toDate: toYmd(new Date(today.getFullYear() - 1, 11, 31))
    };
  }
  return currentMonthRange();
};

export const valueOf = (item, ...keys) => {
  if (!item || typeof item !== 'object') return undefined;
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) return item[key];
    const pascalKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    if (item[pascalKey] !== undefined && item[pascalKey] !== null) return item[pascalKey];
  }
  return undefined;
};

export const safeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const positiveTarget = (value) => Math.max(0, safeNumber(value));
const normalizeKeyPart = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const identityFor = (item) => {
  const userId = valueOf(item, 'userId');
  if (userId !== undefined && userId !== null && String(userId).trim() !== '' && String(userId) !== '0') {
    return { key: `id:${userId}`, userId: String(userId) };
  }

  const fullName = [valueOf(item, 'firstName'), valueOf(item, 'lastName')]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  if (fullName) return { key: `name:${normalizeKeyPart(fullName)}`, userId: '' };

  const userName = valueOf(item, 'userName', 'entUserName', 'agentName');
  if (String(userName || '').trim()) return { key: `username:${normalizeKeyPart(userName)}`, userId: '' };
  return { key: 'unassigned', userId: '' };
};

const displayNameFor = (item, fallback = 'Unassigned') => {
  const fullName = [valueOf(item, 'firstName'), valueOf(item, 'lastName')]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  return fullName || String(valueOf(item, 'userName', 'entUserName', 'agentName', 'name') || '').trim() || fallback;
};

const normalizeLocation = (item) => ({
  id: String(valueOf(item, 'locationId', 'id') || ''),
  name: String(valueOf(item, 'locationName', 'name') || '').trim()
});

const getTargetToDate = (monthlyTarget, toDate) => {
  if (monthlyTarget <= 0) return 0;
  const requested = toDate ? new Date(`${toDate}T00:00:00`) : new Date();
  const today = new Date();
  const effective = Number.isNaN(requested.getTime()) || requested > today ? today : requested;
  const daysInMonth = new Date(effective.getFullYear(), effective.getMonth() + 1, 0).getDate();
  return (monthlyTarget / daysInMonth) * effective.getDate();
};

export const aggregatePerformance = ({ report = {}, users = [], locations = [], toDate = '' }) => {
  const locationMap = new Map(
    locations
      .map(normalizeLocation)
      .filter((item) => item.id)
      .map((item) => [item.id, item.name])
  );
  const userMap = new Map();

  users.forEach((user) => {
    const identity = identityFor(user);
    const locationId = String(valueOf(user, 'locationId') || '');
    userMap.set(identity.key, {
      userId: identity.userId,
      name: displayNameFor(user),
      locationId,
      location: String(valueOf(user, 'locationName', 'location') || locationMap.get(locationId) || 'Unassigned').trim(),
      salesTarget: positiveTarget(valueOf(user, 'salesTarget')),
      rplTarget: positiveTarget(valueOf(user, 'rplTarget'))
    });
  });

  const rows = new Map();
  const ensureRow = (item) => {
    const identity = identityFor(item);
    const userInfo = userMap.get(identity.key) || (identity.userId ? userMap.get(`id:${identity.userId}`) : null);
    if (!rows.has(identity.key)) {
      const locationId = String(valueOf(item, 'locationId') || userInfo?.locationId || '');
      rows.set(identity.key, {
        key: identity.key,
        userId: identity.userId,
        name: userInfo?.name || displayNameFor(item),
        locationId,
        location: String(valueOf(item, 'locationName', 'location') || userInfo?.location || locationMap.get(locationId) || 'Unassigned'),
        totalSales: 0,
        salesCount: 0,
        totalRefunds: 0,
        refundsCount: 0,
        totalLeads: 0,
        salesTarget: userInfo?.salesTarget || 0,
        rplTarget: userInfo?.rplTarget || 0
      });
    }

    const row = rows.get(identity.key);
    row.salesTarget = Math.max(row.salesTarget, positiveTarget(valueOf(item, 'salesTarget')));
    row.rplTarget = Math.max(row.rplTarget, positiveTarget(valueOf(item, 'rplTarget')));
    const itemLocationId = String(valueOf(item, 'locationId') || '');
    if (row.location === 'Unassigned' && itemLocationId) row.location = locationMap.get(itemLocationId) || row.location;
    const explicitLocation = String(valueOf(item, 'locationName', 'location') || '').trim();
    if (explicitLocation) row.location = explicitLocation;
    return row;
  };

  const sales = valueOf(report, 'userSalePayments') || [];
  const refunds = valueOf(report, 'userRefundPayments') || [];
  const leads = valueOf(report, 'userLeads') || [];

  (Array.isArray(sales) ? sales : []).forEach((item) => {
    const row = ensureRow(item);
    row.totalSales += safeNumber(valueOf(item, 'splitSaleAmount', 'amount', 'saleAmount'));
    row.salesCount += Math.max(1, safeNumber(valueOf(item, 'salesCount', 'count')));
  });
  (Array.isArray(refunds) ? refunds : []).forEach((item) => {
    const row = ensureRow(item);
    row.totalRefunds += safeNumber(valueOf(item, 'splitRefundAmount', 'refundAmount', 'amount'));
    row.refundsCount += Math.max(1, safeNumber(valueOf(item, 'refundsCount', 'count')));
  });
  (Array.isArray(leads) ? leads : []).forEach((item) => {
    const row = ensureRow(item);
    row.totalLeads += Math.max(1, safeNumber(valueOf(item, 'leadCount', 'totalLeads', 'leads', 'count')));
  });

  const prepared = Array.from(rows.values()).map((row) => {
    const netRevenue = row.totalSales - row.totalRefunds;
    const revenuePerLead = row.totalLeads > 0 ? netRevenue / row.totalLeads : 0;
    const conversionRate = row.totalLeads > 0 ? (row.salesCount / row.totalLeads) * 100 : 0;
    const targetToDate = getTargetToDate(row.salesTarget, toDate);
    const targetAchievement = targetToDate > 0 ? (row.totalSales / targetToDate) * 100 : 0;
    const rplAchievement = row.rplTarget > 0 ? (revenuePerLead / row.rplTarget) * 100 : 0;
    const existingAchievements = [targetToDate > 0 ? targetAchievement : null, row.rplTarget > 0 ? rplAchievement : null].filter(
      (value) => value !== null
    );
    const overallAchievement = existingAchievements.length
      ? existingAchievements.reduce((sum, value) => sum + value, 0) / existingAchievements.length
      : 0;
    return {
      ...row,
      netRevenue,
      revenuePerLead,
      conversionRate,
      targetToDate,
      targetAchievement,
      rplAchievement,
      overallAchievement,
      hasTargets: existingAchievements.length > 0
    };
  });

  const maxima = prepared.reduce(
    (result, row) => ({
      revenue: Math.max(result.revenue, Math.max(0, row.netRevenue)),
      rpl: Math.max(result.rpl, Math.max(0, row.revenuePerLead)),
      conversion: Math.max(result.conversion, row.conversionRate)
    }),
    { revenue: 0, rpl: 0, conversion: 0 }
  );

  prepared.forEach((row) => {
    const normalizedScore =
      (maxima.revenue ? Math.max(0, row.netRevenue) / maxima.revenue : 0) * 45 +
      (maxima.rpl ? Math.max(0, row.revenuePerLead) / maxima.rpl : 0) * 35 +
      (maxima.conversion ? row.conversionRate / maxima.conversion : 0) * 20;
    row.score = Math.min(100, Math.max(0, row.hasTargets ? row.overallAchievement : normalizedScore));
  });

  prepared.sort(
    (left, right) =>
      Number(right.hasTargets) - Number(left.hasTargets) ||
      right.overallAchievement - left.overallAchievement ||
      right.netRevenue - left.netRevenue ||
      right.totalSales - left.totalSales ||
      right.conversionRate - left.conversionRate ||
      left.name.localeCompare(right.name)
  );

  return prepared.map((row, index) => {
    const rank = index + 1;
    let tier = 'Needs Review';
    if (rank === 1) tier = 'Top Performer';
    else if ((row.hasTargets && row.overallAchievement >= 85) || (!row.hasTargets && row.score >= 60)) tier = 'Solid';
    else if ((row.hasTargets && row.overallAchievement >= 60) || (!row.hasTargets && row.score >= 40)) tier = 'Developing';
    return { ...row, rank, tier };
  });
};
