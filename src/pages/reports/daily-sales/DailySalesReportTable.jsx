import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Inbox, MapPin } from 'lucide-react';

import AnchorPagination from '@/components/common/AnchorPagination';
import TableSearchField from '@/components/common/TableSearchField';
import { TableCard } from '@/components/common/page-card';
import { formatDailySalesCurrency, formatDailySalesPercentage, groupDailySalesByLocation } from '@/utils/dailySalesReportUtils';

const COLUMNS = [
  { key: 'userName', label: 'User Name' },
  { key: 'locationName', label: 'Location' },
  { key: 'salesAmount', label: 'Sales Amount', align: 'right' },
  { key: 'leads', label: 'Leads', align: 'right' },
  { key: 'salesClosed', label: 'Sales Closed', align: 'right' },
  { key: 'revenuePerLead', label: 'Revenue Per Lead', align: 'right' },
  { key: 'conversionRate', label: 'Conversion Rate', align: 'right' }
];

const PAGE_SIZES = [10, 25, 50, 100];

// Location total row, one cell per numeric column.
const GROUP_TOTALS = [
  { key: 'totalSales', format: formatDailySalesCurrency },
  { key: 'totalLeads', format: (value) => value.toLocaleString() },
  { key: 'salesClosed', format: (value) => value.toLocaleString() },
  { key: 'revenuePerLead', format: formatDailySalesCurrency },
  { key: 'conversionRate', format: formatDailySalesPercentage }
];

const cellAlign = (column) => (column.align === 'right' ? 'text-right tabular-nums' : 'text-left');

const formattedValue = (row, key) => {
  if (key === 'salesAmount' || key === 'revenuePerLead') return formatDailySalesCurrency(row[key]);
  if (key === 'conversionRate') return formatDailySalesPercentage(row[key]);
  if (key === 'leads' || key === 'salesClosed') return Number(row[key] || 0).toLocaleString();
  return row[key] || 'Unassigned';
};

function SortIcon({ columnKey, sort }) {
  if (sort.key !== columnKey) return <ArrowUpDown size={13} className="opacity-40" />;
  return sort.direction === 'asc' ? (
    <ArrowUp size={13} className="text-purple-600 dark:text-purple-400" />
  ) : (
    <ArrowDown size={13} className="text-purple-600 dark:text-purple-400" />
  );
}

export default function DailySalesReportTable({ rows, loading, search, onSearchChange, sort, onSortChange }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [collapsedLocations, setCollapsedLocations] = useState(() => new Set());

  useEffect(() => {
    setPage(1);
  }, [rows.length, search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pageSize, rows, safePage]);
  const visibleGroups = useMemo(() => groupDailySalesByLocation(visibleRows), [visibleRows]);
  const fullGroups = useMemo(() => new Map(groupDailySalesByLocation(rows).map((group) => [group.key, group])), [rows]);

  const handleSort = (columnKey) => {
    onSortChange({
      key: columnKey,
      direction: sort.key === columnKey && sort.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const toggleLocation = (locationKey) => {
    setCollapsedLocations((current) => {
      const next = new Set(current);
      if (next.has(locationKey)) next.delete(locationKey);
      else next.add(locationKey);
      return next;
    });
  };

  return (
    <TableCard className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-0 text-base font-semibold text-gray-900 dark:text-white">Performance by Location</h2>
          <p className="mb-0 text-xs text-gray-500 dark:text-gray-400">Expand or collapse each location to review its agents.</p>
        </div>
        <TableSearchField
          className="relative flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-[rgba(210,218,240,0.65)] bg-white/75 px-3 text-sm text-gray-700 transition-colors hover:border-purple-300 focus-within:border-purple-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 sm:w-[300px]"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange('')}
          placeholder="Search user, location, sales or leads"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-white/10 dark:bg-[#1d1733] dark:text-gray-300">
              {COLUMNS.map((column) => (
                <th key={column.key} className={`px-4 py-3.5 ${cellAlign(column)}`}>
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className={`inline-flex items-center gap-1.5 border-0 bg-transparent p-0 font-semibold uppercase tracking-wider transition-colors hover:text-purple-600 ${column.align === 'right' ? 'flex-row-reverse' : ''}`}
                  >
                    {column.label}
                    <SortIcon columnKey={column.key} sort={sort} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
            {loading &&
              Array.from({ length: 7 }, (_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="px-4 py-3.5">
                      <div className={`h-4 rounded bg-gray-200 dark:bg-white/10 ${column.align === 'right' ? 'ml-auto w-16' : 'w-28'}`} />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400">
                      <Inbox size={28} className="opacity-80" />
                    </div>
                    <h4 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">No sales activity found</h4>
                    <p className="mb-0 text-xs text-gray-500 dark:text-gray-400">Try a different date, location, or search filter.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              visibleGroups.map((visibleGroup) => {
                const group = fullGroups.get(visibleGroup.key) || visibleGroup;
                return (
                  <LocationRows
                    key={group.key}
                    group={group}
                    visibleAgents={visibleGroup.agents}
                    collapsed={collapsedLocations.has(group.key)}
                    onToggle={() => toggleLocation(group.key)}
                  />
                );
              })}
          </tbody>
        </table>
      </div>

      {!loading && rows.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/50 px-5 py-3.5 text-xs text-gray-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-gray-400 sm:flex-row">
          <div>
            Showing{' '}
            <strong className="text-gray-800 dark:text-gray-200">
              {Math.min((safePage - 1) * pageSize + 1, rows.length)}–{Math.min(safePage * pageSize, rows.length)}
            </strong>{' '}
            of <strong className="text-gray-800 dark:text-gray-200">{rows.length}</strong> agents
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5">
              Per page:
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-800 focus:outline-none dark:border-white/10 dark:bg-[#0f1322] dark:text-gray-200"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <AnchorPagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      )}
    </TableCard>
  );
}

function LocationRows({ group, visibleAgents, collapsed, onToggle }) {
  return (
    <>
      <tr className="bg-violet-50/50 dark:bg-violet-500/[0.06]">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="flex items-center gap-2.5 border-0 bg-transparent p-0 text-left"
          >
            <ChevronDown size={17} className={`shrink-0 text-violet-500 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
              <MapPin size={15} />
            </span>
            <span>
              <strong className="block text-sm font-semibold text-gray-900 dark:text-white">{group.locationName}</strong>
              <small className="block text-xs text-gray-500 dark:text-gray-400">
                {group.agents.length} agent{group.agents.length === 1 ? '' : 's'}
              </small>
            </span>
          </button>
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-transparent dark:text-violet-300 dark:ring-violet-500/30">
            Location total
          </span>
        </td>
        {GROUP_TOTALS.map(({ key, format }) => (
          <td key={key} className="px-4 py-3 text-right font-bold tabular-nums text-gray-900 dark:text-white">
            {format(group[key])}
          </td>
        ))}
      </tr>
      {!collapsed &&
        visibleAgents.map((agent) => (
          <tr key={agent.key} className="transition-colors hover:bg-purple-50/30 dark:hover:bg-white/[0.02]">
            {COLUMNS.map((column) => (
              <td key={column.key} className={`px-4 py-3 text-gray-700 dark:text-gray-200 ${cellAlign(column)}`}>
                {column.key === 'userName' ? (
                  <span className="flex items-center gap-3 pl-7">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
                      {agent.userName.slice(0, 1).toUpperCase()}
                    </span>
                    <strong className="font-semibold text-gray-900 dark:text-white">{agent.userName}</strong>
                  </span>
                ) : (
                  formattedValue(agent, column.key)
                )}
              </td>
            ))}
          </tr>
        ))}
    </>
  );
}

const agentShape = PropTypes.shape({
  key: PropTypes.string.isRequired,
  userName: PropTypes.string.isRequired,
  locationName: PropTypes.string.isRequired,
  salesAmount: PropTypes.number.isRequired,
  leads: PropTypes.number.isRequired,
  salesClosed: PropTypes.number.isRequired,
  revenuePerLead: PropTypes.number.isRequired,
  conversionRate: PropTypes.number.isRequired
});

DailySalesReportTable.propTypes = {
  rows: PropTypes.arrayOf(agentShape).isRequired,
  loading: PropTypes.bool.isRequired,
  search: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  sort: PropTypes.shape({ key: PropTypes.string.isRequired, direction: PropTypes.oneOf(['asc', 'desc']).isRequired }).isRequired,
  onSortChange: PropTypes.func.isRequired
};

SortIcon.propTypes = {
  columnKey: PropTypes.string.isRequired,
  sort: PropTypes.shape({ key: PropTypes.string.isRequired, direction: PropTypes.oneOf(['asc', 'desc']).isRequired }).isRequired
};

LocationRows.propTypes = {
  group: PropTypes.shape({
    key: PropTypes.string.isRequired,
    locationName: PropTypes.string.isRequired,
    agents: PropTypes.arrayOf(agentShape).isRequired,
    totalSales: PropTypes.number.isRequired,
    totalLeads: PropTypes.number.isRequired,
    salesClosed: PropTypes.number.isRequired,
    revenuePerLead: PropTypes.number.isRequired,
    conversionRate: PropTypes.number.isRequired
  }).isRequired,
  visibleAgents: PropTypes.arrayOf(agentShape).isRequired,
  collapsed: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired
};
