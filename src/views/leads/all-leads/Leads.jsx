import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileBarChart, RefreshCw, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { Badge, Button, Modal, Spinner } from 'react-bootstrap';
import { toast } from 'sonner';

import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import AnimatedDropdown from '@/components/ui/animated-dropdown';
import leadService from '@/services/leadService';
import {
  DateCell,
  ErrorState,
  LeadDataTable,
  LeadDateRangeCalendar,
  badge,
  csvCell,
  formatPhone,
  getMessage,
  pagination,
  useNow,
  usePagedData,
  ymd
} from '../leadpage/leadShared';

const MAX_EXPORT_PAGES = 1000;

const QUICK_DATE_OPTIONS = ['Today', 'Yesterday', 'Last Week', 'Current Month', 'Last Month', 'This Year', 'Last Year'];

const getQuickDateRange = (value) => {
  const today = new Date();
  let from = today;
  let to = today;
  if (value === 'Yesterday') from = to = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (value === 'Last Week') from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  if (value === 'Current Month') from = new Date(today.getFullYear(), today.getMonth(), 1);
  if (value === 'Last Month') {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    to = new Date(today.getFullYear(), today.getMonth(), 0);
  }
  if (value === 'This Year') from = new Date(today.getFullYear(), 0, 1);
  if (value === 'Last Year') {
    from = new Date(today.getFullYear() - 1, 0, 1);
    to = new Date(today.getFullYear() - 1, 11, 31);
  }
  return { fromDate: ymd(from), toDate: ymd(to) };
};

const LEAD_REPORTS = {
  disposition: {
    label: 'Leads By Disposition',
    description: 'Filtered by selected date and lead filters',
    endpoint: 'LeadsByDisposition',
    columns: [
      { label: 'Disposition', keys: ['disposition', 'dispositionName', 'name'] },
      { label: 'Total leads', keys: ['total', 'leadCount', 'totalLeads', 'count'], numeric: true },
      { label: 'Percentage', keys: ['percentage', 'percent'], percentage: true }
    ]
  },
  conversation: {
    label: 'Conversation Report',
    description: 'Summary by user without pagination',
    endpoint: 'LeadPickByUsers',
    columns: [
      { label: 'Name', keys: ['userName', 'name', 'fullName'] },
      { label: 'Leads picked', keys: ['leadsPicked', 'leadPicked', 'leadCount', 'totalLeads', 'total', 'count'], badge: 'blue' },
      { label: 'Sale done', keys: ['saleDone', 'salesDone', 'salesCount', 'totalSales', 'saleCount'], badge: 'green' },
      {
        label: 'Conversation %',
        keys: ['conversationPercentage', 'conversationPercent', 'conversation', 'conversionRate', 'percentage'],
        percentage: true,
        badge: 'red'
      }
    ]
  }
};

const reportValue = (row, keys) => {
  for (const key of keys) {
    const pascalKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
    if (row?.[pascalKey] !== undefined && row?.[pascalKey] !== null) return row[pascalKey];
  }
  return undefined;
};
function ReportDialog({ report, filters, lookups, onClose }) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [refreshKey, setRefreshKey] = useState(0),
    [search, setSearch] = useState(''),
    [period, setPeriod] = useState(''),
    [reportFilters, setReportFilters] = useState(null);
  const config = LEAD_REPORTS[report];

  useEffect(() => {
    if (!config) return;
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const hasParentRange = Boolean(filters.fromDate || filters.toDate);
    setSearch('');
    setPeriod(hasParentRange ? 'custom' : report === 'conversation' ? 'yesterday' : 'month');
    setReportFilters({
      report,
      fromDate: filters.fromDate || (report === 'conversation' ? ymd(yesterday) : ymd(new Date(today.getFullYear(), today.getMonth(), 1))),
      toDate: filters.toDate || (report === 'conversation' ? ymd(yesterday) : ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0))),
      userId: filters.salesPersonId || '',
      vendorId: filters.vendorId || '',
      groupId: filters.groupId || ''
    });
  }, [config, filters.fromDate, filters.groupId, filters.salesPersonId, filters.toDate, filters.vendorId, report]);

  useEffect(() => {
    if (!config || reportFilters?.report !== report) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const dateParams = {
      fromdate: reportFilters.fromDate ? `${reportFilters.fromDate}T00:00:00` : undefined,
      todate: reportFilters.toDate ? `${reportFilters.toDate}T23:59:59` : undefined
    };
    const params =
      report === 'disposition'
        ? { ...dateParams, userId: reportFilters.userId || undefined, vendorId: reportFilters.vendorId || undefined }
        : { ...dateParams, groupId: reportFilters.groupId || undefined };
    leadService
      .getReport(config.endpoint, params, controller.signal)
      .then((result) => setRows(result.data))
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError') {
          console.error(requestError);
          setRows([]);
          setError(getMessage(requestError, 'Unable to load report.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [config, refreshKey, report, reportFilters]);

  const filteredRows = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((row) =>
      config?.columns.some((column) =>
        String(reportValue(row, column.keys) ?? '')
          .toLowerCase()
          .includes(value)
      )
    );
  }, [config, rows, search]);
  const totalDispositionLeads = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(reportValue(row, ['total', 'leadCount', 'totalLeads', 'count'])) || 0), 0),
    [rows]
  );
  const cellValue = (row, column) => {
    const direct = reportValue(row, column.keys);
    if (column.percentage && (direct === undefined || direct === null || direct === '')) {
      if (report === 'disposition') {
        const total = Number(reportValue(row, ['total', 'leadCount', 'totalLeads', 'count'])) || 0;
        return totalDispositionLeads ? (total / totalDispositionLeads) * 100 : 0;
      }
      const leads = Number(reportValue(row, ['leadsPicked', 'leadPicked', 'leadCount', 'totalLeads'])) || 0;
      const sales = Number(reportValue(row, ['saleDone', 'salesDone', 'salesCount', 'totalSales', 'saleCount'])) || 0;
      return leads ? (sales / leads) * 100 : 0;
    }
    return direct;
  };
  const changePeriod = (value) => {
    setPeriod(value);
    if (value === 'custom') return;
    const today = new Date();
    let from = today,
      to = today;
    if (value === 'yesterday') from = to = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (value === 'week') from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    if (value === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }
    setReportFilters((old) => ({ ...old, fromDate: ymd(from), toDate: ymd(to) }));
  };
  const exportReport = () => {
    if (!filteredRows.length) return;
    const headers = ['#', ...config.columns.map((column) => column.label)];
    const lines = [
      headers,
      ...filteredRows.map((row, index) => [
        index + 1,
        ...config.columns.map((column) => {
          const value = cellValue(row, column);
          return column.percentage ? `${Number(value || 0).toFixed(1)}%` : (value ?? '-');
        })
      ])
    ].map((line) => line.map(csvCell).join(','));
    const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report}-report-${ymd()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!config) return null;

  return (
    <Modal
      show={Boolean(config)}
      onHide={onClose}
      size="xl"
      centered
      scrollable
      backdrop
      keyboard
      container={document.body}
      backdropClassName="lead-report-backdrop"
      className="lead-report-window"
      dialogClassName="lead-report-modal"
    >
      <Modal.Header className="lead-report-modal-header">
        <div className="lead-report-modal-title">
          <div>
            <Modal.Title>{config?.label}</Modal.Title>
            <small>{config?.description}</small>
          </div>
        </div>
        <button type="button" className="lead-report-close" onClick={onClose} aria-label="Close report" title="Close report">
          <X size={20} />
        </button>
      </Modal.Header>
      <Modal.Body>
        <div className="lead-report-control-card">
          <div className="lead-report-control-top">
            <div className="lead-report-count">
              <span />
              <strong>{filteredRows.length}</strong> of <strong>{rows.length}</strong> results
            </div>
            <div className="lead-report-control-actions">
              <button type="button" onClick={exportReport} disabled={!filteredRows.length} aria-label="Export report" title="Export report">
                <Download size={18} />
              </button>
              <button
                type="button"
                className="round"
                onClick={() => setRefreshKey((value) => value + 1)}
                disabled={loading}
                aria-label="Refresh report"
                title="Refresh report"
              >
                <RefreshCw size={18} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>
          <div className={`lead-report-control-grid ${report === 'conversation' ? 'conversation' : ''}`}>
            {report === 'disposition' && (
              <>
                <AnimatedDropdown
                  ariaLabel="Report user"
                  value={reportFilters?.userId || ''}
                  onValueChange={(value) => setReportFilters((old) => ({ ...old, userId: value }))}
                  options={[
                    { value: '', label: 'All Users' },
                    ...lookups.users.map((item) => ({ value: String(item.id), label: item.label }))
                  ]}
                />
                <AnimatedDropdown
                  ariaLabel="Report vendor"
                  value={reportFilters?.vendorId || ''}
                  onValueChange={(value) => setReportFilters((old) => ({ ...old, vendorId: value }))}
                  options={[
                    { value: '', label: 'All Vendors' },
                    ...lookups.vendors.map((item) => ({ value: String(item.id), label: item.label }))
                  ]}
                />
              </>
            )}
            <div className="lead-report-search">
              <Search size={17} />
              <input
                type="text"
                className="lead-search-input lead-report-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={report === 'disposition' ? 'Search disposition…' : 'Search by name…'}
                aria-label="Search report"
              />
            </div>
            <AnimatedDropdown
              ariaLabel="Report period"
              value={period}
              onValueChange={changePeriod}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
                { value: 'week', label: 'Last 7 Days' },
                { value: 'month', label: 'Current Month' },
                { value: 'custom', label: 'Custom Range' }
              ]}
            />
            <LeadDateRangeCalendar
              fromDate={reportFilters?.fromDate || ''}
              toDate={reportFilters?.toDate || ''}
              onChange={(fromDate, toDate) => {
                setPeriod('custom');
                setReportFilters((old) => ({ ...old, fromDate, toDate }));
              }}
            />
          </div>
        </div>
        {loading ? (
          <div className="lead-report-loading" role="status">
            {Array.from({ length: 7 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />
        ) : filteredRows.length === 0 ? (
          <div className="lead-report-empty">
            <FileBarChart size={30} />
            <strong>No report data found</strong>
            <span>Try changing the active filters or date range.</span>
          </div>
        ) : (
          <div className="table-responsive lead-report-table-wrap">
            <table className="table align-middle lead-report-table">
              <thead>
                <tr>
                  <th>#</th>
                  {config.columns.map((column) => (
                    <th key={column.label}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row.id || row.userId || row.dispositionId || index}>
                    <td>{index + 1}</td>
                    {config.columns.map((column) => {
                      const value = cellValue(row, column);
                      if (column.percentage) {
                        const percent = Number(value) || 0;
                        return (
                          <td key={column.label}>
                            {report === 'disposition' ? (
                              <div className="lead-report-percent">
                                <span>
                                  <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
                                </span>
                                <strong>{percent.toFixed(1)}%</strong>
                              </div>
                            ) : (
                              <span className="lead-report-value-badge red">{percent.toFixed(1)}%</span>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td key={column.label}>
                          {column.badge ? (
                            <span className={`lead-report-value-badge ${column.badge}`}>{Number(value) || 0}</span>
                          ) : (
                            String(value ?? '-')
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}

export default function Leads({ permissions, voicemail, lookups }) {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState({ sortProperty: 'leadId', isDescending: true });
  const [searchInput, setSearchInput] = useState(''),
    [filters, setFilters] = useState({ text: '', salesPersonId: '', groupId: '', locationId: '', vendorId: '', fromDate: '', toDate: '' });
  const [quickDate, setQuickDate] = useState('Custom');
  const [deleting, setDeleting] = useState(false),
    [deleteLead, setDeleteLead] = useState(null),
    [exporting, setExporting] = useState(false),
    [report, setReport] = useState(''),
    [reportMenuOpen, setReportMenuOpen] = useState(false);
  const reportMenuRef = useRef(null);
  const now = useNow();
  useEffect(() => {
    if (!reportMenuOpen) return undefined;
    const closeMenu = (event) => {
      if (!reportMenuRef.current?.contains(event.target)) setReportMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [reportMenuOpen]);
  const query = useCallback(
    (pageNumber = page, size = pageSize) => ({
      PageNumber: pageNumber,
      PageSize: size,
      ...(filters.text
        ? { Text: filters.text }
        : {
            FromDate: filters.fromDate ? `${filters.fromDate}T00:00:00` : undefined,
            ToDate: filters.toDate ? `${filters.toDate}T23:59:59` : undefined
          }),
      SalesPersonId: filters.salesPersonId || undefined,
      GroupId: filters.groupId || undefined,
      LocationId: filters.locationId || undefined,
      VendorId: filters.vendorId || undefined,
      DispositionId: voicemail ? 21 : undefined,
      SortProperty: sort.sortProperty,
      IsDescending: sort.isDescending
    }),
    [page, pageSize, filters, voicemail, sort]
  );
  const loader = useCallback((signal) => leadService.getLeadReport(query(), signal), [query]);
  const state = usePagedData(loader, [loader]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const text = searchInput.trim();
      if (text === filters.text) return;
      setPage(1);
      setFilters((old) => ({ ...old, text }));
    }, 450);
    return () => clearTimeout(timer);
  }, [filters.text, searchInput]);
  const updateFilter = (key, value) => {
    setFilters((old) => ({ ...old, [key]: value }));
    setPage(1);
  };
  const updateDateRange = (fromDate, toDate) => {
    setQuickDate('Custom');
    setFilters((old) => ({ ...old, fromDate, toDate }));
    setPage(1);
  };
  const updateQuickDate = (value) => {
    setQuickDate(value);
    if (value === 'Custom') return;
    const range = getQuickDateRange(value);
    setFilters((old) => ({ ...old, ...range }));
    setPage(1);
  };
  const hasActiveFilters = Boolean(
    filters.salesPersonId ||
      filters.groupId ||
      filters.locationId ||
      filters.vendorId ||
      filters.fromDate ||
      filters.toDate ||
      searchInput.trim() ||
      filters.text
  );
  const resetFilters = () => {
    setSearchInput('');
    setQuickDate('Custom');
    setFilters({
      text: '',
      salesPersonId: '',
      groupId: '',
      locationId: '',
      vendorId: '',
      fromDate: '',
      toDate: ''
    });
    setPage(1);
  };
  const remove = async () => {
    if (!deleteLead || deleting) return;
    setDeleting(true);
    try {
      await leadService.deleteLead(deleteLead.leadId);
      toast.success('Lead deleted successfully');
      setDeleteLead(null);
      state.refresh();
    } catch (error) {
      console.error(error);
      toast.error(getMessage(error, 'Unable to delete lead.'));
    } finally {
      setDeleting(false);
    }
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = [];
      let currentPage = 1,
        total = Infinity;
      while (rows.length < total && currentPage <= MAX_EXPORT_PAGES) {
        const result = await leadService.getLeadReport(query(currentPage, 1000));
        rows.push(...result.data);
        total = result.totalCount;
        if (!result.data.length || result.data.length < 1000) break;
        currentPage += 1;
      }
      const headers = [
        'Lead ID',
        'Customer',
        'Email',
        'Phone',
        'Sales Person',
        'Group',
        'Location',
        'Description',
        'Disposition',
        'Comments',
        'Vendor',
        'Lead Date',
        'Assign Date'
      ];
      const lines = [
        headers,
        ...rows.map((lead) => [
          lead.leadId,
          lead.customerName,
          lead.email,
          lead.phone,
          lead.assignedToName,
          lead.groupName,
          lead.locationName,
          lead.description,
          lead.dispositionName,
          lead.comments,
          lead.vendorName,
          lead.leadDate,
          lead.assignDate
        ])
      ].map((row) => row.map(csvCell).join(','));
      const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `leads-${ymd()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} leads`);
    } catch (error) {
      console.error(error);
      toast.error(getMessage(error, 'Unable to export leads.'));
    } finally {
      setExporting(false);
    }
  };
  const columns = [
    { id: 'serial', header: '#' },
    {
      id: 'customer',
      header: 'Customer',
      cell: (lead) => (
        <div>
          <strong>{lead.customerName || '-'}</strong>
          {lead.isValid === false && (
            <Badge bg="danger" className="ms-2">
              Invalid
            </Badge>
          )}
          {lead.isProxy && (
            <Badge bg="warning" text="dark" className="ms-1">
              VPN/Proxy
            </Badge>
          )}
          <small className="d-block text-muted">
            {lead.email || '-'} · {formatPhone(lead.phone)}
          </small>
          {lead.activityScore !== undefined && lead.activityScore !== null && (
            <small className="text-muted">Activity: {lead.activityScore}</small>
          )}
        </div>
      )
    },
    {
      id: 'sales',
      header: 'Sales Person',
      cell: (lead) => (
        <div>
          {lead.assignedToName || '-'}
          <div className="d-flex gap-1 mt-1">
            {badge(lead.groupName, 'info', 'dark')}
            {badge(lead.locationName, 'light', 'dark')}
          </div>
          {lead.transferByName && <small className="text-muted">Transferred by {lead.transferByName}</small>}
        </div>
      )
    },
    {
      id: 'description',
      header: 'Description',
      cell: (lead) => (
        <div className="lead-clamp" title={lead.description}>
          {lead.description || '-'}
        </div>
      )
    },
    {
      id: 'disposition',
      header: 'Disposition',
      cell: (lead) => (
        <div>
          {badge(lead.dispositionName, 'primary')}
          <small className="d-block text-muted lead-clamp" title={lead.comments}>
            {lead.comments || '-'}
          </small>
        </div>
      )
    },
    { id: 'vendor', header: 'Vendor', cell: (lead) => badge(lead.vendorName) },
    {
      id: 'leadDate',
      header: 'Lead Date',
      sortable: true,
      sortKey: 'dateAdded',
      cell: (lead) => <DateCell value={lead.leadDate} timeZone={lead.timeZone} now={now} />
    },
    {
      id: 'assignDate',
      header: 'Assign Date',
      sortable: true,
      cell: (lead) => <DateCell value={lead.assignDate} timeZone={lead.timeZone} now={now} />
    },
    {
      id: 'action',
      header: 'Action',
      sticky: 'right',
      cell: (lead) =>
        permissions.canDelete ? (
          <Button variant="outline-danger" size="sm" onClick={() => setDeleteLead(lead)} aria-label={`Delete lead ${lead.leadId}`}>
            <Trash2 size={15} />
          </Button>
        ) : (
          '-'
        )
    }
  ];
  return (
    <>
      <div className="lead-summary-bar">
        <div className="lead-summary-overview">
          <div className="lead-metrics" aria-label={voicemail ? 'Voicemail summary' : 'Lead summary'}>
            <div className="lead-metric lead-metric-total">
              <span className="lead-metric-dot" />
              <div>
                <strong>{state.totalCount}</strong>
                <span>Total {voicemail ? 'Voicemails' : 'Leads'}</span>
              </div>
            </div>
            <div className="lead-metric lead-metric-available">
              <span className="lead-metric-dot" />
              <div>
                <strong>{state.data.length}</strong>
                <span>Showing now</span>
              </div>
            </div>
          </div>
        </div>
        <div className="lead-summary-actions">
          {filters.text && <span className="lead-search-mode">Searching across all dates</span>}
          {hasActiveFilters && (
            <button
              type="button"
              className="lead-reset-chip"
              onClick={resetFilters}
              title="Reset all filters"
              aria-label="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
          <div className="lead-report-menu" ref={reportMenuRef}>
            <button
              type="button"
              className={`lead-export-icon-button lead-report-icon-button ${reportMenuOpen ? 'active' : ''}`}
              onClick={() => setReportMenuOpen((value) => !value)}
              aria-label="Open reports"
              aria-haspopup="menu"
              aria-expanded={reportMenuOpen}
              title="Reports"
            >
              <FileBarChart size={18} />
            </button>
            {reportMenuOpen && (
              <div className="lead-report-menu-popover" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setReport('disposition');
                    setReportMenuOpen(false);
                  }}
                >
                  Disposition
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setReport('conversation');
                    setReportMenuOpen(false);
                  }}
                >
                  Conversation
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="lead-export-icon-button"
            onClick={exportCsv}
            disabled={exporting}
            aria-label="Export CSV"
            title={exporting ? 'Preparing CSV' : 'Export CSV'}
          >
            {exporting ? <Spinner size="sm" /> : <Download size={18} />}
          </button>
        </div>
      </div>

      <div className="lead-report-panel">
        <div className="lead-filters">
          <AnimatedDropdown
            ariaLabel="Sales person"
            value={filters.salesPersonId}
            onValueChange={(value) => updateFilter('salesPersonId', value)}
            options={[
              { value: '', label: 'Sales Person: All' },
              ...lookups.users.map((item) => ({ value: String(item.id), label: item.label }))
            ]}
          />
          <AnimatedDropdown
            ariaLabel="Group"
            value={filters.groupId}
            onValueChange={(value) => updateFilter('groupId', value)}
            options={[
              { value: '', label: 'Groups: All' },
              ...lookups.groups.map((item) => ({ value: String(item.id), label: item.label }))
            ]}
          />
          <AnimatedDropdown
            ariaLabel="Location"
            value={filters.locationId}
            onValueChange={(value) => updateFilter('locationId', value)}
            options={[
              { value: '', label: 'Locations: All' },
              ...lookups.locations.map((item) => ({ value: String(item.id), label: item.label }))
            ]}
          />
          <AnimatedDropdown
            ariaLabel="Vendor"
            value={filters.vendorId}
            onValueChange={(value) => updateFilter('vendorId', value)}
            options={[
              { value: '', label: 'Vendors: All' },
              ...lookups.vendors.map((item) => ({ value: String(item.id), label: item.label }))
            ]}
          />
          <div className="lead-search-field">
            <Search size={17} aria-hidden="true" />
            <input
              type="text"
              className="lead-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={voicemail ? 'Search voicemails…' : 'Search leads…'}
              aria-label={voicemail ? 'Search voicemails' : 'Search all leads'}
            />
            {searchInput && (
              <button type="button" className="lead-search-clear" onClick={() => setSearchInput('')} aria-label="Clear search">
                ×
              </button>
            )}
          </div>
          <div className="lead-date-picker">
            <AnimatedDropdown
              className="lead-quick-date-select"
              ariaLabel="Quick date"
              value={quickDate}
              disabled={Boolean(filters.text)}
              onValueChange={updateQuickDate}
              options={[
                { value: 'Custom', label: 'Quick Date: Custom' },
                ...QUICK_DATE_OPTIONS.map((option) => ({ value: option, label: option }))
              ]}
            />
            <LeadDateRangeCalendar
              toolbar
              emptyLabel={voicemail ? 'All Voicemails' : 'All Leads'}
              fromDate={filters.fromDate}
              toDate={filters.toDate}
              disabled={Boolean(filters.text)}
              onChange={updateDateRange}
              onRefresh={state.refresh}
              refreshing={state.loading}
            />
          </div>
        </div>
      </div>
      <ErrorState message={state.error} onRetry={state.refresh} />
      <LeadDataTable
        columns={columns}
        data={state.data}
        loading={state.loading}
        rowKey="leadId"
        sort={{
          ...sort,
          onSort: (key) => setSort((old) => ({ sortProperty: key, isDescending: old.sortProperty === key ? !old.isDescending : false }))
        }}
        pagination={pagination(page, pageSize, state.totalCount, setPage, setPageSize)}
        emptyState={{ title: voicemail ? 'No voicemail leads' : 'No leads found', description: 'Try changing the active filters.' }}
      />
      <DeleteConfirmModal
        open={Boolean(deleteLead)}
        title="Delete Lead"
        description="Are you sure you want to delete"
        itemName={deleteLead?.customerName || `Lead #${deleteLead?.leadId}`}
        details={[
          { label: 'Lead ID', value: deleteLead?.leadId },
          { label: 'Customer', value: deleteLead?.customerName || '-' }
        ]}
        loading={deleting}
        onCancel={() => setDeleteLead(null)}
        onConfirm={remove}
      />
      {report && <ReportDialog report={report} filters={filters} lookups={lookups} onClose={() => setReport('')} />}
    </>
  );
}
