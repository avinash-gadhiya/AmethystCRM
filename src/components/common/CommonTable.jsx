import React, { useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox } from 'lucide-react';
import AnchorPagination from './AnchorPagination';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Safely resolves nested object keys (e.g. 'user.profile.name')
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  if (typeof path !== 'string') return obj[path];
  return path.split('.').reduce((acc, part) => (acc != null ? acc[part] : undefined), obj);
}

/**
 * CommonTable Component
 *
 * A reusable, loop-driven data table designed for all pages in DashboardKit.
 * Features:
 * - Dynamic column and row looping with custom cell renderers
 * - Automated loading skeleton rows loop
 * - Polished empty state
 * - Column sorting with indicator icons
 * - Sticky column support (e.g. sticky right action columns)
 * - Seamless integration with CodePen-inspired AnchorPagination
 * - Full Dark & Light mode compatibility
 */
const CommonTable = ({
  columns = [],
  data = [],
  loading = false,
  skeletonRows = 6,
  rowKey,
  onRowClick,
  rowClassName,
  emptyState,
  title,
  toolbar,
  containerClassName = '',
  tableClassName = '',
  // Sorting props
  sortBy,
  sortDirection, // 'asc' | 'desc'
  onSort,
  // Combined sort object support
  sort,
  // Pagination props
  pagination,
  hidePaginationOnSinglePage = false
}) => {
  // Normalize sort options
  const activeSortKey = sort?.sortProperty ?? sortBy;
  const isDesc = sort?.isDescending !== undefined ? sort.isDescending : sortDirection === 'desc';

  // Normalize pagination options
  const pConfig = useMemo(() => {
    if (!pagination) return null;

    const pageNumber = pagination.pageNumber ?? pagination.currentPage ?? 1;
    const pageSize = pagination.pageSize ?? 10;
    const totalCount = Number(pagination.totalCount) || 0;
    const computedTotalPages = Math.ceil(totalCount / pageSize) || 1;
    const totalPages = pagination.totalPages ?? computedTotalPages;
    const pageSizeOptions = pagination.pageSizeOptions || DEFAULT_PAGE_SIZE_OPTIONS;
    const itemName = pagination.itemName || 'Records';
    const showPageSize = pagination.showPageSize !== false;
    const showInfo = pagination.showInfo !== false;

    return {
      pageNumber,
      pageSize,
      totalCount,
      totalPages,
      pageSizeOptions,
      itemName,
      showPageSize,
      showInfo,
      onPageChange: pagination.onPageChange,
      onPageSizeChange: pagination.onPageSizeChange
    };
  }, [pagination]);

  // Compute serial number offset for rows
  const serialOffset = pConfig ? (pConfig.pageNumber - 1) * pConfig.pageSize : 0;

  // Handle header sort click
  const handleHeaderSortClick = (col) => {
    if (!col.sortable) return;
    const key = col.sortKey || col.accessor || col.id;
    if (!key) return;

    if (sort?.onSort) {
      sort.onSort(key);
    } else if (typeof onSort === 'function') {
      const nextDirection = activeSortKey === key && !isDesc ? 'desc' : 'asc';
      onSort(key, nextDirection);
    }
  };

  // Render sorting icon
  const renderSortIndicator = (col) => {
    if (!col.sortable) return null;
    const key = col.sortKey || col.accessor || col.id;
    const isSorted = activeSortKey === key;

    if (!isSorted) {
      return <ArrowUpDown size={13} className="inline-block ml-1.5 opacity-40 group-hover:opacity-80 transition-opacity" />;
    }
    return isDesc ? (
      <ArrowDown size={13} className="inline-block ml-1.5 text-purple-600 dark:text-purple-400" />
    ) : (
      <ArrowUp size={13} className="inline-block ml-1.5 text-purple-600 dark:text-purple-400" />
    );
  };

  // Safe row key generator
  const getRowKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row, index);
    if (typeof rowKey === 'string' && row[rowKey] !== undefined) return row[rowKey];
    return row.id ?? row._id ?? row.userId ?? row.key ?? `row-${index}`;
  };

  return (
    <div className={`space-y-4 ${containerClassName}`}>
      {/* Optional Top Card Toolbar or Title Header */}
      {(title || toolbar) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {title && (
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          )}
          {toolbar && <div className="w-full sm:w-auto">{toolbar}</div>}
        </div>
      )}

      {/* Main Table Card Container */}
      <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-left border-collapse ${tableClassName}`}>
            {/* Table Header: Loop through columns */}
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                {columns.map((col, cIdx) => {
                  const alignClass =
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
                  const isStickyRight = col.sticky === 'right';
                  const isStickyLeft = col.sticky === 'left';

                  const stickyClass = isStickyRight
                    ? 'sticky right-0 z-20 bg-gray-50/95 dark:bg-[#1d1733]/95 backdrop-blur-xs shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.06)] border-l border-gray-200/70 dark:border-white/10'
                    : isStickyLeft
                    ? 'sticky left-0 z-20 bg-gray-50/95 dark:bg-[#1d1733]/95 backdrop-blur-xs shadow-[6px_0_10px_-2px_rgba(0,0,0,0.06)] border-r border-gray-200/70 dark:border-white/10'
                    : '';

                  return (
                    <th
                      key={col.id || col.accessor || `col-${cIdx}`}
                      onClick={() => handleHeaderSortClick(col)}
                      style={col.width ? { width: col.width } : undefined}
                      className={`py-3.5 px-4 ${alignClass} ${col.width ? col.width : ''} ${stickyClass} ${
                        col.sortable ? 'cursor-pointer select-none group hover:text-purple-600 dark:hover:text-purple-400 transition-colors' : ''
                      } ${col.headerClassName || ''}`}
                    >
                      <span className="inline-flex items-center">
                        {typeof col.header === 'function' ? col.header() : col.header}
                        {renderSortIndicator(col)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
              {/* 1. Loading State: Loop through skeleton rows & columns */}
              {loading &&
                Array.from({ length: skeletonRows }).map((_, rIdx) => (
                  <tr key={`skel-row-${rIdx}`} className="animate-pulse">
                    {columns.map((col, cIdx) => {
                      const alignClass =
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
                      const isStickyRight = col.sticky === 'right';
                      const stickyClass = isStickyRight
                        ? 'sticky right-0 z-10 bg-white/95 dark:bg-[#17132a]/95 border-l border-gray-100 dark:border-white/5'
                        : '';

                      return (
                        <td
                          key={`skel-cell-${rIdx}-${cIdx}`}
                          className={`py-3.5 px-4 ${alignClass} ${stickyClass}`}
                        >
                          <div
                            className={`h-4 bg-gray-200 dark:bg-white/10 rounded ${
                              col.align === 'center'
                                ? 'mx-auto w-8'
                                : col.align === 'right'
                                ? 'ml-auto w-20'
                                : 'w-24'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}

              {/* 2. Empty State: When not loading and data is empty */}
              {!loading && (!data || data.length === 0) && (
                <tr>
                  <td colSpan={columns.length || 1} className="py-16 px-4 text-center">
                    {emptyState ? (
                      typeof emptyState === 'function' ? (
                        emptyState()
                      ) : React.isValidElement(emptyState) ? (
                        emptyState
                      ) : (
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          {emptyState.icon ? (
                            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                              {emptyState.icon}
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                              <Inbox size={28} className="opacity-80" />
                            </div>
                          )}
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                            {emptyState.title || 'No data available'}
                          </h4>
                          {emptyState.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                              {emptyState.description}
                            </p>
                          )}
                          {emptyState.action && <div className="mt-4">{emptyState.action}</div>}
                        </div>
                      )
                    ) : (
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                          <Inbox size={28} className="opacity-80" />
                        </div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                          No records found
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          There are currently no items to display matching the criteria.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              )}

              {/* 3. Data Rows: Loop through data and columns */}
              {!loading &&
                Array.isArray(data) &&
                data.map((row, rowIdx) => {
                  const serialNumber = serialOffset + rowIdx + 1;
                  const rowId = getRowKey(row, rowIdx);
                  const customRowClass =
                    typeof rowClassName === 'function' ? rowClassName(row, rowIdx) : rowClassName || '';

                  return (
                    <tr
                      key={rowId}
                      onClick={() => onRowClick && onRowClick(row, rowIdx)}
                      className={`group hover:bg-purple-50/30 dark:hover:bg-white/[0.02] transition-colors ${
                        onRowClick ? 'cursor-pointer' : ''
                      } ${customRowClass}`}
                    >
                      {columns.map((col, colIdx) => {
                        const alignClass =
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
                        const isStickyRight = col.sticky === 'right';
                        const isStickyLeft = col.sticky === 'left';

                        const stickyClass = isStickyRight
                          ? 'sticky right-0 z-10 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.06)] border-l border-gray-100 dark:border-white/5 group-hover:bg-purple-50/95 dark:group-hover:bg-[#1f1938]/95 transition-colors'
                          : isStickyLeft
                          ? 'sticky left-0 z-10 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs shadow-[6px_0_10px_-2px_rgba(0,0,0,0.06)] border-r border-gray-100 dark:border-white/5 group-hover:bg-purple-50/95 dark:group-hover:bg-[#1f1938]/95 transition-colors'
                          : '';

                        // Render cell content: custom cell renderer takes precedence
                        let cellContent = null;
                        if (typeof col.cell === 'function') {
                          cellContent = col.cell(row, rowIdx, serialNumber);
                        } else if (col.accessor) {
                          cellContent = getNestedValue(row, col.accessor);
                        } else if (col.id === 'serial' || col.id === 'index' || col.id === '#') {
                          cellContent = `#${serialNumber}`;
                        }

                        return (
                          <td
                            key={col.id || col.accessor || `cell-${rowIdx}-${colIdx}`}
                            className={`py-3.5 px-4 ${alignClass} ${stickyClass} ${col.className || ''}`}
                          >
                            {cellContent ?? '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* 4. Table Pagination Footer */}
        {pConfig && (!hidePaginationOnSinglePage || pConfig.totalPages > 1) && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-gray-500 dark:text-gray-400">
            {/* Information Label */}
            {pConfig.showInfo && (
              <div>
                Showing <strong className="text-gray-800 dark:text-gray-200">{data?.length || 0}</strong> of{' '}
                <strong className="text-gray-800 dark:text-gray-200">{pConfig.totalCount}</strong> {pConfig.itemName}
              </div>
            )}

            {/* Pagination Controls & Per-page Dropdown */}
            <div className="flex flex-wrap items-center gap-4">
              {pConfig.showPageSize && typeof pConfig.onPageSizeChange === 'function' && (
                <div className="flex items-center gap-1.5">
                  <span>Per page:</span>
                  <select
                    value={pConfig.pageSize}
                    onChange={(e) => pConfig.onPageSizeChange(Number(e.target.value))}
                    className="px-2 py-1 bg-white dark:bg-[#0f1322] border border-gray-300 dark:border-white/10 rounded-md text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
                  >
                    {pConfig.pageSizeOptions.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Anchor Pagination from CodePen jh3y */}
              <AnchorPagination
                currentPage={pConfig.pageNumber}
                totalPages={pConfig.totalPages}
                onPageChange={pConfig.onPageChange}
                disabled={loading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommonTable;
