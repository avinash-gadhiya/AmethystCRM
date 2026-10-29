import MiniCalendarInput from '@/components/common/MiniCalendarInput';
import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Braces, Download, Eye, Table2 } from 'lucide-react';

import CommonTable from '@/components/common/CommonTable';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import TableSearchField from '@/components/common/TableSearchField';
import { Button } from 'components/ui/Bootstrap';
import { formatApiValue, humanizeKey, inferApiColumns, rowMatches, toCsv, unwrapApiPayload } from '@/lib/apiData';
import { apiClient } from 'services/core/apiClient';
import RecordDetailModal, { FieldGrid } from './RecordDetailModal';

const toInputDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const defaultRange = () => {
  const today = new Date();
  return { from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toInputDate(today) };
};

const compareValues = (left, right) => {
  if (left === right) return 0;
  if (left === null || left === undefined || left === '') return 1;
  if (right === null || right === undefined || right === '') return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
};

const renderCell = (value, key) => {
  if (typeof value === 'boolean') {
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
          value ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
        }`}
      >
        {value ? 'Yes' : 'No'}
      </span>
    );
  }
  const text = formatApiValue(value, key);
  return (
    <span className="block max-w-[260px] truncate" title={text}>
      {text}
    </span>
  );
};

/**
 * Renders any API payload: a sortable, paginated table for lists, or a field grid for single objects.
 * When `server` is provided, paging and sorting are delegated to the API; otherwise they run on the loaded rows.
 */
export function ApiPayloadView({ payload, loading = false, query = '', server, itemName = 'Records' }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ sortProperty: '', isDescending: false });
  const [selected, setSelected] = useState(null);

  const { rows, totalCount, summary } = useMemo(() => {
    const result = unwrapApiPayload(payload);
    const normalized = result.rows.map((row) => (row !== null && typeof row === 'object' ? row : { value: row }));
    return { ...result, rows: normalized };
  }, [payload]);
  const { columns: keys, hiddenCount } = useMemo(() => inferApiColumns(rows), [rows]);

  useEffect(() => setPage(1), [payload, query]);

  const clientRows = useMemo(() => {
    if (server) return rows;
    const filtered = rows.filter((row) => rowMatches(row, query.trim()));
    if (!sort.sortProperty) return filtered;
    const direction = sort.isDescending ? -1 : 1;
    return [...filtered].sort((a, b) => direction * compareValues(a?.[sort.sortProperty], b?.[sort.sortProperty]));
  }, [rows, query, sort, server]);

  const activeSort = server ? server.sort : sort;
  const onSort = (key) => {
    const next = { sortProperty: key, isDescending: activeSort.sortProperty === key ? !activeSort.isDescending : false };
    if (server) server.onSort(next);
    else setSort(next);
  };

  const pageRows = server ? rows : clientRows.slice((page - 1) * pageSize, page * pageSize);
  const pagination = server
    ? {
        pageNumber: server.page,
        pageSize: server.pageSize,
        totalCount: server.totalCount ?? totalCount,
        onPageChange: server.onPageChange,
        onPageSizeChange: server.onPageSizeChange,
        itemName
      }
    : {
        pageNumber: page,
        pageSize,
        totalCount: clientRows.length,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
        itemName
      };

  const tableColumns = [
    { id: 'serial', header: '#', width: '56px' },
    ...keys.map((key) => ({ id: key, header: humanizeKey(key), sortable: true, cell: (row) => renderCell(row?.[key], key) })),
    {
      id: 'action',
      header: 'View',
      align: 'center',
      sticky: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(row);
          }}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-white/5"
          aria-label="View record"
          title="View all fields"
        >
          <Eye size={15} />
        </button>
      )
    }
  ];

  const isSummary = !loading && rows.length === 0 && summary !== null && summary !== undefined && summary !== '';

  return (
    <>
      {isSummary ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] p-4">
          {typeof summary === 'object' ? <FieldGrid record={summary} /> : <div className="text-sm break-words">{String(summary)}</div>}
        </div>
      ) : (
        <>
          <CommonTable
            columns={tableColumns}
            data={pageRows}
            loading={loading}
            skeletonRows={Math.min(server?.pageSize || pageSize, 8)}
            rowKey={(row, index) => `${index}-${row?.id ?? row?.Id ?? ''}`}
            onRowClick={setSelected}
            sort={{ ...activeSort, onSort }}
            pagination={pagination}
            emptyState={{ title: 'No records found', description: 'Try a different date range or search term.' }}
          />
          {hiddenCount > 0 && !loading && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {hiddenCount} more field{hiddenCount === 1 ? '' : 's'} per record. Open a row to see every field.
            </div>
          )}
        </>
      )}
      <RecordDetailModal record={selected} title={itemName.replace(/s$/, '') + ' details'} onHide={() => setSelected(null)} />
    </>
  );
}

ApiPayloadView.propTypes = {
  payload: PropTypes.any,
  loading: PropTypes.bool,
  query: PropTypes.string,
  itemName: PropTypes.string,
  server: PropTypes.shape({
    page: PropTypes.number.isRequired,
    pageSize: PropTypes.number.isRequired,
    totalCount: PropTypes.number,
    sort: PropTypes.shape({ sortProperty: PropTypes.string, isDescending: PropTypes.bool }).isRequired,
    onSort: PropTypes.func.isRequired,
    onPageChange: PropTypes.func.isRequired,
    onPageSizeChange: PropTypes.func.isRequired
  })
};

export default function ApiDataViewer({ operation, title }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ sortProperty: '', isDescending: true });
  const [range, setRange] = useState(defaultRange);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState('table');
  const [state, setState] = useState({ loading: true, error: '', payload: null, elapsed: 0 });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = performance.now();
    setState((current) => ({ ...current, loading: true, error: '' }));
    apiClient
      .get(
        operation.path,
        {
          PageNumber: page,
          PageSize: pageSize,
          SortProperty: sort.sortProperty,
          IsDescending: sort.isDescending,
          FromDate: range.from ? `${range.from}T00:00:00` : '',
          ToDate: range.to ? `${range.to}T23:59:59` : '',
          Text: search
        },
        controller.signal
      )
      .then((payload) => setState({ loading: false, error: '', payload, elapsed: Math.round(performance.now() - startedAt) }))
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setState({ loading: false, error: error?.message || 'Unable to load data.', payload: null, elapsed: 0 });
      });
    return () => controller.abort();
  }, [operation.path, page, pageSize, sort, range, search, reloadKey]);

  const unwrapped = useMemo(() => unwrapApiPayload(state.payload), [state.payload]);
  // APIs that ignore PageSize return every row at once; page those on the client instead.
  const serverPaged = unwrapped.rows.length <= pageSize;

  const server = serverPaged
    ? {
        page,
        pageSize,
        totalCount: unwrapped.totalCount,
        sort,
        onSort: (next) => {
          setSort(next);
          setPage(1);
        },
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(Number(size));
          setPage(1);
        }
      }
    : undefined;

  const exportCsv = () => {
    const { rows } = unwrapped;
    const keys = [...new Set(rows.flatMap((row) => (row && typeof row === 'object' ? Object.keys(row) : [])))];
    const blob = new Blob([toCsv(rows, keys)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${operation.path.replace(/^\//, '').replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const itemName = humanizeKey(operation.path.split('/').filter(Boolean).pop() || 'Records');
  const recordLabel = state.loading
    ? 'Loading…'
    : unwrapped.rows.length
      ? `${unwrapped.totalCount.toLocaleString()} record${unwrapped.totalCount === 1 ? '' : 's'} · ${state.elapsed} ms`
      : state.payload !== null
        ? `Single response · ${state.elapsed} ms`
        : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="min-w-0">
          <h6 className="mb-0 text-base font-semibold text-gray-900 dark:text-white">{title || itemName}</h6>
          <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
            <code className="text-purple-600 dark:text-purple-300">GET /api{operation.path}</code>
            {recordLabel && <span>{recordLabel}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchField
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onClear={() => setSearchInput('')}
            placeholder="Search records"
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            From
            <MiniCalendarInput
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(event) => {
                setRange((current) => ({ ...current, from: event.target.value }));
                setPage(1);
              }}
              className="form-control neu-input py-1.5 text-xs w-auto"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            To
            <MiniCalendarInput
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(event) => {
                setRange((current) => ({ ...current, to: event.target.value }));
                setPage(1);
              }}
              className="form-control neu-input py-1.5 text-xs w-auto"
            />
          </label>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setView((current) => (current === 'table' ? 'json' : 'table'))}
            className="d-inline-flex align-items-center gap-1"
            disabled={!state.payload}
          >
            {view === 'table' ? <Braces size={14} /> : <Table2 size={14} />}
            {view === 'table' ? 'JSON' : 'Table'}
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={exportCsv}
            disabled={!unwrapped.rows.length}
            className="d-inline-flex align-items-center gap-1"
          >
            <Download size={14} /> CSV
          </Button>
          <TableRefreshButton title="Reload data" loading={state.loading} onClick={() => setReloadKey((key) => key + 1)} />
        </div>
      </div>

      {state.error ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 dark:text-red-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-red-700 dark:text-red-200">Could not load this endpoint</div>
            <div className="text-xs text-red-600 dark:text-red-300 break-words">{state.error}</div>
          </div>
          <Button size="sm" variant="outline-danger" onClick={() => setReloadKey((key) => key + 1)}>
            Retry
          </Button>
        </div>
      ) : view === 'json' ? (
        <pre className="rounded-2xl bg-gray-900 text-gray-100 p-4 text-xs overflow-auto mb-0 max-h-[560px]">
          {JSON.stringify(state.payload, null, 2)}
        </pre>
      ) : (
        <ApiPayloadView payload={state.payload} loading={state.loading} query={search} server={server} itemName={itemName} />
      )}
    </div>
  );
}

ApiDataViewer.propTypes = {
  operation: PropTypes.shape({ path: PropTypes.string.isRequired }).isRequired,
  title: PropTypes.string
};
