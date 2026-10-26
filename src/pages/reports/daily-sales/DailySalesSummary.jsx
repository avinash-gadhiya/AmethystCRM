import PropTypes from 'prop-types';
import { BadgeDollarSign, BarChart3, MousePointerClick, Percent, Target, UsersRound } from 'lucide-react';

import { formatDailySalesCurrency, formatDailySalesPercentage } from '@/utils/dailySalesReportUtils';

const formatCount = (value) => Number(value || 0).toLocaleString();

// Secondary metrics shown as tiles beside the Total Sales headline.
const METRICS = [
  { key: 'totalLeads', label: 'Total Leads', icon: MousePointerClick, format: formatCount },
  { key: 'salesClosed', label: 'Sales Closed', icon: Target, format: formatCount },
  { key: 'activeSalesAgents', label: 'Active Agents', icon: UsersRound, format: formatCount },
  { key: 'revenuePerLead', label: 'Revenue / Lead', icon: BarChart3, format: formatDailySalesCurrency },
  { key: 'conversionRate', label: 'Conversion', icon: Percent, format: formatDailySalesPercentage }
];

/** Compact purple summary banner: Total Sales headline plus the other KPIs as tiles. */
export default function DailySalesSummary({ summary, loading, periodLabel }) {
  const conversion = Math.min(100, Math.max(0, Number(summary.conversionRate) || 0));

  return (
    <section
      aria-label="Daily sales summary"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-4 text-white shadow-lg shadow-violet-500/20 sm:p-5"
    >
      <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />

      <div className="relative grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2.4fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.08em] text-violet-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
              <BadgeDollarSign size={15} aria-hidden="true" />
            </span>
            Total Sales
          </div>
          {loading ? (
            <div className="mt-3 h-9 w-40 animate-pulse rounded-lg bg-white/20" />
          ) : (
            <div className="mt-2 truncate text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
              {formatDailySalesCurrency(summary.totalSales)}
            </div>
          )}
          <div className="mt-1 text-xs text-violet-100">{periodLabel}</div>
          <div className="mt-3 max-w-xs">
            <div className="mb-1 flex justify-between text-[11px] text-violet-100">
              <span>Lead conversion</span>
              <span className="font-semibold text-white">{loading ? '—' : formatDailySalesPercentage(summary.conversionRate)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${loading ? 0 : conversion}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {METRICS.map(({ key, label, icon: Icon, format }) => (
            <div key={key} className="min-w-0 rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-100">
                <Icon size={13} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </div>
              {loading ? (
                <div className="mt-2 h-5 w-16 animate-pulse rounded bg-white/20" />
              ) : (
                <div className="mt-1 truncate text-lg font-bold tabular-nums" title={format(summary[key])}>
                  {format(summary[key])}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

DailySalesSummary.propTypes = {
  summary: PropTypes.shape({
    totalSales: PropTypes.number,
    totalLeads: PropTypes.number,
    salesClosed: PropTypes.number,
    activeSalesAgents: PropTypes.number,
    revenuePerLead: PropTypes.number,
    conversionRate: PropTypes.number
  }).isRequired,
  loading: PropTypes.bool.isRequired,
  periodLabel: PropTypes.string.isRequired
};
