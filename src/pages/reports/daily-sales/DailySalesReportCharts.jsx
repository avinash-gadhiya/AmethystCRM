import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';
import { Award, LineChart, MapPin, TrendingUp } from 'lucide-react';

import { formatDailySalesCurrency, formatDailySalesPercentage } from '@/utils/dailySalesReportUtils';

// Project purple palette.
const PURPLE = '#7c3aed';
const PURPLE_SOFT = '#a78bfa';
const MAX_AGENTS = 12;

const RANK_STYLES = [
  'bg-amber-100 text-amber-700 ring-amber-200',
  'bg-slate-200 text-slate-700 ring-slate-300',
  'bg-orange-100 text-orange-700 ring-orange-200'
];

const formatCount = (value) => Math.round(Number(value) || 0).toLocaleString();

// Small dark value pill shown above the hovered point (one row per series).
const pillTooltip =
  (format) =>
  ({ series, dataPointIndex, w }) => {
    const label = w.globals.labels[dataPointIndex] ?? '';
    // Blank-labelled points are the zero padding around a single agent; they have no tooltip.
    if (!String(label).trim()) return '';
    const rows = series
      .map((values, index) => {
        const color = w.globals.colors[index];
        const name = series.length > 1 ? `${w.globals.seriesNames[index]} ` : '';
        return `<div style="display:flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:9999px;background:${color}"></span>${name}<b>${format(values[dataPointIndex])}</b></div>`;
      })
      .join('');
    return `<div style="padding:6px 9px;border-radius:8px;background:#1e1b4b;color:#fff;font-size:11px;line-height:1.5;box-shadow:0 6px 16px -6px rgba(30,27,75,.5)"><div style="opacity:.7">${label}</div>${rows}</div>`;
  };

// Smooth area chart look: gradient fill fading to transparent, points only on hover, dashed guide line.
const areaOptions = ({ categories, colors, format, integerAxis = false, highlightIndex = null }) => ({
  chart: {
    type: 'area',
    background: 'transparent',
    fontFamily: 'Inter, sans-serif',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { speed: 400 }
  },
  colors,
  stroke: { curve: 'smooth', width: 2.5 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] } },
  dataLabels: { enabled: false },
  markers: {
    size: 0,
    strokeWidth: 3,
    strokeColors: '#fff',
    hover: { size: 6 },
    // Keep the real data point visible when the line is padded around a single agent.
    discrete:
      highlightIndex === null
        ? []
        : colors.map((color, seriesIndex) => ({ seriesIndex, dataPointIndex: highlightIndex, fillColor: color, strokeColor: '#fff', size: 6 }))
  },
  grid: { borderColor: '#f1f0fb', strokeDashArray: 4, xaxis: { lines: { show: false } }, padding: { left: 8, right: 8, top: -10 } },
  legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', labels: { colors: '#64748b' }, markers: { width: 8, height: 8, radius: 12 } },
  xaxis: {
    categories,
    labels: { style: { colors: '#94a3b8', fontSize: '11px' }, rotate: 0, hideOverlappingLabels: true, trim: true },
    axisBorder: { show: false },
    axisTicks: { show: false },
    crosshairs: { show: true, stroke: { color: '#c4b5fd', width: 1, dashArray: 4 } },
    tooltip: { enabled: false }
  },
  yaxis: {
    min: 0,
    forceNiceScale: true,
    decimalsInFloat: integerAxis ? 0 : 2,
    tickAmount: 4,
    labels: { style: { colors: '#94a3b8', fontSize: '11px' }, formatter: format }
  },
  tooltip: { shared: true, intersect: false, custom: pillTooltip(format) }
});

function ChartCard({ icon: Icon, title, subtitle, className = '', children }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-violet-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 ${className}`}>
      <header className="mb-1 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <Icon size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="mb-0 truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="mb-0 truncate text-[11px] text-slate-400">{subtitle}</p>
        </div>
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

function EmptyState({ message = 'No data for the active filters.' }) {
  return (
    <div className="flex h-[230px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-violet-200 bg-violet-50/30 text-center dark:border-slate-800 dark:bg-transparent">
      <LineChart size={24} className="text-violet-300" />
      <span className="text-xs text-slate-400">{message}</span>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="relative h-[230px] overflow-hidden rounded-xl" role="status" aria-label="Loading chart">
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full animate-pulse">
        <path d="M0 70 C40 55 60 75 100 50 S160 30 200 45 S260 25 300 35 L300 100 L0 100 Z" fill="#ede9fe" />
        <path d="M0 70 C40 55 60 75 100 50 S160 30 200 45 S260 25 300 35" fill="none" stroke="#ddd6fe" strokeWidth="2" />
      </svg>
    </div>
  );
}

function BarListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3 py-2" role="status" aria-label="Loading list">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-9 animate-pulse rounded-lg bg-violet-50 dark:bg-slate-800" />
      ))}
    </div>
  );
}

export default function DailySalesReportCharts({ rows, locationGroups, loading }) {
  const rankedAgents = [...rows].sort((left, right) => right.salesAmount - left.salesAmount);
  const chartAgents = rankedAgents.slice(0, MAX_AGENTS);
  const topSales = rankedAgents[0]?.salesAmount || 0;
  const topLocationSales = Math.max(0, ...locationGroups.map((group) => group.totalSales));

  // A line needs two points: with a single agent, pad zero points (blank labels, no tooltip)
  // on both sides so the value shows as a peak in the same area chart.
  const isSingle = chartAgents.length === 1;
  const categories = isSingle ? [' ', chartAgents[0].userName, '  '] : chartAgents.map((agent) => agent.userName);
  const seriesData = (pick) => (isSingle ? [0, pick(chartAgents[0]), 0] : chartAgents.map(pick));
  const highlightIndex = isSingle ? 1 : null;

  const salesChart = {
    options: areaOptions({ categories, colors: [PURPLE], format: formatDailySalesCurrency, highlightIndex }),
    series: [{ name: 'Sales', data: seriesData((agent) => agent.salesAmount) }]
  };

  const activityChart = {
    options: areaOptions({ categories, colors: [PURPLE_SOFT, PURPLE], format: formatCount, integerAxis: true, highlightIndex }),
    series: [
      { name: 'Leads', data: seriesData((agent) => agent.leads) },
      { name: 'Closed sales', data: seriesData((agent) => agent.salesClosed) }
    ]
  };

  const renderArea = (chart) => {
    if (loading) return <ChartSkeleton />;
    if (!chartAgents.length) return <EmptyState />;
    return <Chart type="area" height={240} options={chart.options} series={chart.series} />;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <ChartCard
        icon={TrendingUp}
        title="Sales by Agent"
        subtitle={`Sales amount per agent${rankedAgents.length > MAX_AGENTS ? ` · top ${MAX_AGENTS}` : ''}`}
        className="xl:col-span-2"
      >
        {renderArea(salesChart)}
      </ChartCard>

      <ChartCard icon={MapPin} title="Location Sales" subtitle="Share of sales by location">
        {loading ? (
          <BarListSkeleton />
        ) : locationGroups.length ? (
          <ul className="mb-0 max-h-[240px] space-y-3 overflow-y-auto pl-0 pt-2">
            {[...locationGroups]
              .sort((left, right) => right.totalSales - left.totalSales)
              .map((group) => (
                <li key={group.key || group.locationName}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">{group.locationName}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatDailySalesCurrency(group.totalSales)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-500/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                      style={{ width: `${topLocationSales ? (group.totalSales / topLocationSales) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {formatCount(group.totalLeads)} leads · {formatCount(group.salesClosed)} closed
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </ChartCard>

      <ChartCard icon={LineChart} title="Leads vs Closed Sales" subtitle="Lead volume and closed sales per agent" className="xl:col-span-2">
        {renderArea(activityChart)}
      </ChartCard>

      <ChartCard icon={Award} title="Top Agents" subtitle="Top 10 agents by sales amount">
        {loading ? (
          <BarListSkeleton />
        ) : rankedAgents.length ? (
          <ol className="mb-0 max-h-[240px] space-y-1.5 overflow-y-auto pl-0 pt-1">
            {rankedAgents.slice(0, 10).map((agent, index) => (
              <li key={agent.key} className="rounded-xl px-2.5 py-2 transition-colors hover:bg-violet-50/70 dark:hover:bg-white/[0.03]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ring-1 ring-inset ${
                      RANK_STYLES[index] || 'bg-violet-50 text-violet-700 ring-violet-100'
                    }`}
                  >
                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{agent.userName}</strong>
                    <small className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {agent.locationName} · {formatDailySalesPercentage(agent.conversionRate)} conv.
                    </small>
                  </span>
                  <strong className="shrink-0 text-sm font-bold tabular-nums text-violet-700 dark:text-violet-300">
                    {formatDailySalesCurrency(agent.salesAmount)}
                  </strong>
                </div>
                <div className="ml-[38px] mt-1.5 h-1 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-500/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                    style={{ width: `${topSales ? (agent.salesAmount / topSales) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState />
        )}
      </ChartCard>
    </div>
  );
}

const rowShape = PropTypes.shape({
  key: PropTypes.string.isRequired,
  userName: PropTypes.string.isRequired,
  locationName: PropTypes.string.isRequired,
  salesAmount: PropTypes.number.isRequired,
  leads: PropTypes.number.isRequired,
  salesClosed: PropTypes.number.isRequired,
  conversionRate: PropTypes.number.isRequired
});

DailySalesReportCharts.propTypes = {
  rows: PropTypes.arrayOf(rowShape).isRequired,
  locationGroups: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      locationName: PropTypes.string.isRequired,
      totalSales: PropTypes.number.isRequired,
      totalLeads: PropTypes.number.isRequired,
      salesClosed: PropTypes.number.isRequired
    })
  ).isRequired,
  loading: PropTypes.bool.isRequired
};

ChartCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  className: PropTypes.string,
  children: PropTypes.node.isRequired
};

EmptyState.propTypes = { message: PropTypes.string };
BarListSkeleton.propTypes = { rows: PropTypes.number };
