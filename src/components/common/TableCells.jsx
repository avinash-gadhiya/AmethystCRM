import PropTypes from 'prop-types';

// Small cell renderers shared by list tables so names, contact lines and statuses look the same on every page.

const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export function IdentityCell({ name, subtitle, onClick }) {
  const label = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
        {initials(name)}
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-semibold text-gray-900 group-hover/identity:text-indigo-600 dark:text-white">{name}</span>
        {subtitle && <span className="block text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>}
      </span>
    </>
  );
  if (!onClick) return <div className="flex min-w-0 items-center gap-3">{label}</div>;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="group/identity flex min-w-0 items-center gap-3 rounded-lg border-0 bg-transparent p-0"
    >
      {label}
    </button>
  );
}

IdentityCell.propTypes = { name: PropTypes.node.isRequired, subtitle: PropTypes.node, onClick: PropTypes.func };

/** Stacked icon + text lines, e.g. email and phone. Empty values render as a muted dash. */
export function IconLines({ lines, maxWidth = 260 }) {
  return (
    <div className="flex flex-col gap-1" style={{ maxWidth }}>
      {lines.map(({ icon: Icon, value, strong }, index) => (
        <span
          key={index}
          className={`flex items-center gap-1.5 ${strong ? 'text-sm font-medium text-gray-900 dark:text-white' : 'text-xs text-gray-600 dark:text-gray-300'}`}
        >
          <Icon size={strong ? 14 : 13} className="shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate" title={value || undefined}>
            {value || <span className="text-gray-400">—</span>}
          </span>
        </span>
      ))}
    </div>
  );
}

IconLines.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.shape({ icon: PropTypes.elementType.isRequired, value: PropTypes.node, strong: PropTypes.bool })).isRequired,
  maxWidth: PropTypes.number
};

const PILL_TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  primary: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  secondary: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15'
};

export function StatusPill({ children, tone = 'secondary' }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${PILL_TONES[tone] || PILL_TONES.secondary}`}>
      {children}
    </span>
  );
}

StatusPill.propTypes = { children: PropTypes.node, tone: PropTypes.oneOf(Object.keys(PILL_TONES)) };

/** Label/value grid for detail modals; renders `fields` in a loop. */
export function DetailFields({ fields }) {
  return (
    <dl className="mb-0 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {fields.map(({ label, value, wide }) => (
        <div key={label} className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</dt>
          <dd className="mb-0 mt-1 break-words text-sm text-gray-900 dark:text-gray-100">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

DetailFields.propTypes = {
  fields: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired, value: PropTypes.node, wide: PropTypes.bool })).isRequired
};
