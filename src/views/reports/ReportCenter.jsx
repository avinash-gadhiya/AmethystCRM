import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from 'components/ui/Bootstrap';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  MousePointerClick,
  RefreshCw,
  Search,
  UsersRound,
  WalletCards
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

import reportService from 'services/reportService';
import userService from 'services/userService';

const PAGE_SIZES = [10, 25, 50];
const SERVER_PAGED_REPORTS = new Set(['sales', 'service', 'renewal']);

const REPORTS = {
  disposition: {
    label: 'Leads by Disposition',
    path: '/LeadsReports/LeadsByDisposition',
    resource: 'LeadReport',
    endpoint: 'LeadsByDisposition',
    loader: 'getLeadsByDisposition',
    columns: [
      ['disposition', 'Disposition'],
      ['total', 'Total Leads', 'number'],
      ['percentage', 'Percentage', 'percent']
    ]
  },
  userLeads: {
    label: 'User Wise Leads',
    path: '/LeadsReports/UserWiseLeadPick',
    resource: 'LeadReport',
    endpoint: 'LeadPickByUsers',
    loader: 'getLeadPickByUsers',
    columns: [
      ['userName', 'User'],
      ['leadsPicked', 'Leads Picked', 'number']
    ]
  },
  sales: {
    label: 'Sales',
    path: '/Reports/Sales-reports',
    resource: 'Report',
    endpoint: 'SalesReport',
    loader: 'getSalesReport',
    columns: [
      ['paymentId', 'Payment ID'],
      ['orderId', 'Order ID'],
      ['gatewayName', 'Gateway'],
      ['brandName', 'Brand'],
      ['amount', 'Amount', 'money'],
      ['saleType', 'Sale Type'],
      ['orderDate', 'Order Date', 'date'],
      ['paymentDate', 'Payment Date', 'date'],
      ['customerName', 'Customer'],
      ['subscriptionMonths', 'Months'],
      ['entUserName', 'Sales Person'],
      ['quantity', 'Qty']
    ]
  },
  tickets: {
    label: 'Ticket Status',
    path: '/Reports/Ticket-Refund',
    resource: 'Report',
    endpoint: 'TicketStatusReport',
    loader: 'getTicketStatusReport',
    columns: [
      ['techWorked', 'Tech Worked'],
      ['closed', 'Closed', 'number'],
      ['inProgress', 'In Progress', 'number'],
      ['new', 'New', 'number'],
      ['grandTotal', 'Grand Total', 'number']
    ]
  },
  service: {
    label: 'Service',
    path: '/Reports/Services',
    resource: 'Report',
    endpoint: 'ServiceReport',
    loader: 'getServiceReport',
    columns: [
      ['ticketId', 'Ticket ID'],
      ['ticketType', 'Ticket Type'],
      ['t_StartDate', 'Start Date', 'date'],
      ['t_EndDate', 'End Date', 'date'],
      ['createdByName', 'Created By'],
      ['brandName', 'Brand'],
      ['ticketStatusName', 'Status', 'status'],
      ['customerName', 'Customer'],
      ['techWorkedName', 'Tech Worked']
    ]
  },
  performance: {
    label: 'User Performance',
    path: '/Performance/UserPerformanceReport',
    resource: 'Report',
    endpoint: 'GetUserPerformanceReport',
    loader: 'getUserPerformanceReport',
    columns: [
      ['userName', 'User'],
      ['locationName', 'Location'],
      ['leads', 'Leads', 'number'],
      ['salesClosed', 'Sales Closed', 'number'],
      ['salesAmount', 'Sales Amount', 'money'],
      ['conversionRate', 'Conversion', 'percent'],
      ['revenuePerLead', 'Revenue / Lead', 'money']
    ]
  },
  renewal: {
    label: 'Renewal',
    path: '/Reports/Renewal',
    resource: 'Report',
    endpoint: 'RenewalReport',
    loader: 'getRenewalReport',
    columns: [
      ['customerId', 'Customer ID'],
      ['customerName', 'Customer Name'],
      ['phone', 'Phone'],
      ['amount', 'Amount', 'money'],
      ['subscriptionMonths', 'Months', 'number'],
      ['startDate', 'Start Date', 'date'],
      ['endDate', 'End Date', 'date']
    ]
  }
};

const toInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialFilters = () => {
  const today = new Date();
  return {
    fromDate: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    toDate: toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    userId: '',
    vendorId: '',
    groupId: ''
  };
};

const formatRangeDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
};

const reportFromPath = (pathname) => {
  const path = pathname.toLowerCase();
  if (path.includes('leadsbydisposition')) return 'disposition';
  if (path.includes('userwiseleadpick')) return 'userLeads';
  if (path.includes('service')) return 'service';
  if (path.includes('renewal')) return 'renewal';
  if (path.includes('ticket') || path.includes('refund')) return 'tickets';
  if (path.includes('performance')) return 'performance';
  return 'sales';
};

const normalizeUserLeads = (payload) => {
  const users = Array.isArray(payload?.users) ? payload.users : [];
  return users
    .map((item, index) => ({
      ...item,
      userName:
        getValue(item, 'userName') ||
        getValue(item, 'name') ||
        `${getValue(item, 'firstName') || ''} ${getValue(item, 'lastName') || ''}`.trim() ||
        `User ${getValue(item, 'userId') || index + 1}`,
      leadsPicked: safeNumber(
        getValue(item, 'leadsPicked') ??
          getValue(item, 'leadCount') ??
          getValue(item, 'totalLeads') ??
          getValue(item, 'total') ??
          getValue(item, 'count')
      )
    }))
    .sort((left, right) => right.leadsPicked - left.leadsPicked);
};

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getValue = (row, key) => {
  if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  const pascalKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  return row?.[pascalKey];
};

const normalizePerformance = (payload) => {
  const sales = Array.isArray(payload?.userSalePayments) ? payload.userSalePayments : [];
  const leads = Array.isArray(payload?.userLeads) ? payload.userLeads : [];
  const users = new Map();

  const ensureUser = (item) => {
    const userId = getValue(item, 'userId') ?? 'unknown';
    if (!users.has(userId)) {
      const firstName = String(getValue(item, 'firstName') || '').trim();
      const lastName = String(getValue(item, 'lastName') || '').trim();
      users.set(userId, {
        userId,
        userName:
          `${firstName} ${lastName}`.trim() ||
          getValue(item, 'entUserName') ||
          getValue(item, 'userName') ||
          getValue(item, 'agentName') ||
          `User ${userId}`,
        locationName: getValue(item, 'locationName') || getValue(item, 'location') || 'Unassigned',
        leads: 0,
        salesClosed: 0,
        salesAmount: 0
      });
    }
    return users.get(userId);
  };

  sales.forEach((item) => {
    const user = ensureUser(item);
    user.salesAmount += safeNumber(getValue(item, 'splitSaleAmount') ?? getValue(item, 'amount') ?? getValue(item, 'saleAmount'));
    user.salesClosed += 1;
  });
  leads.forEach((item) => {
    const user = ensureUser(item);
    user.leads += safeNumber(getValue(item, 'leadCount') ?? getValue(item, 'leads'));
    user.locationName = getValue(item, 'locationName') || user.locationName;
  });

  return Array.from(users.values())
    .map((user) => ({
      ...user,
      conversionRate: user.leads ? (user.salesClosed / user.leads) * 100 : 0,
      revenuePerLead: user.leads ? user.salesAmount / user.leads : 0
    }))
    .sort((left, right) => right.salesAmount - left.salesAmount);
};

const formatValue = (value, type) => {
  if (value === undefined || value === null || value === '') return '-';
  if (type === 'money') {
    return safeNumber(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }
  if (type === 'percent') return `${safeNumber(value).toFixed(1)}%`;
  if (type === 'number') return safeNumber(value).toLocaleString();
  if (type === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  return String(value);
};

const SummaryCard = ({ icon: Icon, label, value, tone = 'primary', subtitle }) => (
  <Card className="neu-kpi-card h-100 border-0">
    <Card.Body className="d-flex align-items-center gap-3 p-3">
      <div className={`neu-kpi-icon-circle tone-${tone}`}>
        <Icon size={24} />
      </div>
      <div className="min-w-0 flex-grow-1">
        <div className="neu-kpi-label">{label}</div>
        <div className="neu-kpi-value text-truncate">{value}</div>
        {subtitle && <div className="neu-kpi-subtitle">{subtitle}</div>}
      </div>
    </Card.Body>
  </Card>
);

export default function ReportCenter() {
  const location = useLocation();
  const [activeReport, setActiveReport] = useState(() => reportFromPath(location.pathname));
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [rows, setRows] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restricted, setRestricted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [datePreset, setDatePreset] = useState('this-month');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [userOptions, setUserOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);

  const config = REPORTS[activeReport];

  useEffect(() => {
    setActiveReport(reportFromPath(location.pathname));
    setRows([]);
    setSearchText('');
    setAppliedSearch('');
    setTotalCount(0);
    setRestricted(false);
    setPage(1);
  }, [location.pathname]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      userService.getUserDropDown({ PageSize: 250 }, controller.signal),
      reportService.getGroupDropdown(controller.signal)
    ]).then(([usersResult, groupsResult]) => {
      if (controller.signal.aborted) return;
      setUserOptions(usersResult.status === 'fulfilled' ? usersResult.value : []);
      setGroupOptions(groupsResult.status === 'fulfilled' ? groupsResult.value.data || [] : []);
    });
    return () => controller.abort();
  }, []);

  const loadReport = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      setRestricted(false);
      try {
        const response = await reportService[config.loader](
          {
            ...filters,
            page,
            pageSize,
            search: SERVER_PAGED_REPORTS.has(activeReport) ? appliedSearch : ''
          },
          signal
        );
        const reportRows =
          activeReport === 'performance'
            ? normalizePerformance(response.data || {})
            : activeReport === 'userLeads'
              ? normalizeUserLeads(response.data || {})
            : Array.isArray(response.data)
              ? response.data
              : Array.isArray(response.data?.items)
                ? response.data.items
                : [];
        setRows(reportRows);
        setTotalCount(Number(response.totalCount) || reportRows.length);
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        setRows([]);
        setTotalCount(0);
        if (requestError.statusCode === 403 || /permission|access/i.test(requestError.message || '')) {
          setRestricted(true);
          setError('');
        } else {
          setError(requestError.message || `Unable to load ${config.label.toLowerCase()} report.`);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [activeReport, appliedSearch, config, filters, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadReport(controller.signal);
    return () => controller.abort();
  }, [loadReport, refreshKey]);

  const filteredRows = useMemo(() => {
    if (SERVER_PAGED_REPORTS.has(activeReport)) return rows;
    const search = appliedSearch.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) => config.columns.some(([key]) => String(getValue(row, key) ?? '').toLowerCase().includes(search)));
  }, [activeReport, appliedSearch, config.columns, rows]);

  const effectiveTotal = SERVER_PAGED_REPORTS.has(activeReport) ? totalCount : filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const visibleRows = SERVER_PAGED_REPORTS.has(activeReport)
    ? filteredRows
    : filteredRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const amountKey = activeReport === 'performance' ? 'salesAmount' : 'amount';
    const amount = filteredRows.reduce((sum, row) => sum + safeNumber(getValue(row, amountKey)), 0);
    if (activeReport === 'disposition') {
      const totalLeads = filteredRows.reduce((sum, row) => sum + safeNumber(getValue(row, 'total')), 0);
      const topDisposition = [...filteredRows].sort(
        (left, right) => safeNumber(getValue(right, 'total')) - safeNumber(getValue(left, 'total'))
      )[0];
      return {
        primaryLabel: 'Total leads',
        primary: totalLeads.toLocaleString(),
        secondaryLabel: 'Top disposition',
        secondary: getValue(topDisposition, 'disposition') || '-'
      };
    }
    if (activeReport === 'userLeads') {
      const totalPicked = filteredRows.reduce((sum, row) => sum + safeNumber(getValue(row, 'leadsPicked')), 0);
      return {
        primaryLabel: 'Leads picked',
        primary: totalPicked.toLocaleString(),
        secondaryLabel: 'Active users',
        secondary: filteredRows.filter((row) => safeNumber(getValue(row, 'leadsPicked')) > 0).length
      };
    }
    if (activeReport === 'tickets') {
      return {
        primaryLabel: 'Closed tickets',
        primary: filteredRows.reduce((sum, row) => sum + safeNumber(getValue(row, 'closed')), 0),
        secondaryLabel: 'Open tickets',
        secondary: filteredRows.reduce(
          (sum, row) => sum + safeNumber(getValue(row, 'new')) + safeNumber(getValue(row, 'inProgress')),
          0
        )
      };
    }
    if (activeReport === 'performance') {
      const leads = filteredRows.reduce((sum, row) => sum + safeNumber(row.leads), 0);
      const sales = filteredRows.reduce((sum, row) => sum + safeNumber(row.salesClosed), 0);
      return {
        primaryLabel: 'Total sales',
        primary: formatValue(amount, 'money'),
        secondaryLabel: 'Conversion rate',
        secondary: formatValue(leads ? (sales / leads) * 100 : 0, 'percent')
      };
    }
    return {
      primaryLabel: activeReport === 'service' ? 'Closed services' : 'Total amount',
      primary:
        activeReport === 'service'
          ? filteredRows.filter((row) => String(getValue(row, 'ticketStatusName') || '').toLowerCase() === 'closed').length
          : formatValue(amount, 'money'),
      secondaryLabel: activeReport === 'service' ? 'Active services' : 'Customers',
      secondary:
        activeReport === 'service'
          ? filteredRows.filter((row) => String(getValue(row, 'ticketStatusName') || '').toLowerCase() !== 'closed').length
          : new Set(filteredRows.map((row) => getValue(row, 'customerId')).filter(Boolean)).size
    };
  }, [activeReport, filteredRows]);

  const applyFilters = (event) => {
    if (event && event.preventDefault) event.preventDefault();
    if (draftFilters.fromDate && draftFilters.toDate && draftFilters.fromDate > draftFilters.toDate) {
      setError('From date cannot be later than to date.');
      return;
    }
    setError('');
    setPage(1);
    setAppliedSearch(searchText.trim());
    setFilters({ ...draftFilters });
  };

  const applyPreset = (preset) => {
    const today = new Date();
    let fromDate = new Date();
    let toDate = new Date();

    if (preset === 'today') {
      fromDate = today;
      toDate = today;
    } else if (preset === 'last-7') {
      fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      toDate = today;
    } else if (preset === 'this-month') {
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
      toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (preset === 'last-30') {
      fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      toDate = today;
    }

    const nextFilters = {
      ...draftFilters,
      fromDate: toInputDate(fromDate),
      toDate: toInputDate(toDate)
    };
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
    setDatePreset(preset);
    setShowCustomDates(false);
    setPage(1);
  };

  const shiftDateRange = (direction) => {
    const currentFrom = new Date(`${draftFilters.fromDate}T00:00:00`);
    const currentTo = new Date(`${draftFilters.toDate}T00:00:00`);
    if (Number.isNaN(currentFrom.getTime()) || Number.isNaN(currentTo.getTime())) return;

    let nextFrom;
    let nextTo;
    if (datePreset === 'this-month') {
      nextFrom = new Date(currentFrom.getFullYear(), currentFrom.getMonth() + direction, 1);
      nextTo = new Date(nextFrom.getFullYear(), nextFrom.getMonth() + 1, 0);
    } else {
      const span = Math.max(1, Math.round((currentTo - currentFrom) / 86400000) + 1);
      nextFrom = new Date(currentFrom);
      nextTo = new Date(currentTo);
      nextFrom.setDate(nextFrom.getDate() + direction * span);
      nextTo.setDate(nextTo.getDate() + direction * span);
    }

    const nextFilters = {
      ...draftFilters,
      fromDate: toInputDate(nextFrom),
      toDate: toInputDate(nextTo)
    };
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
    setPage(1);
  };

  const updateAndApplyFilter = (field, value) => {
    const nextFilters = { ...draftFilters, [field]: value };
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
    setPage(1);
  };

  const isGrandTotal = (row) => {
    const firstColKey = config.columns[0][0];
    const val = String(getValue(row, firstColKey) ?? '').trim().toLowerCase();
    return val === 'grand total' || val === 'total';
  };

  const exportCsv = () => {
    if (!filteredRows.length) return;
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [
      config.columns.map(([, label]) => escape(label)).join(','),
      ...filteredRows.map((row) => config.columns.map(([key, , type]) => escape(formatValue(getValue(row, key), type))).join(','))
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeReport}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const DATE_PRESETS = [
    { id: 'today', label: 'Today' },
    { id: 'last-7', label: 'Last 7 Days' },
    { id: 'this-month', label: 'This Month' },
    { id: 'last-30', label: 'Last 30 Days' }
  ];

  return (
    <div className="crm-report-view">
      <Card className="report-toolbar-card border-0 mb-4">
        <Card.Body className="report-toolbar-body">
          <div className="report-toolbar-top">
            <span className="report-result-chip">
              <span className="report-result-dot" />
              <strong>{effectiveTotal.toLocaleString()}</strong> of {effectiveTotal.toLocaleString()} results
            </span>
            <div className="report-toolbar-actions">
              <button type="button" className="report-square-btn" onClick={exportCsv} disabled={!filteredRows.length} title="Download CSV">
                <Download size={18} />
              </button>
              <button type="button" className="report-round-btn" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} title="Refresh report">
                <RefreshCw size={18} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          <Form onSubmit={applyFilters} className="report-compact-form">
            <div className="report-toolbar-controls">
              {activeReport === 'disposition' && (
                <>
                  <Form.Select value={draftFilters.userId} onChange={(event) => updateAndApplyFilter('userId', event.target.value)} aria-label="Filter by user">
                    <option value="">All Users</option>
                    {userOptions.map((user, index) => {
                      const id = getValue(user, 'userId') ?? getValue(user, 'id') ?? index;
                      const name =
                        getValue(user, 'displayName') ||
                        getValue(user, 'userName') ||
                        `${getValue(user, 'firstName') || ''} ${getValue(user, 'lastName') || ''}`.trim() ||
                        `User ${id}`;
                      return <option key={id} value={id}>{name}</option>;
                    })}
                  </Form.Select>
                  <Form.Select value={draftFilters.vendorId} onChange={(event) => updateAndApplyFilter('vendorId', event.target.value)} aria-label="Filter by vendor">
                    <option value="">All Vendors</option>
                  </Form.Select>
                </>
              )}
              {activeReport === 'userLeads' && (
                <Form.Select value={draftFilters.groupId} onChange={(event) => updateAndApplyFilter('groupId', event.target.value)} aria-label="Filter by group">
                  <option value="">All Groups</option>
                  {groupOptions.map((group, index) => {
                    const id = getValue(group, 'groupId') ?? getValue(group, 'id') ?? index;
                    const name = getValue(group, 'groupName') || getValue(group, 'name') || `Group ${id}`;
                    return <option key={id} value={id}>{name}</option>;
                  })}
                </Form.Select>
              )}

              <div className="report-toolbar-search">
                <Search size={18} />
                <Form.Control
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={activeReport === 'disposition' ? 'Search disposition...' : `Search ${config.label.toLowerCase()}...`}
                  aria-label={`Search ${config.label}`}
                />
              </div>

              <Form.Select className="report-period-select" value={datePreset} onChange={(event) => applyPreset(event.target.value)} aria-label="Date period">
                {DATE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </Form.Select>

              <button type="button" className="report-round-btn" onClick={() => setShowCustomDates((value) => !value)} title="Choose custom dates">
                <Calendar size={18} />
              </button>
              <button type="button" className="report-round-btn" onClick={() => shiftDateRange(-1)} title="Previous period">
                <ChevronLeft size={19} />
              </button>
              <button type="button" className="report-date-range-btn" onClick={() => setShowCustomDates((value) => !value)}>
                <Calendar size={17} />
                <span>{formatRangeDate(draftFilters.fromDate)} - {formatRangeDate(draftFilters.toDate)}</span>
              </button>
              <button type="button" className="report-round-btn" onClick={() => shiftDateRange(1)} title="Next period">
                <ChevronRight size={19} />
              </button>
            </div>

            {showCustomDates && (
              <div className="report-custom-dates">
                <Form.Control type="date" value={draftFilters.fromDate} onChange={(event) => setDraftFilters((current) => ({ ...current, fromDate: event.target.value }))} />
                <span>to</span>
                <Form.Control type="date" value={draftFilters.toDate} onChange={(event) => setDraftFilters((current) => ({ ...current, toDate: event.target.value }))} />
                <Button type="submit" size="sm" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Apply dates'}</Button>
              </div>
            )}
          </Form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {restricted && (
        <Alert variant="warning" className="report-access-alert">
          <strong>{config.label} report is restricted.</strong>{' '}
          Your current role does not have API permission to view this report. The other reports remain available.
        </Alert>
      )}

      <Row className="g-3 mb-4">
        <Col sm={4}>
          <SummaryCard
            icon={BarChart3}
            label="Total Records"
            value={effectiveTotal.toLocaleString()}
            tone="primary"
            subtitle="Rows returned for current period"
          />
        </Col>
        <Col sm={4}>
          <SummaryCard
            icon={activeReport === 'disposition' || activeReport === 'userLeads' ? MousePointerClick : WalletCards}
            label={summary.primaryLabel}
            value={summary.primary}
            tone="success"
            subtitle={
              activeReport === 'tickets'
                ? 'Resolved service tickets'
                : activeReport === 'disposition' || activeReport === 'userLeads'
                  ? 'Live lead activity'
                  : 'Financial total'
            }
          />
        </Col>
        <Col sm={4}>
          <SummaryCard
            icon={UsersRound}
            label={summary.secondaryLabel}
            value={summary.secondary}
            tone="warning"
            subtitle={
              activeReport === 'tickets'
                ? 'In progress & new tickets'
                : activeReport === 'disposition' || activeReport === 'userLeads'
                  ? 'Current report period'
                  : 'Active tracking items'
            }
          />
        </Col>
      </Row>

      <Card className="neu-card border-0">
        <Card.Body className="p-3">
          <div className="neu-table-wrapper">
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle">
                <thead>
                  <tr>
                    {config.columns.map(([key, label]) => (
                      <th key={key} className="text-nowrap">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={config.columns.length} className="text-center py-5">
                        <Spinner size="sm" className="me-2" /> Loading report data...
                      </td>
                    </tr>
                  ) : visibleRows.length ? (
                    visibleRows.map((row, rowIndex) => {
                      const isSummary = isGrandTotal(row);
                      return (
                        <tr
                          key={`${getValue(row, config.columns[0][0]) ?? 'row'}-${rowIndex}`}
                          className={isSummary ? 'neu-grand-total-row' : ''}
                        >
                          {config.columns.map(([key, , type]) => {
                            const value = getValue(row, key);
                            return (
                              <td key={key} className="text-nowrap">
                                {type === 'status' ? (
                                  <Badge bg={String(value || '').toLowerCase() === 'closed' ? 'success' : 'warning'}>
                                    {value || '-'}
                                  </Badge>
                                ) : isSummary ? (
                                  <strong>{formatValue(value, type)}</strong>
                                ) : (
                                  formatValue(value, type)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={config.columns.length} className="text-center text-muted py-5">
                        <div className="py-4">
                          <BarChart3 size={32} className="text-muted mb-2 opacity-50" />
                          <div className="fw-medium text-dark">No records found</div>
                          <div className="small text-muted">Try adjusting your date range or search filter.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </div>
        </Card.Body>
        <Card.Footer className="bg-transparent d-flex flex-wrap align-items-center justify-content-between gap-3 py-3 border-0">
          <div className="small text-muted">
            Showing {effectiveTotal ? (page - 1) * pageSize + 1 : 0}&ndash;{Math.min(page * pageSize, effectiveTotal)} of{' '}
            {effectiveTotal} records
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted">Per page:</span>
            <Form.Select
              size="sm"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              style={{ width: 75 }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Form.Select>
            <Button size="sm" variant="outline-secondary" className="neu-btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <span className="small text-nowrap px-2 fw-medium">
              {page} / {totalPages}
            </span>
            <Button size="sm" variant="outline-secondary" className="neu-btn-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </div>
        </Card.Footer>
      </Card>
    </div>
  );
}
