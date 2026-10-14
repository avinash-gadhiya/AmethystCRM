import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  BadgeDollarSign,
  BarChart3,
  CalendarRange,
  Download,
  MapPin,
  MousePointerClick,
  Percent,
  RefreshCw,
  SlidersHorizontal,
  Target,
  UsersRound
} from 'lucide-react';
import { toast } from 'sonner';

import LiquidGlassDatePicker from '@/components/common/LiquidGlassDatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/apiError';
import dailySalesReportService from '@/services/dailySalesReportService';
import {
  DAILY_SALES_QUICK_FILTERS,
  buildDailySalesCsv,
  buildDailySalesRows,
  calculateDailySalesSummary,
  filterDailySalesRows,
  formatDailySalesCurrency,
  formatDailySalesDateRange,
  formatDailySalesPercentage,
  getDailySalesDateRange,
  groupDailySalesByLocation,
  sortDailySalesRows
} from '@/utils/dailySalesReportUtils';

import DailySalesReportCharts from './DailySalesReportCharts';
import DailySalesReportTable from './DailySalesReportTable';
import './DailySalesReportPage.css';

const EMPTY_REPORT = { userSalePayments: [], userLeads: [] };

const KPI_CONFIG = [
  { key: 'totalSales', label: 'Total Sales', icon: BadgeDollarSign, tone: 'indigo', format: formatDailySalesCurrency },
  { key: 'totalLeads', label: 'Total Leads', icon: MousePointerClick, tone: 'sky', format: (value) => value.toLocaleString() },
  { key: 'salesClosed', label: 'Sales Closed', icon: Target, tone: 'emerald', format: (value) => value.toLocaleString() },
  { key: 'activeSalesAgents', label: 'Active Sales Agents', icon: UsersRound, tone: 'violet', format: (value) => value.toLocaleString() },
  { key: 'revenuePerLead', label: 'Revenue Per Lead', icon: BarChart3, tone: 'amber', format: formatDailySalesCurrency },
  { key: 'conversionRate', label: 'Conversion Rate', icon: Percent, tone: 'rose', format: formatDailySalesPercentage }
];

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

  return (
    <main className="daily-sales-report-page">
      <header className="daily-sales-page-header">
        <div>
          <span className="daily-sales-eyebrow">Performance intelligence</span>
          <h1>Daily Sales Report Dashboard</h1>
          <p>
            {formatDailySalesDateRange(range)} · {selectedLocationId ? 'Filtered location' : 'All Locations'}
          </p>
        </div>
        <div className="daily-sales-header-actions">
          <button
            type="button"
            className="daily-sales-action secondary"
            onClick={() => setRefreshVersion((version) => version + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button type="button" className="daily-sales-action primary" onClick={exportCsv} disabled={loading || !sortedRows.length}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </header>

      <section className="daily-sales-filter-card" aria-label="Report filters">
        <div className="daily-sales-filter-heading">
          <span className="daily-sales-filter-heading-icon" aria-hidden="true">
            <SlidersHorizontal size={18} />
          </span>
          <div>
            <strong>Report filters</strong>
            <span>Choose a reporting period and location</span>
          </div>
        </div>

        <div className="daily-sales-filter-controls">
          <div className="daily-sales-filter-field daily-sales-period-filter">
            <span className="daily-sales-filter-label">
              <CalendarRange size={14} aria-hidden="true" />
              Report period
            </span>
            <Select value={activePreset} onValueChange={applyPreset}>
              <SelectTrigger className="daily-sales-select-trigger" aria-label="Report period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="daily-sales-select-content">
                {activePreset === 'custom' && <SelectItem value="custom">Custom range</SelectItem>}
                {DAILY_SALES_QUICK_FILTERS.map((filter) => (
                  <SelectItem key={filter.id} value={filter.id}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="daily-sales-filter-field daily-sales-date-filter">
            <span className="daily-sales-filter-label">Custom date range</span>
            <LiquidGlassDatePicker
              initialFromDate={range.fromDate}
              initialToDate={range.toDate}
              emptyLabel="Select date range"
              calendarMode
              onChange={applyCustomRange}
              stretch
            />
          </div>

          <div className="daily-sales-filter-field daily-sales-location-filter">
            <span className="daily-sales-filter-label">
              <MapPin size={14} aria-hidden="true" />
              Location
            </span>
            <Select
              value={selectedLocationId || 'all'}
              onValueChange={(value) => setSelectedLocationId(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="daily-sales-select-trigger" aria-label="Location">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent className="daily-sales-select-content">
                <SelectItem value="all">All Locations</SelectItem>
                {locationOptions.map((location) => (
                  <SelectItem key={location.locationId} value={String(location.locationId)}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {error && (
        <section className="daily-sales-error" role="alert">
          <div>
            <strong>Report data could not be loaded.</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setRefreshVersion((version) => version + 1)}>
            Try again
          </button>
        </section>
      )}

      <section className="daily-sales-kpi-grid" aria-label="Daily sales summary">
        {KPI_CONFIG.map((kpi) => (
          <KpiCard key={kpi.key} {...kpi} value={summary[kpi.key]} loading={loading} />
        ))}
      </section>

      <DailySalesReportCharts rows={filteredRows} locationGroups={locationGroups} summary={summary} range={range} loading={loading} />

      <DailySalesReportTable
        rows={sortedRows}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
      />
    </main>
  );
}

function KpiCard({ icon: Icon, label, value, format, tone, loading }) {
  return (
    <article className={`daily-sales-kpi-card tone-${tone}`}>
      <span className="daily-sales-kpi-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div>
        <span>{label}</span>
        {loading ? <span className="daily-sales-kpi-skeleton" /> : <strong>{format(value)}</strong>}
      </div>
    </article>
  );
}

KpiCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  format: PropTypes.func.isRequired,
  tone: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired
};
