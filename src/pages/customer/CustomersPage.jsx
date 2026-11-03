import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'components/ui/Bootstrap';
import CustomerFormModal from '@/components/customer/CustomerFormModal';
import { Database, History, Plus, ShoppingBag, UserRound, UsersRound } from 'lucide-react';

import authService from 'services/authService';
import customerService from 'services/customerService';
import { getCustomerDetails } from 'services/customerDetailsService';
import IosToggle from 'components/common/IosToggle';
import ActionIconButton from '@/components/common/ActionIconButton';
import CommonTable from '@/components/common/CommonTable';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import CustomerListToolbar from './CustomerListToolbar';
import { DetailFields, StatusPill } from '@/components/common/TableCells';
import { TableCard } from '@/components/common/page-card';
import GlassRecordsHeader from '@/components/common/GlassRecordsHeader';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import { resolveDynamicPath } from '@/lib/dynamicPaths';
import { isCustomerActive } from '@/lib/customerPayload';
import './customers.css';

const PAGE_SIZES = [10, 25, 50];
const SEARCH_FIELDS = [
  { value: '', label: 'All' },
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
  return date.toLocaleString('en-US');
};

const customerAddress = (customer, compact = false) =>
  [
    !compact && customer?.address,
    customer?.city,
    customer?.stateName || (customer?.stateId > 0 ? `State #${customer.stateId}` : ''),
    customer?.countryName || (customer?.countryId > 0 ? `Country #${customer.countryId}` : ''),
    !compact && customer?.zipCode
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ') || '-';

const salesPersonLabel = (customer) =>
  String(customer?.salesPersonName || '').trim() || (Number(customer?.salesPerson) > 0 ? 'Name unavailable' : '');

export default function CustomersPage() {
  const navigate = useNavigate();
  const permissions = useMemo(() => resolveConfiguredPagePermissions('customer', ['/customers']), []);
  const orderPermissions = useMemo(() => resolveConfiguredPagePermissions('order', ['/orders']), []);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileWarnings, setProfileWarnings] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchField, setSearchField] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailOrders, setDetailOrders] = useState([]);
  const [detailTickets, setDetailTickets] = useState([]);
  const [detailErrors, setDetailErrors] = useState({});
  const [detailOrderPage, setDetailOrderPage] = useState(1);
  const [detailTicketPage, setDetailTicketPage] = useState(1);
  const [showViews, setShowViews] = useState(false);
  const [viewRows, setViewRows] = useState([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [statusBusy, setStatusBusy] = useState({});
  const [statusErrors, setStatusErrors] = useState({});
  const statusBusyRef = useRef(new Set());
  const [deleteCustomer, setDeleteCustomer] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const detailsSeqRef = useRef(0);
  const detailsAbortRef = useRef(null);

  useEffect(() => () => detailsAbortRef.current?.abort(), []);

  const loadCustomers = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const response = await customerService.getCustomers(
          {
            Text: searchText,
            SearchField: searchField,
            FromDate: fromDate ? `${fromDate}T00:00:00` : '',
            ToDate: toDate ? `${toDate}T23:59:59` : '',
            PageNumber: page,
            PageSize: pageSize,
            SortProperty: 'createdDate',
            IsDescending: true
          },
          signal
        );
        if (signal?.aborted) return;
        setCustomers(response.data);
        setProfileWarnings(response.profileWarnings || []);
        setTotalCount(response.totalCount);
      } catch (requestError) {
        if (requestError.name === 'AbortError' || signal?.aborted) return;
        setCustomers([]);
        setProfileWarnings([]);
        setTotalCount(0);
        setError(requestError.message || 'Unable to load customers.');
      } finally {
        if (!signal?.aborted) setLoading(false);
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
    const next = searchInput.trim();
    if (next === searchText) return undefined;
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearchText(next);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchText]);

  const openCreate = () => {
    if (!permissions.canAdd) return;
    setFormData({ ...EMPTY_FORM, createdBy: authService.getUser()?.userId || 0, createdDate: new Date().toISOString() });
    setShowEditor(true);
  };

  const openEdit = (customer) => {
    if (!permissions.canUpdate) return;
    setFormData({
      ...EMPTY_FORM,
      ...customer,
      name: customer?.name ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      phone2: customer?.phone2 ?? '',
      address: customer?.address ?? '',
      city: customer?.city ?? '',
      stateName: customer?.stateName ?? '',
      zipCode: customer?.zipCode ?? '',
      countryName: customer?.countryName || 'USA',
      salesPersonName: customer?.salesPersonName ?? '',
      updatedBy: authService.getUser()?.userId || 0,
      updatedDate: new Date().toISOString()
    });
    setShowEditor(true);
  };

  const openDetails = async (customer) => {
    detailsAbortRef.current?.abort();
    const controller = new AbortController();
    detailsAbortRef.current = controller;
    const seq = ++detailsSeqRef.current;
    setSelectedCustomer(customer);
    setShowDetails(true);
    setDetailsLoading(true);
    setDetailErrors({});
    setDetailOrders([]);
    setDetailTickets([]);
    setDetailOrderPage(1);
    setDetailTicketPage(1);
    try {
      const details = await getCustomerDetails(customer, controller.signal);
      if (controller.signal.aborted || seq !== detailsSeqRef.current) return;
      setSelectedCustomer(details.customer);
      setDetailOrders(details.orders);
      setDetailTickets(details.tickets);
      setDetailErrors(details.errors);
    } catch (requestError) {
      if (controller.signal.aborted || seq !== detailsSeqRef.current) return;
      setDetailErrors({
        customer: requestError.message || 'Unable to load customer details.',
        orders: 'Orders could not be loaded.',
        tickets: 'Tickets could not be loaded.'
      });
    } finally {
      if (seq === detailsSeqRef.current) {
        setDetailsLoading(false);
      }
    }
  };

  const closeDetails = () => {
    detailsAbortRef.current?.abort();
    detailsSeqRef.current += 1;
    setShowDetails(false);
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

  const toggleStatus = async (customer, nextStatus) => {
    if (!permissions.canUpdate) return;
    const customerId = customer.customerId;
    if (statusBusyRef.current.has(customerId)) return;
    statusBusyRef.current.add(customerId);
    setStatusBusy((current) => ({ ...current, [customerId]: true }));
    setStatusErrors((current) => ({ ...current, [customerId]: '' }));
    try {
      const savedCustomer = await customerService.toggleCustomerStatus(customerId, nextStatus);
      setCustomers((current) => current.map((item) => (item.customerId === customerId ? { ...item, ...savedCustomer } : item)));
      setSelectedCustomer((current) => (current?.customerId === customerId ? { ...current, ...savedCustomer } : current));
    } catch (requestError) {
      if (typeof requestError.actualStatus === 'boolean') {
        setCustomers((current) =>
          current.map((item) => (item.customerId === customerId ? { ...item, isActive: requestError.actualStatus } : item))
        );
      }
      setStatusErrors((current) => ({ ...current, [customerId]: requestError.message || 'Unable to update customer status.' }));
    } finally {
      statusBusyRef.current.delete(customerId);
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

  const createOrder = async (customer) => {
    if (!orderPermissions.canAdd) return;
    const path = await resolveDynamicPath('createOrder', '/Orders/CreateOrder');
    navigate(`${path}${path.includes('?') ? '&' : '?'}customerId=${encodeURIComponent(customer.customerId)}`);
  };

  const columns = [
    { id: 'id', header: 'ID', cell: (customer) => customer.customerId },
    {
      id: 'customer',
      header: 'Name',
      cell: (customer) => (
        <div className="customer-identity">
          <button type="button" onClick={() => openDetails(customer)}>
            {customer.name || `Customer #${customer.customerId}`}
          </button>
          {customer.email && <span>{customer.email}</span>}
          {customer.phone && <span>{customer.phone}</span>}
        </div>
      )
    },
    {
      id: 'address',
      header: 'Address',
      cell: (customer) => customerAddress(customer, true)
    },
    {
      id: 'salesPerson',
      header: 'Sales Person',
      cell: (customer) => salesPersonLabel(customer) || '—'
    },
    {
      id: 'createdBy',
      header: 'Created By',
      cell: (customer) => customer.createdByName || (customer.createdBy ? `User #${customer.createdBy}` : '—')
    },
    {
      id: 'created',
      header: 'Create Date',
      cell: (customer) => formatDateTime(customer.createdDate)
    },
    {
      id: 'status',
      header: 'Is Active Status',
      align: 'center',
      cell: (customer) => {
        const active = isCustomerActive(customer.isActive);
        return (
          <div className="flex flex-col items-center justify-center gap-2">
            <IosToggle
              checked={active}
              disabled={!permissions.canUpdate || statusBusy[customer.customerId]}
              loading={statusBusy[customer.customerId]}
              onCheckedChange={(checked) => toggleStatus(customer, checked)}
              title={active ? 'Deactivate customer' : 'Activate customer'}
              aria-label={active ? 'Deactivate customer' : 'Activate customer'}
            />
            {statusErrors[customer.customerId] && (
              <span role="alert" className="max-w-48 text-center text-xs text-rose-600 dark:text-rose-300">
                {statusErrors[customer.customerId]}
              </span>
            )}
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: 'Action',
      align: 'center',
      sticky: 'right',
      cell: (customer) => (
        <div className="customer-row-actions">
          {[
            {
              show: orderPermissions.canAdd,
              label: 'Create Order',
              variant: 'order',
              icon: ShoppingBag,
              onClick: () => createOrder(customer)
            },
            { show: permissions.canUpdate, label: 'Edit customer', variant: 'edit', onClick: () => openEdit(customer) },
            { show: permissions.canDelete, label: 'Delete customer', variant: 'delete', onClick: () => setDeleteCustomer(customer) }
          ]
            .filter((action) => action.show)
            .map((action) => (
              <ActionIconButton
                key={action.variant}
                label={action.label}
                variant={action.variant}
                icon={action.icon}
                onClick={action.onClick}
              />
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
    {
      id: 'status',
      header: 'Status',
      cell: (order) => <StatusPill tone="primary">{order.orderStatusName || order.orderStatus || order.status || 'Unknown'}</StatusPill>
    },
    { id: 'amount', header: 'Amount', align: 'right', cell: (order) => order.totalAmount ?? order.amount ?? '-' }
  ];

  const ticketColumns = [
    { id: 'ticket', header: 'Ticket', cell: (ticket) => `#${ticket.ticketId || '-'}` },
    { id: 'subject', header: 'Subject', cell: (ticket) => ticket.subject || '-' },
    {
      id: 'status',
      header: 'Status',
      cell: (ticket) => <StatusPill>{ticket.ticketStatusName || ticket.status || (ticket.ticketStatus ?? 'Unknown')}</StatusPill>
    }
  ];

  return (
    <div className="orders-table-page crm-records-page customers-reference-page">
      <GlassRecordsHeader
        icon={UsersRound}
        eyebrow="CUSTOMER RELATIONSHIPS"
        title="Customers"
        description="Manage CRM customers and account activity"
      >
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
              <Plus size={16} /> Add Customer
            </LiquidGlassButton>
          )}
        </div>
      </GlassRecordsHeader>

      <TableCard className="crm-records-card">
        <div className="customers-toolbar-wrap">
          <CustomerListToolbar
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
        </div>

        {error && (
          <div className="mx-3 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        {!loading && profileWarnings.length > 0 && (
          <div
            role="status"
            className="mx-3 my-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            Additional contact details could not be loaded for {profileWarnings.length} customer
            {profileWarnings.length === 1 ? '' : 's'}. {profileWarnings[0].message} Refresh to retry.
          </div>
        )}

        <div className="grid">
          <CommonTable
            containerClassName="crm-records-table"
            columns={columns}
            data={customers}
            isLoading={loading}
            rowKey="customerId"
            emptyState={{
              icon: <UsersRound size={28} />,
              title: 'No customers found',
              description: 'Try another search term or date range.'
            }}
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

      <CustomerFormModal
        open={showEditor}
        onOpenChange={setShowEditor}
        mode={Number(formData.customerId) > 0 ? 'edit' : 'add'}
        initialValues={formData}
        canAdd={permissions.canAdd}
        canUpdate={permissions.canUpdate}
        onSaved={() => {
          if (!Number(formData.customerId)) {
            setSearchInput('');
            setSearchText('');
            setFromDate('');
            setToDate('');
            setPage(1);
          }
          setRefreshKey((value) => value + 1);
        }}
      />

      <Modal className="crm-records-dialog" show={showDetails} onHide={closeDetails} size="xl">
        <Modal.Header
          closeButton
          icon={UserRound}
          description={selectedCustomer?.customerId ? `Customer #${selectedCustomer.customerId}` : 'Customer details'}
        >
          <Modal.Title>{selectedCustomer?.name || 'Customer Details'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="max-h-[75vh] overflow-y-auto">
          {!detailsLoading && Object.values(detailErrors).some(Boolean) && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {detailErrors.customer && <p>Customer: {detailErrors.customer}</p>}
              {detailErrors.orders && <p>Orders: {detailErrors.orders}</p>}
              {detailErrors.tickets && <p>Tickets: {detailErrors.tickets}</p>}
              <button type="button" className="mt-2 font-semibold underline" onClick={() => openDetails(selectedCustomer)}>
                Retry
              </button>
            </div>
          )}
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
                      { label: 'Sales Person', value: salesPersonLabel(selectedCustomer) },
                      { label: 'Created', value: formatDateTime(selectedCustomer.createdDate) }
                    ]}
                  />
                </section>
                <div className="space-y-4">
                  {!detailErrors.orders && (
                    <CommonTable
                      title={`Orders (${detailOrders.length})`}
                      columns={orderColumns}
                      data={detailOrders.slice((detailOrderPage - 1) * 10, detailOrderPage * 10)}
                      rowKey="orderId"
                      emptyMessage="No orders"
                      hidePaginationOnSinglePage
                      pagination={{
                        pageNumber: detailOrderPage,
                        pageSize: 10,
                        totalCount: detailOrders.length,
                        onPageChange: setDetailOrderPage,
                        showPageSize: false,
                        itemName: 'Orders'
                      }}
                    />
                  )}
                  {!detailErrors.tickets && (
                    <CommonTable
                      title={`Tickets (${detailTickets.length})`}
                      columns={ticketColumns}
                      data={detailTickets.slice((detailTicketPage - 1) * 10, detailTicketPage * 10)}
                      rowKey="ticketId"
                      emptyMessage="No tickets"
                      hidePaginationOnSinglePage
                      pagination={{
                        pageNumber: detailTicketPage,
                        pageSize: 10,
                        totalCount: detailTickets.length,
                        onPageChange: setDetailTicketPage,
                        showPageSize: false,
                        itemName: 'Tickets'
                      }}
                    />
                  )}
                </div>
              </div>
            )
          )}
        </Modal.Body>
      </Modal>

      <Modal className="crm-records-dialog" show={showViews} onHide={() => setShowViews(false)} size="lg">
        <Modal.Header closeButton icon={History} description="Who opened customer records, and when.">
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
