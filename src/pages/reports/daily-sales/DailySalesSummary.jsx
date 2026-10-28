import PropTypes from 'prop-types';
import './daily-sales-glass.css';
import { BadgeDollarSign, BarChart3, MousePointerClick, Percent, Target, UsersRound } from 'lucide-react';

import { formatDailySalesCurrency, formatDailySalesPercentage } from '@/utils/dailySalesReportUtils';

const formatCount = (value) => Number(value || 0).toLocaleString();

// Equal-sized cards keep the report summary compact at every breakpoint.
const METRICS = [
  { key: 'totalSales', label: 'Total Sales', icon: BadgeDollarSign, format: formatDailySalesCurrency },
  { key: 'totalLeads', label: 'Total Leads', icon: MousePointerClick, format: formatCount },
  { key: 'salesClosed', label: 'Sales Closed', icon: Target, format: formatCount },
  { key: 'activeSalesAgents', label: 'Active Agents', icon: UsersRound, format: formatCount },
  { key: 'revenuePerLead', label: 'Revenue / Lead', icon: BarChart3, format: formatDailySalesCurrency },
  { key: 'conversionRate', label: 'Conversion', icon: Percent, format: formatDailySalesPercentage }
];

export default function DailySalesSummary({ summary, loading, periodLabel }) {
  return (
    <section aria-label="Daily sales summary" aria-busy={loading} className="daily-sales-glass space-y-2.5 rounded-2xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
        <h2 className="mb-0 text-xs font-semibold text-slate-700 dark:text-slate-200">Sales snapshot</h2>
        <p className="mb-0 text-[11px] text-slate-500 dark:text-slate-400">{periodLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {METRICS.map(({ key, label, icon: Icon, format }) => {
          const primary = key === 'totalSales';
          return (
            <div key={key} className="daily-sales-glass__card min-w-0 px-3.5 py-3">
              <span className="daily-sales-glass__rim" aria-hidden="true" />
              <div className="flex min-h-6 items-center justify-between gap-2">
                <span className="text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">{label}</span>
                <span className="daily-sales-glass__icon flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  <Icon size={13} aria-hidden="true" />
                </span>
              </div>
              {loading ? (
                <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              ) : (
                <div
                  className={
                    'mt-2 truncate text-[22px] font-semibold leading-7 tabular-nums tracking-tight ' +
                    (primary ? 'text-violet-700 dark:text-violet-300' : 'text-slate-900 dark:text-white')
                  }
                  title={format(summary[key])}
                >
                  {format(summary[key])}
                </div>
              )}
            </div>
          );
        })}
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
