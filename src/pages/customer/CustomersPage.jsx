import { useCallback, useEffect, useMemo, useState } from 'react';
import { Col, Form, Modal, Row } from 'components/ui/Bootstrap';
import { CalendarDays, Database, History, Mail, MapPin, Phone, Plus, UserRound, UsersRound } from 'lucide-react';

import authService from 'services/authService';
import customerService from 'services/customerService';
import IosToggle from 'components/common/IosToggle';
import ActionIconButton from '@/components/common/ActionIconButton';
import CommonTable from '@/components/common/CommonTable';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ListToolbar from '@/components/common/ListToolbar';
import { DetailFields, IconLines, IdentityCell, StatusPill } from '@/components/common/TableCells';
import { PageHeader, TableCard } from '@/components/common/page-card';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';

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

const FORM_FIELDS = [
  { field: 'name', label: 'Name *', md: 6 },
  { field: 'email', label: 'Email *', md: 6, type: 'email' },
  { field: 'phone', label: 'Phone *', md: 4 },
  { field: 'phone2', label: 'Phone 2', md: 4 },
  { field: 'leadId', label: 'Lead ID *', md: 4, type: 'number' },
  { field: 'salesPerson', label: 'Sales Person ID *', md: 4, type: 'number' },
  { field: 'countryId', label: 'Country ID *', md: 4, type: 'number' },
  { field: 'stateId', label: 'State ID *', md: 4, type: 'number' },
  { field: 'city', label: 'City *', md: 5 },
  { field: 'zipCode', label: 'Zip Code', md: 3 }
];

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

const salesPersonLabel = (customer) => customer?.salesPersonName || (customer?.salesPerson ? `User #${customer.salesPerson}` : '');

export default function CustomersPage() {
  const permissions = useMemo(
    () => resolveConfiguredPagePermissions('customer', ['/customers']),
    []
  );
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

  // Search as the user types (debounced), like the Orders toolbar; Enter applies it immediately.
  const applySearch = useCallback(() => {
    setPage(1);
    setSearchText(searchInput.trim());
  }, [searchInput]);

  useEffect(() => {
    const timer = window.setTimeout(applySearch, 400);
    return () => window.clearTimeout(timer);
  }, [applySearch]);

  const openCreate = () => {
    if (!permissions.canAdd) return;
    setFormData({ ...EMPTY_FORM, createdBy: authService.getUser()?.userId || 0, createdDate: new Date().toISOString() });
    setFormError('');
    setShowEditor(true);
  };

  const openEdit = (customer) => {
    if (!permissions.canUpdate) return;
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
    if (Number(formData.customerId) > 0 ? !permissions.canUpdate : !permissions.canAdd) return;
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
    if (!permissions.canUpdate) return;
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
    if (!permissions.canDelete || !deleteCustomer?.customerId) return;
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
    if (!permissions.canUpdate) return;
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

  const detailOrders = useMemo(() => selectedCustomer?.getOrderListDTOs || selectedCustomer?.orders || [], [selectedCustomer]);
  const detailTickets = useMemo(() => selectedCustomer?.getTicketListDTOs || selectedCustomer?.tickets || [], [selectedCustomer]);

  const columns = [
    {
      id: 'customer',
      header: 'Customer',
      cell: (customer) => (
        <IdentityCell
          name={customer.name || `Customer #${customer.customerId}`}
          subtitle={`#${customer.customerId}`}
          onClick={() => openDetails(customer)}
        />
      )
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: (customer) => (
        <IconLines
          lines={[
            { icon: Mail, value: customer.email, strong: true },
            { icon: Phone, value: customer.phone }
          ]}
        />
      )
    },
    {
      id: 'address',
      header: 'Address',
      cell: (customer) => {
        const address = customerAddress(customer);
        return <IconLines lines={[{ icon: MapPin, value: address === '-' ? '' : address }]} />;
      }
    },
    {
      id: 'salesPerson',
      header: 'Sales Person',
      cell: (customer) => <IconLines lines={[{ icon: UserRound, value: salesPersonLabel(customer), strong: true }]} maxWidth={200} />
    },
    {
      id: 'created',
      header: 'Created',
      cell: (customer) => <IconLines lines={[{ icon: CalendarDays, value: formatDateTime(customer.createdDate) }]} maxWidth={200} />
    },
    {
      id: 'status',
      header: 'Status',
      cell: (customer) => {
        const active = customer.isActive !== false;
        return (
          <div className="flex items-center gap-2">
            <IosToggle
              checked={active}
              disabled={!permissions.canUpdate || statusBusy[customer.customerId]}
              loading={statusBusy[customer.customerId]}
              onCheckedChange={() => toggleStatus(customer)}
              title={active ? 'Deactivate customer' : 'Activate customer'}
              aria-label={active ? 'Deactivate customer' : 'Activate customer'}
            />
            <StatusPill tone={active ? 'success' : 'secondary'}>{active ? 'Active' : 'Inactive'}</StatusPill>
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'center',
      sticky: 'right',
      cell: (customer) => (
        <div className="flex items-center justify-center gap-2">
          {[
            { show: true, label: 'View customer', variant: 'view', onClick: () => openDetails(customer) },
            { show: permissions.canUpdate, label: 'Edit customer', variant: 'edit', onClick: () => openEdit(customer) },
            { show: permissions.canDelete, label: 'Delete customer', variant: 'delete', onClick: () => setDeleteCustomer(customer) }
          ]
            .filter((action) => action.show)
            .map((action) => (
              <ActionIconButton key={action.variant} label={action.label} variant={action.variant} onClick={action.onClick} />
            ))}
        </div>
      )
    }
  ];

  const viewColumns = [
    { id: 'customer', header: 'Customer', cell: (view) => view.customerName || `#${view.customerId || '-'}` },
    { id: 'viewedBy', header: 'Viewed By', cell: (view) => view.userName || view.viewedByName || view.createdByName || '-' },
    { id: 'ip', header: 'IP Address', cell: (view) => view.ip || view.ipAddress || view.customerViewIp || '-' },
    { id: 'date', header: 'Date', cell: (view) => formatDateTime(view.createdDate || view.viewDate) }
  ];

  const orderColumns = [
    { id: 'order', header: 'Order', cell: (order) => `#${order.orderId || '-'}` },
    { id: 'brand', header: 'Brand', cell: (order) => order.brandName || order.brandId || '-' },
    { id: 'status', header: 'Status', cell: (order) => <StatusPill tone="primary">{order.orderStatusName || order.status || '-'}</StatusPill> },
    { id: 'amount', header: 'Amount', align: 'right', cell: (order) => order.totalAmount ?? order.amount ?? '-' }
  ];

  const ticketColumns = [
    { id: 'ticket', header: 'Ticket', cell: (ticket) => `#${ticket.ticketId || '-'}` },
    { id: 'subject', header: 'Subject', cell: (ticket) => ticket.subject || '-' },
    {
      id: 'status',
      header: 'Status',
      cell: (ticket) => <StatusPill>{ticket.ticketStatusName || ticket.status || ticket.ticketStatus || '-'}</StatusPill>
    }
  ];

  return (
    <div className="orders-table-page">
      <PageHeader title="Customers" description="Manage CRM customers and account activity">
        <div className="flex flex-wrap gap-2">
          <LiquidGlassButton variant="secondary" onClick={openViewLogs}>
            <History size={16} /> View Logs
          </LiquidGlassButton>
          {permissions.canUpdate && (
            <LiquidGlassButton variant="secondary" onClick={rebuildIndex} loading={rebuilding}>
              {!rebuilding && <Database size={16} />} Rebuild Index
            </LiquidGlassButton>
          )}
          {permissions.canAdd && (
            <LiquidGlassButton onClick={openCreate}>
              <Plus size={16} /> New Customer
            </LiquidGlassButton>
          )}
        </div>
      </PageHeader>

      <TableCard>
        <ListToolbar
          shown={customers.length}
          total={totalCount}
          itemName="Customers"
          searchFields={SEARCH_FIELDS}
          searchField={searchField}
          onSearchFieldChange={(value) => {
            setSearchField(value);
            setPage(1);
          }}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          onSearchClear={() => setSearchInput('')}
          onSearchSubmit={applySearch}
          searchPlaceholder="Search customers..."
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
            data={customers}
            isLoading={loading}
            rowKey="customerId"
            emptyState={{ icon: <UsersRound size={28} />, title: 'No customers found', description: 'Try another search term or date range.' }}
            pagination={{
              pageNumber: page,
              pageSize,
              totalCount,
              pageSizeOptions: PAGE_SIZES,
              itemName: 'Customers',
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
        <form onSubmit={saveCustomer}>
          <Modal.Header closeButton>
            <Modal.Title>{formData.customerId ? `Edit Customer #${formData.customerId}` : 'Create Customer'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{formError}</div>
            )}
            <Row className="g-3">
              {FORM_FIELDS.map(({ field, label, md, type = 'text' }) => (
                <Col md={md} key={field}>
                  <Form.Label>{label}</Form.Label>
                  <Form.Control
                    type={type}
                    min={type === 'number' ? '1' : undefined}
                    value={formData[field]}
                    onChange={(event) => updateForm(field, type === 'number' ? Number(event.target.value) : event.target.value)}
                  />
                </Col>
              ))}
              <Col md={4}>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <IosToggle checked={formData.isActive !== false} onCheckedChange={(next) => updateForm('isActive', next)} title="Active Customer" />
                  Active Customer
                </div>
              </Col>
              <Col xs={12}>
                <Form.Label>Address</Form.Label>
                <Form.Control as="textarea" rows={3} value={formData.address} onChange={(event) => updateForm('address', event.target.value)} />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <LiquidGlassButton variant="secondary" onClick={() => setShowEditor(false)} disabled={saving}>
              Cancel
            </LiquidGlassButton>
            <LiquidGlassButton type="submit" loading={saving}>
              {saving ? 'Saving...' : 'Save Customer'}
            </LiquidGlassButton>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal show={showDetails} onHide={() => setShowDetails(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title className="flex items-center gap-2">
            <UserRound size={20} />
            {selectedCustomer?.name || 'Customer Details'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="max-h-[75vh] overflow-y-auto">
          {detailsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              Loading customer details...
            </div>
          ) : (
            selectedCustomer && (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                  <DetailFields
                    fields={[
                      { label: 'Email', value: selectedCustomer.email, wide: true },
                      { label: 'Phone', value: selectedCustomer.phone },
                      { label: 'Phone 2', value: selectedCustomer.phone2 },
                      { label: 'Address', value: customerAddress(selectedCustomer), wide: true },
                      { label: 'Sales Person', value: selectedCustomer.salesPersonName || `#${selectedCustomer.salesPerson || '-'}` },
                      { label: 'Created', value: formatDateTime(selectedCustomer.createdDate) }
                    ]}
                  />
                </section>
                <div className="space-y-4">
                  <CommonTable
                    title={`Orders (${detailOrders.length})`}
                    columns={orderColumns}
                    data={detailOrders.slice(0, 10)}
                    rowKey="orderId"
                    emptyMessage="No orders"
                  />
                  <CommonTable
                    title={`Tickets (${detailTickets.length})`}
                    columns={ticketColumns}
                    data={detailTickets.slice(0, 10)}
                    rowKey="ticketId"
                    emptyMessage="No tickets"
                  />
                </div>
              </div>
            )
          )}
        </Modal.Body>
      </Modal>

      <Modal show={showViews} onHide={() => setShowViews(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Customer View History</Modal.Title>
        </Modal.Header>
        <Modal.Body className="max-h-[75vh] overflow-y-auto">
          <CommonTable
            columns={viewColumns}
            data={viewRows}
            isLoading={viewsLoading}
            rowKey={(view, index) => view.customerViewId || index}
            emptyMessage="No view records found."
          />
        </Modal.Body>
      </Modal>

      <DeleteConfirmModal
        open={Boolean(deleteCustomer)}
        title="Delete Customer"
        description="Are you sure you want to delete"
        itemName={deleteCustomer?.name || `Customer #${deleteCustomer?.customerId}`}
        loading={deleting}
        onCancel={() => setDeleteCustomer(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
