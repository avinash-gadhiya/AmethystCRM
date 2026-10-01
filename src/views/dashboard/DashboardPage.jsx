import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import authService from '@/services/authService';
import { getApiErrorMessage } from '@/lib/apiError';
import { TrendingUp, TrendingDown, BarChart2, PieChart, Users, MapPin, Target } from 'lucide-react';
import { LiquidGlassDatePicker } from '@/components/common/LiquidGlassDatePicker';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchSalesPersonList, isSalesManagerUser } from '@/lib/salesRoles';
import SelectSearchInput from '@/components/common/SelectSearchInput';
import UserOptionBadges, {
  getUserBadgeSearchText,
  getUserLocationName,
  getUserRoleName,
} from '@/components/common/UserOptionBadges';
import { ChartSkeleton, DashboardStatCardSkeleton, DonutChartSkeleton } from '@/components/common/skeleton-loader';

const API_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');

const LOCATION_COLORS = ['#7c3aed', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toYmd = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// A target counts only when it is a real positive number.
// null / undefined / 0 are treated as "not set" and skipped in team aggregates.
const toTargetValue = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

// Day-wise column colours: hit the day's target vs missed it. Deeper than the
// summary-card bars (.kpi-progress-bar--met / --low), which need light tints to
// read on the gradient cards; these sit on a plain chart plot area instead.
const TARGET_MET_COLOR = '#0F9D58';
const TARGET_MISSED_COLOR = '#DC2626';

const formatDayLabel = (date) => String(date.getDate());

const formatDayFull = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTH_SHORT[date.getMonth()] || '';
  return `${day} ${month} ${date.getFullYear()}`.trim();
};

const QUICK_DATE_FILTERS = [
  { value: 'Today', label: 'Today' },
  { value: 'Yesterday', label: 'Yesterday' },
  { value: 'Last Week', label: 'Last Week' },
  { value: 'Current Month', label: 'Current Month' },
  { value: 'Last Month', label: 'Last Month' },
  { value: 'This Year', label: 'This Year' },
  { value: 'Last Year', label: 'Last Year' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_FILTER_OPTIONS = [
  { value: String(CURRENT_YEAR), label: String(CURRENT_YEAR) },
  { value: String(CURRENT_YEAR - 1), label: String(CURRENT_YEAR - 1) },
];

const getQuickDatePayload = (value) => {
  const selected = String(value || 'Current Month').trim();
  const now = new Date();
  const today = toYmd(now);

  if (/^\d{4}$/.test(selected)) {
    const selectedYear = Number(selected);
    const start = new Date(selectedYear, 0, 1);
    const end = selectedYear === now.getFullYear() ? now : new Date(selectedYear, 11, 31);
    return { Date: '', FromDate: toYmd(start), ToDate: toYmd(end) };
  }

  if (selected === 'Today') {
    return { Date: today, FromDate: '', ToDate: '' };
  }

  if (selected === 'Yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { Date: toYmd(yesterday), FromDate: '', ToDate: '' };
  }

  if (selected === 'Last Week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { Date: '', FromDate: toYmd(start), ToDate: today };
  }

  if (selected === 'Current Month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { Date: '', FromDate: toYmd(start), ToDate: today };
  }

  if (selected === 'Last Month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { Date: '', FromDate: toYmd(start), ToDate: toYmd(end) };
  }

  if (selected === 'This Year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { Date: '', FromDate: toYmd(start), ToDate: today };
  }

  if (selected === 'Last Year') {
    const start = new Date(now);
    start.setDate(start.getDate() - 364);
    return { Date: '', FromDate: toYmd(start), ToDate: today };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { Date: '', FromDate: toYmd(start), ToDate: today };
};

const DEFAULT_QUICK_DATE_FILTER = 'Current Month';
const DEFAULT_QUICK_DATE_PAYLOAD = getQuickDatePayload(DEFAULT_QUICK_DATE_FILTER);

const isFallbackWorthyStatus = (status) => status === 400 || status === 404 || status === 405;

// Chargebacks are not always returned by the dashboard API; read them under any
// of the likely field names and default to 0 so the card renders cleanly.
const readChargeback = (item) =>
  Number(item?.totalChargebacks ?? item?.totalChargeBacks ?? item?.chargeback ?? item?.chargebacks ?? 0) || 0;
const readChargebackCount = (item) =>
  Number(item?.totalChargebacksCount ?? item?.totalChargeBacksCount ?? item?.chargebackCount ?? item?.chargebacksCount ?? 0) || 0;

const ChartEmptyState = ({ icon: Icon, title, description, className = 'h-[280px] sm:h-[360px]' }) => (
  <div className={`flex flex-col items-center justify-center px-6 text-center ${className}`}>
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500 ring-1 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/10">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
    <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-400 dark:text-slate-500">{description}</p>
  </div>
);

// Whether a payload actually carries a chargeback field, as opposed to simply
// reading 0 through the defaults above. This is what decides between the
// per-user rows and the response envelope as the source for the card.
const hasChargebackField = (item) =>
  item?.totalChargebacks != null ||
  item?.totalChargeBacks != null ||
  item?.chargeback != null ||
  item?.chargebacks != null ||
  item?.totalChargebacksCount != null ||
  item?.totalChargeBacksCount != null;

const DashboardPage = () => {
  const user = authService.getUser();
  const currentUserRole = String(user?.role || localStorage.getItem('roleName') || localStorage.getItem('role') || '').toLowerCase();
  const isAdminUser = ['super admin', 'superadmin', 'admin', 'sales manager', 'developer'].some((role) => currentUserRole.includes(role));
  const currentUserId = Number(user?.userId || localStorage.getItem('userId') || 0);
  const showFullDashboard = isAdminUser;
  const [isSmallScreen, setIsSmallScreen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });
  const [quickDateFilter, setQuickDateFilter] = useState(DEFAULT_QUICK_DATE_FILTER);
  const [fromDate, setFromDate] = useState(DEFAULT_QUICK_DATE_PAYLOAD.FromDate || DEFAULT_QUICK_DATE_PAYLOAD.Date);
  const [toDate, setToDate] = useState(DEFAULT_QUICK_DATE_PAYLOAD.ToDate || DEFAULT_QUICK_DATE_PAYLOAD.Date);
  const [isDateFilterApplied, setIsDateFilterApplied] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [salesPersons, setSalesPersons] = useState([]);
  const [salesManagerTargets, setSalesManagerTargets] = useState([]);
  const [salesPersonSearchText, setSalesPersonSearchText] = useState('');
  // Avoid flashing zero values before the first dashboard request starts.
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalSalesCount: 0,
    totalRefunds: 0,
    totalRefundsCount: 0,
    totalVoids: 0,
    totalVoidsCount: 0,
    totalChargebacks: 0,
    totalChargebacksCount: 0,
    netAmount: 0,
  });
  const [locationWiseSales, setLocationWiseSales] = useState([]);
  const [dailyLocationWiseSales, setDailyLocationWiseSales] = useState([]);
  const [dayWiseSalesAndRpl, setDayWiseSalesAndRpl] = useState([]);
  const [userWiseSummary, setUserWiseSummary] = useState([]);
  const isFetchingRef = useRef(false);

  // Keep isSmallScreen in sync with window width after resize
  useEffect(() => {
    const handleResize = () => setIsSmallScreen(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatPieValue = useCallback((value) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return '0';
    if (Number.isInteger(numeric)) return numeric.toLocaleString();
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }, []);

  const salesPersonOptions = useMemo(() => {
    const sorted = (salesPersons || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const query = String(salesPersonSearchText || '').trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter((user) => {
      // The selected option is always kept: Radix renders the trigger label
      // through it, so filtering it out blanks the field.
      if (String(user?.id) === String(selectedUserId)) return true;

      const name = String(user?.name || '').toLowerCase();
      const idText = user?.id !== undefined && user?.id !== null ? String(user.id).toLowerCase() : '';
      return name.includes(query) || idText.includes(query) || getUserBadgeSearchText(user).includes(query);
    });
  }, [salesPersons, salesPersonSearchText, selectedUserId]);

  const fetchSalesPersons = useCallback(async () => {
    try {
      authService.setupAxios();
      const users = await fetchSalesPersonList({ pageSize: 5000 });

      const normalized = users
        .map((user) => {
          const id = Number(user?.userId ?? user?.UserId ?? user?.id ?? user?.Id);
          if (!Number.isFinite(id) || id <= 0) return null;
          const firstName = String(user?.firstName || '').trim();
          const lastName = String(user?.lastName || '').trim();
          const fullName = `${firstName} ${lastName}`.trim();
          const name =
            fullName ||
            String(user?.fullName || user?.FullName || user?.name || user?.Name || '').trim() ||
            String(user?.username || user?.userName || '').trim() ||
            `User ${id}`;
          // Role / location ride along so the dropdown can badge each option.
          return {
            id,
            name,
            roleName: getUserRoleName(user),
            locationName: getUserLocationName(user),
          };
        })
        .filter(Boolean);

      setSalesPersons(normalized);
    } catch (error) {
      console.error('Failed to fetch sales persons:', error);
      setSalesPersons([]);
    }
  }, []);

  // Sales/RPL targets behind the "All Sales Persons" summary. These live on the
  // full User record - /User/UserDropDown (which feeds the name list above) does
  // not return them, so this reads the same endpoint the Sales Target settings
  // page uses. Without it the team target is 0 and the day-wise chart drops its
  // target / forecast series.
  const fetchSalesManagerTargets = useCallback(async () => {
    try {
      authService.setupAxios();
      const response = await axios.get(`${API_URL}/User`, {
        params: {
          Text: '',
          PageNumber: 1,
          PageSize: 5000,
          SortProperty: 'userId',
          IsDescending: false,
        },
      });

      const payload = response?.data;
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      setSalesManagerTargets(
        list
          // The Sales Manager's target IS the team target, so it is the only one
          // "All Sales Persons" reads. Agent targets are deliberately left out:
          // summing them on top of their manager's counted the same sales twice
          // and inflated the team target.
          .filter(isSalesManagerUser)
          .map((user) => ({
            id: Number(user?.userId ?? user?.UserId ?? user?.id ?? user?.Id) || 0,
            salesTarget: toTargetValue(user?.salesTarget ?? user?.SalesTarget),
            rplTarget: toTargetValue(user?.rplTarget ?? user?.RplTarget),
          }))
          .filter((user) => user.id > 0),
      );
    } catch (error) {
      // Losing this call is not cosmetic: with no targets the team target is 0,
      // so the summary target percentage and the day-wise target / forecast
      // series all disappear. `/User` is the user-management endpoint, so a role
      // that can see the dashboard but not manage users gets 401/403 here and
      // silently loses those. Log the status so that case is obvious.
      const status = error?.response?.status;
      console.error(
        `Failed to fetch sales person targets${status ? ` (HTTP ${status})` : ''} - ` +
        'the target % and forecast series will be hidden.',
        error,
      );
      setSalesManagerTargets([]);
    }
  }, []);

  const dailyLocChartData = useMemo(() => {
    if (!dailyLocationWiseSales.length) return [];

    const locationSet = new Set();
    dailyLocationWiseSales.forEach((row) => {
      (row.locationSales || []).forEach((ls) => locationSet.add(ls.locationName));
    });
    const locations = Array.from(locationSet);

    const parseDate = (value) => {
      if (!value) return null;
      const trimmed = String(value).trim();

      // API sometimes returns DD-MM; map it to the selected month/year.
      const ddMmMatch = trimmed.match(/^(\d{2})-(\d{2})$/);
      if (ddMmMatch) {
        const day = Number(ddMmMatch[1]);
        const month = Number(ddMmMatch[2]);
        const base = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date();
        const year = base.getFullYear();
        const mapped = new Date(year, month - 1, day);
        if (!Number.isNaN(mapped.getTime())) {
          mapped.setHours(0, 0, 0, 0);
          return mapped;
        }
      }

      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return null;
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    };

    const baseDate = parseDate(fromDate ? `${fromDate}T00:00:00` : '')
      || parseDate(toDate ? `${toDate}T00:00:00` : '')
      || parseDate(dailyLocationWiseSales[0]?.date);

    if (!baseDate) return [];

    const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    monthStart.setHours(0, 0, 0, 0);
    monthEnd.setHours(0, 0, 0, 0);

    const byDate = new Map();
    dailyLocationWiseSales.forEach((row) => {
      const parsed = parseDate(row?.date);
      if (!parsed) return;
      const key = toYmd(parsed);
      byDate.set(key, row);
    });

    const filled = [];
    const cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      const key = toYmd(cursor);
      const row = byDate.get(key);
      const entry = {
        date: key,
        label: formatDayFull(cursor),
        totalSales: Number(row?.totalSales) || 0,
      };

      locations.forEach((name) => {
        const match = (row?.locationSales || []).find((ls) => ls.locationName === name);
        entry[name] = match ? Number(match.totalSales) || 0 : 0;
      });

      filled.push(entry);
      cursor.setDate(cursor.getDate() + 1);
    }

    return filled;
  }, [dailyLocationWiseSales, fromDate, toDate]);

  const dailyLocNames = useMemo(() => {
    const locationSet = new Set();
    dailyLocationWiseSales.forEach((row) => {
      (row.locationSales || []).forEach((ls) => locationSet.add(ls.locationName));
    });
    return Array.from(locationSet);
  }, [dailyLocationWiseSales]);

  const DAILY_LOC_COLORS = ['#7c3aed', '#06B6D4', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444'];

  // Team targets for the "All Sales Persons" view. The day-wise API only carries
  // a target when a single user is requested, so this stands in for it.
  //
  // `salesManagerTargets` holds Sales Managers only, so a single manager's target
  // is used exactly as it is set. With several managers - one per location - the
  // sales targets add up and RPL, being a rate rather than an amount, is
  // averaged over the managers who actually have one.
  //
  // No manager with a target means a 0 team target, which hides the target % and
  // the forecast series, the same as for any person with no target set. It does
  // NOT quietly fall back to summing agents: that is the inflated number this
  // moved away from, and it would reappear only in the cases nobody was looking.
  const allPersonsTargets = useMemo(() => {
    const salesTargets = (salesManagerTargets || [])
      .map((user) => toTargetValue(user?.salesTarget))
      .filter((value) => value > 0);
    const rplTargets = (salesManagerTargets || [])
      .map((user) => toTargetValue(user?.rplTarget))
      .filter((value) => value > 0);

    return {
      salesTarget: salesTargets.reduce((sum, value) => sum + value, 0),
      rplTarget: rplTargets.length
        ? rplTargets.reduce((sum, value) => sum + value, 0) / rplTargets.length
        : 0,
      salesTargetPersons: salesTargets.length,
      rplTargetPersons: rplTargets.length,
    };
  }, [salesManagerTargets]);

  // Single source of truth for the targets used by BOTH the summary cards and
  // the Day-wise Sales & Leads Forecast chart, so "All Sales Persons" draws the
  // same target / forecast lines an individual person gets.
  const resolvedTargets = useMemo(() => {
    // Monthly targets carried on the day-wise rows (same value repeated per day).
    const rowSalesTarget = dayWiseSalesAndRpl.reduce(
      (acc, item) => acc || Number(item?.salesTarget) || 0,
      0,
    );
    const rowRplTarget = dayWiseSalesAndRpl.reduce(
      (acc, item) => acc || Number(item?.rplTarget) || 0,
      0,
    );

    // Only admins get the "All Sales Persons" option; for everyone else the
    // dashboard is already scoped to the logged-in user.
    const isAllSalesPersons = isAdminUser && selectedUserId === 'all';

    return {
      isAllSalesPersons,
      salesTarget: isAllSalesPersons && allPersonsTargets.salesTarget > 0
        ? allPersonsTargets.salesTarget
        : rowSalesTarget,
      rplTarget: isAllSalesPersons && allPersonsTargets.rplTarget > 0
        ? allPersonsTargets.rplTarget
        : rowRplTarget,
    };
  }, [dayWiseSalesAndRpl, isAdminUser, selectedUserId, allPersonsTargets]);

  const dayWiseSeriesData = useMemo(() => {
    if (!dayWiseSalesAndRpl.length) return [];

    const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const end = toDate ? new Date(`${toDate}T00:00:00`) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return dayWiseSalesAndRpl;
    }

    const baseMonth = new Date(start);
    const normalizedStart = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
    const normalizedEnd = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 0);
    normalizedStart.setHours(0, 0, 0, 0);
    normalizedEnd.setHours(0, 0, 0, 0);
    const daysTotal = Math.max(
      1,
      Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );

    const dataByDate = new Map();
    // Resolved centrally so the "All Sales Persons" team aggregate is used when
    // the API rows carry no target of their own.
    const salesTargetDefault = resolvedTargets.salesTarget;
    const rplTargetDefault = resolvedTargets.rplTarget;

    dayWiseSalesAndRpl.forEach((item) => {
      const rawDate = item?.date || item?.day || '';
      const parsed = rawDate ? new Date(rawDate) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) return;
      parsed.setHours(0, 0, 0, 0);
      const key = toYmd(parsed);
      dataByDate.set(key, item);
    });

    const filled = [];
    const cursor = new Date(normalizedStart);
    const perDaySalesTarget = salesTargetDefault ? salesTargetDefault / daysTotal : 0;
    const perDayRplTarget = rplTargetDefault ? rplTargetDefault / daysTotal : 0;
    while (cursor <= normalizedEnd) {
      const key = toYmd(cursor);
      const existing = dataByDate.get(key);
      const baseSalesTarget = perDaySalesTarget || Number(existing?.salesTarget) || 0;
      const baseRplTarget = perDayRplTarget || Number(existing?.rplTarget) || 0;

      filled.push({
        day: existing?.day || formatDayFull(cursor),
        date: existing?.date || key,
        dayLabel: existing?.dayLabel || formatDayLabel(cursor),
        totalLeads: Number(existing?.totalLeads) || 0,
        totalSales: Number(existing?.totalSales) || 0,
        rpl: Number(existing?.rpl) || 0,
        salesTarget: baseSalesTarget,
        rplTarget: baseRplTarget,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return filled;
  }, [dayWiseSalesAndRpl, fromDate, toDate, resolvedTargets]);

  // Day-wise total sales as columns (actual up to today, forecast columns for
  // the remaining days at the per-day target) against a flat "total target"
  // base line. RPL is a running rate that trends toward its rplTarget over the
  // remaining days, shown against a flat rplTarget base line.
  const dayWiseForecast = useMemo(() => {
    const empty = {
      categories: [],
      dailyActualSales: [],
      dailyForecastBars: [],
      salesTargetLine: [],
      runningRpl: [],
      forecastRpl: [],
      rplTargetLine: [],
      todayIndex: -1,
      hasForecast: false,
      hasSalesTarget: false,
      hasRplTarget: false,
    };
    if (!dayWiseSeriesData.length) return empty;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // salesTarget is a monthly total we spread evenly per day; rplTarget is a
    // flat rate goal (used as-is). Both come from the shared resolver, so the
    // team aggregate drives these lines on "All Sales Persons".
    const monthlySalesTarget = resolvedTargets.salesTarget;
    const rplTargetRate = resolvedTargets.rplTarget;

    const n = dayWiseSeriesData.length;
    const lastIndex = n - 1;
    const perDayTarget = monthlySalesTarget ? Math.round(monthlySalesTarget / n) : 0;

    const parsedDates = dayWiseSeriesData.map((item) => {
      const parsed = item?.date ? new Date(item.date) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) return null;
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    });
    const hasValidDates = parsedDates.some(Boolean);

    // Last "actual" day: the latest day on or before today. When dates are
    // unusable, fall back to the last day that recorded any sales.
    const todayIndex = hasValidDates
      ? parsedDates.reduce((last, date, index) => (date && date <= today ? index : last), -1)
      : dayWiseSeriesData.reduce(
        (last, item, index) => ((Number(item?.totalSales) || 0) > 0 ? index : last),
        -1,
      );

    const categories = dayWiseSeriesData.map((item) => String(item.dayLabel || item.day || ''));

    const dailyActualSales = [];
    // Same values as dailyActualSales, but as points carrying a per-day colour:
    // green when the day beat its share of the target, red when it fell short.
    // Kept separate so the trend spline still gets a plain numeric series.
    const dailyActualSalesPoints = [];
    const salesTargetLine = [];
    const runningRpl = [];
    const rplTargetLine = [];

    // Daily total sales columns + the per-day target base line, plus a running
    // RPL (cumulative sales / leads) up to today.
    let cumSales = 0;
    let cumLeads = 0;
    dayWiseSeriesData.forEach((item, index) => {
      const isActual = todayIndex >= 0 && index <= todayIndex;
      salesTargetLine.push(perDayTarget || null);
      rplTargetLine.push(rplTargetRate || null);

      if (isActual) {
        const salesValue = Number(item.totalSales) || 0;
        cumSales += salesValue;
        cumLeads += Number(item.totalLeads) || 0;
        runningRpl.push(cumLeads > 0 ? Number((cumSales / cumLeads).toFixed(2)) : null);
        dailyActualSales.push(salesValue);
        // With no target configured the column keeps the series' default colour.
        dailyActualSalesPoints.push(
          perDayTarget > 0
            ? {
              y: salesValue,
              color: salesValue >= perDayTarget ? TARGET_MET_COLOR : TARGET_MISSED_COLOR,
            }
            : salesValue,
        );
      } else {
        runningRpl.push(null);
        dailyActualSales.push(null);
        dailyActualSalesPoints.push(null);
      }
    });

    // Catch-up forecast: the remaining target spread across the remaining days,
    // so the month still lands on the monthly target. e.g. target 1000, sold 800
    // by day 25 with 5 days left -> (1000-800)/5 = 200/5 = 40 per remaining day.
    const cumSalesToDate = cumSales;
    const remainingDays = todayIndex >= 0 ? lastIndex - todayIndex : 0;
    const remainingTarget = Math.max(0, monthlySalesTarget - cumSalesToDate);
    const requiredPerDay = remainingDays > 0 ? Math.round(remainingTarget / remainingDays) : 0;

    const dailyForecastBars = dayWiseSeriesData.map((_, index) => {
      if (todayIndex < 0 || index <= todayIndex) return null;
      return requiredPerDay;
    });

    // Forecast trend line: mirrors the forecast bars, anchored at today's actual
    // sales value so the trend line continues smoothly past today.
    const todayActualSales = todayIndex >= 0 ? (Number(dayWiseSeriesData[todayIndex]?.totalSales) || 0) : null;
    const forecastTrend = dayWiseSeriesData.map((_, index) => {
      if (todayIndex < 0 || index < todayIndex) return null;
      if (index === todayIndex) return todayActualSales; // anchor to today's actual
      return requiredPerDay;
    });

    // RPL forecast: what average RPL the remaining leads must hit so the running
    // RPL reaches its target by month-end (trend from current RPL to rplTarget).
    const currentRpl = cumLeads > 0 ? Number((cumSales / cumLeads).toFixed(2)) : 0;

    const forecastRpl = dayWiseSeriesData.map((_, index) => {
      if (todayIndex < 0 || index < todayIndex || remainingDays <= 0) return null;
      if (index === todayIndex) return currentRpl; // anchor to running RPL
      const progress = (index - todayIndex) / remainingDays;
      return Number((currentRpl + (rplTargetRate - currentRpl) * progress).toFixed(2));
    });

    const hasForecast = todayIndex >= 0 && todayIndex < lastIndex;

    return {
      categories,
      dailyActualSales,
      dailyActualSalesPoints,
      dailyForecastBars,
      forecastTrend,
      salesTargetLine,
      runningRpl,
      forecastRpl,
      rplTargetLine,
      todayIndex,
      hasForecast,
      hasSalesTarget: monthlySalesTarget > 0,
      hasRplTarget: rplTargetRate > 0,
    };
  }, [dayWiseSeriesData, resolvedTargets]);

  const userWiseRechartsData = useMemo(
    () => userWiseSummary
      .map((item) => ({
        user: String(item.userName || ''),
        userId: Number(item.userId) || 0,
        email: String(item.email || '').trim(),
        totalSales: Number(item.totalSales) || 0,
        totalSalesCount: Number(item.totalSalesCount) || 0,
        totalRefunds: Number(item.totalRefunds) || 0,
        totalRefundsCount: Number(item.totalRefundsCount) || 0,
        totalVoids: Number(item.totalVoids) || 0,
        totalVoidsCount: Number(item.totalVoidsCount) || 0,
        netAmount: Number(item.netAmount) || 0,
      }))
      .filter((item) => item.totalSales !== 0 || item.totalRefunds !== 0 || item.totalVoids !== 0),
    [userWiseSummary],
  );

  // Total leads across the selected range (day-wise data is already user-scoped)
  // and RPL (Revenue Per Lead) derived from total sales / total leads.
  const summaryExtra = useMemo(() => {
    const totalLeads = dayWiseSalesAndRpl.reduce(
      (sum, item) => sum + (Number(item?.totalLeads) || 0),
      0,
    );
    const rpl = totalLeads > 0 ? summary.totalSales / totalLeads : 0;

    return {
      totalLeads,
      rpl,
      salesTarget: resolvedTargets.salesTarget,
      rplTarget: resolvedTargets.rplTarget,
      isAllSalesPersons: resolvedTargets.isAllSalesPersons,
    };
  }, [dayWiseSalesAndRpl, summary.totalSales, resolvedTargets]);

  const fetchDashboard = useCallback(async () => {
    if (isFetchingRef.current) return;

    const from = String(fromDate || '').trim();
    const to = String(toDate || '').trim();

    isFetchingRef.current = true;
    setLoading(true);
    try {
      authService.setupAxios();

      const hasDateFilter = isDateFilterApplied && Boolean(from && to);
      const baseParams = hasDateFilter
        ? {
          fromdate: from,
          todate: to,
          fromDate: from,
          toDate: to,
        }
        : undefined;

      const userScopedParams = (() => {
        if (isAdminUser) {
          const selected = selectedUserId === 'all' ? 0 : Number(selectedUserId || 0);
          if (Number.isFinite(selected) && selected > 0) {
            return { ...(baseParams || {}), userId: selected };
          }
          return baseParams;
        }

        if (!Number.isFinite(currentUserId) || currentUserId <= 0) {
          return baseParams;
        }
        return { ...(baseParams || {}), userId: currentUserId };
      })();

      const getWithFallback = async (primaryPath, fallbackPath = primaryPath, paramsOverride) => {
        try {
          return await axios.get(`${API_URL}${primaryPath}`, { params: paramsOverride });
        } catch (error) {
          const status = error?.response?.status;
          const canUseFallback = Boolean(fallbackPath) && fallbackPath !== primaryPath;
          if (!status || !isFallbackWorthyStatus(status) || !canUseFallback) throw error;
          return axios.get(`${API_URL}${fallbackPath}`, { params: paramsOverride });
        }
      };

      const requests = [
        getWithFallback('/Dashboard/DayWiseSalesAndRPL', '/DashBoard/DayWiseSalesAndRPL', userScopedParams),
        getWithFallback('/Dashboard/UserWiseSummary', '/DashBoard/UserWiseSummary', userScopedParams),
      ];

      if (isAdminUser) {
        requests.push(
          getWithFallback('/Dashboard/LocationWiseMonthlyTotalSales', '/Dashboard/LocationWiseMonthlyTotalSales', baseParams),
          getWithFallback('/Dashboard/DailyLocationWiseSales', '/DashBoard/DailyLocationWiseSales', baseParams),
        );
      }

      const [
        dayWiseResponse,
        userWiseResponse,
        locationWiseResponse,
        dailyLocResponse,
      ] = await Promise.all(requests);

      if (isAdminUser) {
        const locationWiseRaw = Array.isArray(locationWiseResponse?.data?.data) ? locationWiseResponse.data.data : [];
        setLocationWiseSales(
          locationWiseRaw.map((item) => ({
            locationId: Number(item?.locationId) || 0,
            locationName: String(item?.locationName || '').trim() || 'Unknown',
            totalSales: Number(item?.monthlyTotalSalesDTO?.totalSales) || 0,
            rpl: Number(item?.monthlyTotalSalesDTO?.rpl) || 0,
            totalLeads: Number(item?.monthlyTotalSalesDTO?.totalLeads) || 0,
          })),
        );
      } else {
        setLocationWiseSales([]);
      }

      const dayWiseData = Array.isArray(dayWiseResponse?.data?.data) ? dayWiseResponse.data.data : [];
      setDayWiseSalesAndRpl(
        dayWiseData.map((item) => ({
          day: item?.day || '',
          date: item?.date || '',
          dayLabel: (() => {
            const parsedDate = item?.date ? new Date(item.date) : null;
            if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
              return String(parsedDate.getDate());
            }
            const fallback = String(item?.day || '').split(' ')[0];
            return fallback.replace(/^0+/, '') || fallback || '';
          })(),
          totalLeads: Number(item?.totalLeads) || 0,
          totalSales: Number(item?.totalSales) || 0,
          rpl: Number(item?.rpl) || 0,
          salesTargetRaw: item?.salesTarget ?? null,
          rplTargetRaw: item?.rplTarget ?? null,
          salesTarget: Number(item?.salesTarget) || 0,
          rplTarget: Number(item?.rplTarget) || 0,
        })),
      );

      const userWiseData = Array.isArray(userWiseResponse?.data?.data) ? userWiseResponse.data.data : [];

      // The API may report chargebacks per user row or once on the response
      // envelope. Rows win when they carry the field; otherwise the envelope
      // totals feed the card, so it is never stuck at 0 because of the shape.
      const userWiseEnvelope = userWiseResponse?.data || {};
      const rowsCarryChargebacks = userWiseData.some(hasChargebackField);
      const envelopeChargebacks = readChargeback(userWiseEnvelope);
      const envelopeChargebacksCount = readChargebackCount(userWiseEnvelope);

      setUserWiseSummary(
        userWiseData.map((item) => ({
          userId: Number(item?.userId) || 0,
          userName: String(item?.userName || '').trim() || 'Unknown',
          email: String(item?.email || '').trim(),
          totalSales: Number(item?.totalSales) || 0,
          totalSalesCount: Number(item?.totalSalesCount) || 0,
          totalRefunds: Number(item?.totalRefunds) || 0,
          totalRefundsCount: Number(item?.totalRefundsCount) || 0,
          totalVoids: Number(item?.totalVoids) || 0,
          totalVoidsCount: Number(item?.totalVoidsCount) || 0,
          netAmount: Number(item?.netAmount) || 0,
        })),
      );

      if (!isAdminUser && Number.isFinite(currentUserId) && currentUserId > 0) {
        const currentUserSummary = userWiseData.find((item) => Number(item?.userId) === currentUserId);
        if (currentUserSummary) {
          setSummary({
            totalSales: Number(currentUserSummary?.totalSales) || 0,
            totalSalesCount: Number(currentUserSummary?.totalSalesCount) || 0,
            totalRefunds: Number(currentUserSummary?.totalRefunds) || 0,
            totalRefundsCount: Number(currentUserSummary?.totalRefundsCount) || 0,
            totalVoids: Number(currentUserSummary?.totalVoids) || 0,
            totalVoidsCount: Number(currentUserSummary?.totalVoidsCount) || 0,
            totalChargebacks: rowsCarryChargebacks ? readChargeback(currentUserSummary) : envelopeChargebacks,
            totalChargebacksCount: rowsCarryChargebacks ? readChargebackCount(currentUserSummary) : envelopeChargebacksCount,
            netAmount: Number(currentUserSummary?.netAmount) || 0,
          });
        }
      }

      if (isAdminUser) {
        const totals = userWiseData.reduce(
          (acc, item) => {
            acc.totalSales += Number(item?.totalSales) || 0;
            acc.totalSalesCount += Number(item?.totalSalesCount) || 0;
            acc.totalRefunds += Number(item?.totalRefunds) || 0;
            acc.totalRefundsCount += Number(item?.totalRefundsCount) || 0;
            acc.totalVoids += Number(item?.totalVoids) || 0;
            acc.totalVoidsCount += Number(item?.totalVoidsCount) || 0;
            acc.totalChargebacks += readChargeback(item);
            acc.totalChargebacksCount += readChargebackCount(item);
            acc.netAmount += Number(item?.netAmount) || 0;
            return acc;
          },
          {
            totalSales: 0,
            totalSalesCount: 0,
            totalRefunds: 0,
            totalRefundsCount: 0,
            totalVoids: 0,
            totalVoidsCount: 0,
            totalChargebacks: 0,
            totalChargebacksCount: 0,
            netAmount: 0,
          },
        );

        if (!rowsCarryChargebacks) {
          totals.totalChargebacks = envelopeChargebacks;
          totals.totalChargebacksCount = envelopeChargebacksCount;
        }

        setSummary(totals);
      }

      if (isAdminUser) {
        const dailyLocRaw = Array.isArray(dailyLocResponse?.data?.data) ? dailyLocResponse.data.data : [];
        setDailyLocationWiseSales(dailyLocRaw);
      } else {
        setDailyLocationWiseSales([]);
      }
    } catch (error) {
      console.error('Failed to load dashboard summary:', error);
      toast.error(getApiErrorMessage(error, 'Failed to load dashboard'));
      setSummary({
        totalSales: 0,
        totalSalesCount: 0,
        totalRefunds: 0,
        totalRefundsCount: 0,
        totalVoids: 0,
        totalVoidsCount: 0,
        totalChargebacks: 0,
        totalChargebacksCount: 0,
        netAmount: 0,
      });
      setLocationWiseSales([]);
      setDailyLocationWiseSales([]);
      setDayWiseSalesAndRpl([]);
      setUserWiseSummary([]);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [fromDate, toDate, isDateFilterApplied, selectedUserId, isAdminUser, currentUserId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!isAdminUser) {
      setSalesPersons([]);
      setSalesManagerTargets([]);
      setSelectedUserId('all');
      return;
    }

    fetchSalesPersons();
    fetchSalesManagerTargets();
  }, [isAdminUser, fetchSalesPersons, fetchSalesManagerTargets]);

  useEffect(() => {
    const updateViewport = () => {
      setIsSmallScreen(window.innerWidth < 640);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const syncTheme = () => setIsDarkMode(root.classList.contains('dark'));

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const chartTheme = useMemo(
    () => ({
      gridStroke: isDarkMode ? '#334155' : '#E5E7EB',
      axisStroke: isDarkMode ? '#475569' : '#CBD5E1',
      tickColor: isDarkMode ? '#CBD5E1' : '#6B7280',
      labelColor: isDarkMode ? '#E2E8F0' : '#6B7280',
      legendColor: isDarkMode ? '#E2E8F0' : '#374151',
      legendMuted: isDarkMode ? '#94A3B8' : '#9CA3AF',
      chartBg: isDarkMode ? '#020617' : 'transparent',
      plotBg: isDarkMode ? '#020617' : 'transparent',
      tooltipBg: isDarkMode ? '#111827' : '#FFFFFF',
      tooltipBorder: isDarkMode ? '#374151' : '#E5E7EB',
      tooltipText: isDarkMode ? '#F9FAFB' : '#111827',
      tooltipShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.35)' : '0 4px 12px rgba(0,0,0,0.08)',
      // Series colours that would otherwise sit near-black on the dark plot
      // area. The dark values are lifted variants of the same hue, so the
      // charts keep their identity in both themes.
      salesColumn: isDarkMode ? '#c084fc' : '#a855f7',
      forecastFill: isDarkMode ? 'rgba(129, 140, 248, 0.32)' : 'rgba(168, 85, 247, 0.35)',
      forecastBorder: isDarkMode ? '#c084fc' : '#a855f7',
      forecastTrend: isDarkMode ? '#d8b4fe' : '#7e22ce',
      salesBar: isDarkMode ? '#8b5cf6' : '#7c3aed',
    }),
    [isDarkMode],
  );

  const locationPieOptions = useMemo(
    () => ({
      chart: {
        type: 'pie',
        backgroundColor: chartTheme.chartBg,
        plotBackgroundColor: chartTheme.plotBg,
        plotBorderWidth: 0,
        height: isSmallScreen ? 280 : 360,
      },
      credits: { enabled: false },
      title: { text: null },
      colors: LOCATION_COLORS,
      tooltip: {
        backgroundColor: chartTheme.tooltipBg,
        borderColor: chartTheme.tooltipBorder,
        style: { color: chartTheme.tooltipText },
        pointFormatter() {
          return `<span style="color:${this.color}">&#9679;</span> ${this.name}: <b>${formatPieValue(this.y)}</b><br/>`;
        },
      },
      legend: {
        itemStyle: { color: chartTheme.legendColor, fontSize: '11px', fontWeight: '600' },
        itemHoverStyle: { color: chartTheme.tooltipText },
        itemHiddenStyle: { color: chartTheme.legendMuted },
      },
      plotOptions: {
        pie: {
          innerSize: '45%',
          dataLabels: {
            enabled: true,
            style: { color: chartTheme.labelColor, textOutline: 'none', fontSize: '11px' },
            formatter() {
              return this.percentage > 4 ? `${this.point.name} (${Math.round(this.percentage)}%)` : '';
            },
          },
        },
      },
      series: [
        {
          name: 'Total Sales',
          type: 'pie',
          data: locationWiseSales.map((item) => ({
            name: item.locationName,
            y: Number(item.totalSales) || 0,
          })),
        },
      ],
    }),
    [locationWiseSales, isSmallScreen, chartTheme, formatPieValue],
  );

  const dayWiseOptions = useMemo(
    () => {
      const {
        categories,
        dailyActualSales,
        dailyActualSalesPoints,
        dailyForecastBars,
        forecastTrend,
        salesTargetLine,
        runningRpl,
        forecastRpl,
        rplTargetLine,
        todayIndex,
        hasForecast,
        hasSalesTarget,
        hasRplTarget,
      } = dayWiseForecast;

      const series = [
        {
          name: 'Total Sales',
          type: 'column',
          yAxis: 0,
          // Fallback only: each point sets its own colour once a target exists.
          color: chartTheme.salesColumn,
          borderWidth: 0,
          zIndex: 1,
          data: dailyActualSalesPoints,
        },
        {
          name: 'Total Sales (Trend)',
          type: 'spline',
          yAxis: 0,
          color: '#38ca75',
          lineWidth: 2,
          marker: { enabled: false, radius: 3 },
          zIndex: 5,
          // Draws the same values as the Total Sales columns, so keep the line
          // but leave it out of the shared tooltip instead of repeating the row.
          enableMouseTracking: false,
          data: dailyActualSales,
        },
        (hasForecast && hasSalesTarget) && {
          name: 'Total Sales (Forecast)',
          type: 'column',
          yAxis: 0,
          color: chartTheme.forecastFill,
          borderColor: chartTheme.forecastBorder,
          borderWidth: 1,
          zIndex: 1,
          data: dailyForecastBars,
        },
        (hasForecast && hasSalesTarget) && {
          name: 'Total Sales (Forecast Trend)',
          type: 'spline',
          yAxis: 0,
          color: chartTheme.forecastTrend,
          dashStyle: 'Dash',
          lineWidth: 2,
          marker: { enabled: false, radius: 3 },
          zIndex: 5,
          // Draws the same values as the forecast columns, so keep the line but
          // leave it out of the shared tooltip instead of repeating the row.
          enableMouseTracking: false,
          data: forecastTrend,
        },
        hasSalesTarget && {
          name: 'Daily Target',
          type: 'spline',
          yAxis: 0,
          color: '#a855f7',
          dashStyle: 'ShortDot',
          lineWidth: 2,
          marker: { enabled: false },
          zIndex: 4,
          data: salesTargetLine,
        },
        {
          name: 'RPL',
          type: 'spline',
          yAxis: 1,
          color: '#F59E0B',
          lineWidth: 2,
          marker: { enabled: false, radius: 3 },
          zIndex: 4,
          data: runningRpl,
        },
        (hasForecast && hasRplTarget) && {
          name: 'RPL (Forecast)',
          type: 'spline',
          yAxis: 1,
          color: '#F59E0B',
          dashStyle: 'Dash',
          lineWidth: 2,
          marker: { enabled: false },
          zIndex: 3,
          data: forecastRpl,
        },
        hasRplTarget && {
          name: 'RPL Target',
          type: 'spline',
          yAxis: 1,
          color: '#EC4899',
          dashStyle: 'ShortDot',
          lineWidth: 2,
          marker: { enabled: false },
          zIndex: 2,
          data: rplTargetLine,
        },
      ].filter(Boolean);

      return {
        chart: {
          type: 'spline',
          backgroundColor: chartTheme.chartBg,
          plotBackgroundColor: chartTheme.plotBg,
          plotBorderWidth: 0,
          height: isSmallScreen ? 320 : 400,
          scrollablePlotArea: isSmallScreen ? { minWidth: Math.max(680, categories.length * 42), scrollPositionX: 0 } : undefined,
        },
        credits: { enabled: false },
        title: { text: null },
        xAxis: {
          categories,
          labels: {
            style: { color: chartTheme.tickColor, fontSize: isSmallScreen ? '10px' : '12px', textOutline: 'none' },
            rotation: isSmallScreen ? -40 : -25,
          },
          lineColor: chartTheme.axisStroke,
          plotLines: (hasForecast && todayIndex >= 0)
            ? [{
              color: chartTheme.legendMuted,
              dashStyle: 'Dash',
              width: 1,
              value: todayIndex,
              zIndex: 5,
              label: {
                text: 'Today',
                rotation: 0,
                y: 12,
                style: { color: chartTheme.legendMuted, fontSize: '10px', fontWeight: '600' },
              },
            }]
            : [],
        },
        yAxis: [
          {
            min: 0,
            title: { text: 'Sales', style: { color: chartTheme.labelColor, fontSize: '11px' } },
            gridLineColor: chartTheme.gridStroke,
            labels: { style: { color: chartTheme.tickColor, textOutline: 'none' } },
          },
          {
            min: 0,
            title: { text: 'RPL', style: { color: '#F59E0B', fontSize: '11px' } },
            labels: { style: { color: '#F59E0B', textOutline: 'none' } },
            opposite: true,
            gridLineWidth: 0,
          },
        ],
        legend: {
          itemStyle: { color: chartTheme.legendColor, fontSize: '12px', fontWeight: '600' },
          itemHoverStyle: { color: chartTheme.tooltipText },
          itemHiddenStyle: { color: chartTheme.legendMuted },
        },
        tooltip: {
          shared: true,
          useHTML: true,
          backgroundColor: chartTheme.tooltipBg,
          borderColor: chartTheme.tooltipBorder,
          style: { color: chartTheme.tooltipText },
          formatter() {
            // On a category axis `this.x` is the 0-based point index, so the raw
            // value would head the box "Day 0" for the 1st. Read the day off the
            // categories instead, which keeps it in step with the axis labels.
            const dayLabel = typeof this.x === 'number'
              ? (categories[this.x] ?? this.x + 1)
              : this.x;

            const rows = (this.points || [])
              .map((point) => `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.5;"><span><span style="color:${point.color}">●</span> ${point.series.name}</span><b>${formatPieValue(point.y)}</b></div>`)
              .join('');
            return `<div style="min-width:190px;"><div style="font-weight:700;margin-bottom:4px;">Day ${dayLabel}</div>${rows}</div>`;
          },
        },
        plotOptions: {
          column: {
            grouping: false,
            borderWidth: 0,
            pointPadding: 0.12,
            groupPadding: 0.08,
          },
          series: {
            connectNulls: false,
          },
        },
        series,
      };
    },
    [dayWiseForecast, isSmallScreen, chartTheme, formatPieValue],
  );

  const userWiseOptions = useMemo(
    () => ({
      chart: {
        type: 'column',
        backgroundColor: chartTheme.chartBg,
        plotBackgroundColor: chartTheme.plotBg,
        plotBorderWidth: 0,
        height: isSmallScreen ? 320 : 460,
      },
      credits: { enabled: false },
      title: { text: null },
      xAxis: {
        categories: userWiseRechartsData.map((item) => item.user),
        labels: {
          style: { color: chartTheme.tickColor, fontSize: isSmallScreen ? '9px' : '10px', textOutline: 'none' },
          rotation: isSmallScreen ? -45 : -70,
        },
        lineColor: chartTheme.axisStroke,
      },
      yAxis: {
        min: 0,
        title: { text: null },
        gridLineColor: chartTheme.gridStroke,
        labels: { style: { color: chartTheme.tickColor, textOutline: 'none' } },
      },
      legend: {
        itemStyle: { color: chartTheme.legendColor, fontSize: '12px', fontWeight: '600' },
        itemHoverStyle: { color: chartTheme.tooltipText },
        itemHiddenStyle: { color: chartTheme.legendMuted },
      },
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        shadow: false,
        padding: 0,
        formatter() {
          const full = this.points?.[0]?.point?.custom;
          if (!full) return '';

          const lineStyle = 'display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.45;';
          const cardBg = isDarkMode ? '#111827' : '#FFFFFF';
          const cardBorder = isDarkMode ? '#374151' : '#E5E7EB';
          const titleColor = isDarkMode ? '#F9FAFB' : '#111827';
          const labelColor = isDarkMode ? '#9CA3AF' : '#6B7280';
          const valueColor = isDarkMode ? '#F9FAFB' : '#111827';

          const labelStyle = `color:${labelColor};font-weight:500;`;
          const valueStyle = `color:${valueColor};font-weight:600;text-align:right;`;

          return [
            `<div style="min-width:220px;max-width:280px;padding:12px 14px;border-radius:12px;background:${cardBg};border:1px solid ${cardBorder};box-shadow:${chartTheme.tooltipShadow};">`,
            `<div style="font-size:14px;font-weight:700;color:${titleColor};margin-bottom:8px;">${full.user}</div>`,
            `<div style="${lineStyle}"><span style="${labelStyle}">Total Sales</span><span style="${valueStyle}">${formatPieValue(full.totalSales)} (${formatPieValue(full.totalSalesCount)})</span></div>`,
            `<div style="${lineStyle}"><span style="${labelStyle}">Total Refunds</span><span style="${valueStyle}">${formatPieValue(full.totalRefunds)} (${formatPieValue(full.totalRefundsCount)})</span></div>`,
            `<div style="${lineStyle}"><span style="${labelStyle}">Total Voids</span><span style="${valueStyle}">${formatPieValue(full.totalVoids)} (${formatPieValue(full.totalVoidsCount)})</span></div>`,
            `<div style="height:1px;background:${cardBorder};margin:8px 0;"></div>`,
            `<div style="${lineStyle}"><span style="${labelStyle}">Net Amount</span><span style="${valueStyle}">${formatPieValue(full.netAmount)}</span></div>`,
            '</div>',
          ].join('');
        },
      },
      plotOptions: {
        column: {
          stacking: 'normal',
          borderWidth: 0,
        },
      },
      series: [
        {
          name: 'Total Refunds',
          type: 'column',
          color: '#F59E0B',
          data: userWiseRechartsData.map((item) => ({ y: item.totalRefunds, custom: item })),
        },
        {
          name: 'Total Voids',
          type: 'column',
          color: '#EF4444',
          data: userWiseRechartsData.map((item) => ({ y: item.totalVoids, custom: item })),
        },
        {
          name: 'Total Sales',
          type: 'column',
          color: chartTheme.salesBar,
          data: userWiseRechartsData.map((item) => ({ y: item.totalSales, custom: item })),
        },
      ],
    }),
    [userWiseRechartsData, isSmallScreen, chartTheme, formatPieValue],
  );

  const dailyLocationWiseOptions = useMemo(
    () => ({
      chart: {
        backgroundColor: chartTheme.chartBg,
        plotBackgroundColor: chartTheme.plotBg,
        plotBorderWidth: 0,
        height: isSmallScreen ? 300 : 400,
        scrollablePlotArea: isSmallScreen ? { minWidth: Math.max(700, dailyLocChartData.length * 72), scrollPositionX: 0 } : undefined,
      },
      credits: { enabled: false },
      title: { text: null },
      xAxis: {
        categories: dailyLocChartData.map((item) => item.label || item.date),
        labels: {
          style: { color: chartTheme.tickColor, fontSize: isSmallScreen ? '9px' : '11px', textOutline: 'none' },
          rotation: isSmallScreen ? -45 : -30,
        },
        lineColor: chartTheme.axisStroke,
      },
      yAxis: [
        {
          title: { text: 'Sales', style: { color: chartTheme.labelColor, fontSize: '11px' } },
          labels: { style: { color: chartTheme.tickColor, textOutline: 'none' } },
          gridLineColor: chartTheme.gridStroke,
        },
        {
          title: { text: 'Total sales', style: { color: '#EF4444', fontSize: '11px' } },
          labels: { style: { color: '#EF4444' } },
          opposite: true,
          gridLineWidth: 0,
        },
      ],
      legend: {
        itemStyle: { color: chartTheme.legendColor, fontSize: '12px', fontWeight: '600' },
        itemHoverStyle: { color: chartTheme.tooltipText },
        itemHiddenStyle: { color: chartTheme.legendMuted },
      },
      tooltip: {
        shared: true,
        backgroundColor: chartTheme.tooltipBg,
        borderColor: chartTheme.tooltipBorder,
        style: { color: chartTheme.tooltipText },
      },
      plotOptions: {
        column: {
          borderWidth: 0,
        },
      },
      series: [
        ...dailyLocNames.map((name, i) => ({
          type: 'column',
          name,
          color: DAILY_LOC_COLORS[i % DAILY_LOC_COLORS.length],
          data: dailyLocChartData.map((item) => Number(item[name] || 0)),
          yAxis: 0,
        })),
        {
          type: 'spline',
          name: 'Total Sales',
          color: '#EF4444',
          yAxis: 1,
          marker: { enabled: true, radius: 3 },
          data: dailyLocChartData.map((item) => Number(item.totalSales || 0)),
        },
      ],
    }),
    [dailyLocChartData, dailyLocNames, isSmallScreen, chartTheme],
  );

  const handleResetDate = () => {
    setIsDateFilterApplied(true);
    setQuickDateFilter(DEFAULT_QUICK_DATE_FILTER);
    setFromDate(DEFAULT_QUICK_DATE_PAYLOAD.FromDate || DEFAULT_QUICK_DATE_PAYLOAD.Date);
    setToDate(DEFAULT_QUICK_DATE_PAYLOAD.ToDate || DEFAULT_QUICK_DATE_PAYLOAD.Date);
  };

  const handleQuickDateChange = (value) => {
    const selected = String(value || DEFAULT_QUICK_DATE_FILTER).trim() || DEFAULT_QUICK_DATE_FILTER;
    const payload = getQuickDatePayload(selected);
    const nextFrom = payload.Date || payload.FromDate || '';
    const nextTo = payload.Date || payload.ToDate || '';

    setQuickDateFilter(selected);
    setFromDate(nextFrom);
    setToDate(nextTo);
    setIsDateFilterApplied(true);
  };

  const handleRefreshDashboard = useCallback(async () => {
    await fetchDashboard();
  }, [fetchDashboard]);

  const renderSectionLoader = useCallback(
    (heightClass = 'h-40', bars) => <ChartSkeleton className={heightClass} bars={bars} />,
    [],
  );

  // Four cards matching website glassmorphism style with Amethyst theme icon badges:
  // 1) Sales + Net Sale, 2) RPL, 3) Refunds/Voids/Chargeback, 4) Leads.
  const summaryCards = [
    {
      key: 'sales',
      title: 'Sales',
      Icon: TrendingUp,
      iconGradient: 'from-violet-500 to-purple-600',
      metrics: [
        { label: 'Total Sales', value: formatPieValue(summary.totalSales), sub: `Count: ${summary.totalSalesCount}` },
        { label: 'Net Sale', value: formatPieValue(summary.netAmount) },
      ],
      progress: summaryExtra.salesTarget > 0
        ? {
          current: summary.totalSales,
          target: summaryExtra.salesTarget,
          label: 'Sales Target',
          targetLabel: formatPieValue(summaryExtra.salesTarget),
        }
        : null,
    },
    {
      key: 'rpl',
      title: 'Revenue Per Lead',
      Icon: Target,
      iconGradient: 'from-indigo-500 to-purple-600',
      metrics: [
        { label: summaryExtra.rplTarget > 0 ? 'RPL' : '', value: formatPieValue(summaryExtra.rpl) },
      ],
      // The target is shown by the progress line below, so no separate row.
      progress: summaryExtra.rplTarget > 0
        ? {
          current: summaryExtra.rpl,
          target: summaryExtra.rplTarget,
          label: 'RPL Target',
          targetLabel: formatPieValue(summaryExtra.rplTarget),
        }
        : null,
    },
    {
      key: 'losses',
      title: 'Refunds / Voids / Chargeback',
      Icon: TrendingDown,
      iconGradient: 'from-rose-500 to-orange-500',
      metrics: [
        { label: 'Refunds', value: formatPieValue(summary.totalRefunds), sub: `Count: ${summary.totalRefundsCount}` },
        { label: 'Voids', value: formatPieValue(summary.totalVoids), sub: `Count: ${summary.totalVoidsCount}` },
        { label: 'Chargeback', value: formatPieValue(summary.totalChargebacks), sub: `Count: ${summary.totalChargebacksCount}` },
      ],
    },
    {
      key: 'leads',
      title: 'Leads',
      Icon: Users,
      iconGradient: 'from-emerald-500 to-teal-500',
      metrics: [
        { label: 'Total Leads', value: formatPieValue(summaryExtra.totalLeads) },
      ],
    },
  ];

  return (
    <div className="p-3 sm:p-4 lg:p-6 relative">
      <style>
        {`
          /* Target progress bars on the Sales / RPL summary cards.
             Colours are deliberately high-luminance so they read on both the
             blue and violet gradient cards. */
          .kpi-progress-bar {
            height: 100%;
            border-radius: 9999px;
            transition:
              width 600ms cubic-bezier(0.22, 1, 0.36, 1),
              background-color 300ms ease,
              box-shadow 300ms ease;
          }

          .kpi-progress-bar--low {
            background-color: #ef4444;
            box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
          }

          .kpi-progress-bar--mid {
            background-color: #f59e0b;
            box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
          }

          .kpi-progress-bar--met {
            background-color: #10b981;
            animation: kpi-progress-pulse 2.2s ease-in-out infinite;
          }

          /* Over target: a flowing mint -> cyan gradient. The gradient repeats
             its first colour at the end so the loop is seamless. */
          .kpi-progress-bar--over {
            background-image: linear-gradient(90deg, #10b981, #06b6d4, #a855f7, #10b981);
            background-size: 200% 100%;
            box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
            animation: kpi-progress-flow 2.4s linear infinite;
          }

          @keyframes kpi-progress-pulse {
            0%, 100% { box-shadow: 0 0 6px rgba(16, 185, 129, 0.35); }
            50% { box-shadow: 0 0 12px rgba(16, 185, 129, 0.7); }
          }

          @keyframes kpi-progress-flow {
            from { background-position: 100% 50%; }
            to { background-position: 0% 50%; }
          }

          .kpi-progress-value {
            transition: color 300ms ease;
          }

          .kpi-progress-value--low { color: #dc2626; }
          .kpi-progress-value--mid { color: #d97706; }
          .kpi-progress-value--met { color: #059669; }
          .kpi-progress-value--over { color: #0d9488; }
          .dark .kpi-progress-value--low { color: #f87171; }
          .dark .kpi-progress-value--mid { color: #fbbf24; }
          .dark .kpi-progress-value--met { color: #34d399; }
          .dark .kpi-progress-value--over { color: #2dd4bf; }

          /* Respect users who ask the OS to limit motion. */
          @media (prefers-reduced-motion: reduce) {
            .kpi-progress-bar {
              transition: none;
            }

            .kpi-progress-bar--met,
            .kpi-progress-bar--over {
              animation: none;
            }
          }


          .dashboard-toolbar-date {
            width: 100%;
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 0.375rem;
            flex-wrap: nowrap !important;
          }

          .dashboard-toolbar-date .liquid-glass-pill-btn {
            width: auto;
            min-width: 0;
            flex: 1 1 auto;
            justify-content: space-between;
            min-width: 170px;
          }

          .dashboard-toolbar-date .liquid-glass-pill-btn span {
            max-width: 165px;
          }

          .dashboard-toolbar-date .liquid-glass-icon-btn {
            flex: 0 0 auto;
          }

          .dashboard-toolbar-refresh-btn {
            flex: 0 0 auto;
          }

          /* Laptops: the sidebar leaves ~1100px of content, so the pill is
             trimmed to keep title + toolbar on a single line. */
          @media (min-width: 1025px) and (max-width: 1440px) {
            .dashboard-toolbar-date .liquid-glass-pill-btn {
              min-width: 150px;
            }

            .dashboard-toolbar-date .liquid-glass-pill-btn span {
              max-width: 126px;
            }
          }

          @media (max-width: 1024px) {
            .dashboard-toolbar-date .liquid-glass-pill-btn {
              min-width: 150px;
            }

            .dashboard-toolbar-date .liquid-glass-pill-btn span {
              max-width: 130px;
            }
          }

          @media (max-width: 768px) {
            .dashboard-toolbar-date .liquid-glass-pill-btn {
              min-width: 138px;
            }

            .dashboard-toolbar-date .liquid-glass-pill-btn span {
              max-width: 112px;
            }
          }

          @media (max-width: 640px) {
            /* No panel chrome on phones - the controls are already full width. */
            .dashboard-toolbar-row {
              border-color: transparent;
              background: transparent;
              box-shadow: none;
              padding: 0;
              backdrop-filter: none;
            }

            .dashboard-toolbar-date-row {
              display: grid;
              grid-template-columns: minmax(0, 1fr) auto;
              align-items: center;
              column-gap: 0.5rem;
            }

            .dashboard-toolbar-date {
              width: 100%;
            }

            .dashboard-toolbar-date-row .liquid-glass-icon-btn {
              flex: 0 0 auto;
            }

            .dashboard-toolbar-date .liquid-glass-pill-btn span {
              max-width: 84px;
            }
          }

          @media (max-width: 420px) {
            .dashboard-toolbar-date {
              gap: 0.3rem;
            }

            .dashboard-toolbar-date .liquid-glass-icon-btn,
            .dashboard-toolbar-refresh-btn {
              width: 30px;
              height: 30px;
            }

            .dashboard-toolbar-date .liquid-glass-pill-btn {
              padding-left: 0.55rem;
              padding-right: 0.55rem;
            }

            .dashboard-toolbar-date .liquid-glass-pill-btn span {
              max-width: 74px;
            }
          }
        `}
      </style>

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 sm:gap-6 lg:gap-7">

          {/* ── Header ── */}
          <div className="flex w-full flex-col gap-3 pt-1 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
            <div className="shrink-0">
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:!text-white">Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:!text-slate-300 mt-0.5">Overview of your business performance</p>
            </div>

            {/* Date controls */}
            <div className="dashboard-toolbar-row flex w-full min-w-0 flex-col gap-2 rounded-2xl border border-gray-200/70 bg-white/70 p-2 shadow-sm backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto xl:flex-nowrap dark:border-slate-700/60 dark:bg-slate-900/40">
              {/* Selects sit side by side as soon as there is room for two. */}
              <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2 w-full sm:w-auto min-w-0">
              {isAdminUser && (
                <div className="flex-1 sm:flex-none sm:w-[200px] lg:w-[176px] xl:w-[210px] min-w-0">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="h-10 w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-100">
                      <SelectValue placeholder="All Sales Persons" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      sideOffset={4}
                      className="min-w-[var(--radix-select-trigger-width)] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-white"
                      search={(
                        <SelectSearchInput
                          value={salesPersonSearchText}
                          onChange={setSalesPersonSearchText}
                          placeholder="Search sales person..."
                        />
                      )}
                    >
                      <SelectItem value="all" className="text-gray-700 dark:text-white focus:dark:bg-slate-800">All Sales Persons</SelectItem>
                      {salesPersonOptions.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-gray-500 dark:text-slate-400">No users found.</div>
                      ) : (
                        salesPersonOptions.map((user) => (
                          <SelectItem
                            key={user.id}
                            value={String(user.id)}
                            className="text-gray-700 dark:text-white focus:dark:bg-slate-800"
                            meta={<UserOptionBadges user={user} />}
                          >
                            {user.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex-1 sm:flex-none sm:w-[172px] lg:w-[150px] xl:w-[182px] min-w-0">
                <Select value={quickDateFilter} onValueChange={handleQuickDateChange}>
                  <SelectTrigger className="h-10 w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-100">
                    <SelectValue placeholder="Current Month" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="min-w-[var(--radix-select-trigger-width)] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-white">
                    {[...QUICK_DATE_FILTERS, ...YEAR_FILTER_OPTIONS].map((item) => (
                      <SelectItem key={item.value} value={item.value} className="text-gray-700 dark:text-white focus:dark:bg-slate-800">{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </div>

              <div className="dashboard-toolbar-date-row w-full sm:w-auto min-w-0 flex items-center gap-2">
                <LiquidGlassDatePicker
                  className="dashboard-toolbar-date"
                  key={`dashboard-date-${fromDate || ''}-${toDate || ''}`}
                  initialFromDate={fromDate || ''}
                  initialToDate={toDate || ''}
                  emptyLabel="This month"
                  showQuickDateDropdown={false}
                  showClearButton={false}
                  onChange={(from, to) => { setFromDate(from); setToDate(to); setIsDateFilterApplied(true); }}
                  onClear={handleResetDate}
                />
                <TableRefreshButton
                  className="dashboard-toolbar-refresh-btn"
                  title="Refresh dashboard"
                  onClick={handleRefreshDashboard}
                  triggerPageRefresh={false}
                  disabled={loading}
                  loading={loading}
                />
              </div>
            </div>
          </div>

          {/* ── Top row: stat cards + pie chart ── */}
          <div className="flex flex-col gap-4 lg:gap-5 xl:flex-row xl:items-stretch">

            {/* Summary stat cards: Sales+Net, RPL, Refunds/Voids/Chargeback, Leads */}
            <div className={`grid auto-rows-fr gap-2.5 sm:gap-4 ${isAdminUser ? 'grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 xl:w-[48%] xl:flex-none xl:shrink-0' : 'grid-cols-2 sm:grid-cols-4 w-full'}`}>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <DashboardStatCardSkeleton key={`dashboard-stat-skeleton-${index}`} list={index === 2} />
                ))
              ) : (
                summaryCards.map((card) => {
                  const CardIcon = card.Icon;
                  const isList = card.metrics.length >= 3;
                  const [hero, ...rest] = card.metrics;
                  const progress = card.progress;
                  // Uncapped: beating the target reads 120%, not a flat 100%.
                  const progressPct = progress && progress.target > 0
                    ? Math.round((progress.current / progress.target) * 100)
                    : 0;
                  // The bar itself still stops at full width.
                  const progressBarPct = Math.min(100, Math.max(0, progressPct));
                  // Achievement bands drive the bar colour: behind / closing /
                  // hit / beaten. Over-target gets motion rather than a fourth
                  // hue, so it stays distinct on both the blue and violet cards.
                  const progressState = progressPct > 100
                    ? 'over'
                    : progressPct >= 100
                      ? 'met'
                      : progressPct >= 75
                        ? 'mid'
                        : 'low';
                  const progressBlock = progress ? (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs">
                        <span className="font-medium text-gray-500 dark:text-slate-400 truncate">{progress.label}: {progress.targetLabel}</span>
                        <span className={`kpi-progress-value kpi-progress-value--${progressState} font-bold tabular-nums whitespace-nowrap`}>
                          {progressPct}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                        <div
                          className={`kpi-progress-bar kpi-progress-bar--${progressState}`}
                          style={{ width: `${progressBarPct}%` }}
                        />
                      </div>
                    </div>
                  ) : null;
                  return (
                    <div
                      key={card.key}
                      className="relative flex min-h-[140px] flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:min-h-[170px] sm:p-5"
                    >
                      <div className="relative flex flex-1 flex-col">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 pr-1 text-[10px] font-semibold uppercase leading-snug tracking-[0.08em] text-gray-500 dark:text-slate-400 sm:text-xs">{card.title}</span>
                          <div className={`flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br ${card.iconGradient} text-white shadow-sm shrink-0`}>
                            <CardIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </div>
                        </div>

                        <div className="mt-2 flex flex-1 flex-col justify-center">
                          {isList ? (
                            <div className="space-y-2 sm:space-y-2.5">
                              {card.metrics.map((m) => (
                                <div key={m.label} className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-[11px] sm:text-sm font-semibold text-gray-700 dark:text-slate-200 truncate">{m.label}</div>
                                    {m.sub ? <div className="text-[9px] sm:text-[10px] text-gray-400 dark:text-slate-500">{m.sub}</div> : null}
                                  </div>
                                  <div className="whitespace-nowrap font-bold leading-none tabular-nums text-gray-900 dark:text-white text-[clamp(0.95rem,3.2vw,1.2rem)]">{m.value}</div>
                                </div>
                              ))}
                            </div>
                          ) : rest.length ? (
                            <div className="min-w-0">
                              <div className="font-bold leading-none tabular-nums break-words text-gray-900 dark:text-white text-[clamp(1.35rem,4.5vw,2rem)]">{hero.value}</div>
                              {hero.sub ? <div className="mt-1 text-[10px] sm:text-xs text-gray-400 dark:text-slate-500">{hero.sub}</div> : null}
                              {progressBlock}
                              {rest.map((m) => (
                                <div key={m.label} className="mt-2.5 flex items-center justify-between gap-2 border-t border-gray-100 dark:border-slate-800/80 pt-2 sm:pt-2.5">
                                  <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-400 truncate">{m.label}</span>
                                  <span className="font-bold tabular-nums whitespace-nowrap text-gray-900 dark:text-white text-[clamp(0.9rem,3.2vw,1.15rem)]">{m.value}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="min-w-0">
                              {hero.label ? <div className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-400 truncate">{hero.label}</div> : null}
                              <div className="mt-1 font-bold leading-none tabular-nums break-words text-gray-900 dark:text-white text-[clamp(1.6rem,5.5vw,2.75rem)]">{hero.value}</div>
                              {hero.sub ? <div className="mt-1.5 text-[10px] sm:text-xs text-gray-400 dark:text-slate-500">{hero.sub}</div> : null}
                              {progressBlock}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie chart - right side of top row */}
            {showFullDashboard && (
              <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-md transition-shadow duration-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:p-5">
                <div className="flex items-center gap-2 sm:gap-3 mb-4">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm shrink-0">
                    <PieChart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white truncate">Location-wise Monthly Breakdown</h2>
                    <p className="text-[10px] sm:text-xs text-gray-400 dark:text-slate-400">Total sales distribution by location</p>
                  </div>
                </div>
                <div className="flex-1">
                  {loading ? (
                    <DonutChartSkeleton />
                  ) : locationWiseSales.length === 0 ? (
                    <ChartEmptyState
                      icon={PieChart}
                      title="No location sales yet"
                      description="Location totals for the selected period will appear here."
                    />
                  ) : (
                    <HighchartsReact highcharts={Highcharts} options={locationPieOptions} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Bar Charts ── */}
          <div className="flex flex-col gap-4 sm:gap-5">

            {/* Day-wise bar chart */}
            <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-md transition-shadow duration-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-sm shrink-0">
                  <BarChart2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white truncate">Day-wise Sales &amp; Leads Forecast</h2>
                  <p className="text-[10px] sm:text-xs text-gray-400 dark:text-slate-400">Daily total sales &amp; RPL forecast against the target base line</p>
                </div>
              </div>
              <div className="w-full">
                {loading ? (
                  renderSectionLoader('h-[320px] sm:h-[400px]', [44, 68, 54, 82, 60, 91, 72, 48, 76, 64, 88, 58])
                ) : dayWiseSalesAndRpl.length === 0 ? (
                  <ChartEmptyState
                    icon={BarChart2}
                    title="No daily performance data"
                    description="Try another date range or sales person to view the daily forecast."
                    className="h-[320px] sm:h-[400px]"
                  />
                ) : (
                  <HighchartsReact highcharts={Highcharts} options={dayWiseOptions} />
                )}
              </div>
            </div>

            {showFullDashboard && (
              <>
                {/* User-wise bar chart */}
                <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-md transition-shadow duration-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:p-5">
                  <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm shrink-0">
                      <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white truncate">User-wise Financial Summary</h2>
                      <p className="text-[10px] sm:text-xs text-gray-400 dark:text-slate-400">Stacked sales, refunds and voids per agent</p>
                    </div>
                  </div>
                  <div className="w-full">
                    <div>
                      {loading ? (
                        renderSectionLoader('h-[320px] sm:h-[460px]', [76, 48, 88, 62, 94, 55, 80, 68])
                      ) : userWiseRechartsData.length === 0 ? (
                        <ChartEmptyState
                          icon={Users}
                          title="No agent totals available"
                          description="User financial totals for the selected period will appear here."
                          className="h-[320px] sm:h-[460px]"
                        />
                      ) : (
                        <HighchartsReact highcharts={Highcharts} options={userWiseOptions} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Location-wise Daily Sales chart */}
                <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-md transition-shadow duration-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:p-5">
                  <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white truncate">Location Wise Daily Sales</h2>
                      <p className="text-[10px] sm:text-xs text-gray-400 dark:text-slate-400">Daily sales per location with total sales trend</p>
                    </div>
                  </div>
                  <div className="w-full">
                    {loading ? (
                      renderSectionLoader('h-[300px] sm:h-[400px]', [52, 78, 64, 90, 56, 84, 70, 94, 62, 80])
                    ) : dailyLocChartData.length === 0 ? (
                      <ChartEmptyState
                        icon={MapPin}
                        title="No location trend data"
                        description="Daily location sales will appear after transactions are recorded."
                        className="h-[300px] sm:h-[400px]"
                      />
                    ) : (
                      <HighchartsReact highcharts={Highcharts} options={dailyLocationWiseOptions} />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
      </div>
    </div>
  );
};

export { DashboardPage };
export default DashboardPage;
