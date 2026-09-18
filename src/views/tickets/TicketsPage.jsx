import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'components/ui/Bootstrap';
import { Activity, Eye, FileText, Paperclip, Pencil, Plus, RefreshCw, Search, Ticket } from 'lucide-react';

import authService from 'services/authService';
import ticketService from 'services/ticketService';

const PAGE_SIZES = [10, 25, 50];
const SEARCH_FIELDS = [
  { value: '', label: 'All Tickets' },
  { value: 'TicketId', label: 'Ticket ID' },
  { value: 'CustomerName', label: 'Customer Name' },
  { value: 'Email', label: 'Email' },
  { value: 'Phone', label: 'Phone' },
  { value: 'Status', label: 'Status' }
];

const EMPTY_FORM = {
  ticketId: 0,
  subject: '',
  ticketStatus: 0,
  customerId: 0,
  brandId: 0,
  assignedTo: '',
  caseNotes: '',
  remoteAccessCode: '',
  remoteAccessMethod: 0,
  os: 0,
  osPassword: '',
  t_StartDate: '',
  t_EndDate: '',
  isNewTicket: true,
  isQualityCheckCompleted: false,
  qualityComment: '',
  files: []
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const ticketStatusLabel = (ticket) =>
  String(ticket?.ticketStatusName || ticket?.statusName || ticket?.status || ticket?.ticketStatus || 'Unknown');

const statusVariant = (status) => {
  const value = String(status).toLowerCase();
  if (value.includes('close') || value.includes('complete') || value.includes('resolve')) return 'success';
  if (value.includes('progress') || value.includes('pending')) return 'warning';
  if (value.includes('new') || value.includes('open')) return 'primary';
  return 'secondary';
};

const customerLabel = (ticket) =>
  ticket?.customerName || ticket?.customerFullName || ticket?.clientName || (ticket?.customerId ? `Customer #${ticket.customerId}` : '-');

const getAttachments = (ticket) => {
  const source = ticket?.awsFileDetails || ticket?.attachments || ticket?.files || [];
  if (!Array.isArray(source)) return [];
  return source
    .map((file) => ({
      name: typeof file === 'string' ? file : file?.fileName || file?.name || file?.key || '',
      raw: file
    }))
    .filter((file) => file.name);
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [searchField, setSearchField] = useState('');
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
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activityRows, setActivityRows] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const loadTickets = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const response = await ticketService.getTickets(
          {
            Text: appliedSearch,
            SearchField: searchField,
            FromDate: fromDate,
            ToDate: toDate,
            PageNumber: page,
            PageSize: pageSize,
            SortProperty: 'TicketId',
            IsDescending: true
          },
          signal
        );
        setTickets(response.data);
        setTotalCount(response.totalCount);
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        setTickets([]);
        setTotalCount(0);
        setError(requestError.message || 'Unable to load tickets.');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [appliedSearch, fromDate, page, pageSize, searchField, toDate]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadTickets(controller.signal);
    return () => controller.abort();
  }, [loadTickets, refreshKey]);

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM, createdBy: authService.getUser()?.userId || 0 });
    setFormError('');
    setShowEditor(true);
  };

  const openEdit = async (ticket) => {
    setFormError('');
    setShowEditor(true);
    setSaving(true);
    try {
      const fresh = await ticketService.getTicketById(ticket.ticketId);
      const source = fresh || ticket;
      setFormData({
        ...EMPTY_FORM,
        ...source,
        ticketId: Number(source.ticketId) || 0,
        ticketStatus: Number(source.ticketStatus) || 0,
        customerId: Number(source.customerId) || 0,
        brandId: Number(source.brandId) || 0,
        assignedTo: source.assignedTo || '',
        t_StartDate: toDateTimeLocal(source.t_StartDate),
        t_EndDate: toDateTimeLocal(source.t_EndDate),
        qualityCheckDate: toDateTimeLocal(source.qualityCheckDate),
        files: [],
        updatedBy: authService.getUser()?.userId || 0
      });
    } catch (requestError) {
      setFormError(requestError.message || 'Unable to load ticket details.');
      setFormData({ ...EMPTY_FORM, ...ticket, files: [] });
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setActivityRows([]);
    setShowDetails(true);
    setDetailsLoading(true);
    try {
      const [details, activity] = await Promise.all([
        ticketService.getTicketById(ticket.ticketId),
        ticketService.getTicketActivity(ticket.ticketId)
      ]);
      setSelectedTicket(details || ticket);
      setActivityRows(activity.sort((left, right) => new Date(right.createdDate || 0) - new Date(left.createdDate || 0)));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load ticket details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateForm = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const saveTicket = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!formData.subject.trim()) {
      setFormError('Subject is required.');
      return;
    }
    if (!Number(formData.customerId)) {
      setFormError('Customer ID is required.');
      return;
    }
    if (!Number(formData.ticketStatus)) {
      setFormError('Ticket status ID is required.');
      return;
    }

    setSaving(true);
    try {
      if (Number(formData.ticketId) > 0) {
        await ticketService.updateTicket(formData);
      } else {
        await ticketService.createTicket(formData);
      }
      setShowEditor(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setFormError(requestError.message || 'Unable to save ticket.');
    } finally {
      setSaving(false);
    }
  };

  const search = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchText.trim());
  };

  const attachmentRows = useMemo(() => getAttachments(selectedTicket), [selectedTicket]);

  const openAttachment = async (fileName) => {
    try {
      const url = await ticketService.getTicketFullUrl(selectedTicket.ticketId, fileName);
      if (!url) throw new Error('The API did not return a file URL.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(requestError.message || 'Unable to open attachment.');
    }
  };

  return (
    <div>
      <Card className="border-0 shadow-sm mb-2.5">
        <Card.Body className="p-2.5">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2 pb-2 border-bottom">
            <div className="d-flex align-items-center gap-2">
              <h6 className="mb-0 fw-bold text-gray-800" style={{ fontSize: '0.875rem' }}>Tickets</h6>
              <span className="badge bg-primary" style={{ fontSize: '0.7rem' }}>{totalCount} total</span>
            </div>
            <Button size="sm" onClick={openCreate} style={{ height: '30px', fontSize: '0.75rem' }}>
              <Plus size={14} className="me-1" />New Ticket
            </Button>
          </div>
          <Form onSubmit={search}>
            <Row className="g-2 align-items-center">
              <Col xs={12} sm={6} md={3} xl={2}>
                <Form.Select size="sm" value={searchField} onChange={(event) => setSearchField(event.target.value)} title="Filter Field">
                  {SEARCH_FIELDS.map((field) => <option key={field.label} value={field.value}>{field.label}</option>)}
                </Form.Select>
              </Col>
              <Col xs={12} sm={6} md={4} xl={4}>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-gray-400 pointer-events-none flex items-center justify-center z-10">
                    <Search size={13} />
                  </span>
                  <Form.Control
                    size="sm"
                    style={{ paddingLeft: '1.85rem' }}
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search tickets..."
                  />
                </div>
              </Col>
              <Col xs={6} sm={6} md={2} xl={2}>
                <Form.Control size="sm" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} title="From date" />
              </Col>
              <Col xs={6} sm={6} md={2} xl={2}>
                <Form.Control size="sm" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} title="To date" />
              </Col>
              <Col xs={12} md={1} xl={2} className="d-flex gap-1">
                <Button size="sm" type="submit" className="flex-grow-1">Search</Button>
                <Button size="sm" variant="outline-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} title="Refresh">
                  <RefreshCw size={13} />
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-transparent d-flex justify-content-between align-items-center py-2 px-3">
          <h6 className="mb-0 fw-bold text-gray-800" style={{ fontSize: '0.85rem' }}>Ticket List</h6>
          <Badge bg="light" text="dark" className="border">{totalCount} tickets</Badge>
        </Card.Header>
        <div className="table-responsive">
          <Table hover className="align-middle mb-0 text-nowrap">
            <thead className="table-light"><tr><th>Ticket</th><th>Customer</th><th>Subject</th><th>Status</th><th>Assigned To</th><th>Created</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="7" className="text-center py-5"><Spinner size="sm" className="me-2" />Loading tickets...</td></tr>}
              {!loading && tickets.length === 0 && <tr><td colSpan="7" className="text-center text-muted py-5">No tickets found.</td></tr>}
              {!loading && tickets.map((ticket) => {
                const status = ticketStatusLabel(ticket);
                return (
                  <tr key={ticket.ticketId}>
                    <td className="fw-semibold">#{ticket.ticketId}</td>
                    <td>{customerLabel(ticket)}</td>
                    <td><div className="text-truncate" style={{ maxWidth: '280px' }} title={ticket.subject}>{ticket.subject || '-'}</div></td>
                    <td><Badge bg={statusVariant(status)}>{status}</Badge></td>
                    <td>{ticket.assignedToName || ticket.assignedName || (ticket.assignedTo ? `User #${ticket.assignedTo}` : '-')}</td>
                    <td>{formatDateTime(ticket.createdDate)}</td>
                    <td className="text-end">
                      <Button size="sm" variant="link" title="View" onClick={() => openDetails(ticket)}><Eye size={16} /></Button>
                      <Button size="sm" variant="link" title="Edit" onClick={() => openEdit(ticket)}><Pencil size={16} /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <Card.Footer className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex align-items-center gap-2 small text-muted">
            <span>Rows</span>
            <Form.Select size="sm" value={pageSize} style={{ width: '76px' }} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </Form.Select>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button size="sm" variant="outline-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <span className="small text-muted">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline-secondary" disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </Card.Footer>
      </Card>

      <Modal show={showEditor} onHide={() => !saving && setShowEditor(false)} size="lg" centered>
        <Form onSubmit={saveTicket}>
          <Modal.Header closeButton><Modal.Title>{formData.ticketId ? `Edit Ticket #${formData.ticketId}` : 'Create Ticket'}</Modal.Title></Modal.Header>
          <Modal.Body>
            {formError && <div className="alert alert-danger py-2">{formError}</div>}
            <Row className="g-3">
              <Col md={8}><Form.Label>Subject *</Form.Label><Form.Control value={formData.subject} onChange={(event) => updateForm('subject', event.target.value)} disabled={saving} /></Col>
              <Col md={4}><Form.Label>Status ID *</Form.Label><Form.Control type="number" min="1" value={formData.ticketStatus} onChange={(event) => updateForm('ticketStatus', Number(event.target.value))} disabled={saving} /></Col>
              <Col md={4}><Form.Label>Customer ID *</Form.Label><Form.Control type="number" min="1" value={formData.customerId} onChange={(event) => updateForm('customerId', Number(event.target.value))} disabled={saving} /></Col>
              <Col md={4}><Form.Label>Brand ID</Form.Label><Form.Control type="number" min="0" value={formData.brandId} onChange={(event) => updateForm('brandId', Number(event.target.value))} disabled={saving} /></Col>
              <Col md={4}><Form.Label>Assigned User ID</Form.Label><Form.Control type="number" min="0" value={formData.assignedTo} onChange={(event) => updateForm('assignedTo', event.target.value)} disabled={saving} /></Col>
              <Col md={6}><Form.Label>Start Date</Form.Label><Form.Control type="datetime-local" value={formData.t_StartDate || ''} onChange={(event) => updateForm('t_StartDate', event.target.value)} disabled={saving} /></Col>
              <Col md={6}><Form.Label>End Date</Form.Label><Form.Control type="datetime-local" value={formData.t_EndDate || ''} onChange={(event) => updateForm('t_EndDate', event.target.value)} disabled={saving} /></Col>
              <Col md={4}><Form.Label>Remote Method ID</Form.Label><Form.Control type="number" min="0" value={formData.remoteAccessMethod} onChange={(event) => updateForm('remoteAccessMethod', Number(event.target.value))} disabled={saving} /></Col>
              <Col md={4}><Form.Label>Remote Access Code</Form.Label><Form.Control value={formData.remoteAccessCode} onChange={(event) => updateForm('remoteAccessCode', event.target.value)} disabled={saving} /></Col>
              <Col md={4}><Form.Label>OS ID</Form.Label><Form.Control type="number" min="0" value={formData.os} onChange={(event) => updateForm('os', Number(event.target.value))} disabled={saving} /></Col>
              <Col md={6}><Form.Label>OS Password</Form.Label><Form.Control value={formData.osPassword} onChange={(event) => updateForm('osPassword', event.target.value)} disabled={saving} /></Col>
              <Col md={6}><Form.Label>Attachments</Form.Label><Form.Control type="file" multiple onChange={(event) => updateForm('files', Array.from(event.target.files || []))} disabled={saving} /></Col>
              <Col xs={12}><Form.Label>Case Notes</Form.Label><Form.Control as="textarea" rows={4} value={formData.caseNotes} onChange={(event) => updateForm('caseNotes', event.target.value)} disabled={saving} /></Col>
              <Col md={6}><Form.Check type="switch" label="New Ticket" checked={formData.isNewTicket} onChange={(event) => updateForm('isNewTicket', event.target.checked)} disabled={saving} /></Col>
              <Col md={6}><Form.Check type="switch" label="Quality Check Completed" checked={formData.isQualityCheckCompleted} onChange={(event) => updateForm('isQualityCheckCompleted', event.target.checked)} disabled={saving} /></Col>
              {formData.isQualityCheckCompleted && <Col xs={12}><Form.Label>Quality Comment</Form.Label><Form.Control as="textarea" rows={2} value={formData.qualityComment || ''} onChange={(event) => updateForm('qualityComment', event.target.value)} disabled={saving} /></Col>}
            </Row>
          </Modal.Body>
          <Modal.Footer><Button variant="secondary" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <><Spinner size="sm" className="me-2" />Saving...</> : 'Save Ticket'}</Button></Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showDetails} onHide={() => setShowDetails(false)} size="xl" centered scrollable>
        <Modal.Header closeButton><Modal.Title className="d-flex align-items-center gap-2"><Ticket size={20} />Ticket #{selectedTicket?.ticketId}</Modal.Title></Modal.Header>
        <Modal.Body>
          {detailsLoading ? <div className="text-center py-5"><Spinner className="me-2" />Loading ticket details...</div> : selectedTicket && (
            <Row className="g-4">
              <Col lg={7}>
                <Card className="border h-100"><Card.Header className="bg-light fw-semibold"><FileText size={16} className="me-2" />Ticket Information</Card.Header><Card.Body>
                  <Row className="g-3">
                    <Col md={6}><div className="text-muted small">Subject</div><div className="fw-semibold">{selectedTicket.subject || '-'}</div></Col>
                    <Col md={3}><div className="text-muted small">Status</div><Badge bg={statusVariant(ticketStatusLabel(selectedTicket))}>{ticketStatusLabel(selectedTicket)}</Badge></Col>
                    <Col md={3}><div className="text-muted small">Type</div><div>{selectedTicket.isNewTicket ? 'New' : 'Existing'}</div></Col>
                    <Col md={4}><div className="text-muted small">Customer</div><div>{customerLabel(selectedTicket)}</div></Col>
                    <Col md={4}><div className="text-muted small">Brand</div><div>{selectedTicket.brandName || (selectedTicket.brandId ? `#${selectedTicket.brandId}` : '-')}</div></Col>
                    <Col md={4}><div className="text-muted small">Assigned</div><div>{selectedTicket.assignedToName || (selectedTicket.assignedTo ? `User #${selectedTicket.assignedTo}` : '-')}</div></Col>
                    <Col xs={12}><div className="text-muted small">Case Notes</div><div className="border rounded p-3 bg-light" style={{ whiteSpace: 'pre-wrap' }}>{selectedTicket.caseNotes || '-'}</div></Col>
                    <Col md={6}><div className="text-muted small">Created</div><div>{formatDateTime(selectedTicket.createdDate)}</div></Col>
                    <Col md={6}><div className="text-muted small">Updated</div><div>{formatDateTime(selectedTicket.updatedDate)}</div></Col>
                  </Row>
                  {attachmentRows.length > 0 && <div className="mt-4"><h6><Paperclip size={16} className="me-2" />Attachments</h6><div className="d-flex flex-wrap gap-2">{attachmentRows.map((file) => <Button key={file.name} size="sm" variant="outline-primary" onClick={() => openAttachment(file.name)}>{file.name}</Button>)}</div></div>}
                </Card.Body></Card>
              </Col>
              <Col lg={5}>
                <Card className="border h-100"><Card.Header className="bg-light fw-semibold"><Activity size={16} className="me-2" />Activity History</Card.Header><Card.Body>
                  {activityRows.length === 0 ? <div className="text-muted text-center py-4">No activity history found.</div> : activityRows.map((activity, index) => (
                    <div className="border-start border-primary ps-3 pb-3 mb-3" key={activity.ticketActivityId || index}>
                      <div className="fw-semibold">{activity.activity || activity.action || activity.subject || 'Ticket updated'}</div>
                      <div className="small text-muted">{formatDateTime(activity.createdDate)}</div>
                      {(activity.caseNotes || activity.notes || activity.comment) && <div className="small mt-1">{activity.caseNotes || activity.notes || activity.comment}</div>}
                    </div>
                  ))}
                </Card.Body></Card>
              </Col>
            </Row>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
