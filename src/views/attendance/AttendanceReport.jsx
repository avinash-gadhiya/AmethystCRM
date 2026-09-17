import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from 'components/ui/Bootstrap';
import { CalendarDays, Clock3, RefreshCw, Search, UserCheck, UserX } from 'lucide-react';

import attendanceService from 'services/attendanceService';

const PAGE_SIZES = [10, 25, 50];

const toInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitialFilters = () => {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);

  return {
    fromDate: toInputDate(weekAgo),
    toDate: toInputDate(today),
    searchText: '',
    includeInactiveUsers: false
  };
};

const formatTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatMinutes = (value) => {
  const total = Number(value) || 0;
  if (total <= 0) return '-';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const getTotalCount = (...values) => {
  for (const value of values) {
    const count = Number(value);
    if (Number.isFinite(count) && count > 0) return count;
  }
  return 0;
};

const statusBadge = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'present' || normalized.startsWith('p')) return 'success';
  if (normalized === 'absent' || normalized.startsWith('a')) return 'danger';
  return 'secondary';
};

const buildApiParams = (filters, page, pageSize) => ({
  PageNumber: page,
  PageSize: pageSize,
  IsDescending: false,
  IncludeInactiveUsers: filters.includeInactiveUsers,
  FromDate: filters.fromDate ? `${filters.fromDate}T00:00:00` : '',
  ToDate: filters.toDate ? `${filters.toDate}T23:59:59` : '',
  Text: filters.searchText.trim()
});

const SummaryCard = ({ icon: Icon, label, value, tone }) => (
  <Card className="border-0 shadow-sm h-100">
    <Card.Body className="d-flex align-items-center gap-3 py-3">
      <span className={`d-inline-flex align-items-center justify-content-center rounded-circle p-2 bg-${tone}-subtle text-${tone}`}>
        <Icon size={20} />
      </span>
      <div>
        <div className="text-muted small">{label}</div>
        <div className="fs-5 fw-semibold">{value}</div>
      </div>
    </Card.Body>
  </Card>
);

export default function AttendanceReport() {
  const initialFilters = useMemo(getInitialFilters, []);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [activeReport, setActiveReport] = useState('register');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [registerMeta, setRegisterMeta] = useState(null);

  const loadReport = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');

      try {
        const params = buildApiParams(filters, page, pageSize);
        const response =
          activeReport === 'register'
            ? await attendanceService.getRegister(params, signal)
            : await attendanceService.getDayWise(params, signal);

        if (activeReport === 'register') {
          const payload = response?.data || {};
          const users = Array.isArray(payload.users) ? payload.users : [];
          const totals = new Map(
            (Array.isArray(payload.totals) ? payload.totals : []).map((item) => [Number(item?.userId) || 0, item])
          );
          setRows(users.map((user) => ({ ...(totals.get(Number(user?.userId) || 0) || {}), ...user })));
          setRegisterMeta(payload);
          setTotalCount(getTotalCount(payload.totalCount, response?.totalCount, users.length));
        } else {
          const payload = response?.data;
          const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
          setRows(items);
          setRegisterMeta(null);
          setTotalCount(getTotalCount(response?.totalCount, payload?.totalCount, items.length));
        }
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        setRows([]);
        setRegisterMeta(null);
        setTotalCount(0);
        setError(requestError.message || 'Unable to load attendance data.');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [activeReport, filters, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadReport(controller.signal);
    return () => controller.abort();
  }, [loadReport, refreshKey]);

  const dateColumns = Array.isArray(registerMeta?.dateColumns) ? registerMeta.dateColumns : [];
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const summary = useMemo(() => {
    if (activeReport === 'register') {
      return {
        present: rows.reduce((sum, row) => sum + (Number(row.presentDays) || 0), 0),
        absent: rows.reduce((sum, row) => sum + (Number(row.absentDays) || 0), 0),
        session: rows.reduce((sum, row) => sum + (Number(row.totalSessionMinutes) || 0), 0)
      };
    }

    return {
      present: rows.filter((row) => String(row.status || '').toLowerCase() === 'present').length,
      absent: rows.filter((row) => String(row.status || '').toLowerCase() === 'absent').length,
      session: rows.reduce((sum, row) => sum + (Number(row.sessionMinutes) || 0), 0)
    };
  }, [activeReport, rows]);

  const updateDraft = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    if (draftFilters.fromDate && draftFilters.toDate && draftFilters.fromDate > draftFilters.toDate) {
      setError('From date cannot be later than to date.');
      return;
    }
    setPage(1);
    setFilters(draftFilters);
  };

  const changeReport = (report) => {
    setActiveReport(report);
    setPage(1);
  };

  return (
    <div>
      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-transparent d-flex flex-wrap align-items-center justify-content-between gap-3 py-3">
          <div>
            <h5 className="mb-1 fw-semibold">Attendance Report</h5>
            <span className="text-muted small">Live data from the secured AttendanceReport API</span>
          </div>
          <Badge bg="light" text="dark" className="border px-3 py-2">
            GET /AttendanceReport/{activeReport === 'register' ? 'Register' : 'DayWise'}
          </Badge>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={applyFilters}>
            <Row className="g-3 align-items-end">
              <Col sm={6} lg={2}>
                <Form.Label className="small text-muted">From date</Form.Label>
                <Form.Control
                  type="date"
                  value={draftFilters.fromDate}
                  onChange={(event) => updateDraft('fromDate', event.target.value)}
                />
              </Col>
              <Col sm={6} lg={2}>
                <Form.Label className="small text-muted">To date</Form.Label>
                <Form.Control
                  type="date"
                  value={draftFilters.toDate}
                  onChange={(event) => updateDraft('toDate', event.target.value)}
                />
              </Col>
              <Col sm={7} lg={4}>
                <Form.Label className="small text-muted">Search user</Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <Search size={16} />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Name, username or email"
                    value={draftFilters.searchText}
                    onChange={(event) => updateDraft('searchText', event.target.value)}
                  />
                </InputGroup>
              </Col>
              <Col sm={5} lg={2}>
                <Form.Label className="small text-muted">Users</Form.Label>
                <Form.Select
                  value={draftFilters.includeInactiveUsers ? 'all' : 'active'}
                  onChange={(event) => updateDraft('includeInactiveUsers', event.target.value === 'all')}
                >
                  <option value="active">Active users</option>
                  <option value="all">Include inactive</option>
                </Form.Select>
              </Col>
              <Col lg={2} className="d-flex gap-2">
                <Button type="submit" className="flex-grow-1" disabled={loading}>
                  Apply
                </Button>
                <Button variant="outline-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
                  <RefreshCw size={16} />
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Row className="g-3 mb-4">
        <Col sm={6} xl={3}>
          <SummaryCard icon={CalendarDays} label="Total users" value={totalCount} tone="primary" />
        </Col>
        <Col sm={6} xl={3}>
          <SummaryCard icon={UserCheck} label="Present records" value={summary.present} tone="success" />
        </Col>
        <Col sm={6} xl={3}>
          <SummaryCard icon={UserX} label="Absent records" value={summary.absent} tone="danger" />
        </Col>
        <Col sm={6} xl={3}>
          <SummaryCard icon={Clock3} label="Session time" value={formatMinutes(summary.session)} tone="warning" />
        </Col>
      </Row>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant={activeReport === 'register' ? 'primary' : 'outline-primary'}
              onClick={() => changeReport('register')}
            >
              Attendance Register
            </Button>
            <Button
              size="sm"
              variant={activeReport === 'daywise' ? 'primary' : 'outline-primary'}
              onClick={() => changeReport('daywise')}
            >
              Day Wise
            </Button>
          </div>
          {registerMeta?.shiftStart && (
            <span className="text-muted small">
              Shift: {registerMeta.shiftStart} – {registerMeta.shiftEnd}
            </span>
          )}
        </Card.Header>

        {error && <div className="alert alert-danger rounded-0 border-start-0 border-end-0 mb-0">{error}</div>}

        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0 text-nowrap">
              <thead className="table-light">
                {activeReport === 'register' ? (
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th className="text-center">Present</th>
                    <th className="text-center">Absent</th>
                    <th className="text-center">Late</th>
                    <th className="text-center">Present %</th>
                    <th className="text-center">Logins</th>
                    <th className="text-center">Session</th>
                    <th className="text-center">Leads</th>
                    {dateColumns.map((date) => (
                      <th className="text-center" key={date}>
                        {date}
                      </th>
                    ))}
                  </tr>
                ) : (
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Role</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Late</th>
                    <th className="text-center">Logins</th>
                    <th>First Login</th>
                    <th>Last Login</th>
                    <th>Session</th>
                    <th className="text-center">Leads</th>
                    <th>Reason</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={activeReport === 'register' ? 9 + dateColumns.length : 11} className="text-center py-5">
                      <Spinner animation="border" size="sm" className="me-2" /> Loading attendance data...
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={activeReport === 'register' ? 9 + dateColumns.length : 11} className="text-center text-muted py-5">
                      No attendance records found for the selected filters.
                    </td>
                  </tr>
                )}
                {!loading &&
                  activeReport === 'register' &&
                  rows.map((row, index) => (
                    <tr key={row.userId || index}>
                      <td>
                        <div className="fw-semibold">{row.fullName || row.userName || `User #${row.userId}`}</div>
                        {row.fullName && row.userName && <div className="small text-muted">{row.userName}</div>}
                      </td>
                      <td>{row.roleName || '-'}</td>
                      <td className="text-center"><Badge bg="success">{row.presentDays ?? 0}</Badge></td>
                      <td className="text-center"><Badge bg="danger">{row.absentDays ?? 0}</Badge></td>
                      <td className="text-center"><Badge bg="warning" text="dark">{row.lateDays ?? 0}</Badge></td>
                      <td className="text-center">{Math.round(Number(row.presentPct) || 0)}%</td>
                      <td className="text-center">{row.totalLogins ?? 0}</td>
                      <td className="text-center">{formatMinutes(row.totalSessionMinutes)}</td>
                      <td className="text-center">{row.totalLeads ?? row.totalLeadsPicked ?? 0}</td>
                      {dateColumns.map((date) => {
                        const value = row.dates?.[date];
                        return (
                          <td className="text-center" key={date}>
                            {value ? <Badge bg={statusBadge(value)}>{value}</Badge> : <span className="text-muted">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                {!loading &&
                  activeReport === 'daywise' &&
                  rows.map((row, index) => (
                    <tr key={`${row.userId || index}-${row.businessDate || row.dateCol || index}`}>
                      <td>{row.dateCol || row.businessDate || '-'}</td>
                      <td>
                        <div className="fw-semibold">{row.fullName || row.userName || `User #${row.userId}`}</div>
                        {row.fullName && row.userName && <div className="small text-muted">{row.userName}</div>}
                      </td>
                      <td>{row.roleName || '-'}</td>
                      <td className="text-center"><Badge bg={statusBadge(row.status)}>{row.status || '-'}</Badge></td>
                      <td className="text-center">{row.isLate ? <Badge bg="warning" text="dark">Late</Badge> : '-'}</td>
                      <td className="text-center">{row.loginCount ?? 0}</td>
                      <td>{formatTime(row.firstLoginLocal)}</td>
                      <td>{formatTime(row.lastLoginLocal)}</td>
                      <td>{formatMinutes(row.sessionMinutes)}</td>
                      <td className="text-center">{row.leadsPicked ?? 0}</td>
                      <td>
                        <div>{row.reason || '-'}</div>
                        {row.remarks && <div className="small text-muted">{row.remarks}</div>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>

        <Card.Footer className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex align-items-center gap-2 small text-muted">
            <span>Rows per page</span>
            <Form.Select
              size="sm"
              value={pageSize}
              style={{ width: '76px' }}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option value={size} key={size}>{size}</option>
              ))}
            </Form.Select>
            <span>{totalCount} users</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="outline-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <span className="small text-muted">Page {page} of {totalPages}</span>
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </Card.Footer>
      </Card>
    </div>
  );
}
