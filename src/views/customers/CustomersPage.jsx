import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'components/ui/Bootstrap';
import { Database, Eye, History, Pencil, Plus, RefreshCw, Search, Trash2, UserRound } from 'lucide-react';

import authService from 'services/authService';
import customerService from 'services/customerService';

const PAGE_SIZES = [10, 25, 50];
const SEARCH_FIELDS = [
  { value: 'name', label: 'Name' },
  { value: 'id', label: 'ID' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'salesPerson', label: 'Sales Person' }
];

const EMPTY_FORM = {
  customerId: 0,
  leadId: 0,
  name: '',
  email: '',
  phone: '',
  phone2: '',
  address: '',
  city: '',
  stateId: 0,
  stateName: '',
  zipCode: '',
  countryId: 0,
  countryName: '',
  isActive: true,
  salesPerson: 0,
  salesPersonName: ''
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const customerAddress = (customer) =>
  [customer?.address, customer?.city, customer?.stateName, customer?.countryName, customer?.zipCode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ') || '-';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchField, setSearchField] = useState('name');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [viewRows, setViewRows] = useState([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [statusBusy, setStatusBusy] = useState({});
  const [deleteCustomer, setDeleteCustomer] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const loadCustomers = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const response = await customerService.getCustomers(
          {
            Text: searchText,
            SearchField: searchField,
            FromDate: searchText ? '' : fromDate ? `${fromDate}T00:00:00` : '',
            ToDate: searchText ? '' : toDate ? `${toDate}T23:59:59` : '',
            PageNumber: page,
            PageSize: pageSize,
            SortProperty: 'createdDate',
            IsDescending: true
          },
          signal
        );
        setCustomers(response.data);
        setTotalCount(response.totalCount);
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        setCustomers([]);
        setTotalCount(0);
        setError(requestError.message || 'Unable to load customers.');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [fromDate, page, pageSize, searchField, searchText, toDate]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadCustomers(controller.signal);
    return () => controller.abort();
  }, [loadCustomers, refreshKey]);

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM, createdBy: authService.getUser()?.userId || 0, createdDate: new Date().toISOString() });
    setFormError('');
    setShowEditor(true);
  };

  const openEdit = (customer) => {
    setFormData({ ...EMPTY_FORM, ...customer, updatedBy: authService.getUser()?.userId || 0, updatedDate: new Date().toISOString() });
    setFormError('');
    setShowEditor(true);
  };

  const openDetails = async (customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
    setDetailsLoading(true);
    try {
      const details = await customerService.getCustomerById(customer.customerId);
      setSelectedCustomer(details || customer);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load customer details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const openViewLogs = async () => {
    setShowViews(true);
    setViewsLoading(true);
    try {
      const response = await customerService.getCustomerViews({ PageNumber: 1, PageSize: 50, IsDescending: true });
      setViewRows(response.data);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load customer view history.');
      setViewRows([]);
    } finally {
      setViewsLoading(false);
    }
  };

  const updateForm = (field, value) => setFormData((current) => ({ ...current, [field]: value }));

  const saveCustomer = async (event) => {
    event.preventDefault();
    setFormError('');
    const requiredIds = [formData.leadId, formData.salesPerson, formData.countryId, formData.stateId];
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.city.trim()) {
      setFormError('Name, email, phone and city are required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (requiredIds.some((value) => Number(value) <= 0)) {
      setFormError('Lead, sales person, country and state IDs are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        leadId: Number(formData.leadId),
        salesPerson: Number(formData.salesPerson),
        countryId: Number(formData.countryId),
        stateId: Number(formData.stateId),
        phone: formData.phone.replace(/\D/g, ''),
        phone2: formData.phone2.replace(/\D/g, '')
      };
      if (Number(formData.customerId) > 0) await customerService.updateCustomer(payload);
      else await customerService.createCustomer(payload);
      setShowEditor(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setFormError(requestError.message || 'Unable to save customer.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (customer) => {
    const customerId = customer.customerId;
    const previousStatus = customer.isActive !== false;
    const nextStatus = !previousStatus;
    setStatusBusy((current) => ({ ...current, [customerId]: true }));
    setCustomers((current) => current.map((item) => (item.customerId === customerId ? { ...item, isActive: nextStatus } : item)));
    try {
      await customerService.toggleCustomerStatus(customerId);
    } catch (requestError) {
      setCustomers((current) => current.map((item) => (item.customerId === customerId ? { ...item, isActive: previousStatus } : item)));
      setError(requestError.message || 'Unable to update customer status.');
    } finally {
      setStatusBusy((current) => ({ ...current, [customerId]: false }));
    }
  };

  const confirmDelete = async () => {
    if (!deleteCustomer?.customerId) return;
    setDeleting(true);
    try {
      await customerService.deleteCustomer(deleteCustomer.customerId);
      setDeleteCustomer(null);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete customer.');
    } finally {
      setDeleting(false);
    }
  };

  const rebuildIndex = async () => {
    setRebuilding(true);
    setError('');
    try {
      await customerService.rebuildSearchIndex();
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to rebuild the customer search index.');
    } finally {
      setRebuilding(false);
    }
  };

  const runSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearchText(searchInput.trim());
  };

  const detailOrders = useMemo(() => selectedCustomer?.getOrderListDTOs || selectedCustomer?.orders || [], [selectedCustomer]);
  const detailTickets = useMemo(() => selectedCustomer?.getTicketListDTOs || selectedCustomer?.tickets || [], [selectedCustomer]);

  return (
    <div>
      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
          <div><h5 className="mb-1 fw-semibold">Customers</h5><span className="text-muted small">Manage CRM customers and account activity</span></div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={openViewLogs}><History size={16} className="me-2" />View Logs</Button>
            <Button variant="outline-secondary" onClick={rebuildIndex} disabled={rebuilding}>{rebuilding ? <Spinner size="sm" /> : <Database size={16} />}<span className="ms-2">Rebuild Index</span></Button>
            <Button onClick={openCreate}><Plus size={16} className="me-2" />New Customer</Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={runSearch}><Row className="g-3 align-items-end">
            <Col md={3} xl={2}><Form.Label className="small text-muted">Search field</Form.Label><Form.Select value={searchField} onChange={(event) => setSearchField(event.target.value)}>{SEARCH_FIELDS.map((field) => <option value={field.value} key={field.value}>{field.label}</option>)}</Form.Select></Col>
            <Col md={5} xl={4}><Form.Label className="small text-muted">Search</Form.Label><InputGroup><InputGroup.Text><Search size={16} /></InputGroup.Text><Form.Control value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search customers..." /></InputGroup></Col>
            <Col md={2} xl={2}><Form.Label className="small text-muted">From date</Form.Label><Form.Control type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} /></Col>
            <Col md={2} xl={2}><Form.Label className="small text-muted">To date</Form.Label><Form.Control type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} /></Col>
            <Col xl={2} className="d-flex gap-2"><Button type="submit" className="flex-grow-1">Search</Button><Button variant="outline-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={16} /></Button></Col>
          </Row></Form>
        </Card.Body>
      </Card>

      {error && <div className="alert alert-danger">{error}</div>}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-transparent d-flex justify-content-between align-items-center py-3"><h5 className="mb-0">Customer List</h5><Badge bg="light" text="dark" className="border">{totalCount} customers</Badge></Card.Header>
        <div className="table-responsive"><Table hover className="align-middle mb-0 text-nowrap">
          <thead className="table-light"><tr><th>Customer</th><th>Contact</th><th>Address</th><th>Sales Person</th><th>Created</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="7" className="text-center py-5"><Spinner size="sm" className="me-2" />Loading customers...</td></tr>}
            {!loading && customers.length === 0 && <tr><td colSpan="7" className="text-center text-muted py-5">No customers found.</td></tr>}
            {!loading && customers.map((customer) => <tr key={customer.customerId}>
              <td><button type="button" className="btn btn-link p-0 text-start fw-semibold" onClick={() => openDetails(customer)}>{customer.name || `Customer #${customer.customerId}`}</button><div className="small text-muted">#{customer.customerId}</div></td>
              <td><div>{customer.email || '-'}</div><div className="small text-muted">{customer.phone || '-'}</div></td>
              <td><div className="text-truncate" style={{ maxWidth: '250px' }} title={customerAddress(customer)}>{customerAddress(customer)}</div></td>
              <td>{customer.salesPersonName || (customer.salesPerson ? `User #${customer.salesPerson}` : '-')}</td>
              <td>{formatDateTime(customer.createdDate)}</td>
              <td><Form.Check type="switch" checked={customer.isActive !== false} disabled={statusBusy[customer.customerId]} onChange={() => toggleStatus(customer)} label={customer.isActive !== false ? 'Active' : 'Inactive'} /></td>
              <td className="text-end"><Button variant="link" size="sm" title="View" onClick={() => openDetails(customer)}><Eye size={16} /></Button><Button variant="link" size="sm" title="Edit" onClick={() => openEdit(customer)}><Pencil size={16} /></Button><Button variant="link" size="sm" className="text-danger" title="Delete" onClick={() => setDeleteCustomer(customer)}><Trash2 size={16} /></Button></td>
            </tr>)}
          </tbody>
        </Table></div>
        <Card.Footer className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex align-items-center gap-2 small text-muted"><span>Rows</span><Form.Select size="sm" value={pageSize} style={{ width: '76px' }} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{PAGE_SIZES.map((size) => <option value={size} key={size}>{size}</option>)}</Form.Select></div>
          <div className="d-flex align-items-center gap-2"><Button size="sm" variant="outline-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="small text-muted">Page {page} of {totalPages}</span><Button size="sm" variant="outline-secondary" disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
        </Card.Footer>
      </Card>

      <Modal show={showEditor} onHide={() => !saving && setShowEditor(false)} size="lg" centered scrollable><Form onSubmit={saveCustomer}>
        <Modal.Header closeButton><Modal.Title>{formData.customerId ? `Edit Customer #${formData.customerId}` : 'Create Customer'}</Modal.Title></Modal.Header>
        <Modal.Body>{formError && <div className="alert alert-danger py-2">{formError}</div>}<Row className="g-3">
          <Col md={6}><Form.Label>Name *</Form.Label><Form.Control value={formData.name} onChange={(event) => updateForm('name', event.target.value)} /></Col>
          <Col md={6}><Form.Label>Email *</Form.Label><Form.Control type="email" value={formData.email} onChange={(event) => updateForm('email', event.target.value)} /></Col>
          <Col md={4}><Form.Label>Phone *</Form.Label><Form.Control value={formData.phone} onChange={(event) => updateForm('phone', event.target.value)} /></Col>
          <Col md={4}><Form.Label>Phone 2</Form.Label><Form.Control value={formData.phone2} onChange={(event) => updateForm('phone2', event.target.value)} /></Col>
          <Col md={4}><Form.Label>Lead ID *</Form.Label><Form.Control type="number" min="1" value={formData.leadId} onChange={(event) => updateForm('leadId', Number(event.target.value))} /></Col>
          <Col md={4}><Form.Label>Sales Person ID *</Form.Label><Form.Control type="number" min="1" value={formData.salesPerson} onChange={(event) => updateForm('salesPerson', Number(event.target.value))} /></Col>
          <Col md={4}><Form.Label>Country ID *</Form.Label><Form.Control type="number" min="1" value={formData.countryId} onChange={(event) => updateForm('countryId', Number(event.target.value))} /></Col>
          <Col md={4}><Form.Label>State ID *</Form.Label><Form.Control type="number" min="1" value={formData.stateId} onChange={(event) => updateForm('stateId', Number(event.target.value))} /></Col>
          <Col md={5}><Form.Label>City *</Form.Label><Form.Control value={formData.city} onChange={(event) => updateForm('city', event.target.value)} /></Col>
          <Col md={3}><Form.Label>Zip Code</Form.Label><Form.Control value={formData.zipCode} onChange={(event) => updateForm('zipCode', event.target.value)} /></Col>
          <Col md={4}><Form.Check type="switch" className="mt-4" label="Active Customer" checked={formData.isActive !== false} onChange={(event) => updateForm('isActive', event.target.checked)} /></Col>
          <Col xs={12}><Form.Label>Address</Form.Label><Form.Control as="textarea" rows={3} value={formData.address} onChange={(event) => updateForm('address', event.target.value)} /></Col>
        </Row></Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <><Spinner size="sm" className="me-2" />Saving...</> : 'Save Customer'}</Button></Modal.Footer>
      </Form></Modal>

      <Modal show={showDetails} onHide={() => setShowDetails(false)} size="xl" centered scrollable>
        <Modal.Header closeButton><Modal.Title className="d-flex align-items-center gap-2"><UserRound size={20} />{selectedCustomer?.name || 'Customer Details'}</Modal.Title></Modal.Header>
        <Modal.Body>{detailsLoading ? <div className="text-center py-5"><Spinner className="me-2" />Loading customer details...</div> : selectedCustomer && <Row className="g-4">
          <Col lg={5}><Card className="border h-100"><Card.Body><Row className="g-3"><Col xs={12}><div className="text-muted small">Email</div><div>{selectedCustomer.email || '-'}</div></Col><Col md={6}><div className="text-muted small">Phone</div><div>{selectedCustomer.phone || '-'}</div></Col><Col md={6}><div className="text-muted small">Phone 2</div><div>{selectedCustomer.phone2 || '-'}</div></Col><Col xs={12}><div className="text-muted small">Address</div><div>{customerAddress(selectedCustomer)}</div></Col><Col md={6}><div className="text-muted small">Sales Person</div><div>{selectedCustomer.salesPersonName || `#${selectedCustomer.salesPerson || '-'}`}</div></Col><Col md={6}><div className="text-muted small">Created</div><div>{formatDateTime(selectedCustomer.createdDate)}</div></Col></Row></Card.Body></Card></Col>
          <Col lg={7}><Card className="border mb-3"><Card.Header className="bg-light fw-semibold">Orders ({detailOrders.length})</Card.Header><div className="table-responsive"><Table size="sm" className="mb-0"><thead><tr><th>Order</th><th>Brand</th><th>Status</th><th>Amount</th></tr></thead><tbody>{detailOrders.length === 0 ? <tr><td colSpan="4" className="text-center text-muted py-3">No orders</td></tr> : detailOrders.slice(0, 10).map((order, index) => <tr key={order.orderId || index}><td>#{order.orderId || '-'}</td><td>{order.brandName || order.brandId || '-'}</td><td>{order.orderStatusName || order.status || '-'}</td><td>{order.totalAmount ?? order.amount ?? '-'}</td></tr>)}</tbody></Table></div></Card>
          <Card className="border"><Card.Header className="bg-light fw-semibold">Tickets ({detailTickets.length})</Card.Header><div className="table-responsive"><Table size="sm" className="mb-0"><thead><tr><th>Ticket</th><th>Subject</th><th>Status</th></tr></thead><tbody>{detailTickets.length === 0 ? <tr><td colSpan="3" className="text-center text-muted py-3">No tickets</td></tr> : detailTickets.slice(0, 10).map((ticket, index) => <tr key={ticket.ticketId || index}><td>#{ticket.ticketId || '-'}</td><td>{ticket.subject || '-'}</td><td>{ticket.ticketStatusName || ticket.status || ticket.ticketStatus || '-'}</td></tr>)}</tbody></Table></div></Card></Col>
        </Row>}</Modal.Body>
      </Modal>

      <Modal show={showViews} onHide={() => setShowViews(false)} size="lg" centered scrollable><Modal.Header closeButton><Modal.Title>Customer View History</Modal.Title></Modal.Header><Modal.Body>{viewsLoading ? <div className="text-center py-5"><Spinner className="me-2" />Loading view history...</div> : <div className="table-responsive"><Table hover><thead><tr><th>Customer</th><th>Viewed By</th><th>IP Address</th><th>Date</th></tr></thead><tbody>{viewRows.length === 0 ? <tr><td colSpan="4" className="text-center text-muted py-4">No view records found.</td></tr> : viewRows.map((view, index) => <tr key={view.customerViewId || index}><td>{view.customerName || `#${view.customerId || '-'}`}</td><td>{view.userName || view.viewedByName || view.createdByName || '-'}</td><td>{view.ip || view.ipAddress || view.customerViewIp || '-'}</td><td>{formatDateTime(view.createdDate || view.viewDate)}</td></tr>)}</tbody></Table></div>}</Modal.Body></Modal>

      <Modal show={Boolean(deleteCustomer)} onHide={() => !deleting && setDeleteCustomer(null)} centered><Modal.Header closeButton><Modal.Title>Delete Customer</Modal.Title></Modal.Header><Modal.Body>Delete <strong>{deleteCustomer?.name || `Customer #${deleteCustomer?.customerId}`}</strong>? This action cannot be undone.</Modal.Body><Modal.Footer><Button variant="secondary" onClick={() => setDeleteCustomer(null)} disabled={deleting}>Cancel</Button><Button variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting ? <><Spinner size="sm" className="me-2" />Deleting...</> : 'Delete'}</Button></Modal.Footer></Modal>
    </div>
  );
}
