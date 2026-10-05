import { useCallback, useEffect, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  Activity,
  Award,
  BarChart3,
  CircleDollarSign,
  DollarSign,
  MapPin,
  Percent,
  RefreshCw,
  RotateCcw,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users
} from 'lucide-react';

import LiquidGlassDatePicker from '@/components/common/LiquidGlassDatePicker';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import { ChartSkeleton, DashboardStatCardSkeleton, TableSkeletonRows } from '@/components/common/skeleton-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import performanceDashboardService from '@/services/performanceDashboardService';
import { aggregatePerformance, currentMonthRange, getQuickDateRange } from './performanceDashboardUtils';

const QUICK_FILTERS = [
  'Today',
  'Yesterday',
  'Last Week',
  'Current Month',
  'Last Month',
  'This Year',
  'Last Year',
  'Current year',
  'Previous year'
];

const TIER_FILTERS = [
  ['all', 'All tiers'],
  ['top', 'Top'],
  ['solid', 'Solid'],
  ['dev', 'Dev'],
  ['review', 'Review']
];

const TIER_META = {
  'Top Performer': {
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
    bar: 'bg-emerald-500',
    color: '#10b981'
  },
  Solid: {
    text: 'text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30',
    bar: 'bg-violet-500',
    color: '#8b5cf6'
  },
  Developing: {
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
    bar: 'bg-amber-500',
    color: '#f59e0b'
  },
  'Needs Review': {
    text: 'text-rose-700 dark:text-rose-300',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
    bar: 'bg-rose-500',
    color: '#f43f5e'
  }
};

const TAB_OPTIONS = [
  ['rankings', 'Rankings', Award],
  ['analytics', 'Analytics', BarChart3],
  ['profiles', 'Profiles', Users]
];

const initialRange = currentMonthRange();
const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const numberFormatter = new Intl.NumberFormat('en-US');

const formatMoney = (value) => moneyFormatter.format(Number(value) || 0);
const formatNumber = (value) => numberFormatter.format(Math.round(Number(value) || 0));
const formatPercent = (value) => `${(Number(value) || 0).toFixed(1)}%`;
const formatCompactMoney = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(value) || 0
  );

const formatRangeDate = (value) => {
  if (!value) return 'All dates';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const initials = (name) =>
  String(name || 'Unassigned')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const tierMatches = (row, filter) => {
  if (filter === 'all') return true;
  if (filter === 'top') return row.tier === 'Top Performer';
  if (filter === 'solid') return row.tier === 'Solid';
  if (filter === 'dev') return row.tier === 'Developing';
  return row.tier === 'Needs Review';
};

const achievementClass = (value) => {
  if (value >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
};

function TierBadge({ tier }) {
  const meta = TIER_META[tier] || TIER_META['Needs Review'];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${meta.badge}`}>
      {tier}
    </span>
  );
}

function EmptyState({ profiles = false }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-5 text-center dark:border-slate-800 dark:bg-slate-950/50">
      <Users className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-700" />
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {profiles ? 'No profiles available for selected filters.' : 'No data available for selected date range.'}
      </p>
      <p className="mt-1 text-xs text-slate-400">Try another date range, tier, or location.</p>
    </div>
  );
}

function ProfileSkeletonCard() {
  return (
    <div className="dashboard-skeleton-wave overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <div className="skeleton-circle h-12 w-12" />
        <div className="flex-1 space-y-2">
          <div className="skeleton-block h-4 w-32" />
          <div className="skeleton-block h-3 w-20" />
        </div>
        <div className="skeleton-block h-6 w-20 rounded-full" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton-block h-14 rounded-xl" />
        ))}
      </div>
      <div className="skeleton-block mt-5 h-2 w-full rounded-full" />
    </div>
  );
}

function MobileRankingSkeleton() {
  return (
    <div className="space-y-3 md:hidden">
      {Array.from({ length: 5 }).map((_, index) => (
        <ProfileSkeletonCard key={index} />
      ))}
    </div>
  );
}

export default function PerformanceDashboardPage() {
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);
  const [quickFilter, setQuickFilter] = useState('Current Month');
  const [tierFilter, setTierFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('rankings');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    performanceDashboardService
      .load({ fromDate, toDate }, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setRows(aggregatePerformance({ ...payload, toDate }));
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setRows([]);
        setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load employee performance data.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [fromDate, toDate, refreshKey]);

  const locations = useMemo(() => [...new Set(rows.map((row) => row.location).filter(Boolean))].sort(), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((row) => tierMatches(row, tierFilter) && (locationFilter === 'all' || row.location === locationFilter)),
    [locationFilter, rows, tierFilter]
  );

  const summary = useMemo(() => {
    const totals = filteredRows.reduce(
      (result, row) => ({
        totalSales: result.totalSales + row.totalSales,
        salesCount: result.salesCount + row.salesCount,
        totalRefunds: result.totalRefunds + row.totalRefunds,
        refundsCount: result.refundsCount + row.refundsCount,
        totalLeads: result.totalLeads + row.totalLeads,
        conversionTotal: result.conversionTotal + row.conversionRate
      }),
      { totalSales: 0, salesCount: 0, totalRefunds: 0, refundsCount: 0, totalLeads: 0, conversionTotal: 0 }
    );
    return {
      ...totals,
      netRevenue: totals.totalSales - totals.totalRefunds,
      revenuePerLead: totals.totalLeads ? totals.totalSales / totals.totalLeads : 0,
      conversionRate: filteredRows.length ? totals.conversionTotal / filteredRows.length : 0,
      refundRate: totals.totalSales ? (totals.totalRefunds / totals.totalSales) * 100 : 0,
      agents: filteredRows.length
    };
  }, [filteredRows]);

  const tierCounts = useMemo(
    () => Object.keys(TIER_META).map((tier) => ({ tier, count: filteredRows.filter((row) => row.tier === tier).length })),
    [filteredRows]
  );

  const summaryCards = [
    {
      label: 'Net Revenue',
      value: formatMoney(summary.netRevenue),
      caption: 'After refunds',
      Icon: DollarSign,
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      label: 'Adj. Gross Revenue',
      value: formatMoney(summary.totalSales),
      caption: `${formatNumber(summary.salesCount)} transactions`,
      Icon: TrendingUp,
      gradient: 'from-violet-500 to-purple-600'
    },
    {
      label: 'Revenue Per Lead',
      value: formatMoney(summary.revenuePerLead),
      caption: 'Average gross basis',
      Icon: CircleDollarSign,
      gradient: 'from-cyan-500 to-blue-600'
    },
    {
      label: 'Conversion Rate',
      value: formatPercent(summary.conversionRate),
      caption: 'Team average',
      Icon: Percent,
      gradient: 'from-indigo-500 to-violet-600'
    },
    {
      label: 'Total Leads',
      value: formatNumber(summary.totalLeads),
      caption: 'From selected filters',
      Icon: Users,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      label: 'Total Sales',
      value: formatNumber(summary.salesCount),
      caption: 'Closed deals',
      Icon: Target,
      gradient: 'from-fuchsia-500 to-purple-600'
    },
    {
      label: 'Total Refunds',
      value: formatMoney(summary.totalRefunds),
      caption: `${formatPercent(summary.refundRate)} of sales`,
      Icon: TrendingDown,
      gradient: 'from-rose-500 to-orange-500'
    },
    {
      label: 'Agents',
      value: formatNumber(summary.agents),
      caption: 'Agents in current segment',
      Icon: UserRound,
      gradient: 'from-amber-500 to-orange-500'
    }
  ];

  const handleQuickFilter = (value) => {
    const range = getQuickDateRange(value);
    setQuickFilter(value);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  };

  const handleDateChange = (from, to) => {
    setQuickFilter('Custom');
    setFromDate(from);
    setToDate(to);
  };

  const handleClearDates = () => {
    setQuickFilter('Custom');
    setFromDate('');
    setToDate('');
  };

  const resetFilters = useCallback(() => {
    const range = currentMonthRange();
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setQuickFilter('Current Month');
    setTierFilter('all');
    setLocationFilter('all');
  }, []);

  const averages = useMemo(
    () => ({
      revenue: filteredRows.length ? filteredRows.reduce((sum, row) => sum + row.netRevenue, 0) / filteredRows.length : 0,
      rpl: filteredRows.length ? filteredRows.reduce((sum, row) => sum + row.revenuePerLead, 0) / filteredRows.length : 0
    }),
    [filteredRows]
  );

  const commonChartOptions = {
    chart: { backgroundColor: 'transparent', style: { fontFamily: 'Inter, sans-serif' } },
    credits: { enabled: false },
    legend: { enabled: false },
    title: { text: null },
    accessibility: { enabled: false },
    tooltip: { backgroundColor: '#0f172a', borderWidth: 0, style: { color: '#f8fafc' } },
    xAxis: { lineColor: '#cbd5e1', tickColor: '#cbd5e1', labels: { style: { color: '#64748b', fontSize: '11px' } } },
    yAxis: { gridLineColor: 'rgba(148,163,184,.18)', labels: { style: { color: '#64748b', fontSize: '11px' } }, title: { text: null } }
  };

  const quadrantOptions = useMemo(
    () => ({
      ...commonChartOptions,
      chart: { ...commonChartOptions.chart, type: 'scatter', height: 390, zoomType: 'xy' },
      xAxis: {
        ...commonChartOptions.xAxis,
        title: { text: 'Net Revenue', style: { color: '#64748b' } },
        plotLines: [{ value: averages.revenue, color: '#94a3b8', dashStyle: 'Dash', width: 1, zIndex: 2 }]
      },
      yAxis: {
        ...commonChartOptions.yAxis,
        title: { text: 'Revenue Per Lead', style: { color: '#64748b' } },
        plotLines: [{ value: averages.rpl, color: '#94a3b8', dashStyle: 'Dash', width: 1, zIndex: 2 }]
      },
      tooltip: { ...commonChartOptions.tooltip, pointFormat: '<b>{point.name}</b><br/>Net: ${point.x:,.2f}<br/>RPL: ${point.y:,.2f}' },
      series: [
        {
          data: filteredRows.map((row) => ({ name: row.name, x: row.netRevenue, y: row.revenuePerLead, color: TIER_META[row.tier].color }))
        }
      ]
    }),
    [averages, filteredRows]
  );

  const makeBarOptions = useCallback(
    (metric, averageLine = null) => {
      const chartRows = [...filteredRows]
        .sort((left, right) => right[metric] - left[metric])
        .slice(0, 14)
        .reverse();
      return {
        ...commonChartOptions,
        chart: { ...commonChartOptions.chart, type: 'bar', height: Math.max(340, chartRows.length * 34) },
        xAxis: { ...commonChartOptions.xAxis, categories: chartRows.map((row) => row.name) },
        yAxis: {
          ...commonChartOptions.yAxis,
          plotLines: averageLine === null ? [] : [{ value: averageLine, color: '#94a3b8', dashStyle: 'Dash', width: 1, zIndex: 3 }]
        },
        plotOptions: { series: { borderRadius: 4, pointWidth: 16 } },
        tooltip: { ...commonChartOptions.tooltip, pointFormat: '<b>${point.y:,.2f}</b>' },
        series: [{ data: chartRows.map((row) => ({ y: row[metric], color: TIER_META[row.tier].color })) }]
      };
    },
    [filteredRows]
  );

  const netRevenueOptions = useMemo(() => makeBarOptions('netRevenue'), [makeBarOptions]);
  const rplOptions = useMemo(() => makeBarOptions('revenuePerLead', averages.rpl), [averages.rpl, makeBarOptions]);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-violet-50/40 p-3 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/10 sm:p-5 lg:p-6">
      <section className="mx-auto max-w-[1800px] overflow-visible rounded-2xl border border-slate-200/70 bg-white/55 p-3 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/60 sm:p-5 lg:p-6">
        <div className="relative z-50 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-600" />
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Employee Performance Dashboard
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Ranking and revenue overview for {formatRangeDate(fromDate)} - {formatRangeDate(toDate)}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 rounded-2xl border border-white/80 bg-white/75 p-2 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/60 xl:w-auto">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:flex">
              <Select value={quickFilter} onValueChange={handleQuickFilter}>
                <SelectTrigger className="h-10 min-w-[150px] rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  {quickFilter === 'Custom' && <SelectItem value="Custom">Custom range</SelectItem>}
                  {QUICK_FILTERS.map((filter) => (
                    <SelectItem key={filter} value={filter}>
                      {filter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="h-10 min-w-[130px] rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  {TIER_FILTERS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-10 min-w-[160px] rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <LiquidGlassDatePicker
                className="min-w-0 flex-1"
                initialFromDate={fromDate}
                initialToDate={toDate}
                emptyLabel="All dates"
                showClearButton
                onChange={handleDateChange}
                onClear={handleClearDates}
                stretch
              />
              <TableRefreshButton
                title="Refresh performance dashboard"
                onClick={() => setRefreshKey((value) => value + 1)}
                disabled={loading}
                loading={loading}
              />
              <button
                type="button"
                onClick={resetFilters}
                className="liquid-glass-icon-btn shrink-0"
                title="Reset filters"
                aria-label="Reset filters"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="inline-flex items-center gap-1.5 font-semibold"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        <div className="mt-5 grid auto-rows-fr grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          {loading
            ? Array.from({ length: 8 }).map((_, index) => <DashboardStatCardSkeleton key={index} />)
            : summaryCards.map(({ label, value, caption, Icon, gradient }) => (
                <article
                  key={label}
                  className="relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-500 dark:text-slate-400">{label}</span>
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-auto pt-4">
                    <div className="truncate text-xl font-bold tabular-nums text-slate-900 dark:text-white" title={value}>
                      {value}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{caption}</p>
                  </div>
                </article>
              ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="dashboard-skeleton-wave rounded-2xl border border-slate-200/70 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="skeleton-block h-3 w-24" />
                  <div className="skeleton-block mt-3 h-7 w-14" />
                </div>
              ))
            : tierCounts.map(({ tier, count }) => {
                const meta = TIER_META[tier];
                return (
                  <div
                    key={tier}
                    className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold ${meta.text}`}>{tier}</span>
                      <span className="text-xl font-bold text-slate-900 dark:text-white">{count}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${meta.bar}`}
                        style={{ width: `${filteredRows.length ? (count / filteredRows.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
        </div>
        {!loading && (
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {tierCounts
              .filter(({ count }) => count > 0)
              .map(({ tier, count }) => (
                <div
                  key={tier}
                  className={TIER_META[tier].bar}
                  style={{ width: `${(count / Math.max(1, filteredRows.length)) * 100}%` }}
                  title={`${tier}: ${count}`}
                />
              ))}
          </div>
        )}

        <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-800 dark:bg-slate-900/70">
          {TAB_OPTIONS.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === value ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === 'rankings' && (
            <>
              {loading ? (
                <MobileRankingSkeleton />
              ) : filteredRows.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-3 md:hidden">
                  {filteredRows.map((row) => (
                    <MobileRankingCard key={row.key} row={row} />
                  ))}
                </div>
              )}
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 dark:border-slate-800 dark:bg-slate-950 md:block">
                <div className="max-h-[720px] overflow-auto">
                  <table className="min-w-[1560px] w-full border-separate border-spacing-0 text-left text-xs">
                    <thead className="sticky top-0 z-30 bg-slate-50/95 text-[10px] uppercase tracking-wider text-slate-500 backdrop-blur dark:bg-slate-900/95 dark:text-slate-400">
                      <tr>
                        <th
                          className="sticky left-0 z-40 w-16 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-center dark:border-slate-800 dark:bg-slate-900"
                          rowSpan="2"
                        >
                          #
                        </th>
                        <th
                          className="sticky left-16 z-40 min-w-[210px] border-b border-r border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900"
                          rowSpan="2"
                        >
                          Agent
                        </th>
                        <th className="border-b border-slate-200 px-3 py-2 dark:border-slate-800" rowSpan="2">
                          Location
                        </th>
                        <th className="border-b border-slate-200 px-3 py-2 text-center dark:border-slate-800" colSpan="3">
                          Activity
                        </th>
                        <th className="border-b border-slate-200 px-3 py-2 text-center dark:border-slate-800" colSpan="3">
                          Efficiency
                        </th>
                        <th className="border-b border-slate-200 px-3 py-2 text-center dark:border-slate-800" colSpan="3">
                          Targets
                        </th>
                        <th className="border-b border-slate-200 px-3 py-2 text-center dark:border-slate-800" colSpan="2">
                          Result
                        </th>
                      </tr>
                      <tr>
                        {[
                          'Leads',
                          'Sales',
                          'Refunds',
                          'Net Revenue',
                          'Conv %',
                          'Rev / Lead',
                          'Sales Target',
                          'Target %',
                          'RPL Target %',
                          'Overall %',
                          'Tier'
                        ].map((heading) => (
                          <th key={heading} className="border-b border-slate-200 px-3 py-2 text-right dark:border-slate-800">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <TableSkeletonRows rows={8} columns={14} cellClassName="px-3 py-4" />
                      ) : (
                        filteredRows.map((row, index) => <RankingRow key={row.key} row={row} striped={index % 2 === 1} />)
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'analytics' &&
            (loading ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="xl:col-span-2">
                  <ChartSkeleton className="h-[390px]" />
                </div>
                <ChartSkeleton className="h-[420px]" />
                <ChartSkeleton className="h-[420px]" />
              </div>
            ) : filteredRows.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartPanel className="xl:col-span-2" title="Performance Quadrant" subtitle="Net revenue versus revenue per lead">
                  <HighchartsReact highcharts={Highcharts} options={quadrantOptions} />
                </ChartPanel>
                <ChartPanel title="Net Revenue by Agent" subtitle="After refunds and chargebacks">
                  <HighchartsReact highcharts={Highcharts} options={netRevenueOptions} />
                </ChartPanel>
                <ChartPanel title="Revenue Per Lead" subtitle="Dashed line shows the team average">
                  <HighchartsReact highcharts={Highcharts} options={rplOptions} />
                </ChartPanel>
              </div>
            ))}

          {activeTab === 'profiles' &&
            (loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ProfileSkeletonCard key={index} />
                ))}
              </div>
            ) : filteredRows.length === 0 ? (
              <EmptyState profiles />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredRows.map((row) => (
                  <ProfileCard key={row.key} row={row} />
                ))}
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

function RankMark({ rank }) {
  const style =
    rank === 1
      ? 'bg-amber-100 text-amber-700'
      : rank === 2
        ? 'bg-slate-200 text-slate-700'
        : rank === 3
          ? 'bg-orange-100 text-orange-700'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-extrabold ${style}`}>
      {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
    </span>
  );
}

function RankingRow({ row, striped }) {
  const stickyBackground = striped ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-950';
  return (
    <tr className={`${striped ? 'bg-slate-50 dark:bg-slate-900' : ''} group hover:bg-violet-50/50 dark:hover:bg-violet-500/5`}>
      <td
        className={`sticky left-0 z-10 border-r border-slate-100 px-3 py-3 text-center dark:border-slate-800 ${stickyBackground} group-hover:bg-violet-50 dark:group-hover:bg-slate-900`}
      >
        <RankMark rank={row.rank} />
      </td>
      <td
        className={`sticky left-16 z-10 border-r border-slate-100 px-4 py-3 dark:border-slate-800 ${stickyBackground} group-hover:bg-violet-50 dark:group-hover:bg-slate-900`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 font-bold text-white">
            {initials(row.name)}
          </span>
          <span className="font-semibold text-slate-800 dark:text-white">{row.name}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{row.location}</td>
      <Cell>{formatNumber(row.totalLeads)}</Cell>
      <Cell>
        {formatMoney(row.totalSales)}
        <small className="ml-1 block text-[10px] text-slate-400">{formatNumber(row.salesCount)} sales</small>
      </Cell>
      <Cell className="text-rose-600 dark:text-rose-400">{formatMoney(row.totalRefunds)}</Cell>
      <Cell className={row.netRevenue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
        {formatMoney(row.netRevenue)}
      </Cell>
      <Cell>{formatPercent(row.conversionRate)}</Cell>
      <Cell>{formatMoney(row.revenuePerLead)}</Cell>
      <Cell>{row.salesTarget ? formatMoney(row.salesTarget) : '—'}</Cell>
      <Cell className={achievementClass(row.targetAchievement)}>{row.targetToDate ? formatPercent(row.targetAchievement) : '—'}</Cell>
      <Cell className={achievementClass(row.rplAchievement)}>{row.rplTarget ? formatPercent(row.rplAchievement) : '—'}</Cell>
      <Cell className={achievementClass(row.overallAchievement)}>{row.hasTargets ? formatPercent(row.overallAchievement) : '—'}</Cell>
      <td className="px-3 py-3 text-right">
        <TierBadge tier={row.tier} />
      </td>
    </tr>
  );
}

function Cell({ children, className = '' }) {
  return (
    <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200 ${className}`}>
      {children}
    </td>
  );
}

function MobileRankingCard({ row }) {
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3">
        <RankMark rank={row.rank} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-slate-900 dark:text-white">{row.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3 w-3" />
            {row.location}
          </p>
        </div>
        <TierBadge tier={row.tier} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Overall" value={row.hasTargets ? formatPercent(row.overallAchievement) : '—'} />
        <Metric label="Sales" value={`${formatCompactMoney(row.totalSales)} · ${formatNumber(row.salesCount)}`} />
        <Metric label="Net Revenue" value={formatCompactMoney(row.netRevenue)} />
        <Metric label="Refunds" value={formatCompactMoney(row.totalRefunds)} />
        <Metric label="Leads" value={formatNumber(row.totalLeads)} />
        <Metric label="Conversion" value={formatPercent(row.conversionRate)} />
        <Metric label="Revenue / Lead" value={formatMoney(row.revenuePerLead)} />
        <Metric label="Sales Target" value={row.salesTarget ? formatCompactMoney(row.salesTarget) : '—'} />
        <Metric label="Target %" value={row.targetToDate ? formatPercent(row.targetAchievement) : '—'} />
        <Metric label="RPL Target %" value={row.rplTarget ? formatPercent(row.rplAchievement) : '—'} />
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 truncate font-bold tabular-nums text-slate-800 dark:text-white" title={value}>
        {value}
      </div>
    </div>
  );
}

function ChartPanel({ title, subtitle, children, className = '' }) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5 ${className}`}
    >
      <div className="mb-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function ProfileCard({ row }) {
  const meta = TIER_META[row.tier];
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-extrabold text-white shadow-sm">
          {initials(row.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-slate-900 dark:text-white">{row.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3 w-3" />
            {row.location}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase text-slate-400">Rank</div>
          <div className="text-lg font-extrabold text-slate-800 dark:text-white">#{row.rank}</div>
        </div>
      </div>
      <div className="mt-4">
        <TierBadge tier={row.tier} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Net Revenue" value={formatMoney(row.netRevenue)} />
        <Metric label="Revenue / Lead" value={formatMoney(row.revenuePerLead)} />
        <Metric label="Sales" value={formatNumber(row.salesCount)} />
        <Metric label="Conversion" value={formatPercent(row.conversionRate)} />
      </div>
      <div className="mt-5 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-500 dark:text-slate-400">Performance score</span>
        <span className={`font-extrabold ${meta.text}`}>{row.score.toFixed(0)} / 100</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full transition-all duration-700 ${meta.bar}`} style={{ width: `${row.score}%` }} />
      </div>
    </article>
  );
}
