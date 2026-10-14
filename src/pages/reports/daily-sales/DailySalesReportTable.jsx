import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Inbox, Search } from 'lucide-react';

import AnchorPagination from '@/components/common/AnchorPagination';
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

const formattedValue = (row, key) => {
  if (key === 'salesAmount' || key === 'revenuePerLead') return formatDailySalesCurrency(row[key]);
  if (key === 'conversionRate') return formatDailySalesPercentage(row[key]);
  if (key === 'leads' || key === 'salesClosed') return Number(row[key] || 0).toLocaleString();
  return row[key] || 'Unassigned';
};

function SortIcon({ columnKey, sort }) {
  if (sort.key !== columnKey) return <ArrowUpDown size={13} />;
  return sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
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
    <section className="daily-sales-table-card">
      <header className="daily-sales-table-toolbar">
        <div>
          <h2>Performance by Location</h2>
          <p>Expand or collapse each location to review its agents.</p>
        </div>
        <label className="daily-sales-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search user, location, sales, or leads"
            aria-label="Search daily sales report"
          />
        </label>
      </header>

      <div className="daily-sales-table-scroll">
        <table className="daily-sales-table">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} className={column.align === 'right' ? 'is-numeric' : ''}>
                  <button type="button" onClick={() => handleSort(column.key)}>
                    {column.label}
                    <SortIcon columnKey={column.key} sort={sort} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 7 }, (_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="daily-sales-table-skeleton">
                  {COLUMNS.map((column) => (
                    <td key={column.key}>
                      <span />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length}>
                  <div className="daily-sales-empty-state">
                    <Inbox size={30} />
                    <strong>No sales activity found</strong>
                    <span>Try a different date, location, or search filter.</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              visibleGroups.map((visibleGroup) => {
                const group = fullGroups.get(visibleGroup.key) || visibleGroup;
                const collapsed = collapsedLocations.has(group.key);
                return (
                  <LocationRows
                    key={group.key}
                    group={group}
                    visibleAgents={visibleGroup.agents}
                    collapsed={collapsed}
                    onToggle={() => toggleLocation(group.key)}
                  />
                );
              })}
          </tbody>
        </table>
      </div>

      {!loading && rows.length > 0 && (
        <footer className="daily-sales-table-footer">
          <span>
            Showing {Math.min((safePage - 1) * pageSize + 1, rows.length)}-{Math.min(safePage * pageSize, rows.length)} of {rows.length}{' '}
            agents
          </span>
          <div>
            <label>
              Per page
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <AnchorPagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </footer>
      )}
    </section>
  );
}

function LocationRows({ group, visibleAgents, collapsed, onToggle }) {
  return (
    <>
      <tr className="daily-sales-location-row">
        <td>
          <button type="button" onClick={onToggle} aria-expanded={!collapsed}>
            <ChevronDown size={17} className={collapsed ? '-rotate-90' : ''} />
            <span>
              <strong>{group.locationName}</strong>
              <small>
                {group.agents.length} agent{group.agents.length === 1 ? '' : 's'}
              </small>
            </span>
          </button>
        </td>
        <td>
          <span className="daily-sales-location-label">Location total</span>
        </td>
        <td className="is-numeric">
          <strong>{formatDailySalesCurrency(group.totalSales)}</strong>
        </td>
        <td className="is-numeric">
          <strong>{group.totalLeads.toLocaleString()}</strong>
        </td>
        <td className="is-numeric">
          <strong>{group.salesClosed.toLocaleString()}</strong>
        </td>
        <td className="is-numeric">
          <strong>{formatDailySalesCurrency(group.revenuePerLead)}</strong>
        </td>
        <td className="is-numeric">
          <strong>{formatDailySalesPercentage(group.conversionRate)}</strong>
        </td>
      </tr>
      {!collapsed &&
        visibleAgents.map((agent) => (
          <tr key={agent.key} className="daily-sales-agent-row">
            {COLUMNS.map((column) => (
              <td key={column.key} className={column.align === 'right' ? 'is-numeric' : ''}>
                {column.key === 'userName' ? (
                  <span className="daily-sales-agent-name">
                    <span>{agent.userName.slice(0, 1).toUpperCase()}</span>
                    <strong>{agent.userName}</strong>
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
