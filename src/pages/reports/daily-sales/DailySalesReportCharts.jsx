import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';
import { Award, LineChart, MapPin, TrendingUp } from 'lucide-react';
import { formatDailySalesCurrency as money, formatDailySalesPercentage as percent } from '@/utils/dailySalesReportUtils';

const COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#6366f1'];
const MAX_AGENTS = 12;
const count = (value) => Math.round(Number(value) || 0).toLocaleString();

// A single total uses a flat visual span; only its central point is labelled.
const lineOptions = (categories, format, colors = [COLORS[0]]) => ({
  chart: {
    type: 'area',
    background: 'transparent',
    fontFamily: 'Inter, sans-serif',
    foreColor: '#94a3b8',
    toolbar: { show: false },
    zoom: { enabled: false }
  },
  colors,
  stroke: { curve: 'straight', width: 2 },
  markers: {
    size: categories.length === 1 ? 0 : 3,
    strokeWidth: 0,
    hover: { size: 5 },
    discrete:
      categories.length === 1
        ? colors.map((color, seriesIndex) => ({ seriesIndex, dataPointIndex: 1, fillColor: color, strokeColor: color, size: 4 }))
        : []
  },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.06, stops: [0, 100] } },
  dataLabels: {
    enabled: true,
    formatter: (value, { dataPointIndex }) => (categories.length === 1 && dataPointIndex !== 1 ? '' : format(value)),
    offsetY: -9,
    background: { enabled: false },
    style: { fontSize: '9px', fontWeight: 500, colors: ['#64748b'] }
  },
  grid: { show: false, padding: { top: 24, right: 18, left: 12, bottom: 10 } },
  legend: { position: 'top', horizontalAlign: 'left', labels: { colors: '#94a3b8' } },
  xaxis: {
    categories: categories.length === 1 ? ['', categories[0], ''] : categories,
    labels: { trim: true, style: { fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
    tooltip: { enabled: false }
  },
  yaxis: {
    min: (value) => Math.min(0, value),
    max: (value) => (value > 0 ? value * 1.15 : 1),
    tickAmount: 4,
    labels: { maxWidth: 135, formatter: format }
  },
  tooltip: {
    theme: 'dark',
    shared: true,
    intersect: false,
    x: { formatter: (value) => (categories.length === 1 ? categories[0] : value) },
    y: { formatter: format }
  }
});

function ChartCard({ icon: Icon, title, subtitle, className = '', children }) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 ${className}`}
    >
      <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="mb-0 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="mb-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </header>
      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}

function ChartState({ loading, empty, children }) {
  if (loading)
    return <div role="status" aria-label="Loading chart" className="h-[280px] animate-pulse rounded-xl bg-violet-50 dark:bg-slate-800" />;
  if (empty)
    return (
      <div className="flex h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-violet-200 text-center dark:border-slate-800">
        <LineChart size={28} className="text-violet-300" aria-hidden="true" />
        <span className="text-sm text-slate-500">No activity for the active filters.</span>
      </div>
    );
  return children;
}

export default function DailySalesReportCharts({ rows, locationGroups, loading }) {
  const ranked = [...rows].sort((a, b) => b.salesAmount - a.salesAmount || a.userName.localeCompare(b.userName));
  const agents = ranked.slice(0, MAX_AGENTS);
  const categories = agents.map((agent) => agent.userName);
  const seriesValues = (key) => (agents.length === 1 ? Array(3).fill(agents[0][key]) : agents.map((agent) => agent[key]));
  const locations = [...locationGroups].sort((a, b) => b.totalSales - a.totalSales);
  const positiveLocations = locations.filter((group) => group.totalSales > 0);
  const locationColorMap = new Map(
    positiveLocations.map((group, index) => [group.key, index === 0 ? '#155dfb' : COLORS[index % COLORS.length]])
  );
  const getLocationColor = (group, fallbackIndex) =>
    locationColorMap.get(group.key) || (group.totalSales < 0 ? '#f43f5e' : COLORS[fallbackIndex % COLORS.length]);
  const total = positiveLocations.reduce((sum, group) => sum + group.totalSales, 0);
  const hasAdjustments = locations.some((group) => group.totalSales < 0);
  const locationMax = Math.max(1, ...locations.map((group) => Math.abs(group.totalSales)));
  const agentMax = Math.max(1, ...agents.map((agent) => Math.abs(agent.salesAmount)));
  const locationOptions = {
    chart: { type: 'radialBar', background: 'transparent', fontFamily: 'Inter, sans-serif', foreColor: '#94a3b8' },
    labels: positiveLocations.map((group) => group.locationName),
    colors: positiveLocations.map((group, index) => getLocationColor(group, index)),
    stroke: { lineCap: 'butt' },
    legend: { show: false },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 210,
        hollow: { size: positiveLocations.length === 1 ? '78%' : '55%', background: 'transparent' },
        track: { background: '#94a3b826', strokeWidth: '100%', margin: 5 },
        dataLabels: {
          show: true,
          name: { color: '#94a3b8', fontSize: '12px', offsetY: -8 },
          value: { color: '#94a3b8', fontSize: '18px', offsetY: 6, formatter: percent },
          total: { show: true, showAlways: true, label: 'Location sales', color: '#94a3b8', formatter: () => money(total) }
        }
      }
    },
    tooltip: { enabled: true, theme: 'dark', y: { formatter: (_, { seriesIndex }) => money(positiveLocations[seriesIndex]?.totalSales) } }
  };

  return (
    <section aria-label="Sales performance charts" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-500">Performance overview</p>
          <h2 className="mb-0 text-lg font-semibold text-slate-900 dark:text-white">Where your sales come from</h2>
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
          {loading ? 'Loading activity...' : `${rows.length} agents / ${locations.length} locations`}
        </span>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <ChartCard
          icon={TrendingUp}
          title="Sales by agent"
          subtitle={
            agents.length === 1
              ? 'Single agent total / flat line shows the selected period’s value'
              : `Revenue comparison / top ${Math.min(MAX_AGENTS, rows.length)} of ${rows.length} agents`
          }
          className="xl:col-span-2"
        >
          <ChartState loading={loading} empty={!agents.length}>
            <Chart
              type="area"
              height={300}
              options={lineOptions(categories, money)}
              series={[{ name: 'Sales', data: seriesValues('salesAmount') }]}
            />
          </ChartState>
        </ChartCard>

        <ChartCard
          icon={MapPin}
          title="Location mix"
          subtitle={hasAdjustments ? 'Net sales including negative adjustments' : 'Concentric rings show each location’s share of sales'}
        >
          <ChartState loading={loading} empty={!locations.length}>
            <div>
              {!hasAdjustments && total > 0 && (
                <Chart
                  type="radialBar"
                  height={300}
                  options={locationOptions}
                  series={positiveLocations.map((group) => (group.totalSales / total) * 100)}
                />
              )}
              <ul className="mb-0 max-h-[240px] space-y-4 overflow-y-auto pl-0">
                {locations.map((group, index) => (
                  <li key={group.key}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: getLocationColor(group, index) }}
                        />
                        <span className="truncate" title={group.locationName}>
                          {group.locationName}
                        </span>
                      </span>
                      <strong className="shrink-0 tabular-nums text-slate-900 dark:text-white">{money(group.totalSales)}</strong>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(Math.abs(group.totalSales) / locationMax) * 100}%`,
                          backgroundColor: getLocationColor(group, index)
                        }}
                      />
                    </div>
                    <p className="mb-0 mt-1 text-[11px] text-slate-500">
                      {count(group.totalLeads)} leads / {count(group.salesClosed)} closed
                      {!hasAdjustments && total > 0 ? ` / ${percent((group.totalSales / total) * 100)} of sales` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </ChartState>
        </ChartCard>

        <ChartCard
          icon={LineChart}
          title="Leads and closed sales"
          subtitle={
            agents.length === 1
              ? 'Single agent totals / flat lines show leads and closed sales'
              : 'Activity comparison for the same top revenue agents'
          }
          className="xl:col-span-2"
        >
          <ChartState loading={loading} empty={!agents.length}>
            <Chart
              type="area"
              height={300}
              options={lineOptions(categories, count, ['#a78bfa', '#06b6d4'])}
              series={[
                { name: 'Leads', data: seriesValues('leads') },
                { name: 'Closed sales', data: seriesValues('salesClosed') }
              ]}
            />
          </ChartState>
        </ChartCard>

        <ChartCard icon={Award} title="Agent leaderboard" subtitle="Top 10 by sales / conversion shown for context">
          <ChartState loading={loading} empty={!ranked.length}>
            <ol className="mb-0 max-h-[300px] space-y-3 overflow-y-auto pl-0">
              {ranked.slice(0, 10).map((agent, index) => (
                <li key={agent.key} className="rounded-xl bg-slate-50/80 p-3 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${index === 0 ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'}`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-xs text-slate-900 dark:text-white" title={agent.userName}>
                        {agent.userName}
                      </strong>
                      <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {agent.locationName} / {percent(agent.conversionRate)} conversion
                      </span>
                    </div>
                    <strong className="shrink-0 text-xs tabular-nums text-violet-700 dark:text-violet-300">
                      {money(agent.salesAmount)}
                    </strong>
                  </div>
                  <div className="ml-9 mt-2 h-1 overflow-hidden rounded-full bg-violet-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${(Math.abs(agent.salesAmount) / agentMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </ChartState>
        </ChartCard>
      </div>
    </section>
  );
}

DailySalesReportCharts.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      userName: PropTypes.string.isRequired,
      locationName: PropTypes.string.isRequired,
      salesAmount: PropTypes.number.isRequired,
      leads: PropTypes.number.isRequired,
      salesClosed: PropTypes.number.isRequired,
      conversionRate: PropTypes.number.isRequired
    })
  ).isRequired,
  locationGroups: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
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
ChartState.propTypes = { loading: PropTypes.bool.isRequired, empty: PropTypes.bool.isRequired, children: PropTypes.node.isRequired };
