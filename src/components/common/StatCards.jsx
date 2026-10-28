import PropTypes from 'prop-types';

import { DashboardStatCardSkeleton } from './skeleton-loader';

// Gradient for the icon tile. Bootstrap-style names are aliases so existing `tone` props keep working.
const TONES = {
  emerald: 'from-emerald-500 to-teal-500',
  violet: 'from-violet-500 to-purple-600',
  blue: 'from-cyan-500 to-blue-600',
  indigo: 'from-indigo-500 to-violet-600',
  sky: 'from-blue-500 to-cyan-500',
  fuchsia: 'from-fuchsia-500 to-purple-600',
  rose: 'from-rose-500 to-orange-500',
  amber: 'from-amber-500 to-orange-500',
  primary: 'from-indigo-500 to-violet-600',
  success: 'from-emerald-500 to-teal-500',
  green: 'from-emerald-500 to-teal-500',
  warning: 'from-amber-500 to-orange-500',
  danger: 'from-rose-500 to-orange-500',
  info: 'from-cyan-500 to-blue-600'
};

// Static class strings so Tailwind keeps them in the build.
const COLUMNS = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 min-[430px]:grid-cols-2 xl:grid-cols-4',
  6: 'grid-cols-1 min-[430px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6'
};

export function StatCard({ label, value, caption, icon: Icon, tone = 'primary' }) {
  return (
    <article className="stat-card flex min-h-[132px] min-w-0 flex-col rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-950 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-words text-[11px] font-bold uppercase leading-snug tracking-[.08em] text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {Icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TONES[tone] || TONES.primary} text-white shadow-sm`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-auto pt-3">
        <div className="break-words text-2xl font-bold leading-tight tabular-nums text-slate-900 dark:text-white">{value}</div>
        {caption && <p className="mb-0 mt-1 text-xs text-slate-400 dark:text-slate-500">{caption}</p>}
      </div>
    </article>
  );
}

StatCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node,
  caption: PropTypes.node,
  icon: PropTypes.elementType,
  tone: PropTypes.oneOf(Object.keys(TONES))
};

/** Renders `items` (each a StatCard's props plus a unique `key` or `label`) in a responsive grid, or skeletons while loading. */
export default function StatCardGrid({ items, loading = false, columns = 4, className = '' }) {
  return (
    <div className={`grid auto-rows-fr gap-3 ${COLUMNS[columns] || COLUMNS[4]} ${className}`}>
      {loading
        ? items.map((item, index) => <DashboardStatCardSkeleton key={item.key || item.label || index} />)
        : items.map(({ key, ...item }, index) => <StatCard key={key || item.label || index} {...item} />)}
    </div>
  );
}

StatCardGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.node.isRequired })).isRequired,
  loading: PropTypes.bool,
  columns: PropTypes.oneOf([2, 3, 4, 6]),
  className: PropTypes.string
};
