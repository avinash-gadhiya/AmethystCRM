import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from 'components/ui/Bootstrap';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Filter,
  RefreshCw,
  Search,
  Ticket,
  TrendingUp,
  UsersRound,
  WalletCards,
  Wrench,
  X
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

import reportService from 'services/reportService';

const REPORT_METADATA = {
  sales: {
    icon: CircleDollarSign,
    subtitle: 'Sales volume, gateway breakdown, transactions and customer purchases'
  },
  tickets: {
    icon: Ticket,
    subtitle: 'Technician ticket counts, resolution progress and live status'
  },
  service: {
    icon: Wrench,
    subtitle: 'Service tickets lifecycle, assigned technicians, status and brands'
  },
  performance: {
    icon: TrendingUp,
    subtitle: 'Agent conversion rates, sales volumes and revenue per lead'
  },
  renewal: {
    icon: RefreshCw,
    subtitle: 'Customer renewals, subscriptions and retention metrics'
  }
};

const PAGE_SIZES = [10, 25, 50];

const REPORTS = {
  sales: {
    label: 'Sales',
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
    toDate: toInputDate(today),
    groupId: '',
    brandId: '',
    gatewayId: '',
    userId: ''
  };
};

const reportFromPath = (pathname) => {
  const path = pathname.toLowerCase();
  if (path.includes('service')) return 'service';
  if (path.includes('renewal')) return 'renewal';
  if (path.includes('ticket') || path.includes('refund')) return 'tickets';
  if (path.includes('performance')) return 'performance';
  return 'sales';
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const config = REPORTS[activeReport];

  useEffect(() => {
    setActiveReport(reportFromPath(location.pathname));
  }, [location.pathname]);

  const loadReport = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const response = await reportService[config.loader](filters, signal);
        const reportRows =
          activeReport === 'performance'
            ? normalizePerformance(response.data || {})
            : Array.isArray(response.data)
              ? response.data
              : Array.isArray(response.data?.items)
                ? response.data.items
                : [];
        setRows(reportRows);
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        setRows([]);
        setError(requestError.message || `Unable to load ${config.label.toLowerCase()} report.`);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [activeReport, config, filters]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadReport(controller.signal);
    return () => controller.abort();
  }, [loadReport, refreshKey]);

  const filteredRows = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) => config.columns.some(([key]) => String(getValue(row, key) ?? '').toLowerCase().includes(search)));
  }, [config.columns, rows, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const amountKey = activeReport === 'performance' ? 'salesAmount' : 'amount';
    const amount = filteredRows.reduce((sum, row) => sum + safeNumber(getValue(row, amountKey)), 0);
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

  const switchReport = (report) => {
    setActiveReport(report);
    setRows([]);
    setSearchText('');
    setPage(1);
  };

  const applyFilters = (event) => {
    if (event && event.preventDefault) event.preventDefault();
    if (draftFilters.fromDate && draftFilters.toDate && draftFilters.fromDate > draftFilters.toDate) {
      setError('From date cannot be later than to date.');
      return;
    }
    setError('');
    setPage(1);
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
      toDate = today;
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
      <Card className="neu-card border-0 mb-4">
        <Card.Header className="bg-transparent d-flex flex-wrap align-items-center justify-content-between gap-3 py-3 border-0">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h5 className="mb-0 fw-bold">{config.label} Report</h5>
              <span className="neu-live-badge">
                <span className="pulse-dot" /> Live Data
              </span>
            </div>
            <span className="small text-muted">
              {REPORT_METADATA[activeReport]?.subtitle || 'Live secured business reports'}
            </span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-light text-secondary border px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
              GET /Report/{config.endpoint}
            </span>
          </div>
        </Card.Header>
        <Card.Body className="p-4 pt-1">
          <div className="mb-4">
            <div className="neu-segmented-tabs">
              {Object.entries(REPORTS).map(([key, report]) => {
                const MetaIcon = REPORT_METADATA[key]?.icon || BarChart3;
                const isActive = activeReport === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`neu-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => switchReport(key)}
                  >
                    <MetaIcon size={16} />
                    <span>{report.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Form onSubmit={applyFilters}>
            <Row className="g-3 align-items-end">
              <Col sm={6} lg={3}>
                <Form.Label className="small text-muted d-flex align-items-center gap-1 mb-1">
                  <Calendar size={13} /> From date
                </Form.Label>
                <Form.Control
                  type="date"
                  className="neu-input"
                  value={draftFilters.fromDate}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, fromDate: event.target.value }))}
                />
              </Col>
              <Col sm={6} lg={3}>
                <Form.Label className="small text-muted d-flex align-items-center gap-1 mb-1">
                  <Calendar size={13} /> To date
                </Form.Label>
                <Form.Control
                  type="date"
                  className="neu-input"
                  value={draftFilters.toDate}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, toDate: event.target.value }))}
                />
              </Col>
              {activeReport === 'sales' && (
                <Col sm={6} lg={2}>
                  <Form.Label className="small text-muted mb-1">Group ID</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    className="neu-input"
                    placeholder="All groups"
                    value={draftFilters.groupId}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, groupId: event.target.value }))}
                  />
                </Col>
              )}
              {activeReport === 'performance' &&
                ['brandId', 'gatewayId', 'userId'].map((field) => (
                  <Col sm={4} lg={2} key={field}>
                    <Form.Label className="small text-muted mb-1">{field.replace('Id', ' ID').replace(/^./, (letter) => letter.toUpperCase())}</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      className="neu-input"
                      placeholder="All"
                      value={draftFilters[field]}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, [field]: event.target.value }))}
                    />
                  </Col>
                ))}
              <Col sm={6} lg={activeReport === 'sales' || activeReport === 'performance' ? 2 : 3} className="d-flex gap-2">
                <Button type="submit" variant="primary" className="neu-btn-primary flex-grow-1 d-inline-flex align-items-center justify-content-center gap-2" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : <Filter size={15} />}
                  <span>Apply</span>
                </Button>
                <Button variant="outline-secondary" className="neu-btn-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} title="Reload report data">
                  <RefreshCw size={15} className={loading ? 'spin' : ''} />
                </Button>
              </Col>
            </Row>

            {/* Quick date presets loop */}
            <div className="d-flex flex-wrap align-items-center gap-2 mt-3 pt-3 border-top" style={{ borderColor: 'rgba(202, 211, 224, 0.4)' }}>
              <span className="small text-muted me-1 fw-medium">Quick Range:</span>
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="neu-preset-btn"
                  onClick={() => applyPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-3 mb-4">
        <Col sm={4}>
          <SummaryCard
            icon={BarChart3}
            label="Total Records"
            value={filteredRows.length.toLocaleString()}
            tone="primary"
            subtitle="Rows returned for current period"
          />
        </Col>
        <Col sm={4}>
          <SummaryCard
            icon={WalletCards}
            label={summary.primaryLabel}
            value={summary.primary}
            tone="success"
            subtitle={activeReport === 'tickets' ? 'Resolved service tickets' : 'Financial total'}
          />
        </Col>
        <Col sm={4}>
          <SummaryCard
            icon={UsersRound}
            label={summary.secondaryLabel}
            value={summary.secondary}
            tone="warning"
            subtitle={activeReport === 'tickets' ? 'In progress & new tickets' : 'Active tracking items'}
          />
        </Col>
      </Row>

      <Card className="neu-card border-0">
        <Card.Header className="bg-transparent d-flex flex-wrap align-items-center justify-content-between gap-3 py-3 border-0">
          <div className="d-flex align-items-center gap-2">
            <div className="neu-input-group" style={{ maxWidth: 360, width: '100%' }}>
              <span className="input-group-text">
                <Search size={15} />
              </span>
              <Form.Control
                placeholder={`Search ${config.label.toLowerCase()} rows...`}
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setPage(1);
                }}
              />
              {searchText && (
                <Button variant="link" className="p-0 text-muted me-2" onClick={() => setSearchText('')} title="Clear search">
                  <X size={14} />
                </Button>
              )}
            </div>
            {filteredRows.length > 0 && (
              <span className="small text-muted d-none d-md-inline">
                {filteredRows.length} matching {filteredRows.length === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>
          <Button variant="outline-primary" size="sm" onClick={exportCsv} disabled={!filteredRows.length} className="neu-btn-action d-inline-flex align-items-center gap-2">
            <Download size={15} />
            <span>Export CSV</span>
          </Button>
        </Card.Header>
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
            Showing {filteredRows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredRows.length)} of{' '}
            {filteredRows.length} records
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
