import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Minus,
  Package,
  Plus,
  Save,
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  UserRound
} from 'lucide-react';
import { toast } from 'sonner';

import PaymentStatusBadge from '@/components/orders/PaymentStatusBadge';
import { getApiErrorMessage } from '@/lib/apiError';
import authService from '@/services/authService';
import brandService from '@/services/brandService';
import customerService from '@/services/customerService';
import gatewayService from '@/services/gatewayService';
import orderService from '@/services/orderService';
import paymentService from '@/services/paymentService';
import productService from '@/services/productService';
import settingService from '@/services/settingService';
import sharePaymentService from '@/services/sharePaymentService';
import userService from '@/services/userService';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import './order-management.css';

const SUBSCRIPTION_MONTHS = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
const PAYMENT_TYPES = ['Card', 'Bank', 'Cheque', 'Zelle', 'PayPal'];

const newPayment = () => ({
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
  bankName: '',
  accountNumber: '',
  chequeNumber: '',
  routingNumber: '',
  trackingNumber: '',
  isChequeCleared: false,
  zelleId: '',
  paypalEmail: '',
  isVoid: false,
  isChargeBack: false,
  isRetrieval: false,
  isAlert: false,
  paymentDate: new Date().toISOString().slice(0, 16),
  isDeleted: false
});

const newOrder = (userId = '') => ({
  orderId: 0,
  customerId: '',
  salesPersonId: userId,
  saleDate: new Date().toISOString().slice(0, 16),
  discountAmount: 0,
  discountType: 'Fixed',
  discountCode: '',
  orderStatus: 'Pending',
  isFulfilled: false,
  notes: '',
  orderItems: [],
  payment: newPayment(),
  sharePayments: []
});

const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);

const optionId = (record, ...keys) => {
  for (const key of keys) if (record?.[key] !== undefined && record?.[key] !== null) return record[key];
  return '';
};

const optionName = (record, ...keys) => {
  for (const key of keys) if (String(record?.[key] || '').trim()) return String(record[key]).trim();
  return '';
};

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currentUser = authService.getUser() || {};
  const permissions = useMemo(() => resolveConfiguredPagePermissions('order', ['/orders']), []);
  const paymentPermissions = useMemo(() => resolveConfiguredPagePermissions('payment', ['/orders/payments']), []);
  const orderId = Number(params.get('orderId')) || 0;
  const paymentId = Number(params.get('paymentId')) || 0;
  const paymentOnly = params.get('mode') === 'payment';
  const [form, setForm] = useState(() => newOrder(currentUser.userId || ''));
  const [loading, setLoading] = useState(Boolean(orderId));
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [cardTypes, setCardTypes] = useState([]);
  const [discountTypes, setDiscountTypes] = useState([]);
  const [shareTypes, setShareTypes] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const roleName = String(currentUser.roleName || currentUser.role || '').toLowerCase();
  const canChooseSalesPerson = ['super admin', 'admin', 'developer', 'sales manager', 'service manager'].some((role) => roleName.includes(role));
  const canEditOrder = orderId ? permissions.canUpdate : permissions.canAdd;
  const canSavePayment = paymentId ? paymentPermissions.canUpdate : paymentPermissions.canAdd;

  useEffect(() => {
    const controller = new AbortController();
    const safe = async (request, fallback = []) => {
      try { return await request(); } catch (error) { if (error?.name !== 'AbortError') console.warn(error); return fallback; }
    };
    Promise.all([
      safe(() => productService.getProductDropdown({ PageSize: 250 }, controller.signal)),
      safe(() => customerService.getCustomers({ PageSize: 50 }, controller.signal).then((result) => result.data)),
      safe(() => userService.getUserDropDown({ PageSize: 500, isActive: true })),
      safe(() => brandService.getBrandDropdown()),
      safe(() => gatewayService.getGateways({ PageSize: 500 }, controller.signal).then((result) => result.data)),
      safe(() => settingService.getSettingValueDropdown('Card_Type', controller.signal).then((result) => result.data)),
      safe(() => settingService.getSettingValueDropdown('DiscountType', controller.signal).then((result) => result.data)),
      safe(() => settingService.getSettingValueDropdown('sales_share_type', controller.signal).then((result) => result.data))
    ]).then(([productRows, customerRows, userRows, brandRows, gatewayRows, cardRows, discountRows, shareRows]) => {
      if (controller.signal.aborted) return;
      setProducts(productRows);
      setCustomers(customerRows);
      setUsers(userRows);
      setBrands(brandRows);
      setGateways(gatewayRows);
      setCardTypes(cardRows);
      setDiscountTypes(discountRows);
      setShareTypes(shareRows);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const customerId = Number(params.get('customerId')) || 0;
    const controller = new AbortController();
    const load = async () => {
      if (!orderId) {
        if (customerId) setForm((current) => ({ ...current, customerId }));
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const order = await orderService.getOrderById(orderId, controller.signal);
        let payment = order.payment || (Array.isArray(order.payments) ? order.payments.find((item) => Number(item.paymentId) === paymentId) || order.payments[0] : null);
        if (paymentId) payment = await paymentService.getPayment(paymentId, controller.signal);
        let sharePayments = Array.isArray(order.sharePayments) ? order.sharePayments : [];
        if (payment?.paymentId) {
          try { sharePayments = await sharePaymentService.getSharePayments({ PaymentId: payment.paymentId }, controller.signal); } catch { /* optional */ }
        }
        setForm({
          ...newOrder(currentUser.userId || ''),
          ...order,
          orderId,
          customerId: order.customerId || '',
          salesPersonId: order.salesPersonId || currentUser.userId || '',
          saleDate: String(order.saleDate || order.orderDate || new Date().toISOString()).slice(0, 16),
          orderItems: Array.isArray(order.orderItems) ? order.orderItems : [],
          payment: { ...newPayment(), ...(payment || {}), orderId, paymentDate: String(payment?.paymentDate || new Date().toISOString()).slice(0, 16) },
          sharePayments
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'Unable to load the order.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [currentUser.userId, orderId, params, paymentId]);

  const selectedCustomer = customers.find((customer) => Number(optionId(customer, 'customerId', 'id')) === Number(form.customerId));

  const totals = useMemo(() => {
    const subtotal = form.orderItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    const discountValue = Math.max(0, Number(form.discountAmount) || 0);
    const discount = String(form.discountType).toLowerCase().includes('percent') ? subtotal * Math.min(discountValue, 100) / 100 : Math.min(discountValue, subtotal);
    return { subtotal, discount, total: Math.max(0, subtotal - discount) };
  }, [form.discountAmount, form.discountType, form.orderItems]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updatePayment = (field, value) => setForm((current) => ({ ...current, payment: { ...current.payment, [field]: value } }));

  const searchCustomers = async () => {
    try {
      const result = await customerService.getCustomers({ Text: customerSearch, PageNumber: 1, PageSize: 50 });
      setCustomers(result.data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to search customers.'));
    }
  };

  const searchProducts = async () => {
    try {
      setProducts(await productService.getProductDropdown({ Text: productSearch, PageNumber: 1, PageSize: 100 }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to search products.'));
    }
  };

  const addProduct = (productId) => {
    const product = products.find((item) => Number(optionId(item, 'productId', 'id', 'value')) === Number(productId));
    if (!product) return;
    setForm((current) => {
      const existing = current.orderItems.findIndex((item) => Number(item.productId) === Number(productId));
      if (existing >= 0) {
        const orderItems = [...current.orderItems];
        orderItems[existing] = { ...orderItems[existing], quantity: (Number(orderItems[existing].quantity) || 0) + 1 };
        return { ...current, orderItems };
      }
      const unitPrice = Number(product.price ?? product.unitPrice) || 0;
      return { ...current, orderItems: [...current.orderItems, { orderItemId: 0, orderId, productId: Number(productId), productName: optionName(product, 'name', 'productName', 'label'), productType: optionName(product, 'productType', 'type') || 'Service', quantity: 1, unitPrice, totalPrice: unitPrice, subscriptionMonths: 0, isDeleted: false }] };
    });
  };

  const updateItem = (index, changes) => setForm((current) => ({ ...current, orderItems: current.orderItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) }));
  const removeItem = (index) => setForm((current) => ({ ...current, orderItems: current.orderItems.filter((_, itemIndex) => itemIndex !== index) }));

  const addShare = () => setForm((current) => ({ ...current, sharePayments: [...current.sharePayments, { sharePaymentId: 0, paymentId: current.payment.paymentId || 0, shareWithId: '', shareTypeId: '', shareAmount: '' }] }));
  const updateShare = (index, field, value) => setForm((current) => ({ ...current, sharePayments: current.sharePayments.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row) }));
  const removeShare = async (index) => {
    const row = form.sharePayments[index];
    if (row.sharePaymentId) {
      try { await sharePaymentService.deleteSharePayment(row.sharePaymentId); toast.success('Sales share removed.'); } catch (error) { toast.error(getApiErrorMessage(error, 'Unable to remove sales share.')); return; }
    }
    setForm((current) => ({ ...current, sharePayments: current.sharePayments.filter((_, rowIndex) => rowIndex !== index) }));
  };

  const validate = () => {
    if (!paymentOnly && !form.customerId) return 'Customer is required.';
    if (!paymentOnly && !form.orderItems.length) return 'Add at least one product to the order.';
    if (!paymentOnly && form.orderItems.some((item) => !item.productName || Number(item.quantity) <= 0 || Number(item.unitPrice) < 0)) return 'Every order item needs a product, valid quantity, and valid price.';
    if (totals.discount > totals.subtotal) return 'Discount cannot exceed the subtotal.';
    const amount = Number(form.payment.amount || totals.total);
    if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid payment amount.';
    const type = String(form.payment.paymentType).toLowerCase();
    if (type === 'card' && (!form.payment.cardNumber || !form.payment.cardExpiryDate || !form.payment.cvv || !form.payment.nameOnCard)) return 'Complete all required card fields.';
    if (type === 'cheque' && !form.payment.chequeNumber) return 'Cheque number is required.';
    if (type === 'zelle' && !form.payment.zelleId) return 'Zelle ID is required.';
    const shares = form.sharePayments.filter((row) => row.shareWithId || row.shareAmount);
    if (new Set(shares.map((row) => String(row.shareWithId))).size !== shares.length) return 'Duplicate sales-share users are not allowed.';
    if (shares.some((row) => !row.shareWithId || !row.shareTypeId || Number(row.shareAmount) <= 0)) return 'Complete every sales-share row.';
    if (shares.reduce((sum, row) => sum + Number(row.shareAmount || 0), 0) > totals.total) return 'Shared amount cannot exceed the order total.';
    return '';
  };

  const saveShares = async (resolvedPaymentId) => {
    for (const row of form.sharePayments) {
      const payload = { ...row, paymentId: Number(resolvedPaymentId), sharePaymentId: Number(row.sharePaymentId) || 0, shareWithId: Number(row.shareWithId), shareTypeId: Number(row.shareTypeId), shareAmount: Number(row.shareAmount) };
      if (payload.sharePaymentId) await sharePaymentService.updateSharePayment(payload);
      else await sharePaymentService.createSharePayment(payload);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if ((paymentOnly || paymentId) && !canSavePayment) return;
    if (!paymentOnly && !canEditOrder) return;
    const validation = validate();
    if (validation) { toast.error(validation); return; }
    setSaving(true);
    const createdBy = Number(currentUser.userId) || 0;
    const payment = { ...form.payment, paymentId: Number(form.payment.paymentId) || 0, orderId: Number(orderId) || 0, gatewayId: Number(form.payment.gatewayId) || 0, brandId: Number(form.payment.brandId) || 0, amount: Number(form.payment.amount || totals.total), paymentDate: new Date(form.payment.paymentDate).toISOString(), createdBy, isDeleted: false };
    try {
      if (paymentOnly || paymentId) {
        const response = payment.paymentId ? await paymentService.updatePayment(payment) : await paymentService.createPayment(payment);
        const resolvedPaymentId = Number(response?.data?.paymentId ?? response?.paymentId ?? payment.paymentId);
        if (resolvedPaymentId && form.sharePayments.length) await saveShares(resolvedPaymentId);
        toast.success(payment.paymentId ? 'Payment updated successfully.' : 'Payment added successfully.');
      } else {
        const payload = {
          orderId: Number(form.orderId) || 0,
          customerId: Number(form.customerId),
          salesPersonId: Number(form.salesPersonId) || createdBy,
          saleDate: new Date(form.saleDate).toISOString(),
          subtotal: totals.subtotal,
          discountAmount: totals.discount,
          discountType: form.discountType,
          totalAmount: totals.total,
          orderStatus: form.orderStatus || 'Pending',
          isFulfilled: Boolean(form.isFulfilled),
          notes: form.notes || '',
          createdBy,
          isDeleted: false,
          discountCode: form.discountCode || '',
          orderItems: form.orderItems.map((item) => ({ orderItemId: Number(item.orderItemId) || 0, orderId: Number(form.orderId) || 0, productId: Number(item.productId) || 0, productName: item.productName, productType: item.productType || 'Service', quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), totalPrice: Number(item.quantity) * Number(item.unitPrice), subscriptionMonths: Number(item.subscriptionMonths) || 0, isDeleted: false })),
          payment,
          sharePayments: form.sharePayments.map((row) => ({ ...row, sharePaymentId: Number(row.sharePaymentId) || 0, paymentId: Number(row.paymentId) || 0, shareWithId: Number(row.shareWithId), shareTypeId: Number(row.shareTypeId), shareAmount: Number(row.shareAmount) }))
        };
        if (payload.orderId) await orderService.updateOrder(payload);
        else await orderService.createOrder(payload);
        toast.success(payload.orderId ? 'Order updated successfully.' : 'Order created successfully.');
      }
      navigate('/Orders');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to save the order.'));
    } finally {
      setSaving(false);
    }
  };

  if ((!paymentOnly && !canEditOrder) || ((paymentOnly || paymentId) && !canSavePayment)) return <div className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">You do not have permission to {orderId ? 'update' : 'create'} this order.</div>;
  if (loading) return <div className="m-6 animate-pulse rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading order workflow...</div>;

  return (
    <main className="min-h-full space-y-4 bg-gradient-to-br from-slate-50 via-white to-violet-50/40 p-3 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/10 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><button type="button" onClick={() => navigate('/Orders')} className="order-secondary-button px-2"><ArrowLeft size={16} /></button><div><div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-violet-600" /><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{paymentOnly ? `Add Payment to Order #${orderId}` : orderId ? `Edit Order #${orderId}` : 'Create Order'}</h1></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Customer, items, payment, discount, and sales sharing in one workflow.</p></div></div>{orderId && <PaymentStatusBadge status={form.orderStatus} />}</header>

      <form onSubmit={save} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {!paymentOnly && <>
            <Section icon={UserRound} title="Customer & sales person">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Search customer"><div className="flex gap-2"><input className="order-control" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Name, email, phone..." /><button type="button" onClick={searchCustomers} className="order-secondary-button px-3"><Search size={15} /></button></div></Field>
                <Field label="Customer" required><select className="order-control" value={form.customerId} onChange={(e) => update('customerId', e.target.value)}><option value="">Select customer</option>{customers.map((customer) => { const id = optionId(customer, 'customerId', 'id'); return <option key={id} value={id}>{optionName(customer, 'customerName', 'fullName', 'name') || `Customer #${id}`}</option>; })}</select></Field>
                <Field label="Sales person" required><select className="order-control" disabled={!canChooseSalesPerson} value={form.salesPersonId} onChange={(e) => update('salesPersonId', e.target.value)}><option value="">Select sales person</option>{users.map((user) => { const id = optionId(user, 'userId', 'id'); return <option key={id} value={id}>{optionName(user, 'fullName', 'displayName', 'userName', 'username') || `User #${id}`}</option>; })}</select></Field>
                <Field label="Sale date"><input className="order-control" type="datetime-local" value={form.saleDate} onChange={(e) => update('saleDate', e.target.value)} /></Field>
              </div>
              {selectedCustomer && <div className="mt-3 grid gap-2 rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-xs text-slate-600 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-slate-300 sm:grid-cols-2 lg:grid-cols-3">{[['Email', selectedCustomer.email], ['Phone', selectedCustomer.phone || selectedCustomer.phoneNumber], ['Secondary phone', selectedCustomer.secondaryPhone], ['Address', selectedCustomer.address], ['City / State', [selectedCustomer.city, selectedCustomer.stateName || selectedCustomer.state].filter(Boolean).join(', ')], ['ZIP / Country', [selectedCustomer.zipCode || selectedCustomer.postalCode, selectedCustomer.countryName || selectedCustomer.country].filter(Boolean).join(', ')]].map(([label, value]) => <div key={label}><span className="font-bold text-slate-400">{label}: </span>{value || '-'}</div>)}</div>}
            </Section>

            <Section icon={Package} title="Products & order items">
              <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]"><div className="flex gap-2"><input className="order-control" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search product catalog..." /><button type="button" onClick={searchProducts} className="order-secondary-button px-3"><Search size={15} /></button></div><select className="order-control" value="" onChange={(e) => addProduct(e.target.value)}><option value="">Add a product...</option>{products.map((product) => { const id = optionId(product, 'productId', 'id', 'value'); return <option key={id} value={id}>{optionName(product, 'name', 'productName', 'label')} — {money(product.price ?? product.unitPrice)}</option>; })}</select></div>
              {!form.orderItems.length ? <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400 dark:border-slate-700">No products added. Select a product above to begin.</div> : <div className="space-y-2">{form.orderItems.map((item, index) => <div key={`${item.productId}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40 md:grid-cols-[minmax(180px,1fr)_100px_125px_150px_110px_auto]"><div><strong className="block text-sm text-slate-800 dark:text-slate-100">{item.productName}</strong><span className="text-[11px] text-slate-400">{item.productType || 'Service'}</span></div><div className="flex items-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><button type="button" className="px-2" onClick={() => updateItem(index, { quantity: Math.max(1, Number(item.quantity) - 1) })}><Minus size={13} /></button><input className="w-full bg-transparent text-center text-xs outline-none" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Math.max(1, Number(e.target.value)) })} /><button type="button" className="px-2" onClick={() => updateItem(index, { quantity: Number(item.quantity) + 1 })}><Plus size={13} /></button></div><input className="order-control" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: Math.max(0, Number(e.target.value)) })} aria-label="Unit price" /><select className="order-control" value={item.subscriptionMonths || 0} onChange={(e) => updateItem(index, { subscriptionMonths: Number(e.target.value) })}><option value="0">No subscription</option>{SUBSCRIPTION_MONTHS.map((months) => <option key={months} value={months}>{months} months</option>)}</select><strong className="self-center text-right text-sm">{money(Number(item.quantity) * Number(item.unitPrice))}</strong><button type="button" onClick={() => removeItem(index)} className="self-center rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30" aria-label={`Remove ${item.productName}`}><Trash2 size={15} /></button></div>)}</div>}
            </Section>

            <Section title="Discount & notes">
              <div className="grid gap-3 md:grid-cols-3"><Field label="Discount type"><select className="order-control" value={form.discountType} onChange={(e) => update('discountType', e.target.value)}>{(discountTypes.length ? discountTypes.map((row) => optionName(row, 'settingValueText', 'name', 'text')) : ['Fixed', 'Percentage']).filter(Boolean).map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Discount code"><input className="order-control" value={form.discountCode || ''} onChange={(e) => update('discountCode', e.target.value)} /></Field><Field label="Discount value"><input className="order-control" type="number" min="0" step="0.01" value={form.discountAmount} onChange={(e) => update('discountAmount', Math.max(0, Number(e.target.value)))} /></Field><div className="md:col-span-3"><Field label="Order notes"><textarea className="order-control min-h-24 resize-y" value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} /></Field></div></div>
            </Section>
          </>}

          <Section icon={CreditCard} title={paymentId ? 'Edit payment' : paymentOnly ? 'Add payment' : 'Payment'}>
            <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">{PAYMENT_TYPES.map((type) => <button key={type} type="button" onClick={() => updatePayment('paymentType', type)} className={`rounded-lg px-4 py-2 text-xs font-bold ${form.payment.paymentType === type ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'}`}>{type}</button>)}</div>
            <PaymentFields payment={form.payment} update={updatePayment} brands={brands} gateways={gateways} cardTypes={cardTypes} />
          </Section>

          <Section icon={Share2} title="Sales sharing" action={<button type="button" onClick={addShare} className="order-secondary-button"><Plus size={14} />Add user</button>}>
            {!form.sharePayments.length ? <p className="text-xs text-slate-400">No additional sales shares. The main sales person receives the full remaining amount.</p> : <div className="space-y-2">{form.sharePayments.map((row, index) => <div key={row.sharePaymentId || index} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 md:grid-cols-[1fr_1fr_140px_auto]"><select className="order-control" value={row.shareWithId || ''} onChange={(e) => updateShare(index, 'shareWithId', e.target.value)}><option value="">Select user</option>{users.filter((user) => Number(optionId(user, 'userId', 'id')) !== Number(form.salesPersonId)).map((user) => { const id = optionId(user, 'userId', 'id'); return <option key={id} value={id}>{optionName(user, 'fullName', 'displayName', 'userName', 'username') || `User #${id}`}</option>; })}</select><select className="order-control" value={row.shareTypeId || ''} onChange={(e) => updateShare(index, 'shareTypeId', e.target.value)}><option value="">Share type</option>{shareTypes.map((type) => { const id = optionId(type, 'settingValueId', 'id'); return <option key={id} value={id}>{optionName(type, 'settingValueText', 'name', 'text')}</option>; })}</select><input className="order-control" type="number" min="0.01" step="0.01" placeholder="Amount" value={row.shareAmount || ''} onChange={(e) => updateShare(index, 'shareAmount', e.target.value)} /><button type="button" onClick={() => removeShare(index)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={15} /></button></div>)}</div>}
            <div className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">Main sales person remaining share: <strong>{money(Math.max(0, totals.total - form.sharePayments.reduce((sum, row) => sum + Number(row.shareAmount || 0), 0)))}</strong></div>
          </Section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-4 font-bold text-slate-900 dark:text-white">Order totals</h2><div className="space-y-3 text-sm"><TotalRow label="Subtotal" value={money(totals.subtotal)} /><TotalRow label="Discount" value={`-${money(totals.discount)}`} /><div className="border-t border-slate-200 pt-3 dark:border-slate-700"><TotalRow label="Total" value={money(totals.total)} strong /></div><TotalRow label="Payment" value={money(form.payment.amount || totals.total)} /></div>{form.orderItems.some((item) => Number(item.subscriptionMonths) > 0) && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Subscription durations: {form.orderItems.filter((item) => item.subscriptionMonths).map((item) => `${item.productName}: ${item.subscriptionMonths} months`).join(', ')}</div>}</section>
          {!paymentOnly && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="grid gap-3"><Field label="Order status"><select className="order-control" value={form.orderStatus} onChange={(e) => update('orderStatus', e.target.value)}>{['Pending', 'Processing', 'Completed', 'Cancelled', 'Refunded'].map((status) => <option key={status}>{status}</option>)}</select></Field><label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><input type="checkbox" checked={Boolean(form.isFulfilled)} onChange={(e) => update('isFulfilled', e.target.checked)} />Order fulfilled</label></div></section>}
          <button type="submit" className="order-primary-button w-full py-3" disabled={saving}><Save size={16} />{saving ? 'Saving...' : paymentOnly ? 'Save payment' : orderId ? 'Update order' : 'Create order'}</button><button type="button" onClick={() => navigate('/Orders')} className="order-secondary-button w-full">Cancel</button>
        </aside>
      </form>
    </main>
  );
}

function PaymentFields({ payment, update, brands, gateways, cardTypes }) {
  const type = String(payment.paymentType).toLowerCase();
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {type === 'card' && <><Field label="Card type"><select className="order-control" value={payment.cardType || ''} onChange={(e) => update('cardType', e.target.value)}><option value="">Select card type</option>{cardTypes.map((row) => { const value = optionName(row, 'settingValueText', 'name', 'text'); return <option key={optionId(row, 'settingValueId', 'id') || value}>{value}</option>; })}</select></Field><Field label="Card number" required><input className="order-control" autoComplete="cc-number" value={payment.cardNumber || ''} onChange={(e) => update('cardNumber', e.target.value)} /></Field><Field label="Expiry date" required><input className="order-control" type="month" value={String(payment.cardExpiryDate || '').slice(0, 7)} onChange={(e) => update('cardExpiryDate', e.target.value)} /></Field><Field label="CVV" required><input className="order-control" type="password" autoComplete="cc-csc" value={payment.cvv || ''} onChange={(e) => update('cvv', e.target.value)} /></Field><Field label="Name on card" required><input className="order-control" autoComplete="cc-name" value={payment.nameOnCard || ''} onChange={(e) => update('nameOnCard', e.target.value)} /></Field></>}
    {type === 'bank' && <><Field label="Bank name"><input className="order-control" value={payment.bankName || ''} onChange={(e) => update('bankName', e.target.value)} /></Field><Field label="Account information"><input className="order-control" value={payment.accountNumber || ''} onChange={(e) => update('accountNumber', e.target.value)} /></Field></>}
    {type === 'cheque' && <><Field label="Cheque number" required><input className="order-control" value={payment.chequeNumber || ''} onChange={(e) => update('chequeNumber', e.target.value)} /></Field><Field label="Routing number"><input className="order-control" value={payment.routingNumber || ''} onChange={(e) => update('routingNumber', e.target.value)} /></Field><Field label="Tracking number"><input className="order-control" value={payment.trackingNumber || ''} onChange={(e) => update('trackingNumber', e.target.value)} /></Field><label className="flex items-center gap-2 self-end pb-3 text-xs font-semibold"><input type="checkbox" checked={Boolean(payment.isChequeCleared)} onChange={(e) => update('isChequeCleared', e.target.checked)} />Cheque cleared</label></>}
    {type === 'zelle' && <Field label="Zelle ID" required><input className="order-control" value={payment.zelleId || ''} onChange={(e) => update('zelleId', e.target.value)} /></Field>}
    {type === 'paypal' && <Field label="PayPal email"><input className="order-control" type="email" value={payment.paypalEmail || ''} onChange={(e) => update('paypalEmail', e.target.value)} /></Field>}
    <Field label="Transaction ID"><input className="order-control" value={payment.transactionId || ''} onChange={(e) => update('transactionId', e.target.value)} /></Field><Field label="Authorization code"><input className="order-control" value={payment.authCode || ''} onChange={(e) => update('authCode', e.target.value)} /></Field><Field label="Gateway"><select className="order-control" value={payment.gatewayId || ''} onChange={(e) => update('gatewayId', e.target.value)}><option value="">Select gateway</option>{gateways.map((row) => { const id = optionId(row, 'gatewayId', 'id'); return <option key={id} value={id}>{optionName(row, 'gatewayName', 'name') || `Gateway #${id}`}</option>; })}</select></Field><Field label="Brand"><select className="order-control" value={payment.brandId || ''} onChange={(e) => update('brandId', e.target.value)}><option value="">Select brand</option>{brands.map((row) => { const id = optionId(row, 'brandId', 'id'); return <option key={id} value={id}>{optionName(row, 'brandName', 'name') || `Brand #${id}`}</option>; })}</select></Field><Field label="Amount" required><input className="order-control" type="number" min="0.01" step="0.01" value={payment.amount || ''} onChange={(e) => update('amount', e.target.value)} /></Field><Field label="Payment date"><input className="order-control" type="datetime-local" value={payment.paymentDate || ''} onChange={(e) => update('paymentDate', e.target.value)} /></Field>
  </div>;
}

function Section({ icon: Icon, title, action, children }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"><header className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2">{Icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><Icon size={16} /></span>}<h2 className="font-bold text-slate-900 dark:text-white">{title}</h2></div>{action}</header>{children}</section>;
}

function Field({ label, required, children }) {
  return <label className="grid gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>{label}{required && <span className="text-rose-500"> *</span>}</span>{children}</label>;
}

function TotalRow({ label, value, strong }) {
  return <div className="flex items-center justify-between gap-3"><span className={strong ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500'}>{label}</span><span className={strong ? 'text-lg font-black text-violet-700 dark:text-violet-300' : 'font-semibold text-slate-800 dark:text-slate-100'}>{value}</span></div>;
}
