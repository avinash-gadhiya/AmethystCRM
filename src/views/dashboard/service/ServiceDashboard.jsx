import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Search, Ticket, UserPlus, Users } from 'lucide-react';

import DashboardRangeToolbar from 'components/dashboard/DashboardRangeToolbar';
import { Alert, Badge, Card, Col, Form, InputGroup, Row, Spinner, Table } from 'components/ui/Bootstrap';
import dashboardService from 'services/dashboardService';
import userService from 'services/userService';
import { getMonthToDateRange, isValidDateRange } from 'utils/dateUtils';
import { asArray, findNumber, integer, textValue } from '../dashboardData';

const statusOf = (ticket) => textValue(ticket, ['statusName', 'ticketStatus', 'status', 'state'], 'New').toLowerCase();
const isClosed = (status) => ['closed', 'complete', 'completed', 'resolved'].some((value) => status.includes(value));
const isProgress = (status) => ['progress', 'assigned', 'working', 'pending'].some((value) => status.includes(value));

function StatusCard({ title, subtitle, value, color, icon: Icon }) {
  return (
    <Card className="border-0 shadow-sm h-100 overflow-hidden">
      <Card.Body className="p-4 position-relative text-white" style={{ backgroundImage: color, color: '#fff', borderRadius: 'inherit' }}>
        <span
          className="d-inline-flex align-items-center justify-content-center rounded-circle position-absolute top-0 end-0 m-3 p-2"
          style={{ background: 'rgba(255,255,255,.18)' }}
        >
          <Icon size={20} />
        </span>
        <div className="small fw-semibold text-uppercase mb-2" style={{ letterSpacing: '.08em' }}>
          {title}
        </div>
        <div className="small opacity-75 mb-3">{subtitle}</div>
        <div className="d-flex align-items-end gap-2">
          <span className="display-6 fw-bold lh-1">{integer.format(value)}</span>
          <span className="small opacity-75 mb-1">tickets</span>
        </div>
      </Card.Body>
    </Card>
  );
}

export default function ServiceDashboard() {
  const initialRange = useMemo(() => getMonthToDateRange(), []);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const [userId, setUserId] = useState('');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState({});
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const [dashboard, userOptions] = await Promise.all([
          dashboardService.getServiceManagerDashboard(range.fromDate, range.toDate, userId || undefined, signal, { pageSize: 100 }),
          userService.getUserDropDown({ PageSize: 200 }, signal).catch(() => [])
        ]);
        if (signal.aborted) return;
        setRaw(dashboard.data || {});
        setTickets(asArray(dashboard.data));
        setUsers(userOptions);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setRaw({});
          setTickets([]);
          setError(requestError.message || 'Service dashboard could not be loaded.');
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [range, userId]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  const derived = tickets.reduce(
    (total, ticket) => {
      const status = statusOf(ticket);
      if (isClosed(status)) total.closed += 1;
      else if (isProgress(status)) total.progress += 1;
      else total.new += 1;
      const customerId = textValue(ticket, ['customerId', 'clientId'], '');
      const customerType = textValue(ticket, ['customerType', 'customerStatus'], '').toLowerCase();
      if (customerType.includes('new') || !customerId) total.newCustomers += 1;
      else total.existingCustomers += 1;
      return total;
    },
    { new: 0, progress: 0, closed: 0, newCustomers: 0, existingCustomers: 0 }
  );
  const counts = {
    new: findNumber(raw, ['newTickets', 'newTicketCount', 'totalNew'], derived.new),
    progress: findNumber(raw, ['inProgressTickets', 'progressTicketCount', 'totalInProgress'], derived.progress),
    closed: findNumber(raw, ['closedTickets', 'closedTicketCount', 'totalClosed'], derived.closed),
    newCustomers: findNumber(raw, ['newCustomers', 'newCustomerCount'], derived.newCustomers),
    existingCustomers: findNumber(raw, ['existingCustomers', 'existingCustomerCount'], derived.existingCustomers)
  };
  const total = counts.new + counts.progress + counts.closed || tickets.length;
  const visibleTickets = tickets.filter((ticket) => {
    const haystack = Object.values(ticket || {})
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const applyRange = (event) => {
    event.preventDefault();
    if (!isValidDateRange(draftRange)) {
      setError('Select a valid date range.');
      return;
    }
    setRange(draftRange);
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1 fw-bold">Service Manager Dashboard</h3>
        <p className="text-muted mb-0">
          Ticket overview for {range.fromDate} to {range.toDate}
        </p>
      </div>

      <DashboardRangeToolbar
        range={draftRange}
        onRangeChange={setDraftRange}
        onApply={applyRange}
        onRefresh={() => setRefreshKey((value) => value + 1)}
        loading={loading}
      >
        <Col sm={6} lg={3} xl={2}>
          <Form.Label htmlFor="service-user">Assigned user</Form.Label>
          <Form.Select id="service-user" value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">All users</option>
            {users.map((user, index) => {
              const id = user.userId || user.id || user.value || index;
              return (
                <option key={id} value={id}>
                  {textValue(user, ['fullName', 'userName', 'name', 'text', 'label'], `User ${index + 1}`)}
                </option>
              );
            })}
          </Form.Select>
        </Col>
      </DashboardRangeToolbar>

      {error && (
        <Alert variant="warning" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h5 className="mb-1 fw-semibold">Summary</h5>
          <span className="small text-muted">Live ticket counts for the selected window</span>
        </div>
        <Badge bg="primary" className="px-3 py-2">
          Total tickets: {integer.format(total)}
        </Badge>
      </div>
      <Row className="g-3 mb-4">
        <Col md={4}>
          <StatusCard
            title="New"
            subtitle="Waiting to be picked up"
            value={counts.new}
            color="linear-gradient(135deg,#0ea5e9,#4f46e5)"
            icon={Ticket}
          />
        </Col>
        <Col md={4}>
          <StatusCard
            title="In progress"
            subtitle="Currently being worked"
            value={counts.progress}
            color="linear-gradient(135deg,#f59e0b,#f97316)"
            icon={Clock3}
          />
        </Col>
        <Col md={4}>
          <StatusCard
            title="Closed"
            subtitle="Finished in this window"
            value={counts.closed}
            color="linear-gradient(135deg,#10b981,#0d9488)"
            icon={CheckCircle2}
          />
        </Col>
      </Row>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-transparent d-flex align-items-center justify-content-between py-3">
          <div>
            <h5 className="mb-1 fw-semibold">Customer Mix</h5>
            <span className="small text-muted">New versus existing customers</span>
          </div>
          <Badge bg="light" className="text-dark">
            {counts.newCustomers + counts.existingCustomers} customers
          </Badge>
        </Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <div className="rounded bg-light p-4 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <span className="rounded-3 bg-white text-primary p-3">
                    <UserPlus size={20} />
                  </span>
                  <div>
                    <div className="small fw-semibold text-uppercase text-muted">New customers</div>
                    <div className="small text-muted">First time raising a ticket</div>
                  </div>
                </div>
                <strong className="fs-3">{counts.newCustomers}</strong>
              </div>
            </Col>
            <Col md={6}>
              <div className="rounded bg-light p-4 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                  <span className="rounded-3 bg-white text-info p-3">
                    <Users size={20} />
                  </span>
                  <div>
                    <div className="small fw-semibold text-uppercase text-muted">Existing customers</div>
                    <div className="small text-muted">Have been here before</div>
                  </div>
                </div>
                <strong className="fs-3">{counts.existingCustomers}</strong>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-transparent d-flex flex-wrap align-items-center justify-content-between gap-3 py-3">
          <span className="small fw-semibold">
            Showing {visibleTickets.length} of {tickets.length} tickets
          </span>
          <InputGroup style={{ maxWidth: 280 }}>
            <InputGroup.Text>
              <Search size={15} />
            </InputGroup.Text>
            <Form.Control
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tickets"
              aria-label="Search tickets"
            />
          </InputGroup>
        </Card.Header>
        <div className="table-responsive">
          <Table className="align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Assigned to</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-5">
                    <Spinner size="sm" className="me-2" />
                    Loading tickets...
                  </td>
                </tr>
              )}
              {!loading && visibleTickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-5">
                    No tickets found for the selected filters.
                  </td>
                </tr>
              )}
              {!loading &&
                visibleTickets.map((ticket, index) => {
                  const status = statusOf(ticket);
                  const statusTone = isClosed(status) ? 'success' : isProgress(status) ? 'warning' : 'primary';
                  return (
                    <tr key={ticket.ticketId || ticket.id || index}>
                      <td>
                        <div className="fw-semibold">
                          {textValue(ticket, ['ticketNumber', 'ticketNo', 'reference', 'subject'], `Ticket ${index + 1}`)}
                        </div>
                        <div className="small text-muted">{textValue(ticket, ['subject', 'title', 'description'], '')}</div>
                      </td>
                      <td>{textValue(ticket, ['customerName', 'clientName', 'companyName'], '-')}</td>
                      <td>{textValue(ticket, ['assignedUserName', 'assignedTo', 'userName'], 'Unassigned')}</td>
                      <td>
                        <Badge bg={statusTone}>{textValue(ticket, ['statusName', 'ticketStatus', 'status', 'state'], 'New')}</Badge>
                      </td>
                      <td>{textValue(ticket, ['createdDate', 'createdOn', 'date'], '-')}</td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
