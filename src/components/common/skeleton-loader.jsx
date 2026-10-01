// Loading placeholders shaped like the content that is coming, so a section
// keeps its height and nothing jumps when the data arrives. Styles live in
// src/styles/skeleton-loader.css.

// Flexible primitive skeleton component
export function Skeleton({ className = '', variant = 'block', style, ...props }) {
  const variantClass = variant === 'circle' ? 'skeleton-circle' : variant === 'bar' ? 'skeleton-bar' : 'skeleton-block';
  return <div className={`${variantClass} ${className}`} style={style} role="status" aria-label="Loading..." {...props} />;
}

// Bar-chart shape: a title line, a row of bars at varied heights, an axis line.
// `className` carries the height the real chart will take (e.g. "h-40 sm:h-56").
export function ChartSkeleton({ className = 'h-40', bars = [62, 88, 45, 74, 96, 55, 80] }) {
  return (
    <div className={`dashboard-skeleton-wave w-full overflow-hidden rounded-xl p-3 ${className}`} role="status" aria-label="Loading chart">
      <div className="skeleton-chart">
        <div className="skeleton-block h-3 w-1/3 shrink-0" />

        <div className="skeleton-chart-bars skeleton-stagger">
          {bars.map((height, index) => (
            <div key={`skeleton-bar-${index}`} className="skeleton-bar" style={{ height: `${height}%` }} />
          ))}
        </div>

        <div className="skeleton-block h-2 w-full shrink-0" />
      </div>
    </div>
  );
}

// Dashboard-specific KPI placeholder. It mirrors the real cards closely so the
// two-column grid keeps exactly the same proportions while data is requested.
export function DashboardStatCardSkeleton({ list = false }) {
  return (
    <div
      className="dashboard-skeleton-wave relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5"
      role="status"
      aria-label="Loading dashboard statistic"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton-block h-3 w-28" />
        <div className="skeleton-block h-9 w-9 rounded-xl" />
      </div>

      {list ? (
        <div className="mt-5 space-y-3">
          {[72, 58, 66].map((width, index) => (
            <div key={`dashboard-list-stat-${index}`} className="flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="skeleton-block h-3 w-20" />
                <div className="skeleton-block h-2 w-12" />
              </div>
              <div className="skeleton-block h-5 rounded-md" style={{ width: `${width}px` }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex flex-1 flex-col justify-center">
          <div className="skeleton-block h-3 w-16" />
          <div className="skeleton-block mt-2 h-9 w-28" />
          <div className="skeleton-block mt-3 h-2 w-full rounded-full" />
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="skeleton-block h-3 w-20" />
            <div className="skeleton-block h-5 w-12" />
          </div>
        </div>
      )}
    </div>
  );
}

// Donut-shaped placeholder for pie/donut panels instead of showing bar-chart
// bones for every chart type.
export function DonutChartSkeleton({ className = 'h-[280px] sm:h-[360px]' }) {
  return (
    <div
      className={`dashboard-skeleton-wave flex w-full items-center justify-center overflow-hidden rounded-xl ${className}`}
      role="status"
      aria-label="Loading location breakdown"
    >
      <div className="grid w-full max-w-md grid-cols-1 items-center gap-8 px-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="dashboard-donut-skeleton mx-auto" aria-hidden="true">
          <div className="dashboard-donut-skeleton__center" />
        </div>
        <div className="hidden space-y-3 sm:block">
          {[88, 112, 76, 98].map((width, index) => (
            <div key={`donut-legend-${index}`} className="flex items-center gap-2">
              <div className="skeleton-circle h-2.5 w-2.5" />
              <div className="skeleton-block h-2.5" style={{ width: `${width}px` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// One stat card: a label line, a big value line, and a footer meter with icon.
export function StatCardSkeleton({ className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur-xs ${className}`}
      role="status"
      aria-label="Loading statistic"
    >
      <div className="flex items-center justify-between">
        <div className="skeleton-block h-3 w-28" />
        <div className="skeleton-circle h-8 w-8 shrink-0" />
      </div>
      <div className="skeleton-block mt-4 h-8 w-36" />
      <div className="flex items-center gap-2 mt-3.5">
        <div className="skeleton-block h-2.5 w-14 rounded-full" />
        <div className="skeleton-block h-2 w-24" />
      </div>
    </div>
  );
}

// Placeholder rows for a table body. Returns bare <tr>s, so it drops straight
// into an existing <tbody> and keeps the table's own column widths.
export function TableSkeletonRows({ rows = 6, columns = 6, cellClassName = 'px-4 py-3.5' }) {
  return Array.from({ length: rows }).map((_, rowIndex) => (
    <tr key={`skeleton-row-${rowIndex}`} className="skeleton-stagger border-b border-slate-100 dark:border-slate-800/50">
      {Array.from({ length: columns }).map((_, cellIndex) => (
        <td key={`skeleton-cell-${rowIndex}-${cellIndex}`} className={cellClassName}>
          <div
            className="skeleton-block h-3 w-full"
            style={{
              width: cellIndex === 0 ? '70%' : cellIndex === columns - 1 ? '40%' : `${85 - ((cellIndex * 7) % 30)}%`
            }}
          />
        </td>
      ))}
    </tr>
  ));
}

// A row of stat cards. `className` supplies the grid, so the placeholder sits on
// exactly the same layout as the real cards.
export function StatCardGridSkeleton({ count = 4, className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' }) {
  return (
    <div className={`${className} skeleton-stagger`} role="status" aria-label="Loading statistics grid">
      {Array.from({ length: count }).map((_, index) => (
        <StatCardSkeleton key={`skeleton-card-${index}`} />
      ))}
    </div>
  );
}

// Complete table card placeholder with toolbar, header and skeleton rows
export function TableCardSkeleton({ rows = 5, columns = 5, title = true }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur-xs">
      {title && (
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-1.5">
            <div className="skeleton-block h-5 w-40" />
            <div className="skeleton-block h-3 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton-block h-9 w-24 rounded-xl" />
            <div className="skeleton-block h-9 w-28 rounded-xl" />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              {Array.from({ length: columns }).map((_, idx) => (
                <th key={`sk-th-${idx}`} className="px-4 py-3">
                  <div className="skeleton-block h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TableSkeletonRows rows={rows} columns={columns} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// List skeleton for activity feeds, recent items, messages
export function ListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3.5 skeleton-stagger" role="status" aria-label="Loading list">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`sk-list-${idx}`}
          className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40"
        >
          <div className="flex items-center gap-3">
            <div className="skeleton-circle h-10 w-10 shrink-0" />
            <div className="space-y-1.5">
              <div className="skeleton-block h-3.5 w-32" />
              <div className="skeleton-block h-2.5 w-48" />
            </div>
          </div>
          <div className="skeleton-block h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// Form fields skeleton
export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="space-y-4 max-w-xl" role="status" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, idx) => (
        <div key={`sk-form-${idx}`} className="space-y-1.5">
          <div className="skeleton-block h-3 w-24" />
          <div className="skeleton-block h-10 w-full rounded-xl" />
        </div>
      ))}
      <div className="pt-2 flex items-center gap-3">
        <div className="skeleton-block h-10 w-28 rounded-xl" />
        <div className="skeleton-block h-10 w-24 rounded-xl" />
      </div>
    </div>
  );
}

// Profile skeleton
export function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60">
      <div className="skeleton-circle h-16 w-16 shrink-0" />
      <div className="space-y-2 flex-1">
        <div className="skeleton-block h-4 w-40" />
        <div className="skeleton-block h-3 w-56" />
        <div className="skeleton-block h-2.5 w-32" />
      </div>
    </div>
  );
}

// Full page skeleton
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8" role="status" aria-label="Loading page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="skeleton-block h-7 w-48" />
          <div className="skeleton-block h-3 w-72" />
        </div>
        <div className="flex items-center gap-3">
          <div className="skeleton-block h-9 w-28 rounded-xl" />
          <div className="skeleton-block h-9 w-32 rounded-xl" />
        </div>
      </div>
      <StatCardGridSkeleton count={4} />
      <TableCardSkeleton rows={6} columns={6} />
    </div>
  );
}
