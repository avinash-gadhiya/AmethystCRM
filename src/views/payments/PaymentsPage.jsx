import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  Mail,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Share2,
  Trash2,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';

import CommonTable from '@/components/common/CommonTable';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import PaymentStatusBadge, { getPaymentStatus } from '@/components/orders/PaymentStatusBadge';
import { getApiErrorMessage } from '@/lib/apiError';
import paymentService from '@/services/paymentService';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import '../orders/order-management.css';

const SEARCH_FIELDS = [
  ['', 'All Payments'],
  ['PaymentId', 'Payment ID'],
  ['OrderId', 'Order ID'],
  ['CustomerName', 'Customer Name'],
  ['BrandGateway', 'Brand & Gateway'],
  ['PaymentType', 'Payment Type'],
  ['TransactionId', 'Transaction Number']
];

const EMPTY_PAYMENT = {
  paymentId: 0,
  orderId: 0,
  paymentType: 'Card',
  cardType: '',
  cardNumber: '',
  cardExpiryDate: '',
  cvv: '',
  nameOnCard: '',
  transactionId: '',
  authCode: '',
  gatewayId: '',
  brandId: '',
  amount: '',
  isVoid: false,
  isChargeBack: false,
  isRetrieval: false,
  isAlert: false,
  paymentDate: new Date().toISOString().slice(0, 16)
};

const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);

const dateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function PaymentsPage() {
  const navigate = useNavigate();
  const permissions = useMemo(() => resolveConfiguredPagePermissions('payment', ['/orders/payments', '/payments']), []);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ text: '', searchField: '', status: 'Sale', fromDate: '', toDate: '' });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [emailTarget, setEmailTarget] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const fileInputRef = useRef(null);

  const loadPayments = useCallback(
    async (signal) => {
      if (!permissions.canView) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await paymentService.getPayments(
          {
            Text: filters.text,
            SearchField: filters.searchField,
            PaymentStatus: filters.status === 'All' ? '' : filters.status,
            FromDate: filters.fromDate,
            ToDate: filters.toDate,
            PageNumber: page,
            PageSize: pageSize,
            SortProperty: 'paymentId',
            IsDescending: true
          },
          signal
        );
        setRows(result.data);
        setTotalCount(result.totalCount);
      } catch (error) {
        if (error?.name !== 'AbortError') toast.error(getApiErrorMessage(error, 'Unable to load payments.'));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filters, page, pageSize, permissions.canView]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadPayments(controller.signal);
    return () => controller.abort();
  }, [loadPayments, refreshKey]);

  const refresh = () => setRefreshKey((value) => value + 1);

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setFilters((current) => ({ ...current, text: searchInput.trim() }));
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ text: '', searchField: '', status: 'Sale', fromDate: '', toDate: '' });
    setPage(1);
  };

  const savePayment = async (event) => {
    event.preventDefault();
    const amount = Number(editor.amount);
    if (!editor.orderId || !editor.paymentType || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Order, payment type, and a valid amount are required.');
      return;
    }
    if (String(editor.paymentType).toLowerCase() === 'card' && (!editor.cardNumber || !editor.cardExpiryDate || !editor.cvv)) {
      toast.error('Card number, expiry date, and CVV are required for card payments.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...editor,
        paymentId: Number(editor.paymentId) || 0,
        orderId: Number(editor.orderId),
        gatewayId: Number(editor.gatewayId) || 0,
        brandId: Number(editor.brandId) || 0,
        amount,
        paymentDate: new Date(editor.paymentDate).toISOString()
      };
      if (payload.paymentId) await paymentService.updatePayment(payload);
      else await paymentService.createPayment(payload);
      toast.success(payload.paymentId ? 'Payment updated successfully.' : 'Payment added successfully.');
      setEditor(null);
      refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to save payment.'));
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async () => {
    setDeleting(true);
    try {
      await paymentService.deletePayment(deleteTarget.paymentId);
      toast.success('Payment deleted successfully.');
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to delete payment.'));
    } finally {
      setDeleting(false);
    }
  };

  const sendPaymentEmail = async () => {
    if (!templateId) {
      toast.error('Brand email template ID is required.');
      return;
    }
    setSaving(true);
    try {
      await paymentService.sendMail(emailTarget.paymentId, Number(templateId));
      toast.success('Payment email sent successfully.');
      setEmailTarget(null);
      setTemplateId('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to send payment email.'));
    } finally {
      setSaving(false);
    }
  };

  const sendPandaDoc = async (payment) => {
    try {
      await paymentService.sendPandaDocMail(payment.paymentId);
      toast.success('PandaDoc email sent successfully.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to send PandaDoc email.'));
    }
  };

  const refundPayment = async (payment) => {
    try {
      await paymentService.updatePayment({ ...payment, paymentStatus: 'Refund', saleType: 'Refund' });
      toast.success('Payment marked as refunded.');
      refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to refund payment.'));
    }
  };

  const uploadRefunds = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error('Please select an Excel .xlsx or .xls file.');
      return;
    }
    const toastId = toast.loading('Uploading refund file...');
    try {
      await paymentService.uploadRefundFile(file);
      toast.success('Refund file uploaded successfully.', { id: toastId });
      refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to upload refund file.'), { id: toastId });
    }
  };

  const downloadCsv = (template = false) => {
    const headers = template
      ? ['Payment ID', 'Refund Amount', 'Reason']
      : ['Payment ID', 'Order ID', 'Customer', 'Brand', 'Gateway', 'Payment Type', 'Transaction Number', 'Amount', 'Payment Date', 'Status'];
    const body = template
      ? []
      : rows.map((row) => [
          row.paymentId,
          row.orderId,
          row.customerName,
          row.brandName,
          row.gatewayName,
          row.paymentType,
          row.transactionId,
          row.amount,
          row.paymentDate,
          getPaymentStatus(row)
        ]);
    const csv = [headers, ...body].map((line) => line.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = template ? 'refund-upload-template.csv' : 'payments.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { header: 'Payment ID', accessor: 'paymentId', cell: (row) => <span className="font-bold text-indigo-600">#{row.paymentId}</span> },
    { header: 'Order ID', accessor: 'orderId', cell: (row) => (row.orderId ? `#${row.orderId}` : '-') },
    { header: 'Customer', accessor: 'customerName' },
    { header: 'Brand', accessor: 'brandName' },
    { header: 'Gateway', accessor: 'gatewayName' },
    { header: 'Payment type', accessor: 'paymentType' },
    { header: 'Transaction number', accessor: 'transactionId' },
    { header: 'Amount', align: 'right', cell: (row) => <strong>{money(row.amount)}</strong> },
    { header: 'Payment date', cell: (row) => dateTime(row.paymentDate) },
    { header: 'Status', cell: (row) => <PaymentStatusBadge record={row} /> },
    {
      header: 'Actions',
      id: 'actions',
      sticky: 'right',
      align: 'center',
      cell: (row) => (
        <div className="flex items-center justify-center gap-1" onClick={(event) => event.stopPropagation()}>
          <Action icon={Eye} label="View payment" onClick={() => setSelected(row)} />
          {permissions.canUpdate && <Action icon={Pencil} label="Edit payment" onClick={() => setEditor({ ...EMPTY_PAYMENT, ...row, paymentDate: String(row.paymentDate || '').slice(0, 16) })} />}
          <Action icon={Mail} label="Send payment email" onClick={() => setEmailTarget(row)} />
          <Action icon={Send} label="Send PandaDoc email" onClick={() => sendPandaDoc(row)} />
          <Action
            icon={Share2}
            label="Share-payment details"
            onClick={() => navigate(`/Orders/CreateOrder?orderId=${row.orderId || ''}&paymentId=${row.paymentId}&share=1`)}
          />
          {permissions.canUpdate && !/refund/i.test(getPaymentStatus(row)) && <Action icon={RotateCcw} label="Refund payment" tone="warning" onClick={() => refundPayment(row)} />}
          {permissions.canDelete && <Action icon={Trash2} label="Delete payment" tone="danger" onClick={() => setDeleteTarget(row)} />}
        </div>
      )
    }
  ];

  if (!permissions.canView) {
    return <PermissionDenied subject="payments" />;
  }

  return (
    <main className="min-h-full space-y-4 bg-gradient-to-br from-slate-50 via-white to-violet-50/40 p-3 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/10 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-violet-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Payments</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">View and manage all payment transactions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HeaderButton icon={Download} onClick={() => downloadCsv(false)}>Download payments</HeaderButton>
          <HeaderButton icon={FileSpreadsheet} onClick={() => downloadCsv(true)}>Refund template</HeaderButton>
          {permissions.canAdd && <HeaderButton icon={Upload} onClick={() => fileInputRef.current?.click()}>Upload refund Excel</HeaderButton>}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={uploadRefunds} />
          <TableRefreshButton loading={loading} onClick={refresh} title="Refresh payments" />
        </div>
      </header>

      <section className="rounded-2xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mb-3 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
          {['Sale', 'All', 'Refund'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => { setFilters((current) => ({ ...current, status })); setPage(1); }}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${filters.status === status ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
            >
              {status === 'Refund' ? 'Refunds' : status === 'Sale' ? 'Sales' : status}
            </button>
          ))}
        </div>
        <form onSubmit={submitSearch} className="grid gap-2 md:grid-cols-[180px_minmax(220px,1fr)_150px_150px_auto]">
          <select value={filters.searchField} onChange={(event) => { setFilters((current) => ({ ...current, searchField: event.target.value })); setPage(1); }} className="order-control">
            {SEARCH_FIELDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label className="order-input-with-icon"><Search size={15} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search payments..." /></label>
          <input type="date" value={filters.fromDate} onChange={(event) => { setFilters((current) => ({ ...current, fromDate: event.target.value })); setPage(1); }} className="order-control" aria-label="From date" />
          <input type="date" value={filters.toDate} onChange={(event) => { setFilters((current) => ({ ...current, toDate: event.target.value })); setPage(1); }} className="order-control" aria-label="To date" />
          <div className="flex gap-2"><button className="order-primary-button" type="submit">Search</button><button className="order-secondary-button" type="button" onClick={clearFilters}>Clear</button></div>
        </form>
      </section>

      <CommonTable
        columns={columns}
        data={rows}
        loading={loading}
        rowKey="paymentId"
        emptyState={{ title: 'No payments found', description: 'Try changing the search or date filters.' }}
        pagination={{ pageNumber: page, pageSize, totalCount, itemName: 'Payments', onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }}
      />

      {selected && <PaymentDetailsModal payment={selected} onClose={() => setSelected(null)} />}
      {editor && <PaymentEditorModal payment={editor} saving={saving} onChange={setEditor} onClose={() => !saving && setEditor(null)} onSave={savePayment} />}
      {emailTarget && <EmailModal payment={emailTarget} templateId={templateId} onTemplateChange={setTemplateId} saving={saving} onClose={() => setEmailTarget(null)} onSend={sendPaymentEmail} />}
      <DeleteConfirmModal open={Boolean(deleteTarget)} title="Delete payment" itemName={deleteTarget ? `Payment #${deleteTarget.paymentId}` : ''} loading={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={deletePayment} />
    </main>
  );
}

function Action({ icon: Icon, label, onClick, tone = 'default' }) {
  const color = tone === 'danger' ? 'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30' : tone === 'warning' ? 'hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30' : 'hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950/30';
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={`rounded-lg p-1.5 text-slate-400 transition ${color}`}><Icon size={15} /></button>;
}

function HeaderButton({ icon: Icon, children, onClick }) {
  return <button type="button" onClick={onClick} className="order-secondary-button"><Icon size={15} />{children}</button>;
}

function PermissionDenied({ subject }) {
  return <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/20"><h1 className="font-bold text-amber-900 dark:text-amber-200">Access denied</h1><p className="mt-1 text-sm text-amber-700 dark:text-amber-300">You do not have permission to view {subject}.</p></div>;
}

function ModalShell({ title, onClose, children, footer }) {
  return <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"><h2 className="font-bold text-slate-900 dark:text-white">{title}</h2><button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">×</button></div><div className="p-5">{children}</div>{footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">{footer}</div>}</div></div>;
}

function PaymentDetailsModal({ payment, onClose }) {
  const fields = [['Payment ID', `#${payment.paymentId}`], ['Order ID', payment.orderId ? `#${payment.orderId}` : '-'], ['Customer', payment.customerName || '-'], ['Brand', payment.brandName || '-'], ['Gateway', payment.gatewayName || '-'], ['Payment type', payment.paymentType || '-'], ['Transaction number', payment.transactionId || '-'], ['Authorization code', payment.authCode || '-'], ['Amount', money(payment.amount)], ['Payment date', dateTime(payment.paymentDate)]];
  return <ModalShell title={`Payment #${payment.paymentId}`} onClose={onClose} footer={<button className="order-secondary-button" onClick={onClose}>Close</button>}><div className="mb-4"><PaymentStatusBadge record={payment} /></div><dl className="grid gap-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"><dt className="text-[11px] font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</dd></div>)}</dl>{payment.showShareHint && <p className="mt-4 rounded-xl bg-violet-50 p-3 text-xs text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">Sales-share records are managed from the order payment workflow.</p>}</ModalShell>;
}

function PaymentEditorModal({ payment, saving, onChange, onClose, onSave }) {
  const field = (name, value) => onChange((current) => ({ ...current, [name]: value }));
  const isCard = String(payment.paymentType).toLowerCase() === 'card';
  return <ModalShell title={payment.paymentId ? `Edit payment #${payment.paymentId}` : 'Add payment'} onClose={onClose} footer={<><button type="button" className="order-secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" form="payment-editor" className="order-primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save payment'}</button></>}><form id="payment-editor" onSubmit={onSave} className="grid gap-3 sm:grid-cols-2"><Field label="Order ID" required><input className="order-control" type="number" min="1" value={payment.orderId} onChange={(e) => field('orderId', e.target.value)} /></Field><Field label="Payment type" required><select className="order-control" value={payment.paymentType} onChange={(e) => field('paymentType', e.target.value)}>{['Card', 'Bank', 'Cheque', 'Zelle', 'PayPal'].map((type) => <option key={type}>{type}</option>)}</select></Field>{isCard && <><Field label="Card type"><input className="order-control" value={payment.cardType || ''} onChange={(e) => field('cardType', e.target.value)} /></Field><Field label="Name on card"><input className="order-control" value={payment.nameOnCard || ''} onChange={(e) => field('nameOnCard', e.target.value)} /></Field><Field label="Card number" required><input className="order-control" autoComplete="cc-number" value={payment.cardNumber || ''} onChange={(e) => field('cardNumber', e.target.value)} /></Field><Field label="Expiry" required><input className="order-control" type="month" value={String(payment.cardExpiryDate || '').slice(0, 7)} onChange={(e) => field('cardExpiryDate', e.target.value)} /></Field><Field label="CVV" required><input className="order-control" type="password" autoComplete="cc-csc" value={payment.cvv || ''} onChange={(e) => field('cvv', e.target.value)} /></Field></>}<Field label="Transaction ID"><input className="order-control" value={payment.transactionId || ''} onChange={(e) => field('transactionId', e.target.value)} /></Field><Field label="Authorization code"><input className="order-control" value={payment.authCode || ''} onChange={(e) => field('authCode', e.target.value)} /></Field><Field label="Gateway ID"><input className="order-control" type="number" value={payment.gatewayId || ''} onChange={(e) => field('gatewayId', e.target.value)} /></Field><Field label="Brand ID"><input className="order-control" type="number" value={payment.brandId || ''} onChange={(e) => field('brandId', e.target.value)} /></Field><Field label="Amount" required><input className="order-control" type="number" min="0.01" step="0.01" value={payment.amount} onChange={(e) => field('amount', e.target.value)} /></Field><Field label="Payment date"><input className="order-control" type="datetime-local" value={payment.paymentDate || ''} onChange={(e) => field('paymentDate', e.target.value)} /></Field></form></ModalShell>;
}

function EmailModal({ payment, templateId, onTemplateChange, saving, onClose, onSend }) {
  return <ModalShell title={`Email payment #${payment.paymentId}`} onClose={onClose} footer={<><button className="order-secondary-button" onClick={onClose}>Cancel</button><button className="order-primary-button" onClick={onSend} disabled={saving}>{saving ? 'Sending...' : 'Send email'}</button></>}><Field label="Brand email template ID" required><input className="order-control" type="number" min="1" value={templateId} onChange={(e) => onTemplateChange(e.target.value)} placeholder="Enter template ID" /></Field></ModalShell>;
}

function Field({ label, required, children }) {
  return <label className="grid gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>{label}{required && <span className="text-rose-500"> *</span>}</span>{children}</label>;
}
