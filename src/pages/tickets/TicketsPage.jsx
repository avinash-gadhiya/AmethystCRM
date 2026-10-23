import { useCallback, useEffect, useMemo, useState } from 'react';
import { Col, Form, Modal, Row } from 'components/ui/Bootstrap';
import { Activity, CalendarDays, FileText, Paperclip, Plus, Ticket, UserRound } from 'lucide-react';

import authService from 'services/authService';
import ticketService from 'services/ticketService';
import IosToggle from 'components/common/IosToggle';
import ActionIconButton from '@/components/common/ActionIconButton';
import CommonTable from '@/components/common/CommonTable';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ListToolbar from '@/components/common/ListToolbar';
import { DetailFields, IconLines, IdentityCell, StatusPill } from '@/components/common/TableCells';
import { PageHeader, TableCard } from '@/components/common/page-card';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

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

const FORM_FIELDS = [
  { field: 'subject', label: 'Subject *', md: 8 },
  { field: 'ticketStatus', label: 'Status ID *', md: 4, type: 'number', min: '1' },
  { field: 'customerId', label: 'Customer ID *', md: 4, type: 'number', min: '1' },
  { field: 'brandId', label: 'Brand ID', md: 4, type: 'number', min: '0' },
  { field: 'assignedTo', label: 'Assigned User ID', md: 4, type: 'number', min: '0', keepString: true },
  { field: 't_StartDate', label: 'Start Date', md: 6, type: 'datetime-local' },
  { field: 't_EndDate', label: 'End Date', md: 6, type: 'datetime-local' },
  { field: 'remoteAccessMethod', label: 'Remote Method ID', md: 4, type: 'number', min: '0' },
  { field: 'remoteAccessCode', label: 'Remote Access Code', md: 4 },
  { field: 'os', label: 'OS ID', md: 4, type: 'number', min: '0' },
  { field: 'osPassword', label: 'OS Password', md: 6 }
];

const FORM_SWITCHES = [
  { field: 'isNewTicket', label: 'New Ticket' },
  { field: 'isQualityCheckCompleted', label: 'Quality Check Completed' }
];

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
  const permissions = useMemo(
    () => resolveConfiguredPagePermissions('ticket', ['/tickets']),
    []
  );
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
    if (!permissions.canAdd) return;
    setFormData({ ...EMPTY_FORM, createdBy: authService.getUser()?.userId || 0 });
    setFormError('');
    setShowEditor(true);
  };

  const openEdit = async (ticket) => {
    if (!permissions.canUpdate) return;
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
    if (Number(formData.ticketId) > 0 ? !permissions.canUpdate : !permissions.canAdd) return;
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

  // Search as the user types (debounced), like the Orders toolbar; Enter applies it immediately.
  const applySearch = useCallback(() => {
    setPage(1);
    setAppliedSearch(searchText.trim());
  }, [searchText]);

  useEffect(() => {
    const timer = window.setTimeout(applySearch, 400);
    return () => window.clearTimeout(timer);
  }, [applySearch]);

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

  const assignedLabel = (ticket) => ticket.assignedToName || ticket.assignedName || (ticket.assignedTo ? `User #${ticket.assignedTo}` : '');

  const columns = [
    {
      id: 'ticket',
      header: 'Ticket',
      cell: (ticket) => (
        <IdentityCell name={`#${ticket.ticketId}`} subtitle={ticket.isNewTicket ? 'New ticket' : undefined} onClick={() => openDetails(ticket)} />
      )
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (ticket) => <IconLines lines={[{ icon: UserRound, value: customerLabel(ticket), strong: true }]} maxWidth={220} />
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (ticket) => (
        <span className="block max-w-[280px] truncate text-sm text-gray-800 dark:text-gray-200" title={ticket.subject}>
          {ticket.subject || '-'}
        </span>
      )
    },
    {
      id: 'status',
      header: 'Status',
      cell: (ticket) => {
        const status = ticketStatusLabel(ticket);
        return <StatusPill tone={statusVariant(status)}>{status}</StatusPill>;
      }
    },
    {
      id: 'assigned',
      header: 'Assigned To',
      cell: (ticket) => <IconLines lines={[{ icon: UserRound, value: assignedLabel(ticket) }]} maxWidth={200} />
    },
    {
      id: 'created',
      header: 'Created',
      cell: (ticket) => <IconLines lines={[{ icon: CalendarDays, value: formatDateTime(ticket.createdDate) }]} maxWidth={200} />
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'center',
      sticky: 'right',
      cell: (ticket) => (
        <div className="flex items-center justify-center gap-2">
          {[
            { show: true, label: 'View ticket', variant: 'view', onClick: () => openDetails(ticket) },
            { show: permissions.canUpdate, label: 'Edit ticket', variant: 'edit', onClick: () => openEdit(ticket) }
          ]
            .filter((action) => action.show)
            .map((action) => (
              <ActionIconButton key={action.variant} label={action.label} variant={action.variant} onClick={action.onClick} />
            ))}
        </div>
      )
    }
  ];

  return (
    <div className="orders-table-page">
      <PageHeader title="Tickets" description="Track customer service tickets and activity">
        {permissions.canAdd && (
          <LiquidGlassButton onClick={openCreate}>
            <Plus size={16} /> New Ticket
          </LiquidGlassButton>
        )}
      </PageHeader>

      <TableCard>
        <ListToolbar
          shown={tickets.length}
          total={totalCount}
          itemName="Tickets"
          searchFields={SEARCH_FIELDS}
          searchField={searchField}
          onSearchFieldChange={(value) => {
            setSearchField(value);
            setPage(1);
          }}
          searchValue={searchText}
          onSearchChange={setSearchText}
          onSearchClear={() => setSearchText('')}
          onSearchSubmit={applySearch}
          searchPlaceholder="Search tickets..."
          fromDate={fromDate}
          toDate={toDate}
          onDateChange={(from, to) => {
            setFromDate(from || '');
            setToDate(to || from || '');
            setPage(1);
          }}
          onDateClear={() => {
            setFromDate('');
            setToDate('');
            setPage(1);
          }}
          onRefresh={() => setRefreshKey((value) => value + 1)}
          loading={loading}
        />

        {error && (
          <div className="mx-3 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="grid">
          <CommonTable
            columns={columns}
            data={tickets}
            isLoading={loading}
            rowKey="ticketId"
            emptyState={{ icon: <Ticket size={28} />, title: 'No tickets found', description: 'Try another search term or date range.' }}
            pagination={{
              pageNumber: page,
              pageSize,
              totalCount,
              pageSizeOptions: PAGE_SIZES,
              itemName: 'Tickets',
              onPageChange: setPage,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setPage(1);
              }
            }}
          />
        </div>
      </TableCard>

      <Modal show={showEditor} onHide={() => !saving && setShowEditor(false)} size="lg">
        <form onSubmit={saveTicket}>
          <Modal.Header closeButton>
            <Modal.Title>{formData.ticketId ? `Edit Ticket #${formData.ticketId}` : 'Create Ticket'}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="max-h-[75vh] overflow-y-auto">
            {formError && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{formError}</div>}
            <Row className="g-3">
              {FORM_FIELDS.map(({ field, label, md, type = 'text', min, keepString }) => (
                <Col md={md} key={field}>
                  <Form.Label>{label}</Form.Label>
                  <Form.Control
                    type={type}
                    min={min}
                    value={formData[field] ?? ''}
                    onChange={(event) =>
                      updateForm(field, type === 'number' && !keepString ? Number(event.target.value) : event.target.value)
                    }
                    disabled={saving}
                  />
                </Col>
              ))}
              <Col md={6}>
                <Form.Label>Attachments</Form.Label>
                <Form.Control
                  type="file"
                  multiple
                  onChange={(event) => updateForm('files', Array.from(event.target.files || []))}
                  disabled={saving}
                />
              </Col>
              <Col xs={12}>
                <Form.Label>Case Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={formData.caseNotes}
                  onChange={(event) => updateForm('caseNotes', event.target.value)}
                  disabled={saving}
                />
              </Col>
              {FORM_SWITCHES.map(({ field, label }) => (
                <Col md={6} key={field}>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <IosToggle checked={Boolean(formData[field])} onCheckedChange={(next) => updateForm(field, next)} disabled={saving} title={label} />
                    {label}
                  </div>
                </Col>
              ))}
              {formData.isQualityCheckCompleted && (
                <Col xs={12}>
                  <Form.Label>Quality Comment</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formData.qualityComment || ''}
                    onChange={(event) => updateForm('qualityComment', event.target.value)}
                    disabled={saving}
                  />
                </Col>
              )}
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <LiquidGlassButton variant="secondary" onClick={() => setShowEditor(false)} disabled={saving}>
              Cancel
            </LiquidGlassButton>
            <LiquidGlassButton type="submit" loading={saving}>
              {saving ? 'Saving...' : 'Save Ticket'}
            </LiquidGlassButton>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal show={showDetails} onHide={() => setShowDetails(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title className="flex items-center gap-2">
            <Ticket size={20} />
            Ticket #{selectedTicket?.ticketId}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="max-h-[75vh] overflow-y-auto">
          {detailsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              Loading ticket details...
            </div>
          ) : (
            selectedTicket && (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                  <h6 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <FileText size={16} /> Ticket Information
                  </h6>
                  <DetailFields
                    fields={[
                      { label: 'Subject', value: selectedTicket.subject, wide: true },
                      {
                        label: 'Status',
                        value: (
                          <StatusPill tone={statusVariant(ticketStatusLabel(selectedTicket))}>{ticketStatusLabel(selectedTicket)}</StatusPill>
                        )
                      },
                      { label: 'Type', value: selectedTicket.isNewTicket ? 'New' : 'Existing' },
                      { label: 'Customer', value: customerLabel(selectedTicket) },
                      { label: 'Brand', value: selectedTicket.brandName || (selectedTicket.brandId ? `#${selectedTicket.brandId}` : '') },
                      { label: 'Assigned', value: assignedLabel(selectedTicket) },
                      {
                        label: 'Case Notes',
                        wide: true,
                        value: selectedTicket.caseNotes && (
                          <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                            {selectedTicket.caseNotes}
                          </div>
                        )
                      },
                      { label: 'Created', value: formatDateTime(selectedTicket.createdDate) },
                      { label: 'Updated', value: formatDateTime(selectedTicket.updatedDate) }
                    ]}
                  />
                  {attachmentRows.length > 0 && (
                    <div className="mt-5">
                      <h6 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                        <Paperclip size={16} /> Attachments
                      </h6>
                      <div className="flex flex-wrap gap-2">
                        {attachmentRows.map((file) => (
                          <LiquidGlassButton
                            key={file.name}
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => openAttachment(file.name)}
                          >
                            {file.name}
                          </LiquidGlassButton>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                  <h6 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Activity size={16} /> Activity History
                  </h6>
                  {activityRows.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-500">No activity history found.</div>
                  ) : (
                    <ol className="mb-0 space-y-4 border-l-2 border-indigo-100 pl-4 dark:border-indigo-500/30">
                      {activityRows.map((activity, index) => (
                        <li key={activity.ticketActivityId || index} className="relative">
                          <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 dark:border-slate-900" />
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {activity.activity || activity.action || activity.subject || 'Ticket updated'}
                          </div>
                          <div className="text-xs text-gray-500">{formatDateTime(activity.createdDate)}</div>
                          {(activity.caseNotes || activity.notes || activity.comment) && (
                            <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                              {activity.caseNotes || activity.notes || activity.comment}
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            )
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
