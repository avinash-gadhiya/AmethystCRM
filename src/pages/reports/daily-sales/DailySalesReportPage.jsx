import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import LiquidGlassDatePicker from '@/components/common/LiquidGlassDatePicker';
import { TOOLBAR_SELECT_TRIGGER_CLASS } from '@/components/common/ListToolbar';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import { PageHeader, TableCard } from '@/components/common/page-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/apiError';
import dailySalesReportService from '@/services/dailySalesReportService';
import {
  DAILY_SALES_QUICK_FILTERS,
  buildDailySalesCsv,
  buildDailySalesRows,
  calculateDailySalesSummary,
  filterDailySalesRows,
  formatDailySalesDateRange,
  getDailySalesDateRange,
  groupDailySalesByLocation,
  sortDailySalesRows
} from '@/utils/dailySalesReportUtils';

import DailySalesReportCharts from './DailySalesReportCharts';
import DailySalesReportTable from './DailySalesReportTable';
import DailySalesSummary from './DailySalesSummary';

const EMPTY_REPORT = { userSalePayments: [], userLeads: [] };

export default function DailySalesReportPage() {
  const [range, setRange] = useState(() => getDailySalesDateRange('yesterday'));
  const [activePreset, setActivePreset] = useState('yesterday');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'salesAmount', direction: 'desc' });
  const [report, setReport] = useState(EMPTY_REPORT);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestIdRef = useRef(0);

  const loadDashboard = useCallback(
    async (signal, requestId) => {
      setLoading(true);
      setError('');

      try {
        const result = await dailySalesReportService.getDashboardData(range, signal);
        if (signal.aborted || requestId !== requestIdRef.current) return;

        setReport(result.report);
        setLocations(result.locations);
        setUsers(result.users);
      } catch (requestError) {
        if (signal.aborted || requestId !== requestIdRef.current || requestError?.code === 'ERR_CANCELED') return;

        const message = getApiErrorMessage(requestError, 'Unable to load the daily sales report. Please try again.');
        setReport(EMPTY_REPORT);
        setError(message);
        toast.error(message);
      } finally {
        if (!signal.aborted && requestId === requestIdRef.current) setLoading(false);
      }
    },
    [range]
  );

  useEffect(() => {
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    loadDashboard(controller.signal, requestId);

    return () => controller.abort();
  }, [loadDashboard, refreshVersion]);

  const allRows = useMemo(() => buildDailySalesRows(report, users, locations), [locations, report, users]);

  const locationOptions = useMemo(() => {
    const options = new Map(locations.map((location) => [location.locationId, location.name || 'Unassigned']));
    allRows.forEach((row) => {
      if (row.locationId > 0 && !options.has(row.locationId)) options.set(row.locationId, row.locationName);
    });
    return Array.from(options, ([locationId, name]) => ({ locationId, name })).sort((left, right) => left.name.localeCompare(right.name));
  }, [allRows, locations]);

  const filteredRows = useMemo(
    () => filterDailySalesRows(allRows, { locationId: selectedLocationId, search }),
    [allRows, search, selectedLocationId]
  );
  const sortedRows = useMemo(() => sortDailySalesRows(filteredRows, sort), [filteredRows, sort]);
  const summary = useMemo(() => calculateDailySalesSummary(filteredRows), [filteredRows]);
  const locationGroups = useMemo(() => groupDailySalesByLocation(filteredRows), [filteredRows]);

  const applyPreset = (preset) => {
    setActivePreset(preset);
    setRange(getDailySalesDateRange(preset));
  };

  const applyCustomRange = (fromDate, toDate) => {
    if (!fromDate || !toDate) return;
    if (fromDate > toDate) {
      toast.error('The start date must be on or before the end date.');
      return;
    }
    setActivePreset('custom');
    setRange({ fromDate, toDate });
  };

  const exportCsv = () => {
    if (!sortedRows.length) return;

    const csv = buildDailySalesCsv(sortedRows);
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `daily-sales-report-${range.fromDate}-to-${range.toDate}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const selectedLocationName = locationOptions.find((location) => String(location.locationId) === String(selectedLocationId))?.name;

  return (
    <div className="dashboard-glass daily-sales-report space-y-5 p-3 sm:p-5 lg:p-6">
      <PageHeader
        title="Daily Sales Report"
        description={`${formatDailySalesDateRange(range)} · ${selectedLocationName || 'All Locations'}`}
      >
        <LiquidGlassButton onClick={exportCsv} disabled={loading || !!error || !sortedRows.length} className="w-full sm:w-auto">
          <Download size={16} />
          Export CSV
        </LiquidGlassButton>
      </PageHeader>

      <TableCard>
        <div className="flex flex-col gap-3 bg-slate-50/70 p-3 dark:bg-white/[0.02] xl:flex-row xl:items-center">
          <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-purple-100/80 bg-white/80 px-3 py-2 text-xs text-gray-600 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 xl:self-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" aria-hidden="true" />
            <strong className="font-semibold text-gray-900 dark:text-white">{filteredRows.length}</strong> agents with activity
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 xl:justify-end">
            <div className="w-full sm:w-[170px]">
              <Select value={activePreset} onValueChange={applyPreset}>
                <SelectTrigger className={TOOLBAR_SELECT_TRIGGER_CLASS} aria-label="Report period">
                  <SelectValue placeholder="Report period" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="min-w-[var(--radix-select-trigger-width)]">
                  {activePreset === 'custom' && <SelectItem value="custom">Custom range</SelectItem>}
                  {DAILY_SALES_QUICK_FILTERS.map((filter) => (
                    <SelectItem key={filter.id} value={filter.id}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-[310px]">
              <LiquidGlassDatePicker
                initialFromDate={range.fromDate}
                initialToDate={range.toDate}
                emptyLabel="Select date range"
                calendarMode
                onChange={applyCustomRange}
                stretch
                className="w-full"
              />
            </div>

            <div className="min-w-0 flex-1 sm:w-[190px] sm:flex-none">
              <Select value={selectedLocationId || 'all'} onValueChange={(value) => setSelectedLocationId(value === 'all' ? '' : value)}>
                <SelectTrigger className={TOOLBAR_SELECT_TRIGGER_CLASS} aria-label="Location">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="min-w-[var(--radix-select-trigger-width)] max-h-72">
                  <SelectItem value="all">All Locations</SelectItem>
                  {locationOptions.map((location) => (
                    <SelectItem key={location.locationId} value={String(location.locationId)}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TableRefreshButton
              className="h-10 w-10 shrink-0"
              title="Refresh report"
              loading={loading}
              onClick={() => setRefreshVersion((version) => version + 1)}
            />
          </div>
        </div>
      </TableCard>

      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <strong className="block font-semibold">Report data could not be loaded.</strong>
            <span className="text-xs">{error}</span>
          </div>
          <button
            type="button"
            className="shrink-0 font-semibold underline-offset-2 hover:underline"
            onClick={() => setRefreshVersion((version) => version + 1)}
          >
            Try again
          </button>
        </div>
      )}

      <DailySalesSummary
        summary={summary}
        loading={loading}
        periodLabel={`${formatDailySalesDateRange(range)} · ${selectedLocationName || 'All Locations'}`}
      />

      <DailySalesReportCharts rows={filteredRows} locationGroups={locationGroups} loading={loading} />

      <DailySalesReportTable
        rows={sortedRows}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
      />
    </div>
  );
}
