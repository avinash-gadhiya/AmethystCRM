import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  CreditCard,
  DollarSign,
  Eye,
  Mail,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Share2,
  ShoppingCart,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

import CommonTable from '@/components/common/CommonTable';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import PaymentStatusBadge from '@/components/orders/PaymentStatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/apiError';
import orderService from '@/services/orderService';
import paymentService from '@/services/paymentService';
import { getDailySalesDateRange } from '@/utils/dailySalesReportUtils';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import './order-management.css';

const QUICK_FILTERS = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['last-week', 'Last Week'],
  ['current-month', 'Current Month'],
  ['last-month', 'Last Month'],
  ['this-year', 'This Year'],
  ['last-year', 'Last Year']
];

const SEARCH_FIELDS = [
  ['', 'All fields'],
  ['OrderId', 'Order ID'],
  ['CustomerName', 'Customer Name'],
  ['BrandName', 'Brand'],
  ['GatewayName', 'Gateway'],
  ['SalesPersonName', 'Sales Person'],
  ['OrderStatus', 'Order Status']
];

const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);

const dateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const paymentsFor = (order) => {
  if (Array.isArray(order?.payments)) return order.payments;
  if (Array.isArray(order?.paymentDTOs)) return order.paymentDTOs;
  if (order?.payment && typeof order.payment === 'object') return [order.payment];
  return [];
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const permissions = useMemo(() => resolveConfiguredPagePermissions('order', ['/orders']), []);
  const paymentPermissions = useMemo(() => resolveConfiguredPagePermissions('payment', ['/orders/payments']), []);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchField, setSearchField] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [preset, setPreset] = useState('current-month');
  const initialRange = useMemo(() => getDailySalesDateRange('current-month'), []);
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(new Set());
  const [details, setDetails] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const query = useMemo(
    () => ({ SearchField: searchField, Text: searchText, FromDate: fromDate, ToDate: toDate }),
    [fromDate, searchField, searchText, toDate]
  );

  const loadOrders = useCallback(
    async (signal) => {
      if (!permissions.canView) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [listResult, summaryResult] = await Promise.all([
          orderService.getOrders({ ...query, PageNumber: page, PageSize: pageSize, SortProperty: 'orderId', IsDescending: false }, signal),
          orderService.getOrderSummary(query, signal).catch((error) => {
            if (error?.name !== 'AbortError') console.warn('Unable to load order summary:', error);
            return {};
          })
        ]);
        setOrders(listResult.data);
        setTotalCount(listResult.totalCount);
        setSummary(summaryResult || {});
      } catch (error) {
        if (error?.name !== 'AbortError') toast.error(getApiErrorMessage(error, 'Unable to load orders.'));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, pageSize, permissions.canView, query]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadOrders(controller.signal);
    return () => controller.abort();
  }, [loadOrders, refreshKey]);

  const applyPreset = (value) => {
    const range = getDailySalesDateRange(value);
    setPreset(value);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setPage(1);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const text = searchInput.trim();
    setSearchText(text);
    if (text && !['BrandName', 'SalesPersonName'].includes(searchField)) {
      setPreset('custom');
      setFromDate('');
      setToDate('');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchText('');
    setSearchField('');
    applyPreset('current-month');
  };

  const refresh = () => setRefreshKey((value) => value + 1);

  const toggleExpanded = (orderId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const openDetails = async (order) => {
    setDetails({ ...order, loading: true });
    try {
      const full = await orderService.getOrderById(order.orderId);
      setDetails({ ...order, ...full, loading: false });
    } catch (error) {
      setDetails({ ...order, loading: false });
      toast.error(getApiErrorMessage(error, 'Unable to load order details.'));
    }
  };

  const removeOrder = async () => {
    setDeleting(true);
    try {
      await orderService.deleteOrder(deleteTarget.orderId);
      toast.success(`Order #${deleteTarget.orderId} deleted successfully.`);
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to delete order.'));
    } finally {
      setDeleting(false);
    }
  };

  const mutatePayment = async (action, payment) => {
    try {
      if (action === 'email') await paymentService.sendMail(payment.paymentId, payment.brandEmailTempleteId || payment.brandEmailTemplateId || 0);
      if (action === 'pandadoc') await paymentService.sendPandaDocMail(payment.paymentId);
      if (action === 'refund') await paymentService.updatePayment({ ...payment, paymentStatus: 'Refund', saleType: 'Refund' });
      toast.success(action === 'refund' ? 'Payment refunded successfully.' : 'Email sent successfully.');
      refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Unable to ${action} payment.`));
    }
  };

  const displayRows = useMemo(() => {
    const result = [];
    orders.forEach((order) => {
      result.push(order);
      if (expanded.has(order.orderId)) {
        paymentsFor(order).forEach((payment, index) => result.push({ ...payment, _paymentRow: true, _order: order, _rowKey: `payment-${order.orderId}-${payment.paymentId || index}` }));
      }
    });
    return result;
  }, [expanded, orders]);

  const columns = [
    {
      header: 'Order ID',
      id: 'orderId',
      sticky: 'left',
      cell: (row) => {
        if (row._paymentRow) return <span className="pl-7 text-xs font-semibold text-slate-400">Payment #{row.paymentId || '-'}</span>;
        const payments = paymentsFor(row);
        return <div className="flex items-center gap-1.5">{paymentPermissions.canView && payments.length > 0 && <button type="button" onClick={(event) => { event.stopPropagation(); toggleExpanded(row.orderId); }} className="rounded p-1 text-slate-400 hover:bg-violet-50 hover:text-violet-600">{expanded.has(row.orderId) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>}<span className="font-bold text-indigo-600">#{row.orderId}</span></div>;
      }
    },
    { header: 'Customer Name', cell: (row) => row._paymentRow ? <span className="text-xs text-slate-400">{row.paymentType || 'Payment'}</span> : row.customerName || '-' },
    { header: 'Brand', cell: (row) => row.brandName || row._order?.brandName || '-' },
    { header: 'Gateway', cell: (row) => row.gatewayName || row._order?.gatewayName || '-' },
    { header: 'Sales Person', cell: (row) => row._paymentRow ? '-' : row.salesPersonName || '-' },
    { header: 'Sale Date', cell: (row) => dateTime(row.paymentDate || row.saleDate || row.orderDate) },
    { header: 'Order Status', cell: (row) => <PaymentStatusBadge record={row} /> },
    { header: 'Subtotal', align: 'right', cell: (row) => row._paymentRow ? '-' : money(row.subtotal) },
    { header: 'Discount', align: 'right', cell: (row) => row._paymentRow ? '-' : money(row.discountAmount) },
    { header: 'Total Amount', align: 'right', cell: (row) => <strong>{money(row._paymentRow ? row.amount : row.totalAmount)}</strong> },
    { header: 'Payment', cell: (row) => row._paymentRow ? <span className="text-xs">{row.transactionId || row.authCode || '-'}</span> : `${paymentsFor(row).length} payment${paymentsFor(row).length === 1 ? '' : 's'}` },
    {
      header: 'Actions',
      id: 'actions',
      sticky: 'right',
      align: 'center',
      cell: (row) => row._paymentRow ? (
        <div className="flex justify-center gap-1">
          <Action icon={Eye} label="Open payment details" onClick={() => setDetails({ ...row, _paymentDetails: true })} />
          {paymentPermissions.canUpdate && <Action icon={Pencil} label="Edit payment" onClick={() => navigate(`/Orders/CreateOrder?orderId=${row._order.orderId}&paymentId=${row.paymentId || ''}`)} />}
          <Action icon={Mail} label="Send payment email" onClick={() => mutatePayment('email', row)} />
          <Action icon={Send} label="Send PandaDoc email" onClick={() => mutatePayment('pandadoc', row)} />
          <Action icon={Share2} label="Open sales-share details" onClick={() => navigate(`/Orders/CreateOrder?orderId=${row._order.orderId}&paymentId=${row.paymentId || ''}&share=1`)} />
          {paymentPermissions.canUpdate && <Action icon={RotateCcw} label="Refund payment" tone="warning" onClick={() => mutatePayment('refund', row)} />}
        </div>
      ) : (
        <div className="flex justify-center gap-1">
          <Action icon={Eye} label="View order" onClick={() => openDetails(row)} />
          {paymentPermissions.canAdd && <Action icon={CreditCard} label="Add payment" onClick={() => navigate(`/Orders/CreateOrder?orderId=${row.orderId}&mode=payment`)} />}
          {permissions.canUpdate && <Action icon={Pencil} label="Edit order" onClick={() => navigate(`/Orders/CreateOrder?orderId=${row.orderId}`)} />}
          {permissions.canDelete && <Action icon={Trash2} label="Delete order" tone="danger" onClick={() => setDeleteTarget(row)} />}
        </div>
      )
    }
  ];

  const summaryCards = [
    ['Total Orders', summary.totalOrders ?? summary.orderCount ?? totalCount, ShoppingCart, 'violet'],
    ['Total Sales', money(summary.totalSales ?? summary.totalAmount ?? 0), DollarSign, 'emerald'],
    ['Total Payments', summary.totalPayments ?? summary.paymentCount ?? 0, CreditCard, 'sky'],
    ['Subtotal', money(summary.subtotal ?? summary.totalSubtotal ?? 0), PackageCheck, 'amber'],
    ['Discount', money(summary.discount ?? summary.discountAmount ?? summary.totalDiscount ?? 0), RotateCcw, 'rose']
  ];

  if (!permissions.canView) return <PermissionDenied />;

  return (
    <main className="min-h-full space-y-4 bg-gradient-to-br from-slate-50 via-white to-violet-50/40 p-3 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/10 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-violet-600" /><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Orders</h1></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">View and manage all customer orders.</p></div>
        <div className="flex items-center gap-2"><TableRefreshButton loading={loading} onClick={refresh} title="Refresh orders" />{permissions.canAdd && <button type="button" className="order-primary-button" onClick={() => navigate('/Orders/CreateOrder')}><Plus size={15} />Add Order</button>}</div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(([label, value, Icon, tone]) => <SummaryCard key={label} label={label} value={value} icon={Icon} tone={tone} />)}
      </section>

      <section className="rounded-2xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mb-3 text-xs font-semibold text-slate-500">Showing {orders.length} of {totalCount} Orders</div>
        <form onSubmit={submitSearch} className="grid gap-2 xl:grid-cols-[160px_minmax(210px,1fr)_160px_150px_150px_auto]">
          <select className="order-control" value={searchField} onChange={(event) => { setSearchField(event.target.value); setPage(1); }}>{SEARCH_FIELDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <label className="order-input-with-icon"><Search size={15} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search orders..." /></label>
          <Select value={preset} onValueChange={applyPreset}><SelectTrigger className="order-control"><SelectValue placeholder="Quick date" /></SelectTrigger><SelectContent className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">{preset === 'custom' && <SelectItem value="custom">Custom range</SelectItem>}{QUICK_FILTERS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          <input className="order-control" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPreset('custom'); setPage(1); }} aria-label="From date" />
          <input className="order-control" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPreset('custom'); setPage(1); }} aria-label="To date" />
          <div className="flex gap-2"><button className="order-primary-button" type="submit">Search</button><button className="order-secondary-button" type="button" onClick={clearFilters}>Clear</button></div>
        </form>
      </section>

      <CommonTable columns={columns} data={displayRows} loading={loading} rowKey={(row) => row._rowKey || `order-${row.orderId}`} emptyState={{ title: 'No orders found', description: 'Try changing the search or date filters.' }} pagination={{ pageNumber: page, pageSize, totalCount, itemName: 'Orders', onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }} />

      {details && <DetailsModal record={details} onClose={() => setDetails(null)} />}
      <DeleteConfirmModal open={Boolean(deleteTarget)} title="Delete order" itemName={deleteTarget ? `Order #${deleteTarget.orderId}` : ''} loading={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={removeOrder} />
    </main>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  const tones = { violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40', emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40', sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40', rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40' };
  return <article className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={19} /></span><div className="min-w-0"><span className="block text-[11px] font-semibold text-slate-500">{label}</span><strong className="block truncate text-lg text-slate-900 dark:text-white">{value}</strong></div></article>;
}

function Action({ icon: Icon, label, onClick, tone = 'default' }) {
  const color = tone === 'danger' ? 'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30' : tone === 'warning' ? 'hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30' : 'hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950/30';
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={`rounded-lg p-1.5 text-slate-400 transition ${color}`}><Icon size={15} /></button>;
}

function DetailsModal({ record, onClose }) {
  const isPayment = record._paymentDetails;
  const fields = isPayment ? [['Payment ID', record.paymentId], ['Order ID', record._order?.orderId || record.orderId], ['Payment type', record.paymentType], ['Transaction', record.transactionId], ['Amount', money(record.amount)], ['Payment date', dateTime(record.paymentDate)]] : [['Order ID', record.orderId], ['Customer', record.customerName], ['Sales Person', record.salesPersonName], ['Brand', record.brandName], ['Gateway', record.gatewayName], ['Sale Date', dateTime(record.saleDate || record.orderDate)], ['Subtotal', money(record.subtotal)], ['Discount', money(record.discountAmount)], ['Total', money(record.totalAmount)], ['Notes', record.notes]];
  return <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"><header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700"><h2 className="font-bold text-slate-900 dark:text-white">{isPayment ? 'Payment details' : 'Order details'}</h2><button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">×</button></header><div className="grid gap-3 p-5 sm:grid-cols-2">{record.loading ? <div className="col-span-full py-10 text-center text-sm text-slate-500">Loading details...</div> : fields.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"><span className="text-[10px] font-bold uppercase text-slate-400">{label}</span><div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value || '-'}</div></div>)}</div><footer className="flex justify-end border-t border-slate-200 px-5 py-3 dark:border-slate-700"><button className="order-secondary-button" onClick={onClose}>Close</button></footer></div></div>;
}

function PermissionDenied() {
  return <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/20"><h1 className="font-bold text-amber-900 dark:text-amber-200">Access denied</h1><p className="mt-1 text-sm text-amber-700 dark:text-amber-300">You do not have permission to view orders.</p></div>;
}
