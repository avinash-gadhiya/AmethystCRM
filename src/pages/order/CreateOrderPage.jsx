import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModalPortal, PageHeader } from '@/components/common/page-card';
import { Search, Plus, Minus, Trash2, CreditCard, ChevronDown, X, Package, BadgePercent, ClipboardList, CalendarClock, Eraser, ArrowLeft, Landmark, FileCheck2, Zap, WalletCards } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import LiquidGlassButton from '@/components/ui/LiquidGlassButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import ShareSaleModal from '@/components/common/ShareSaleModal';
import CustomerFormModal from '@/components/customer/CustomerFormModal';
import { cn } from '@/lib/utils';
import { fetchSalesPersonList, searchSalesPersonUsers } from '@/lib/salesRoles';
import SelectSearchInput from '@/components/common/SelectSearchInput';
import UserOptionBadges, { getUserBadgeSearchText } from '@/components/common/UserOptionBadges';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { productService, paymentService, orderService, orderLookupService, customerService, brandService, gatewayService, countryService } from '@/services';
import { getCurrentLoginIpv4 } from '@/services/clientIpService';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';
import { changePaymentMethod } from '@/lib/paymentMethod';
import { normalizeOrderForEditor, buildOrderUpdatePayload } from '@/lib/orderEditor';
import { usePageCrudPermissions } from '@/hooks/usePageCrudPermissions';
import { usePagePermissionCodes } from '@/hooks/usePagePermissionCodes';
import permissionService from '@/services/permissionService';
import { resolveDynamicPaths } from '@/lib/dynamicPaths';

// Marks a field that `validateBeforeSave` actually rejects when empty. Kept to
// exactly those fields so the asterisk stays a promise rather than decoration -
// a starred field blocks Save, an unstarred one never does.
const RequiredMark = () => <span className="text-red-500 dark:text-red-400"> *</span>;

const ProductThumbnail = ({ src, name, className = '' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 text-violet-600 dark:from-violet-500/15 dark:to-indigo-500/15 dark:text-violet-300 ${className}`}>
        <Package size={18} aria-hidden="true" />
        <span className="sr-only">{name || 'Product'} image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || 'Product'}
      className={`h-full w-full object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
};

const emptyPayment = {
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
  gatewayId: 0,
  brandId: 0,
  amount: 0,
  isVoid: false,
  isChargeBack: false,
  isRetrieval: false,
  isAlert: false,
  paymentDate: null,
  createdAt: null,
  createdBy: 0,
  updatedAt: null,
  updatedBy: 0,
  isDeleted: false,
  isChequeCleared: false,
  chequeRoutingNo: 0,
  chequeNo: 0,
  chequeTrackingNo: '',
  zelleId: '',
};

const emptyCustomerForm = {
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
  createdBy: 0,
  createdByName: '',
  createdDate: '',
  salesPerson: 0,
  salesPersonName: '',
};

// Subscription length is sold in quarterly steps: 3, 6, 9 ... 36 months.
const SUBSCRIPTION_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 3);

const CreateOrderPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const paymentFromState = location.state?.payment || null;
  const orderDataFromState = location.state?.orderData || null;
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get('id');
  const orderIdParam = searchParams.get('orderId');
  const customerIdParam = searchParams.get('customerId');
  const leadIdParam = searchParams.get('leadId');
  const numericId = idParam ? Number(idParam) : 0;
  const numericOrderId = orderIdParam ? Number(orderIdParam) : 0;
  const numericCustomerId = customerIdParam ? Number(customerIdParam) : 0;
  const numericLeadId = leadIdParam ? Number(leadIdParam) : 0;
  const leadIdFromState = Number(location.state?.leadId || 0);
  const initialLeadId = leadIdFromState || numericLeadId || Number(orderDataFromState?.leadId || 0);
  const paymentIdForEdit = numericId || paymentFromState?.paymentId || 0;
  const isOrderEditMode = searchParams.get('mode') === 'edit' || !!location.state?.editOrderMode;
  const orderIdForEdit = isOrderEditMode ? (numericOrderId || Number(orderDataFromState?.orderId) || 0) : 0;
  const isEditMode = !!(location.state?.isEditMode || paymentIdForEdit);
  const isAddPaymentMode = !isOrderEditMode && !isEditMode && (!!location.state?.addPaymentMode || (!!numericOrderId && !Number.isNaN(numericOrderId)));
  const [editingOrder, setEditingOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(isOrderEditMode);
  const [orderLoadError, setOrderLoadError] = useState('');
  const [paths, setPaths] = useState({
    orders: '/Orders',
    products: '/Orders/Products',
    customer: '/Customer',
  });

  useEffect(() => {
    let mounted = true;

    const loadPaths = async () => {
      const resolved = await resolveDynamicPaths({
        orders: '/Orders',
        products: '/Orders/Products',
        customer: '/Customer',
      });
      if (!mounted) return;
      setPaths(resolved);
    };

    loadPaths();
    return () => {
      mounted = false;
    };
  }, []);

  const {
    loading: permissionsLoading,
    canView: canViewOrders,
    canAdd,
    canUpdate,
    canDelete,
  } = usePageCrudPermissions({ path: paths.orders });

  const {
    loading: productsPermsLoading,
    canAdd: canAddProducts,
  } = usePageCrudPermissions({ path: paths.products });

  const {
    loading: productsCodesLoading,
    has: hasProductCode,
  } = usePagePermissionCodes({ path: paths.products });

  const {
    loading: ordersCodesLoading,
    has: hasOrderCode,
  } = usePagePermissionCodes({ path: paths.orders });

  const {
    loading: customerPermsLoading,
    canAdd: canAddCustomer,
    canUpdate: canUpdateCustomer,
  } = usePageCrudPermissions({ path: paths.customer });

  // A user can be allowed to create a customer from inside the order flow via
  // the standalone `Add_Customer` code, without having the Customer page itself
  // granted â€” so read the code directly instead of relying only on page CRUD.
  const canAddCustomerByCode = useMemo(() => {
    const granted = new Set(
      permissionService
        .getUserPermissionCodes()
        .map((code) => String(code || '').trim().toLowerCase())
        .filter(Boolean),
    );
    return ['add_customer', 'addcustomer'].some((code) => granted.has(code));
  }, []);

  const canCreateCustomer = canAddCustomerByCode || (!customerPermsLoading && canAddCustomer);

  const labelClass = 'block mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300';
  const inputClass =
    'w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400';
  const inputCompactClass =
    'w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400';
  const textareaClass =
    'w-full min-h-[90px] px-3 py-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-y dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400';
  // Keep all dropdown triggers consistent with inputs on this page
  const selectTriggerClass = `${inputCompactClass} font-medium`;
  const selectTriggerCompactClass = selectTriggerClass;
  const [products, setProducts] = useState([]);
  const [productDropdownItems, setProductDropdownItems] = useState([]);
  const [productCache, setProductCache] = useState({});
  const [search, setSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingProductDropdown, setLoadingProductDropdown] = useState(false);
  const [productsModalOpen, setProductsModalOpen] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [productPriceOverrides, setProductPriceOverrides] = useState({});
  const [selectedProductDropdownId, setSelectedProductDropdownId] = useState('');

  const [customItems, setCustomItems] = useState([]);
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [productSelectSearchText, setProductSelectSearchText] = useState('');
  const [customItemDraft, setCustomItemDraft] = useState({
    name: '',
    productType: '',
    price: '',
    quantity: 1,
    imageUrl: '',
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerRebuilding, setCustomerRebuilding] = useState(false);
  const customerSearchAbortRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);

  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  // Guards the one-shot Add Customer open when the page is reached from a lead.
  const leadAddCustomerOpenedRef = useRef(false);
  const [customerFormData, setCustomerFormData] = useState(emptyCustomerForm);
  const [customerCountries, setCustomerCountries] = useState([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountType, setDiscountType] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  // Starts empty (not 0) so the required field doesn't look pre-filled.
  const [subscriptionMonths, setSubscriptionMonths] = useState('');
  const [originalSubscriptionMonths, setOriginalSubscriptionMonths] = useState(0);
  // True when the "Custom" box is picked, which swaps the preset boxes for a
  // free-typed month count.
  const [subscriptionCustom, setSubscriptionCustom] = useState(false);

  const [brands, setBrands] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [loadingBrandGateways, setLoadingBrandGateways] = useState(false);
  const [gatewayPaymentTypes, setGatewayPaymentTypes] = useState([]);
  // The unfiltered gateway list from the lookup fetch. Kept so that clearing the
  // brand can restore it without re-requesting what we already hold.
  const allGatewaysRef = useRef([]);
  // gatewayId -> brandId. See the effect that fills it for why this cannot come
  // from the dropdown endpoint.
  const [gatewayBrandById, setGatewayBrandById] = useState(() => new Map());
  const [cardTypes, setCardTypes] = useState([]);
  // Sale Types setting, only so a new payment carries the same saleType the
  // Orders payment modal sends. There is no picker for it here: this page only
  // ever creates ordinary sales, never refunds.
  const [saleTypes, setSaleTypes] = useState([]);
  const [discountTypeOptions, setDiscountTypeOptions] = useState([]);
  const [salesShareTypeOptions, setSalesShareTypeOptions] = useState([]);
  const [salesPersons, setSalesPersons] = useState([]);
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState(0);
  const [showShareSale, setShowShareSale] = useState(true);
  const [shareSaleModalOpen, setShareSaleModalOpen] = useState(false);
  const [shareSalesPersonTypeId, setShareSalesPersonTypeId] = useState(0);
  const [shareSaleRows, setShareSaleRows] = useState([]);
  const [salesPersonSearchText, setSalesPersonSearchText] = useState('');

  // The order and Add Customer forms must always expose the complete active
  // Sales Agent + Sales Manager list, regardless of the signed-in user's role.
  const canPickSalesPerson = true;
  const currentUserId = Number(localStorage.getItem('userId') || 0);
  const currentUserName = localStorage.getItem('userName') || '';

  const mergeSalesPersons = useCallback((nextUsers = []) => {
    setSalesPersons((prev) => {
      const map = new Map();

      (Array.isArray(prev) ? prev : []).forEach((user) => {
        const userId = Number(user?.userId ?? user?.UserId ?? user?.id) || 0;
        if (userId > 0) {
          map.set(userId, user);
        }
      });

      (Array.isArray(nextUsers) ? nextUsers : []).forEach((user) => {
        const userId = Number(user?.userId ?? user?.UserId ?? user?.id) || 0;
        if (userId > 0) {
          map.set(userId, { ...map.get(userId), ...user });
        }
      });

      return Array.from(map.values());
    });
  }, []);

  const fetchShareSaleUsers = useCallback(
    async (searchText) => {
      const query = String(searchText || '').trim();
      if (!query) return;

      try {
        mergeSalesPersons(await searchSalesPersonUsers(query, { pageSize: 200 }));
      } catch (error) {
        console.error('Failed to search Share Sale users', error);
      }
    },
    [mergeSalesPersons],
  );

  const [activeTab, setActiveTab] = useState('card');
  const [payment, setPayment] = useState(emptyPayment);
  const [cardTypeTouched, setCardTypeTouched] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [deletePaymentConfirmOpen, setDeletePaymentConfirmOpen] = useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  const [formErrors, setFormErrors] = useState({});

  const getError = useCallback((key) => {
    if (!key) return '';
    return String(formErrors?.[key] || '');
  }, [formErrors]);

  const clearError = useCallback((key) => {
    if (!key) return;
    setFormErrors((prev) => {
      if (!prev || !prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const withErrorClass = useCallback((baseClass, errorKeyOrMessage) => {
    const hasError = !!errorKeyOrMessage;
    if (!hasError) return baseClass;
    return `${baseClass} border-red-400 focus:border-red-500 focus:ring-red-500/30`;
  }, []);

  const FieldError = ({ errorKey }) => {
    const message = getError(errorKey);
    if (!message) return null;
    return <div className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{message}</div>;
  };

  const paymentTypeFromTab = useCallback((tab) => {
    if (tab === 'card') return 'Card';
    if (tab === 'bank') return 'Bank';
    if (tab === 'cheque') return 'Cheque';
    if (tab === 'zelle') return 'Zelle';
    if (tab === 'paypal') return 'PayPal';
    return '';
  }, []);

  const getGatewayIdValue = useCallback(
    (gateway) => Number(gateway?.gatewayId ?? gateway?.GatewayId ?? gateway?.getwayId ?? gateway?.GetwayId ?? gateway?.id) || 0,
    [],
  );

  const getGatewayNameValue = useCallback(
    (gateway) => String(gateway?.gatewayName ?? gateway?.GatewayName ?? gateway?.getwayName ?? gateway?.GetwayName ?? gateway?.name ?? '').trim(),
    [],
  );

  const getGatewayBrandIdValue = useCallback(
    (gateway) => Number(gateway?.brandId ?? gateway?.BrandId) || 0,
    [],
  );

  const activeGatewayPaymentTypeRecords = useMemo(() => {
    const source = Array.isArray(gatewayPaymentTypes) ? gatewayPaymentTypes : [];
    const normalized = [];

    source.forEach((record) => {
      const gatewayId = Number(
        record?.gatewayId ?? record?.GatewayId ?? record?.getwayId ?? record?.GetwayId,
      ) || 0;
      if (!gatewayId) return;
      if (record?.isActive === false) return;

      const paymentTypeIds = Array.isArray(record?.paymentTypeIds)
        ? record.paymentTypeIds
        : (record?.paymentTypeId != null ? [record.paymentTypeId] : []);

      const nameParts = String(record?.paymentTypeName ?? record?.PaymentTypeName ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      const normalizedIds = paymentTypeIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

      if (normalizedIds.length === 0) {
        normalized.push({
          ...record,
          gatewayId,
          paymentTypeName: nameParts[0] || String(record?.paymentTypeName ?? record?.PaymentTypeName ?? '').trim(),
        });
        return;
      }

      normalizedIds.forEach((paymentTypeId, index) => {
        normalized.push({
          ...record,
          gatewayId,
          paymentTypeId,
          paymentTypeName: nameParts[index] || nameParts[0] || String(paymentTypeId),
        });
      });
    });

    return normalized;
  }, [gatewayPaymentTypes]);

  // Roles with a picker must explicitly choose a Sales Agent/Manager. Other
  // roles file the order under the logged-in user, matching the reference rule.
  useEffect(() => {
    if (isEditMode) return;
    if (canPickSalesPerson) return;
    if (!currentUserId) return;
    if (selectedSalesPersonId) return;
    setSelectedSalesPersonId(currentUserId);
  }, [isEditMode, canPickSalesPerson, currentUserId, selectedSalesPersonId]);

  const canAddProductsByCode = !productsCodesLoading && hasProductCode('Add_Product');
  const canAddOrdersByCode = !ordersCodesLoading && hasOrderCode('Save_Order');
  const canAddOrderPayment = !ordersCodesLoading && hasOrderCode('Add_Order_Payment');
  const canUpdateOrderPayment = !ordersCodesLoading && hasOrderCode('Update_Order_Payment');
  const canDeleteOrderPayment = !ordersCodesLoading && hasOrderCode('Delete_Order_Payment');
  const canAddCustomItem =
    canAddProductsByCode || (!productsPermsLoading && canAddProducts);

  const filterProductsBySearch = useCallback((items, text) => {
    const query = String(text || '').trim().toLowerCase();
    if (!query) return items;
    return (items || []).filter((p) => {
      const values = [p?.name, p?.description, p?.productType, p?.price]
        .map((v) => String(v ?? '').toLowerCase());
      return values.some((v) => v.includes(query));
    });
  }, []);

  const fetchProducts = useCallback(
    async (text) => {
      if (isEditMode || isAddPaymentMode) return;
      // Load the product dropdown for every role, regardless of permissions.
      // Saving/updating the order remains permission-protected elsewhere.
      try {
        setLoadingProducts(true);
        setLoadingProductDropdown(true);
        const list = await productService.getProductDropdown({
          Text: String(text || '').trim(),
          PageNumber: 1,
          PageSize: 100,
          SortProperty: 'name',
          IsDescending: false,
        });
        const active = Array.isArray(list) ? list.filter((p) => p?.isActive !== false) : [];
        const filtered = filterProductsBySearch(active, text);
        setProductDropdownItems(active);
        setProducts(filtered);
        setProductCache((prev) => {
          const next = { ...prev };
          active.forEach((p) => {
            if (p?.productId != null) next[p.productId] = p;
          });
          return next;
        });
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        setLoadingProducts(false);
        setLoadingProductDropdown(false);
      }
    },
    [isEditMode, isAddPaymentMode, filterProductsBySearch],
  );

  const filteredProductDropdownItems = useMemo(
    () => filterProductsBySearch(productDropdownItems, productSelectSearchText),
    [filterProductsBySearch, productDropdownItems, productSelectSearchText],
  );

  // Load products once on page load (create mode)
  useEffect(() => {
    if (isEditMode || isAddPaymentMode) return;
    fetchProducts('');
  }, [isEditMode, isAddPaymentMode, fetchProducts]);

  // Auto-select the first product and add qty 1 when opening create order.
  useEffect(() => {
    if (isEditMode || isAddPaymentMode || isOrderEditMode) return;
    if (!Array.isArray(productDropdownItems) || productDropdownItems.length === 0) return;

    const firstProductId = Number(productDropdownItems[0]?.productId) || 0;
    if (!firstProductId) return;

    setSelectedProductDropdownId((prev) => prev || String(firstProductId));
    setQuantities((prev) => {
      const hasSelectedProduct = Object.values(prev).some((q) => Number(q) > 0);
      if (hasSelectedProduct) return prev;
      return { ...prev, [firstProductId]: 1 };
    });
  }, [productDropdownItems, isEditMode, isAddPaymentMode, isOrderEditMode]);

  // While Browse Products modal is open, refetch on search changes
  useEffect(() => {
    if (!productsModalOpen || isEditMode || isAddPaymentMode) return;
    const id = setTimeout(() => {
      fetchProducts(search);
    }, 300);
    return () => clearTimeout(id);
  }, [search, productsModalOpen, isEditMode, isAddPaymentMode, fetchProducts]);

  // Fetch payment details by paymentId (edit mode)
  useEffect(() => {
    const loadPayment = async () => {
      if (!isEditMode) return;
      if (!paymentIdForEdit) return;
      try {
        setLoadingPayment(true);
        const data = await paymentService.getPaymentById(paymentIdForEdit);
        if (data) {
          setPayment((prev) => ({ ...prev, ...data }));
          if (data.paymentType) {
            const type = data.paymentType.toLowerCase().trim();
            if (type === 'card' || type === 'credit card' || type === 'debit card') setActiveTab('card');
            else if (type === 'bank' || type === 'bank transfer' || type === 'wire') setActiveTab('bank');
            else if (type === 'cheque' || type === 'check') setActiveTab('cheque');
            else if (type === 'zelle') setActiveTab('zelle');
            else if (type === 'paypal' || type === 'pay pal') setActiveTab('paypal');
          }
        }
      } catch (err) {
        console.error('Failed to load payment', err);
      } finally {
        setLoadingPayment(false);
      }
    };
    loadPayment();
  }, [isEditMode, paymentIdForEdit]);

  // If a payment was passed from navigation state (Edit from Orders table), hydrate from that
  useEffect(() => {
    if (!paymentFromState) return;

    setPayment((prev) => ({ ...prev, ...paymentFromState }));

    if (paymentFromState.paymentType) {
      const type = paymentFromState.paymentType.toLowerCase().trim();

      if (type === 'card' || type === 'credit card' || type === 'debit card') {
        setActiveTab('card');
      } else if (type === 'bank' || type === 'bank transfer' || type === 'wire') {
        setActiveTab('bank');
      } else if (type === 'cheque' || type === 'check') {
        setActiveTab('cheque');
      } else if (type === 'zelle') {
        setActiveTab('zelle');
      } else if (type === 'paypal' || type === 'pay pal') {
        setActiveTab('paypal');
      } else {
        setActiveTab('card'); // default to card
      }
    }
  }, [paymentFromState]);

  // If opened from Orders table to add a NEW payment to an existing order
  useEffect(() => {
    if (!isAddPaymentMode) return;

    const orderIdFromState = Number(orderDataFromState?.orderId || 0);
    const nextOrderId = Number(numericOrderId) || orderIdFromState;
    if (!nextOrderId) return;

    setPayment((prev) => ({
      ...prev,
      orderId: nextOrderId,
      paymentId: 0,
    }));

    // Best-effort: preselect customer & order notes if present in the order data
    const customerId = Number(orderDataFromState?.customerId || 0);
    if (customerId) {
      setSelectedCustomer((prev) => {
        if (prev?.customerId === customerId) return prev;
        return {
          customerId,
          name: orderDataFromState?.customerName || '',
          customerName: orderDataFromState?.customerName || '',
        };
      });
    }

    if (orderDataFromState?.notes) {
      setOrderNotes(orderDataFromState.notes);
    }
  }, [isAddPaymentMode, numericOrderId, orderDataFromState]);

  // Initialize order data when in edit mode
  useEffect(() => {
    if (!isEditMode || !orderDataFromState) return;

    // Set order notes
    if (orderDataFromState.notes) {
      setOrderNotes(orderDataFromState.notes);
    }

    // Set discount fields
    if (orderDataFromState.discountAmount) {
      setDiscountAmount(orderDataFromState.discountAmount);
    }
    if (orderDataFromState.discountType) {
      setDiscountType(orderDataFromState.discountType);
    }
    if (orderDataFromState.discountCode) {
      setDiscountCode(orderDataFromState.discountCode);
    }

    // Set sales person
    if (orderDataFromState.salesPersonId) {
      setSelectedSalesPersonId(orderDataFromState.salesPersonId);
    }

    // Set customer if available
    if (orderDataFromState.customerId) {
      const customerData = {
        customerId: orderDataFromState.customerId,
        name: orderDataFromState.customerName,
        customerName: orderDataFromState.customerName,
      };
      setSelectedCustomer(customerData);
    }

    // Set order items
    if (orderDataFromState.orderItems && Array.isArray(orderDataFromState.orderItems)) {
      const items = orderDataFromState.orderItems.map(item => ({
        id: item.orderItemId || Date.now() + Math.random(),
        productId: item.productId || 0,
        name: item.productName || '',
        productType: item.productType || '',
        price: item.unitPrice || 0,
        quantity: item.quantity || 1,
        subscriptionMonths: item.subscriptionMonths || 0,
        isCustom: true,
        imageUrl: '',
      }));
      setCustomItems(items);
    }
  }, [isEditMode, orderDataFromState]);

  useEffect(() => {
    if (!isOrderEditMode) return;
    const controller = new AbortController();
    const loadOrder = async () => {
      setLoadingOrder(true);
      setOrderLoadError('');
      try {
        if (!orderIdForEdit) throw new Error('Order ID is required.');
        const saved = await orderService.getOrderById(orderIdForEdit, controller.signal);
        const editor = normalizeOrderForEditor(saved);
        if (controller.signal.aborted) return;
        setEditingOrder(editor.order);
        setSelectedCustomer(editor.customer);
        setSelectedSalesPersonId(Number(editor.order.salesPersonId) || 0);
        if (Number(editor.order.salesPersonId)) {
          mergeSalesPersons([{
            userId: Number(editor.order.salesPersonId),
            fullName: editor.order.salesPersonName || editor.order.salesPerson?.fullName || `User ${editor.order.salesPersonId}`
          }]);
        }
        setOrderNotes(editor.order.notes || '');
        setDiscountAmount(Number(editor.order.discountAmount) || 0);
        setDiscountType(editor.order.discountType || 'Fixed');
        setDiscountCode(editor.order.discountCode || '');
        setDiscountPercent(editor.discountPercent);
        setSubscriptionMonths(editor.subscriptionMonths || '');
        setOriginalSubscriptionMonths(editor.subscriptionMonths);
        setSubscriptionCustom(editor.subscriptionMonths > 0 && !SUBSCRIPTION_MONTH_OPTIONS.includes(editor.subscriptionMonths));
        setCustomItems(editor.items);
        setQuantities({});
        setShareSalesPersonTypeId(Number(editor.order.shareTypeId) || 0);
        // Load the full saved customer instead of relying on the table's name.
        if (Number(editor.customer.customerId)) {
          try {
            const customer = await customerService.getCustomerById(editor.customer.customerId);
            if (!controller.signal.aborted && customer) setSelectedCustomer(customer);
          } catch (error) {
            if (!controller.signal.aborted) toast.error(getApiErrorMessage(error, 'Some customer details could not be loaded.'));
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = getApiErrorMessage(error, 'Failed to load the saved order.');
        setOrderLoadError(message);
        toast.error(message);
      } finally {
        if (!controller.signal.aborted) setLoadingOrder(false);
      }
    };
    loadOrder();
    return () => controller.abort();
  }, [isOrderEditMode, orderIdForEdit, mergeSalesPersons]);

  // If opened from Customer table (Create Order for a specific customer)
  // auto-load that customer and set it as selected.
  useEffect(() => {
    if (isEditMode) return;
    if (!numericCustomerId || Number.isNaN(numericCustomerId)) return;

    let cancelled = false;
    const loadCustomer = async () => {
      try {
        const customer = await customerService.getCustomerById(numericCustomerId);
        if (cancelled) return;
        if (customer) {
          setSelectedCustomer(customer);
        } else {
          toast.error('Customer not found');
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(err, 'Failed to load customer'));
        }
      }
    };

    loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, numericCustomerId]);

  const fetchCustomersForModal = useCallback(
    async (text) => {
      if (!customerModalOpen) return;

      const q = String(text || '').trim();
      if (!q) {
        customerSearchAbortRef.current?.abort();
        setCustomers([]);
        setLoadingCustomers(false);
        return;
      }

      customerSearchAbortRef.current?.abort();
      const controller = new AbortController();
      customerSearchAbortRef.current = controller;

      try {
        setLoadingCustomers(true);
        const result = await customerService.searchCustomers(q, 1, 10, controller.signal);
        if (!controller.signal.aborted) {
          setCustomers(Array.isArray(result?.data) ? result.data : []);
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error('Failed to load customers', err);
        setCustomers([]);
      } finally {
        if (customerSearchAbortRef.current === controller) {
          customerSearchAbortRef.current = null;
          setLoadingCustomers(false);
        }
      }
    },
    [customerModalOpen],
  );

  const rebuildCustomerIndex = useCallback(async () => {
    try {
      if (customerPermsLoading) {
        toast.error('Permissions are still loading. Please try again.');
        return;
      }
      if (!canUpdateCustomer) {
        toast.error("You don't have permission to update customers.");
        return;
      }

      setCustomerRebuilding(true);
      await customerService.rebuildSearchIndex();
      await fetchCustomersForModal(customerSearch);
      toast.success('Customers refreshed');
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Failed to refresh customers');
    } finally {
      setCustomerRebuilding(false);
    }
  }, [canUpdateCustomer, customerPermsLoading, customerSearch, fetchCustomersForModal]);

  // Fetch customers only when searching (no auto-select shown in UI)
  useEffect(() => {
    if (!customerModalOpen) return;
    const id = setTimeout(() => {
      fetchCustomersForModal(customerSearch);
    }, 350);

    return () => {
      clearTimeout(id);
      customerSearchAbortRef.current?.abort();
    };
  }, [customerSearch, customerModalOpen, fetchCustomersForModal]);

  // Fetch brands, gateways, sales persons, and settings-driven dropdowns
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const lookupResults = await Promise.allSettled([
          brandService.getBrandDropdown(),
          gatewayService.getGatewayDropdown({ PageNumber: 1, PageSize: 200, SortProperty: 'gatewayId', IsDescending: false }),
          // Sale With / Sales Person offer active Sales Agents and Managers.
          fetchSalesPersonList({ pageSize: 1000 }),
          orderLookupService.getDiscountTypes(),
          orderLookupService.getCardTypes(),
          orderLookupService.getSalesShareTypes(),
          gatewayService.getGatewayPaymentTypes(),
          orderLookupService.getSaleTypes(),
        ]);

        const lookupNames = [
          'brands',
          'gateways',
          'sales people',
          'discount types',
          'card types',
          'share types',
          'gateway payment types',
          'sale types',
        ];
        const failedLookups = lookupResults
          .map((result, index) => ({ result, name: lookupNames[index] }))
          .filter(({ result }) => result.status === 'rejected');
        failedLookups.forEach(({ result, name }) => {
          console.error(`Failed to load ${name}`, result.reason);
        });
        if (failedLookups.length > 0) {
          toast.error(`Some order options could not be loaded: ${failedLookups.map(({ name }) => name).join(', ')}`);
        }

        const valueAt = (index, fallback) =>
          lookupResults[index]?.status === 'fulfilled' ? lookupResults[index].value : fallback;
        const brandResult = valueAt(0, []);
        const gatewayResult = valueAt(1, { data: [] });
        const userResult = valueAt(2, []);
        const discountTypeResult = valueAt(3, { data: [] });
        const cardTypeResult = valueAt(4, { data: [] });
        const salesShareTypeResult = valueAt(5, { data: [] });
        const gatewayPaymentTypeResult = valueAt(6, { data: [] });
        const saleTypeResult = valueAt(7, { data: [] });
        setBrands(Array.isArray(brandResult) ? brandResult : brandResult?.data || []);

        const gatewayList = gatewayResult.data || [];
        allGatewaysRef.current = gatewayList;
        setGateways(gatewayList);

        // Already filtered by role name and de-duplicated.
        mergeSalesPersons(Array.isArray(userResult) ? userResult : []);

        const saleTypeValues = Array.isArray(saleTypeResult?.data) ? saleTypeResult.data : [];
        setSaleTypes(
          saleTypeValues
            .filter((v) => v?.isActive !== false)
            .map((v) => ({
              id: Number(v?.settingValueId ?? v?.id ?? v?.valueId) || 0,
              name: String(v?.settingValueText ?? v?.name ?? v?.text ?? '').trim(),
            }))
            .filter((v) => v.id > 0 && v.name),
        );

        const gatewayPaymentTypeList = gatewayPaymentTypeResult?.data || [];
        setGatewayPaymentTypes(Array.isArray(gatewayPaymentTypeList) ? gatewayPaymentTypeList : []);

        const discountValues = Array.isArray(discountTypeResult?.data) ? discountTypeResult.data : [];
        const discountOptions = discountValues
          .filter((v) => v?.isActive !== false)
          .map((v) => ({
            id: Number(v?.settingValueId ?? v?.id ?? v?.valueId) || 0,
            name: String(v?.settingValueText ?? v?.name ?? v?.text ?? '').trim(),
          }))
          .filter((v) => v.id > 0 && v.name);
        setDiscountTypeOptions(discountOptions);

        const cardValues = Array.isArray(cardTypeResult?.data) ? cardTypeResult.data : [];
        const cardOptions = cardValues
          .filter((v) => v?.isActive !== false)
          .map((v) => ({
            id: v?.settingValueId ?? v?.id ?? v?.valueId ?? v?.name,
            name: String(v?.settingValueText ?? v?.name ?? v?.label ?? v?.text ?? '').trim(),
          }))
          .filter((v) => v.name);
        setCardTypes(cardOptions);

        const shareValues = Array.isArray(salesShareTypeResult?.data) ? salesShareTypeResult.data : [];
        const shareOptions = shareValues
          .filter((v) => v?.isActive !== false)
          .map((v) => ({
            id: Number(v?.settingValueId ?? v?.id ?? v?.valueId) || 0,
            name: String(v?.settingValueText ?? v?.name ?? v?.text ?? '').trim(),
          }))
          .filter((v) => v.id > 0 && v.name);
        setSalesShareTypeOptions(shareOptions);
      } catch (err) {
        console.error('Failed to load brand/gateway/user/settings data', err);
      }
    };

    fetchLookups();
  }, []);

  // Default discount type to "Fixed" on new orders once the options are loaded.
  useEffect(() => {
    if (isEditMode || isOrderEditMode) return;
    if (discountType) return;
    if (!Array.isArray(discountTypeOptions) || discountTypeOptions.length === 0) return;

    const fixedOption = discountTypeOptions.find((opt) =>
      String(opt?.name || '').trim().toLowerCase().includes('fixed'),
    );

    if (fixedOption?.name) {
      setDiscountType(fixedOption.name);
    }
  }, [discountTypeOptions, discountType, isEditMode, isOrderEditMode]);

  useEffect(() => {
    let cancelled = false;

    const fetchPaymentGateways = async () => {
      setGateways([]);
      setLoadingBrandGateways(true);
      try {
        const brandId = Number(payment?.brandId) || 0;

        // No brand picked: the lookup fetch already holds the unfiltered list,
        // so reuse it instead of firing the same request a second time.
        if (brandId <= 0) {
          return;
        }

        // Only this brand's gateways (exact brandId match from the Gateway records).
        const response = await gatewayService.getBrandGateways(brandId);

        if (!cancelled) {
          setGateways(response.data || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load gateways for selected brand', error);
          toast.error(getApiErrorMessage(error, 'Failed to load gateways for the selected brand.'));
        }
      } finally {
        if (!cancelled) setLoadingBrandGateways(false);
      }
    };

    fetchPaymentGateways();

    return () => {
      cancelled = true;
    };
  }, [payment?.brandId]);

  const handleQtyChange = (productId, delta) => {
    clearError('orderItems');
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleProductDropdownSelect = (value) => {
    setSelectedProductDropdownId(value);
    setProductSelectSearchText('');
    clearError('orderItems');
    const productId = Number(value) || 0;
    if (!productId) return;

    setQuantities((prev) => {
      const current = Number(prev[productId]) || 0;
      if (current > 0) return prev;
      return { ...prev, [productId]: 1 };
    });
  };

  const handleCustomItemField = (field) => (e) => {
    const value = field === 'price' || field === 'quantity' ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value;
    setCustomItemDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleCustomItemQtyChange = (id, delta) => {
    clearError('orderItems');
    setCustomItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(0, (item.quantity || 0) + delta) }
          : item,
      ),
    );
  };

  const handleRemoveCustomItem = (id) => {
    clearError('orderItems');
    setCustomItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddCustomItem = async () => {
    clearError('orderItems');
    const name = customItemDraft.name.trim();
    const price = parseFloat(customItemDraft.price) || 0;
    const quantity = parseInt(customItemDraft.quantity, 10) || 1;

    if (!name) {
      return;
    }

    if (permissionsLoading) {
      toast.error('Permissions are still loading. Please try again.');
      return;
    }

    const canMutateOrder = isEditMode || isOrderEditMode ? canUpdate : canAdd;
    if (!canMutateOrder) {
      toast.error(isEditMode ? "You don't have permission to update orders." : "You don't have permission to create orders.");
      return;
    }

    // If user cannot add Products, don't create a real product row.
    // Still allow adding as a local custom line item (order-only).
    if (productsPermsLoading || !canAddProducts) {
      const newItem = {
        id: Date.now(),
        productId: 0,
        name,
        productType: customItemDraft.productType?.trim() || 'Custom Item',
        price,
        quantity,
        subscriptionMonths: 0,
        isCustom: true,
        imageUrl: customItemDraft.imageUrl?.trim() || '',
      };

      setCustomItems((prev) => [...prev, newItem]);
      setCustomItemDraft({ name: '', productType: '', price: '', quantity: 1, imageUrl: '' });
      setCustomItemModalOpen(false);
      toast.success('Added as custom item');
      return;
    }

    // Create the custom item as a real Product so it shows up in ProductsTable.
    // If the API fails, fall back to adding a local custom line item only.
    try {
      const createdBy = Number(localStorage.getItem('userId') || 0);
      const createdByName = localStorage.getItem('userName') || '';
      const createdDate = new Date().toISOString();

      const payload = {
        productId: 0,
        name,
        description: '',
        price,
        productType: customItemDraft.productType?.trim() || 'Custom Item',
        photo: customItemDraft.imageUrl?.trim() || '',
        isActive: true,
        createdBy,
        createdByName,
        createdDate,
      };

      const created = await productService.createProduct(payload);
      if (!created?.productId) {
        throw new Error('Product created but no productId returned');
      }

      setProductCache((prev) => ({ ...prev, [created.productId]: created }));
      setQuantities((prev) => ({
        ...prev,
        [created.productId]: (Number(prev[created.productId]) || 0) + Math.max(1, quantity),
      }));

      toast.success('Product created and added to order');
      setCustomItemDraft({ name: '', productType: '', price: '', quantity: 1, imageUrl: '' });
      setCustomItemModalOpen(false);
    } catch (err) {
      console.error('Failed to create product from custom item', err);
      toast.error(getApiErrorMessage(err, 'Failed to add to Products. Added as custom item only.'));

      const newItem = {
        id: Date.now(),
        productId: 0,
        name,
        productType: customItemDraft.productType?.trim() || 'Custom Item',
        price,
        quantity,
        subscriptionMonths: 0,
        isCustom: true,
        imageUrl: customItemDraft.imageUrl?.trim() || '',
      };

      setCustomItems((prev) => [...prev, newItem]);
      setCustomItemDraft({ name: '', productType: '', price: '', quantity: 1, imageUrl: '' });
      setCustomItemModalOpen(false);
    }
  };

  const orderLines = useMemo(() => {
    const productLines = Object.entries(quantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([productIdRaw, qtyRaw]) => {
        const productId = Number(productIdRaw);
        const qty = Number(qtyRaw) || 0;
        const p = productCache[productId] || products.find((x) => x.productId === productId);
        if (!p) return null;

        const basePrice = Number(p.price) || 0;
        const overrideRaw = productPriceOverrides?.[productId];
        const parsedOverride =
          overrideRaw === undefined || overrideRaw === '' ? basePrice : Number.parseFloat(overrideRaw);
        const paidPrice = Number.isFinite(parsedOverride) ? parsedOverride : basePrice;
        // A price typed below the catalog (main) price is treated as a discount:
        // the catalog price stays in the subtotal and the gap becomes a discount.
        const isDiscounted = paidPrice < basePrice;
        const lineUnitPrice = isDiscounted ? basePrice : paidPrice;
        const lineSavings = isDiscounted ? (basePrice - paidPrice) * qty : 0;
        return {
          ...p,
          price: lineUnitPrice,
          basePrice,
          paidPrice,
          lineSavings,
          quantity: qty,
          subscriptionMonths: Number(subscriptionMonths) || 0,
          totalPrice: qty * lineUnitPrice,
        };
      })
      .filter(Boolean);

    const customLines = customItems.map((item) => ({
      ...item,
      subscriptionMonths: isOrderEditMode && Number(item.productId) > 0 && Number(subscriptionMonths) !== originalSubscriptionMonths ? Number(subscriptionMonths) || 0 : item.subscriptionMonths,
      totalPrice: (item.quantity || 0) * (item.price || 0),
    }));

    return [...productLines, ...customLines];
  }, [products, productCache, quantities, customItems, subscriptionMonths, productPriceOverrides, isOrderEditMode, originalSubscriptionMonths]);

  const orderSummary = useMemo(() => {
    const subtotal = orderLines.reduce((sum, line) => sum + line.totalPrice, 0);
    const items = orderLines.reduce((sum, line) => sum + line.quantity, 0);
    const effectiveSubscriptionMonths = isEditMode
      ? orderLines.reduce((maxMonths, line) => Math.max(maxMonths, Number(line.subscriptionMonths) || 0), 0)
      : Number(subscriptionMonths) || 0;
    const discountTypeRaw = String(discountType || '').trim().toLowerCase();
    const isPercentDiscount =
      discountTypeRaw.includes('percent') ||
      discountTypeRaw.includes('percentage') ||
      discountTypeRaw.includes('%');

    const rawAmount = Number(discountAmount) || 0;
    const rawPercent = Number(discountPercent) || 0;
    const percent = isPercentDiscount ? Math.min(100, Math.max(0, rawPercent)) : 0;
    const computedDiscount = isPercentDiscount ? (subtotal * percent) / 100 : Math.max(0, rawAmount);
    const discount = Math.min(subtotal, Math.max(0, computedDiscount));
    const total = Math.max(0, subtotal - discount);
    return { subtotal, items, subscriptionMonths: effectiveSubscriptionMonths, discount, total };
  }, [orderLines, discountAmount, discountType, discountPercent, subscriptionMonths, isEditMode]);

  const isPercentDiscount = useMemo(() => {
    const discountTypeRaw = String(discountType || '').trim().toLowerCase();
    return discountTypeRaw.includes('percent') || discountTypeRaw.includes('percentage') || discountTypeRaw.includes('%');
  }, [discountType]);

  // Total saved across all product lines whose price was set below catalog.
  const productSavings = useMemo(
    () => orderLines.reduce((sum, line) => sum + (Number(line.lineSavings) || 0), 0),
    [orderLines],
  );

  // When a product's price is lowered below catalog, mirror the saving into the
  // Discount fields as a Fixed discount with an auto "SAVE{amount}" code.
  // Only clears fields it previously auto-filled, so manual discounts are safe.
  const autoDiscountRef = useRef({ applied: false });
  useEffect(() => {
    const savings = Number(productSavings) || 0;
    if (savings > 0) {
      autoDiscountRef.current = { applied: true };
      setDiscountType((prev) => {
        const raw = String(prev || '').trim().toLowerCase();
        const isPercent = raw.includes('percent') || raw.includes('percentage') || raw.includes('%');
        if (prev && !isPercent) return prev;
        const fixedOption = discountTypeOptions.find((opt) =>
          String(opt?.name || '').trim().toLowerCase().includes('fixed'),
        );
        return fixedOption?.name || 'Fixed';
      });
      setDiscountAmount(savings);
      setDiscountCode(`SAVE${Math.round(savings)}`);
    } else if (autoDiscountRef.current.applied) {
      autoDiscountRef.current = { applied: false };
      setDiscountAmount(0);
      setDiscountCode((prev) => (String(prev || '').startsWith('SAVE') ? '' : prev));
    }
  }, [productSavings, discountTypeOptions]);

  // Typing a discount amount by hand fills the code the same way a product
  // price reduction does. A promo code the user typed themselves is left
  // untouched - only an empty box or a previous auto "SAVE..." code is rewritten.
  const applyAutoDiscountCode = useCallback((amount) => {
    const value = Number(amount) || 0;

    setDiscountCode((prev) => {
      const current = String(prev || '').trim();
      if (current && !current.toUpperCase().startsWith('SAVE')) return prev;
      return value > 0 ? `SAVE${Math.round(value)}` : '';
    });
  }, []);

  const totalAmountForPayment = useMemo(() => Number(orderSummary.total) || 0, [orderSummary.total]);

  // Build the authoritative gateway -> brand map from full Gateway records.
  // Dropdown rows are still used for display and remain the fallback below.
  useEffect(() => {
    let cancelled = false;

    const loadGatewayBrandMap = async () => {
      try {
        const response = await gatewayService.getGateways({
          PageNumber: 1,
          PageSize: 500,
          SortProperty: 'gatewayId',
          IsDescending: false,
        });

        const list = Array.isArray(response?.data) ? response.data : [];

        const map = new Map();
        list.forEach((gateway) => {
          const gatewayId = Number(
            gateway?.gatewayId ?? gateway?.GatewayId ?? gateway?.getwayId ?? gateway?.GetwayId ?? gateway?.id,
          ) || 0;
          const brandId = Number(gateway?.brandId ?? gateway?.BrandId) || 0;
          if (gatewayId > 0 && brandId > 0) map.set(gatewayId, brandId);
        });

        if (!cancelled) setGatewayBrandById(map);
      } catch (error) {
        console.error('Failed to load gateway brand mapping', error);
      }
    };

    loadGatewayBrandMap();

    return () => {
      cancelled = true;
    };
  }, []);

  const gatewayBrandIdByGatewayId = useMemo(() => {
    // Full /Gateway records first - they are the authoritative pairing. Then
    // the dropdown rows, then GatewayPaymentType, and finally by name.
    const brandMap = new Map(gatewayBrandById);

    (Array.isArray(gateways) ? gateways : []).forEach((gateway) => {
      const gatewayId = getGatewayIdValue(gateway);
      const brandId = getGatewayBrandIdValue(gateway);
      if (gatewayId > 0 && brandId > 0 && !brandMap.has(gatewayId)) {
        brandMap.set(gatewayId, brandId);
      }
    });

    activeGatewayPaymentTypeRecords.forEach((record) => {
      const gatewayId = Number(record?.gatewayId ?? record?.GatewayId ?? record?.getwayId ?? record?.GetwayId) || 0;
      const brandId = Number(record?.brandId ?? record?.BrandId) || 0;
      if (gatewayId > 0 && brandId > 0 && !brandMap.has(gatewayId)) {
        brandMap.set(gatewayId, brandId);
      }
    });

    // Last resort for gateways that arrive without a brand id: they are named
    // "<Payment type> - <Brand>", so match the name against the brand list.
    // Longest brand name first, so "QF360 Pro" wins over "QF360".
    const brandsByName = (Array.isArray(brands) ? brands : [])
      .map((brand) => ({
        id: Number(brand?.brandId ?? brand?.BrandId ?? brand?.id) || 0,
        name: String(
          brand?.brandName ?? brand?.BrandName ?? brand?.brandDisplayName ?? brand?.name ?? '',
        ).trim().toLowerCase(),
      }))
      .filter((brand) => brand.id > 0 && brand.name)
      .sort((a, b) => b.name.length - a.name.length);

    if (brandsByName.length > 0) {
      (Array.isArray(gateways) ? gateways : []).forEach((gateway) => {
        const gatewayId = getGatewayIdValue(gateway);
        if (!gatewayId || brandMap.has(gatewayId)) return;

        const gatewayName = getGatewayNameValue(gateway).toLowerCase();
        if (!gatewayName) return;

        const match = brandsByName.find((brand) => gatewayName.includes(brand.name));
        if (match) brandMap.set(gatewayId, match.id);
      });
    }

    return brandMap;
  }, [
    gatewayBrandById,
    gateways,
    brands,
    activeGatewayPaymentTypeRecords,
    getGatewayBrandIdValue,
    getGatewayIdValue,
    getGatewayNameValue,
  ]);

  // Safety net for a gateway that is already set with no brand beside it - an
  // order being edited, or a gateway picked before the map finished loading.
  // Only ever fills a blank brand.
  useEffect(() => {
    const gatewayId = Number(payment?.gatewayId) || 0;
    if (!gatewayId) return;
    if (Number(payment?.brandId) > 0) return;

    const inferredBrandId = Number(gatewayBrandIdByGatewayId.get(gatewayId)) || 0;
    if (!inferredBrandId) return;

    setPayment((prev) => (Number(prev.brandId) > 0 ? prev : { ...prev, brandId: inferredBrandId }));
    clearError('payment.brandId');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.gatewayId, payment?.brandId, gatewayBrandIdByGatewayId]);

  const selectedPaymentGateway = useMemo(
    () => (gateways || []).find((gateway) => getGatewayIdValue(gateway) === (Number(payment?.gatewayId) || 0)) || null,
    [gateways, payment?.gatewayId, getGatewayIdValue],
  );

  // The resolved map first, so a gateway whose dropdown row carries no brand id
  // still fills the brand in. Falls back to the row itself and finally to
  // whatever the payment already had.
  const inferredPaymentBrandId = useMemo(
    () =>
      Number(gatewayBrandIdByGatewayId.get(Number(payment?.gatewayId) || 0)) ||
      Number(selectedPaymentGateway?.brandId ?? selectedPaymentGateway?.BrandId ?? selectedPaymentGateway?.brand_id) ||
      Number(payment?.brandId) ||
      0,
    [gatewayBrandIdByGatewayId, selectedPaymentGateway, payment?.gatewayId, payment?.brandId],
  );

  const inferredPaymentBrandName = useMemo(() => {
    const brandId = inferredPaymentBrandId;
    if (!brandId) return '';
    const matchedBrand = (brands || []).find((brand) =>
      Number(brand?.brandId ?? brand?.BrandId ?? brand?.id) === brandId,
    );
    return matchedBrand?.brandName || matchedBrand?.name || '';
  }, [brands, inferredPaymentBrandId]);

  const paymentBrands = useMemo(() => (Array.isArray(brands) ? brands : []), [brands]);

  // Gateway selection never changes the payment method or hides its fields.
  const filteredGateways = useMemo(() => {
    const brandId = Number(payment.brandId) || 0;
    if (!brandId || loadingBrandGateways) return [];
    return (gateways || []).filter((gateway) => {
      const id = getGatewayIdValue(gateway);
      const gatewayBrandId = gatewayBrandIdByGatewayId.get(id) || getGatewayBrandIdValue(gateway);
      return gatewayBrandId === brandId
        && (gateway.isActive !== false || id === Number(payment.gatewayId));
    });
  }, [gateways, gatewayBrandIdByGatewayId, payment.brandId, payment.gatewayId, getGatewayIdValue, getGatewayBrandIdValue, loadingBrandGateways]);

  const handlePaymentTabChange = (tab) => {
    setActiveTab(tab);
    setPayment((prev) => changePaymentMethod(prev, tab));
    setFormErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith('payment.'))));
  };

  useEffect(() => {
    if (activeTab === 'card') return;
    setPayment((prev) => prev.gatewayId || prev.gatewayName ? { ...prev, gatewayId: 0, gatewayName: '' } : prev);
  }, [activeTab, payment.gatewayId, payment.gatewayName]);

  // Wipes the brand/gateway pair back to unselected - the way out of a wrong
  // pick, since choosing a brand filters the gateway list and choosing a gateway
  // fills the brand back in. Clearing the brand also re-runs the gateway fetch
  // below without a BrandId, restoring the full list.
  const clearPaymentBrandAndGateway = useCallback(() => {
    setPayment((prev) => ({ ...prev, brandId: 0, gatewayId: 0 }));
    clearError('payment.brandId');
    clearError('payment.gatewayId');
    clearError('payment.paymentType');
  }, [clearError]);

  // Keep the payment amount connected to the order total.
  // This effect runs only when the order total changes (product price/quantity
  // or discount edits). When it does, re-sync the payment amount to the new
  // total. Typing a (partial) amount does not change the total, so the effect
  // won't run and the typed value is preserved until the total changes again.
  useEffect(() => {
    if (isEditMode || isAddPaymentMode || isOrderEditMode) return;
    setPayment((prev) =>
      Number(prev.amount) === totalAmountForPayment
        ? prev
        : { ...prev, amount: totalAmountForPayment },
    );
  }, [isEditMode, isAddPaymentMode, isOrderEditMode, totalAmountForPayment]);

  const sanitizeAmountInput = (value) => {
    const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length <= 1) return cleaned;
    return `${parts[0]}.${parts.slice(1).join('')}`;
  };

  const handlePaymentField = (field) => (e) => {
    const rawValue = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    let value = rawValue;

    if (field === 'amount') {
      // Keep as string while editing so decimals like `12.` and `12.50` work.
      // Final payload already converts via Number(payment.amount).
      value = rawValue === '' || rawValue === null ? '' : sanitizeAmountInput(rawValue);
    } else if (
      ['gatewayId', 'brandId', 'chequeRoutingNo', 'chequeNo', 'createdBy', 'updatedBy'].includes(field)
    ) {
      value = rawValue === '' || rawValue === null ? 0 : Number(rawValue);
    }

    clearError(`payment.${field}`);
    setPayment((prev) => ({ ...prev, [field]: value }));
  };

  const handlePaymentStatusToggle = (field) => () => {
    setPayment((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const clearSelectedCustomer = () => {
    clearError('customerId');
    setSelectedCustomer(null);
  };

  const createEmptyShareSaleRow = useCallback(
    (defaultAmount = '', defaultShareWithId = 0) => ({
      rowId: Date.now() + Math.random(),
      shareWithId: Number(defaultShareWithId) || 0,
      amount: defaultAmount,
      splitTypeId: 0,
    }),
    [],
  );

  const selectedSalesPersonLabel = useMemo(() => {
    const id = Number(selectedSalesPersonId) || 0;
    if (!id) return canPickSalesPerson ? '' : currentUserName || '';
    const selectedUser = (salesPersons || []).find((u) => Number(u?.userId) === id);
    if (!selectedUser) {
      if (id === Number(currentUserId) && currentUserName) return currentUserName;
      return '';
    }

    const fullName = String(selectedUser.fullName || '').trim();
    if (fullName) return fullName;

    const firstName = String(selectedUser.firstName || selectedUser.firstname || '').trim();
    const lastName = String(selectedUser.lastName || selectedUser.lastname || '').trim();
    const combined = `${firstName} ${lastName}`.trim();
    if (combined) return combined;

    const name = String(selectedUser.name || '').trim();
    if (name) return name;

    const userName = String(selectedUser.userName || selectedUser.username || '').trim();
    if (userName) return userName;

    const email = String(selectedUser.email || '').trim();
    if (email) return email;

    return selectedUser.userId ? `User ${selectedUser.userId}` : '';
  }, [selectedSalesPersonId, salesPersons, currentUserId, currentUserName, canPickSalesPerson]);

  const filteredSalesPersons = useMemo(() => {
    const query = String(salesPersonSearchText || '').trim().toLowerCase();
    if (!query) return salesPersons || [];

    const selectedId = Number(selectedSalesPersonId) || 0;

    return (salesPersons || []).filter((user) => {
      // The selected option must stay mounted while searching: Radix renders the
      // trigger label through it, so filtering it out blanks the field.
      if (selectedId && Number(user?.userId) === selectedId) return true;

      const label = String(getSalesPersonLabel(user) || '').toLowerCase();
      const idKey = user?.userId ?? user?.id ?? user?.userID ?? user?.UserId;
      const idText = idKey !== undefined && idKey !== null ? String(idKey).toLowerCase() : '';
      return label.includes(query) || idText.includes(query) || getUserBadgeSearchText(user).includes(query);
    });
  }, [salesPersons, salesPersonSearchText, getSalesPersonLabel, selectedSalesPersonId]);

  const shareSaleEnteredTotal = useMemo(
    () =>
      (shareSaleRows || []).reduce((sum, row) => {
        const amount = Number(row?.amount) || 0;
        return sum + (amount > 0 ? amount : 0);
      }, 0),
    [shareSaleRows],
  );

  const shareSaleRemainingAmount = useMemo(
    () => Math.max(0, (Number(orderSummary?.total) || 0) - shareSaleEnteredTotal),
    [orderSummary?.total, shareSaleEnteredTotal],
  );

  const salesPersonMainAmount = useMemo(
    () => Math.max(0, (Number(orderSummary?.total) || 0) - shareSaleEnteredTotal),
    [orderSummary?.total, shareSaleEnteredTotal],
  );

  const isShareSaleExceeded = useMemo(
    () => shareSaleEnteredTotal > (Number(orderSummary?.total) || 0),
    [shareSaleEnteredTotal, orderSummary?.total],
  );

  const hasManualShareSaleRows = useMemo(
    () =>
      (shareSaleRows || []).some((row) => {
        const hasShareWith = Number(row?.shareWithId) > 0;
        const hasAmount = Number(row?.amount) > 0;
        const hasSplitType = Number(row?.splitTypeId) > 0;
        return hasShareWith || hasAmount || hasSplitType;
      }),
    [shareSaleRows],
  );

  const shareSaleReceiptRows = useMemo(() => {
    if (!showShareSale) return [];

    const rows = [];
    const mainAmount = Number(salesPersonMainAmount) || 0;
    const mainLabel = selectedSalesPersonLabel || 'Sales Person';
    const hasShareUsers = Array.isArray(shareSaleRows) && shareSaleRows.length > 0;
    const salesPersonSplitType = (salesShareTypeOptions || []).find(
      (opt) => Number(opt?.id) === Number(shareSalesPersonTypeId),
    );
    const salesPersonSplitTypeLabel = hasShareUsers
      ? salesPersonSplitType?.name || 'Split Type'
      : 'Full';

    if (mainAmount > 0 || !hasShareUsers) {
      rows.push({
        rowId: 'main-sales-person',
        label: mainLabel,
        splitTypeLabel: salesPersonSplitTypeLabel,
        amount: mainAmount,
      });
    }

    (shareSaleRows || []).forEach((row, idx) => {
      const amount = Number(row?.amount) || 0;
      if (amount <= 0) return;

      const personId = Number(row?.shareWithId) || 0;
      const person = (salesPersons || []).find((u) => Number(u?.userId) === personId);
      const personLabel = person ? getSalesPersonLabel(person) : `Split ${idx + 1}`;

      const splitTypeId = Number(row?.splitTypeId) || 0;
      const splitType = (salesShareTypeOptions || []).find((opt) => Number(opt?.id) === splitTypeId);
      const splitTypeLabel = splitType?.name || 'Split Type';

      rows.push({
        rowId: row.rowId,
        label: personLabel,
        splitTypeLabel,
        amount,
      });
    });

    return rows;
  }, [
    showShareSale,
    salesPersonMainAmount,
    selectedSalesPersonLabel,
    shareSaleRows,
    salesPersons,
    getSalesPersonLabel,
    shareSalesPersonTypeId,
    salesShareTypeOptions,
  ]);

  const openShareSaleModal = () => {
    if (!selectedSalesPersonId && canPickSalesPerson) {
      toast.error('Select a Sales Person before editing Share Sale.');
      return;
    }
    if (!selectedSalesPersonId && currentUserId) {
      setSelectedSalesPersonId(currentUserId);
    }
    if (!showShareSale) {
      setShowShareSale(true);
    }
    setShareSaleModalOpen(true);
  };

  const closeShareSaleModal = () => {
    setShareSaleModalOpen(false);
  };

  const handleShareSaleSave = async () => {
    // Validate that all rows are complete
    const hasIncompleteRows = (shareSaleRows || []).some((row) => {
      const hasShareWith = Number(row?.shareWithId) > 0;
      const hasAmount = Number(row?.amount) > 0;
      const hasSplitType = Number(row?.splitTypeId) > 0;
      return !hasShareWith || !hasAmount || !hasSplitType;
    });

    if (shareSaleRows.length > 0 && hasIncompleteRows) {
      toast.error('Please complete all Share Sale rows (Split With, Amount, Split Type).');
      return;
    }

    const isSalesPersonSplitTypeMissing = (shareSaleRows || []).length > 0 && Number(shareSalesPersonTypeId) <= 0;
    if (isSalesPersonSplitTypeMissing) {
      toast.error('Sales Person Split Type is required when shares are added.');
      return;
    }

    // Close modal after successful validation
    setShareSaleModalOpen(false);
    toast.success('Share Sale saved. Ready to create order.');
  };

  const disableShareSale = () => {
    setShowShareSale(false);
    setShareSaleModalOpen(false);
    setShareSalesPersonTypeId(0);
    setShareSaleRows([]);
  };

  const addShareSaleRow = () => {
    setShareSaleRows((prev) => [...prev, createEmptyShareSaleRow('', 0)]);
  };

  const removeShareSaleRow = (rowId) => {
    setShareSaleRows((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const updateShareSaleRow = (rowId, field, value) => {
    setShareSaleRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;

        if (field === 'amount') {
          // Keep what was typed. Clamping to the remaining amount silently wrote
          // 0 into every row added after the total was used up, and a 0 row is
          // dropped before save. The exceeded banner and the pre-save check
          // already stop an over-allocated split.
          const amountValue = String(value ?? '').replace(/[^0-9.]/g, '');
          return { ...row, amount: amountValue };
        }

        if (field === 'shareWithId') {
          return { ...row, shareWithId: value ? Number(value) : 0 };
        }

        if (field === 'splitTypeId') {
          const nextSplitTypeId = value ? Number(value) : 0;
          const selectedSplitType = (salesShareTypeOptions || []).find(
            (opt) => Number(opt?.id) === nextSplitTypeId,
          );
          const isFullType = String(selectedSplitType?.name || '')
            .trim()
            .toLowerCase() === 'full';

          if (!isFullType) {
            return { ...row, splitTypeId: nextSplitTypeId };
          }

          const otherRowsTotal = (prev || []).reduce((sum, item) => {
            if (item.rowId === rowId) return sum;
            const itemAmount = Number(item?.amount) || 0;
            return sum + (itemAmount > 0 ? itemAmount : 0);
          }, 0);
          const orderTotal = Number(orderSummary?.total) || 0;
          const maxAllowed = Math.max(0, orderTotal - otherRowsTotal);

          return {
            ...row,
            splitTypeId: nextSplitTypeId,
            amount: String(maxAllowed),
          };
        }

        return { ...row, [field]: value };
      }),
    );
  };

  const validateBeforeSave = ({ isEditPayment, isNewPaymentForExistingOrder }) => {
    const nextErrors = {};

    const isCreatingNewOrder = !isEditPayment && !isNewPaymentForExistingOrder;

    if (isCreatingNewOrder) {
      if (!selectedCustomer?.customerId) {
        nextErrors.customerId = 'Customer is required.';
      }

      if (!selectedSalesPersonId) {
        nextErrors.salesPersonId = 'Sales person is required.';
      }

      if (!orderLines?.length) {
        nextErrors.orderItems = 'Please add at least one product or custom item.';
      } else {
        const invalidLine = (orderLines || []).find((line) => {
          const qty = Number(line?.quantity) || 0;
          const unitPrice = Number(line?.price) || 0;
          return qty <= 0 || unitPrice <= 0;
        });
        if (invalidLine) {
          nextErrors.orderItems = 'All items must have quantity and price greater than 0.';
        }
      }

      const monthsValue = Number(subscriptionMonths);
      if (!isOrderEditMode && (String(subscriptionMonths).trim() === '' || !Number.isFinite(monthsValue) || monthsValue <= 0)) {
        nextErrors.subscriptionMonths = 'Subscription months is required.';
      }
    }

    if (isOrderEditMode) {
      setFormErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    }

    const amountNumber = Number(payment?.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      nextErrors['payment.amount'] = 'Amount must be greater than 0.';
    }

    const brandId = inferredPaymentBrandId;

    if (!brandId) nextErrors['payment.brandId'] = 'Brand is required.';
    if (activeTab === 'card') {
      const gatewayId = Number(payment.gatewayId) || 0;
      if (!gatewayId) {
        nextErrors['payment.gatewayId'] = 'Gateway is required.';
      } else if (gateways.length > 0 && !filteredGateways.some((gateway) => getGatewayIdValue(gateway) === gatewayId)) {
        nextErrors['payment.gatewayId'] = 'Please select a valid gateway.';
      }
    }

    const requiresPaymentDate = activeTab !== 'card';
    const paymentDateRaw = String(payment?.paymentDate || '').trim();
    const paymentDateOk = !!paymentDateRaw && !Number.isNaN(new Date(paymentDateRaw).getTime());
    if (requiresPaymentDate && !paymentDateOk) {
      nextErrors['payment.paymentDate'] = 'Payment date is required.';
    }

    if (activeTab === 'card') {
      const digits = String(payment?.cardNumber || '').replace(/\D/g, '');
      if (!digits || digits.length < 13) {
        nextErrors['payment.cardNumber'] = 'Card number is required.';
      }
      if (!String(payment?.cardType || '').trim()) {
        nextErrors['payment.cardType'] = 'Card type is required.';
      }
      if (!String(payment?.nameOnCard || '').trim()) {
        nextErrors['payment.nameOnCard'] = 'Name on card is required.';
      }
      if (!/^\d{2}\/\d{2}$/.test(String(payment?.cardExpiryDate || '').trim())) {
        nextErrors['payment.cardExpiryDate'] = 'Expiry must be in MM/YY format.';
      }
      const cvvDigits = String(payment?.cvv || '').replace(/\D/g, '');
      if (!cvvDigits || cvvDigits.length < 3) {
        nextErrors['payment.cvv'] = 'CVV is required.';
      }
    }

    if (activeTab === 'bank') {
      if (!String(payment?.nameOnCard || '').trim()) {
        nextErrors['payment.nameOnCard'] = 'Account holder name is required.';
      }
      const acctDigits = String(payment?.cardNumber || '').replace(/\D/g, '');
      if (!acctDigits || acctDigits.length < 4) {
        nextErrors['payment.cardNumber'] = 'Account number is required.';
      }
      if (!String(payment?.chequeRoutingNo || '').trim()) {
        nextErrors['payment.chequeRoutingNo'] = 'Routing / IFSC is required.';
      }
    }

    if (activeTab === 'cheque') {
      if (!String(payment?.nameOnCard || '').trim()) {
        nextErrors['payment.nameOnCard'] = 'Payee name is required.';
      }
      const routingDigits = String(payment?.chequeRoutingNo || '').replace(/\D/g, '');
      if (routingDigits.length !== 9) {
        nextErrors['payment.chequeRoutingNo'] = 'Routing number must be 9 digits.';
      }
      const chequeDigits = String(payment?.chequeNo || '').replace(/\D/g, '');
      if (!chequeDigits) {
        nextErrors['payment.chequeNo'] = 'Cheque number is required.';
      }
    }

    if (activeTab === 'zelle') {
      if (!String(payment?.zelleId || '').trim()) {
        nextErrors['payment.zelleId'] = 'Zelle ID is required.';
      }
      if (!String(payment?.transactionId || '').trim()) {
        nextErrors['payment.transactionId'] = 'Transaction ID is required.';
      }
    }

    if (activeTab === 'paypal') {
      const paypalAccount = String(payment?.zelleId || '').trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalAccount);
      const phoneDigits = paypalAccount.replace(/\D/g, '');
      if (!isEmail && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
        nextErrors['payment.zelleId'] = 'Enter a valid PayPal email or phone number.';
      }
      if (!String(payment?.transactionId || '').trim()) {
        nextErrors['payment.transactionId'] = 'Transaction ID is required.';
      }
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSavePayment = async () => {
    if (loadingPayment) return;
    try {
      if (isOrderEditMode) {
        if (permissionsLoading || !canUpdate) throw new Error('You do not have permission to update orders.');
        if (loadingOrder || orderLoadError || !editingOrder || Number(editingOrder.orderId) !== orderIdForEdit) throw new Error(orderLoadError || 'Wait for the saved order to load.');
        if (!validateBeforeSave({ isEditPayment: false, isNewPaymentForExistingOrder: false })) {
          toast.error('Please fix the highlighted fields');
          return;
        }
        setLoadingPayment(true);
        await orderService.updateOrder(buildOrderUpdatePayload(editingOrder, {
          customerId: selectedCustomer?.customerId,
          salesPersonId: selectedSalesPersonId,
          lines: orderLines,
          summary: orderSummary,
          discountType, discountCode, notes: orderNotes
        }));
        toast.success(`Order #${orderIdForEdit} updated successfully`);
        navigate(paths.orders);
        return;
      }
      // Get logged-in user ID from localStorage
      const currentUserId = Number(localStorage.getItem('userId')) || 0;

      const isEditPayment = payment.paymentId && payment.paymentId > 0 && payment.orderId;

      const existingOrderIdForPayment = Number(payment.orderId) || Number(orderDataFromState?.orderId) || 0;
      const isNewPaymentForExistingOrder = !isEditPayment && existingOrderIdForPayment > 0;

      if (permissionsLoading || ordersCodesLoading) {
        toast.error('Permissions are still loading. Please try again.');
        return;
      }
      if (isEditPayment && (!canUpdate || !canUpdateOrderPayment)) {
        toast.error("You don't have permission to update order payments.");
        return;
      }
      if (isNewPaymentForExistingOrder && (!canUpdate || !canAddOrderPayment)) {
        toast.error("You don't have permission to add order payments.");
        return;
      }
      if (!isEditPayment && !isNewPaymentForExistingOrder && !canAdd && !canAddOrdersByCode) {
        toast.error("You don't have permission to create orders.");
        return;
      }

      const isValid = validateBeforeSave({ isEditPayment, isNewPaymentForExistingOrder });
      if (!isValid) {
        toast.error('Please fix the highlighted fields');
        return;
      }

      const paymentType = paymentTypeFromTab(activeTab);
      if (!paymentType) {
        toast.error('Please select an allowed payment type for the chosen gateway.');
        return;
      }

      // Straight from /SettingValue/SettingValueDropDown?settingKey=SaleTypes.
      const resolvedSaleType =
        String(payment?.saleType || '').trim()
        || String(saleTypes?.[0]?.name || '').trim();

      if (!isEditPayment && !isNewPaymentForExistingOrder && showShareSale) {
        const activeShareRows = (shareSaleRows || []).filter((row) => {
          const hasShareWith = Number(row?.shareWithId) > 0;
          const hasSplitType = Number(row?.splitTypeId) > 0;
          const hasAmount = Number(row?.amount) > 0;
          return hasShareWith || hasSplitType || hasAmount;
        });

        const invalidShareRow = activeShareRows.find((row) => {
          const hasShareWith = Number(row?.shareWithId) > 0;
          const hasSplitType = Number(row?.splitTypeId) > 0;
          const hasAmount = Number(row?.amount) > 0;
          return !hasShareWith || !hasSplitType || !hasAmount;
        });

        if (invalidShareRow) {
          toast.error('Please complete all Share Sale rows (Split With, Amount, Split Type).');
          return;
        }

        // Two rows for the same person collapse into one server-side, so catch
        // it here instead of silently saving fewer rows than were entered.
        const seenShareWithIds = new Set();
        const hasDuplicateRow = activeShareRows.some((row) => {
          const shareWithId = Number(row?.shareWithId) || 0;
          if (seenShareWithIds.has(shareWithId)) return true;
          seenShareWithIds.add(shareWithId);
          return false;
        });

        if (hasDuplicateRow) {
          toast.error('Each person can only appear once in Share Sale.');
          return;
        }

        const mainSalesPersonId = Number(selectedSalesPersonId) || 0;
        const sharesMainSalesPerson =
          mainSalesPersonId > 0 &&
          activeShareRows.some((row) => (Number(row?.shareWithId) || 0) === mainSalesPersonId);

        if (sharesMainSalesPerson) {
          toast.error('The main sales person already keeps the remaining amount - remove their Share Sale row.');
          return;
        }

        const splitTotal = activeShareRows.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);
        if (splitTotal > (Number(orderSummary?.total) || 0)) {
          toast.error('Split amount cannot be more than order total.');
          return;
        }
      }

      setLoadingPayment(true);
      const brandId = inferredPaymentBrandId;

      const amount = isEditPayment
        ? Number(payment.amount) || 0
        : orderLines.length > 0
          ? orderSummary.total
          : payment.amount || orderSummary.total;
      const nowIso = new Date().toISOString();
      const normalizedPaymentDate = normalizeIsoDate(payment.paymentDate);

      // If we already have a paymentId and an existing orderId, update BOTH the order and payment (edit mode)
      if (isEditPayment) {
        // Update Payment
        const updatePaymentPayload = {
          paymentId: payment.paymentId,
          orderId: payment.orderId,
          paymentType,
          cardType: payment.cardType || '',
          cardNumber: payment.cardNumber || '',
          cardExpiryDate: payment.cardExpiryDate || '',
          cvv: payment.cvv || '',
          nameOnCard: payment.nameOnCard || '',
          transactionId: payment.transactionId || '',
          authCode: payment.authCode || '',
          gatewayId: Number(payment.gatewayId) || 0,
          brandId: brandId,
          amount: Number(amount) || 0,
          isVoid: !!payment.isVoid,
          isChargeBack: !!payment.isChargeBack,
          isRetrieval: !!payment.isRetrieval,
          isAlert: !!payment.isAlert,
          paymentDate: normalizedPaymentDate || nowIso,
          createdAt: payment.createdAt || nowIso,
          createdBy: Number(payment.createdBy) || currentUserId,
          updatedAt: nowIso,
          updatedBy: currentUserId,
          isDeleted: !!payment.isDeleted,
          isChequeCleared: !!payment.isChequeCleared,
          chequeRoutingNo: Number(payment.chequeRoutingNo) || 0,
          chequeNo: Number(payment.chequeNo) || 0,
          chequeTrackingNo: payment.chequeTrackingNo || '',
          zelleId: payment.zelleId || '',
        };

        await paymentService.updatePayment(updatePaymentPayload);

        toast.success('Payment updated successfully!');
        navigate(paths.orders);
        return;
      }

      // Add a NEW payment to an EXISTING order (opened via Orders table "Add payment")
      if (isNewPaymentForExistingOrder) {
        const gatewayName = getGatewayNameValue(selectedPaymentGateway);
        const brandName = inferredPaymentBrandName || '';

        const createPaymentPayload = {
          paymentId: 0,
          orderId: existingOrderIdForPayment,
          paymentType,
          cardType: payment.cardType || '',
          cardNumber: payment.cardNumber || '',
          cardExpiryDate: payment.cardExpiryDate || '',
          cvv: payment.cvv || '',
          nameOnCard: payment.nameOnCard || '',
          transactionId: payment.transactionId || '',
          authCode: payment.authCode || '',
          gatewayId: Number(payment.gatewayId) || 0,
          gatewayName,
          brandId: brandId,
          brandName,
          amount: Number(amount) || 0,
          saleType: resolvedSaleType,
          isVoid: !!payment.isVoid,
          isChargeBack: !!payment.isChargeBack,
          isRetrieval: !!payment.isRetrieval,
          isAlert: !!payment.isAlert,
          paymentDate: normalizedPaymentDate || nowIso,
          createdAt: nowIso,
          createdBy: currentUserId,
          updatedAt: nowIso,
          updatedBy: currentUserId,
          isDeleted: false,
          isChequeCleared: !!payment.isChequeCleared,
          chequeRoutingNo: Number(payment.chequeRoutingNo) || 0,
          chequeNo: Number(payment.chequeNo) || 0,
          chequeTrackingNo: payment.chequeTrackingNo || '',
          zelleId: payment.zelleId || '',
        };

        // AmethystCRM appends an existing-order payment with PUT. The backend
        // identifies the target order by orderId while paymentId remains zero.
        await paymentService.updatePayment(createPaymentPayload);
        toast.success('Payment added successfully!');
        navigate(paths.orders);
        return;
      }

      // Otherwise create a new order with items and this payment
      const { saleType: _saleType, ...paymentWithoutSaleType } = payment || {};
      const newPaymentPayload = {
        ...paymentWithoutSaleType,
        orderId: 0,
        amount,
        paymentType,
        cardType: payment.cardType || '',
        cardNumber: payment.cardNumber || '',
        cardExpiryDate: payment.cardExpiryDate || '',
        cvv: payment.cvv || '',
        nameOnCard: payment.nameOnCard || '',
        transactionId: payment.transactionId || '',
        authCode: payment.authCode || '',
        gatewayId: Number(payment.gatewayId) || 0,
        brandId: brandId,
        saleType: resolvedSaleType,
        isVoid: !!payment.isVoid,
        isChargeBack: !!payment.isChargeBack,
        isRetrieval: !!payment.isRetrieval,
        isAlert: !!payment.isAlert,
        paymentDate: normalizedPaymentDate || nowIso,
        createdAt: nowIso,
        createdBy: currentUserId,
        updatedAt: nowIso,
        updatedBy: currentUserId,
        isDeleted: false,
        isChequeCleared: !!payment.isChequeCleared,
        chequeRoutingNo: Number(payment.chequeRoutingNo) || 0,
        chequeNo: Number(payment.chequeNo) || 0,
        chequeTrackingNo: payment.chequeTrackingNo || '',
        zelleId: payment.zelleId || '',
      };

      // Share Sale rows ride along with the order as a top-level `sharePayments`
      // list (a sibling of `payment`, not inside it), so the backend creates them
      // with the order - no follow-up /SharePayment call.
      const activeShareRows = showShareSale
        ? (shareSaleRows || []).filter((row) => Number(row?.shareWithId) > 0 && Number(row?.amount) > 0)
        : [];

      const mainSalesPersonId = Number(selectedSalesPersonId) || 0;
      // The main sales person keeps the remainder and is never a share row.
      const shareRowsToSave = activeShareRows.filter(
        (row) => (Number(row?.shareWithId) || 0) !== mainSalesPersonId,
      );
      const shareIpv4 = shareRowsToSave.length > 0 ? await getCurrentLoginIpv4() : '';

      const buildShareRow = (shareWithId, shareWithName, shareTypeId, amount) => ({
        id: 0,
        paymentId: 0,
        shareWithId,
        shareWithName,
        shareTypeId,
        amount,
        createdDate: nowIso,
        updatedDate: nowIso,
        entIp: shareIpv4 || '',
        udpIp: shareIpv4 || '',
        createdBy: currentUserId,
        updatedBy: currentUserId,
      });

      // The split is "main sales person keeps the remainder" plus one row per
      // share - the same shape the on-screen receipt and the Orders table send.
      // Without their own row the split never adds up to the order total.
      const mainShareAmount = Number(salesPersonMainAmount) || 0;
      const mainShareRow =
        shareRowsToSave.length > 0 && mainSalesPersonId > 0 && mainShareAmount > 0
          ? buildShareRow(
            mainSalesPersonId,
            selectedSalesPersonLabel || '',
            Number(shareSalesPersonTypeId) || 0,
            mainShareAmount,
          )
          : null;

      const sharePayments = [
        ...(mainShareRow ? [mainShareRow] : []),
        ...shareRowsToSave.map((row) => {
          const shareWithId = Number(row?.shareWithId) || 0;
          const matchedUser = (salesPersons || []).find((u) => Number(u?.userId) === shareWithId);

          return buildShareRow(
            shareWithId,
            matchedUser ? getSalesPersonLabel(matchedUser) : '',
            Number(row?.splitTypeId) || 0,
            Number(row?.amount) || 0,
          );
        }),
      ];

      const orderPayload = {
        orderId: 0,
        customerId: selectedCustomer ? selectedCustomer.customerId : 0,
        salesPersonId: selectedSalesPersonId || 0,
        saleDate: nowIso,
        subtotal: orderSummary.subtotal,
        discountAmount: Number(orderSummary.discount) || 0,
        discountType: discountType || '',
        totalAmount: orderSummary.total,
        orderStatus: '',
        isFulfilled: false,
        notes: orderNotes || '',
        createdBy: currentUserId,
        isDeleted: false,
        discountCode: discountCode || '',
        orderItems: orderLines.map((line) => ({
          orderItemId: 0,
          orderId: 0,
          productId: line.productId || 0,
          productName: line.name,
          productType: line.productType,
          quantity: line.quantity,
          unitPrice: line.price || 0,
          totalPrice: line.totalPrice,
          subscriptionMonths: line.isCustom ? 0 : Number(line.subscriptionMonths) || 0,
          isDeleted: false,
        })),
        // Backend expects a single `payment` object (see DTO: `payment`),
        // not an array named `payments` which causes validation errors.
        payment: newPaymentPayload,
        sharePayments,
      };

      const createdOrder = await orderService.createOrder(orderPayload);

      // Update local payment state so the generated orderId shows in UI
      setPayment((prev) => ({
        ...prev,
        ...newPaymentPayload,
      }));

      const createdOrderId =
        Number(createdOrder?.orderId) ||
        Number(createdOrder?.id) ||
        Number(createdOrder?.data?.orderId) ||
        0;

      toast.success(createdOrderId ? `Order #${createdOrderId} created successfully` : 'Order created successfully');

      // Clear everything so the page is ready for the next order. Done before
      // navigating too, so the form is clean if the user comes back to it.
      resetOrderForm();

      // Go to the Orders list so the fresh data (incl. the new order) shows.
      // If the user can't access the Orders page, stay on the clean form.
      if (canViewOrders) {
        navigate(paths.orders);
      }
    } catch (err) {
      console.error('Failed to save order/payment', err);
      toast.error(getApiErrorMessage(err, 'Failed to save order/payment'));
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleConfirmDeletePayment = async () => {
    if (!payment.paymentId) return;
    try {
      if (permissionsLoading || ordersCodesLoading) {
        toast.error('Permissions are still loading. Please try again.');
        return;
      }
      if (!canDelete || !canDeleteOrderPayment) {
        toast.error("You don't have permission to delete payments.");
        return;
      }
      setIsDeletingPayment(true);
      await paymentService.deletePayment(payment.paymentId);
      setPayment(emptyPayment);
      toast.success('Payment deleted');
    } catch (err) {
      console.error('Failed to delete payment', err);
      toast.error(getApiErrorMessage(err, 'Failed to delete payment'));
    } finally {
      setIsDeletingPayment(false);
      setDeletePaymentConfirmOpen(false);
    }
  };

  // Puts the page back to how it looks on a fresh load. Used after a successful
  // create so the next order starts clean, and by Discard.
  const resetOrderForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');

    setQuantities({});
    setProductPriceOverrides({});
    setSelectedProductDropdownId('');
    setCustomItems([]);

    setOrderNotes('');
    setDiscountAmount(0);
    setDiscountPercent(0);
    setDiscountType('');
    setDiscountCode('');
    setSubscriptionMonths('');
    setSubscriptionCustom(false);
    // Let the product-savings effect re-apply from scratch.
    autoDiscountRef.current = { applied: false };

    setPayment(emptyPayment);
    setActiveTab('card');
    setCardTypeTouched(false);

    setShowShareSale(true);
    setShareSaleModalOpen(false);
    setShareSalesPersonTypeId(0);
    setShareSaleRows([]);
    setSalesPersonSearchText('');
    // Cleared, not hard-coded: the default-sales-person effect puts the
    // logged-in user back.
    setSelectedSalesPersonId(0);

    setFormErrors({});
  };

  const handleDiscardOrder = () => {
    if (isOrderEditMode) {
      navigate(paths.orders);
      return;
    }
    resetOrderForm();
  };

  const clearSelectedProduct = (productId) => {
    clearError('orderItems');
    setQuantities((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });

    setProductPriceOverrides((prev) => {
      if (!prev || typeof prev !== 'object') return {};
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const sanitizeDecimalInput = (value) => {
    const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length <= 1) return cleaned;
    return `${parts[0]}.${parts.slice(1).join('')}`;
  };

  const handleProductPriceOverrideChange = (productId, nextRaw) => {
    clearError('orderItems');
    const nextValue = sanitizeDecimalInput(nextRaw);
    setProductPriceOverrides((prev) => {
      const current = prev && typeof prev === 'object' ? prev : {};
      // Keep empty string while the user is editing so the input can be cleared.
      // If the user leaves it empty, we restore the base price on blur.
      return { ...current, [productId]: nextValue };
    });
  };

  const handleProductPriceOverrideClick = (productId) => {
    setProductPriceOverrides((prev) => {
      const current = prev && typeof prev === 'object' ? prev : {};
      return { ...current, [productId]: '' };
    });
  };

  const handleProductPriceOverrideBlur = (productId) => {
    setProductPriceOverrides((prev) => {
      const current = prev && typeof prev === 'object' ? prev : {};
      if (current?.[productId] !== '') return current;
      const copy = { ...current };
      delete copy[productId];
      return copy;
    });
  };

  const selectedProductCount = useMemo(
    () => Object.values(quantities).filter((q) => Number(q) > 0).length,
    [quantities],
  );
  const selectedProductQty = useMemo(
    () => Object.values(quantities).reduce((sum, q) => sum + (Number(q) > 0 ? Number(q) : 0), 0),
    [quantities],
  );

  const selectedProductLines = useMemo(
    () => orderLines.filter((line) => !line?.isCustom && Number(line?.quantity) > 0),
    [orderLines],
  );

  const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');
  const formatCardNumberGroups = (digits) =>
    String(digits ?? '')
      .replace(/\D/g, '')
      .replace(/(\d{4})(?=\d)/g, '$1 ')
      .trim();

  const formatMoney2 = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(2);
  };

  const formatDateMMDDYYYY = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
  };

  const normalizeIsoDate = (value) => {
    if (!value) return '';
    const v = String(value).trim();
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(`${v}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
      return v;
    }
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return v;
  };

  const detectCardType = (digits) => {
    const d = String(digits ?? '').replace(/\D/g, '');
    if (!d) return '';
    if (/^4/.test(d)) return 'Visa';
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'Mastercard';
    if (/^3[47]/.test(d)) return 'American Express';
    if (/^(6011|65|64[4-9])/.test(d)) return 'Discover';
    return 'Card';
  };

  const formatExpiryForInput = (raw) => {
    const digits = onlyDigits(raw).slice(0, 4);
    if (!digits) return '';
    if (digits.length <= 2) return digits;

    let mm = digits.slice(0, 2);
    const yy = digits.slice(2);
    if (mm.length === 2) {
      const month = Number(mm);
      if (month <= 0) mm = '01';
      else if (month > 12) mm = '12';
    }
    return `${mm}/${yy}`;
  };

  const formattedCardNumber = useMemo(() => {
    const digits = onlyDigits(payment.cardNumber).slice(0, 16);
    return digits ? formatCardNumberGroups(digits) : '';
  }, [payment.cardNumber]);

  const cardPreview = useMemo(() => {
    const digits = onlyDigits(payment.cardNumber).slice(0, 16);
    const type = payment.cardType || detectCardType(digits) || 'Card';
    const displayNumber = digits ? formatCardNumberGroups(digits) : '•••• •••• •••• ••••';
    const displayName = (payment.nameOnCard || '').trim().toUpperCase();
    const displayExpiry = (payment.cardExpiryDate || '').trim() || 'MM/YY';
    return { type, digits, displayNumber, displayName, displayExpiry };
  }, [payment.cardNumber, payment.cardType, payment.nameOnCard, payment.cardExpiryDate]);

  const handleCardNumberChange = (e) => {
    const digits = onlyDigits(e.target.value).slice(0, 16);
    const cardType = detectCardType(digits);

    clearError('payment.cardNumber');

    setPayment((prev) => {
      const shouldAutoSetType = !cardTypeTouched;
      if (!shouldAutoSetType) return { ...prev, cardNumber: digits };

      const allowed = (cardTypes || []).map((t) => t.name);
      const nextType = allowed.length === 0 || allowed.includes(cardType) ? cardType : prev.cardType;
      return { ...prev, cardNumber: digits, cardType: nextType };
    });
  };

  const handleNameOnCardChange = (e) => {
    clearError('payment.nameOnCard');
    setPayment((prev) => ({ ...prev, nameOnCard: e.target.value }));
  };

  const handleExpiryChange = (e) => {
    const value = formatExpiryForInput(e.target.value);
    clearError('payment.cardExpiryDate');
    setPayment((prev) => ({ ...prev, cardExpiryDate: value }));
  };

  const handleCvvChange = (e) => {
    const maxLen = (payment.cardType || cardPreview.type) === 'American Express' ? 4 : 3;
    const value = onlyDigits(e.target.value).slice(0, maxLen);
    clearError('payment.cvv');
    setPayment((prev) => ({ ...prev, cvv: value }));
  };

  const paymentDateForInput = useMemo(() => {
    if (!payment.paymentDate) return '';
    const v = String(payment.paymentDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }, [payment.paymentDate]);

  const chequeAmount = useMemo(() => {
    if (isEditMode) return Number(payment.amount) || 0;
    if (orderLines.length > 0) return Number(orderSummary.total) || 0;
    return 0;
  }, [isEditMode, payment.amount, orderLines.length, orderSummary.total]);

  const chequePreview = useMemo(() => {
    const payee = (payment.nameOnCard || '').trim();
    const memo = (payment.authCode || '').trim();
    const date = formatDateMMDDYYYY(payment.paymentDate);
    const amount = chequeAmount > 0 ? formatMoney2(chequeAmount) : '';
    const routing = onlyDigits(payment.chequeRoutingNo).slice(0, 9);
    const accountOrTracking = String(payment.chequeTrackingNo || '').trim();
    const chequeNo = onlyDigits(payment.chequeNo).slice(0, 6);
    return { payee, memo, date, amount, routing, accountOrTracking, chequeNo };
  }, [payment.nameOnCard, payment.authCode, payment.paymentDate, payment.chequeRoutingNo, payment.chequeTrackingNo, payment.chequeNo, chequeAmount]);

  const handleChequeRoutingChange = (e) => {
    const value = onlyDigits(e.target.value).slice(0, 9);
    clearError('payment.chequeRoutingNo');
    setPayment((prev) => ({ ...prev, chequeRoutingNo: value }));
  };

  const handleChequeNoChange = (e) => {
    const value = onlyDigits(e.target.value).slice(0, 6);
    clearError('payment.chequeNo');
    setPayment((prev) => ({ ...prev, chequeNo: value }));
  };

  const handleChequeTrackingChange = (e) => {
    clearError('payment.chequeTrackingNo');
    setPayment((prev) => ({ ...prev, chequeTrackingNo: e.target.value }));
  };

  const formatAccountNumber = (raw) => {
    const digits = onlyDigits(raw).slice(0, 22);
    if (!digits) return '';
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const bankAccountNumberFormatted = useMemo(
    () => formatAccountNumber(payment.cardNumber),
    [payment.cardNumber],
  );

  const bankPreview = useMemo(() => {
    const holder = (payment.nameOnCard || '').trim();
    const acctDigits = onlyDigits(payment.cardNumber).slice(0, 22);
    const acctDisplay = acctDigits ? formatAccountNumber(acctDigits) : '';
    const routingOrIfsc = String(payment.chequeRoutingNo || '').trim();
    const reference = String(payment.authCode || '').trim();
    return { holder, acctDisplay, routingOrIfsc, reference };
  }, [payment.nameOnCard, payment.cardNumber, payment.chequeRoutingNo, payment.authCode]);

  const handleBankAccountNumberChange = (e) => {
    const digits = onlyDigits(e.target.value).slice(0, 22);
    clearError('payment.cardNumber');
    setPayment((prev) => ({ ...prev, cardNumber: digits }));
  };

  const handleBankRoutingIfscChange = (e) => {
    const value = String(e.target.value ?? '')
      .replace(/\s/g, '')
      .slice(0, 18)
      .toUpperCase();
    clearError('payment.chequeRoutingNo');
    setPayment((prev) => ({ ...prev, chequeRoutingNo: value }));
  };

  function getSalesPersonLabel(user) {
    if (!user) return '';
    const fullName = String(user.fullName || '').trim();
    if (fullName) return fullName;

    const firstName = String(user.firstName || user.firstname || '').trim();
    const lastName = String(user.lastName || user.lastname || '').trim();
    const combined = `${firstName} ${lastName}`.trim();
    if (combined) return combined;

    const name = String(user.name || '').trim();
    if (name) return name;

    const userName = String(user.userName || user.username || '').trim();
    if (userName) return userName;

    const email = String(user.email || '').trim();
    if (email) return email;

    return user.userId ? `User ${user.userId}` : 'User';
  }

  const openAddCustomerModal = () => {
    if (addCustomerModalOpen) return;
    if (!canCreateCustomer) {
      if (customerPermsLoading) {
        toast.error('Permissions are still loading. Please try again.');
        return;
      }
      toast.error("You don't have permission to add customers.");
      return;
    }

    // Add Customer can be launched from the customer-search portal. Close that
    // parent first so only one modal is mounted and focus/scroll locks do not
    // compete with each other.
    setCustomerModalOpen(false);
    setShowCustomerDetailsModal(false);

    const userId = Number(localStorage.getItem('userId') || 0);
    const userName = localStorage.getItem('userName') || '';
    const defaultSalesPerson = Number(selectedSalesPersonId) || 0;

    const usa = (customerCountries || []).find((c) => {
      const n = String(c?.countryName || '').trim().toLowerCase();
      return n === 'usa' || n === 'us' || n === 'america' || n.includes('united states');
    });

    setCustomerFormData({
      ...emptyCustomerForm,
      leadId: Number(initialLeadId) || 0,
      createdBy: userId,
      createdByName: userName,
      createdDate: new Date().toISOString(),
      salesPerson: defaultSalesPerson,
      salesPersonName: getSalesPersonLabel(
        (salesPersons || []).find((u) => Number(u.userId) === defaultSalesPerson),
      ),
      countryId: Number(usa?.countryId) || 0,
      countryName: 'USA',
      stateId: 0,
      stateName: '',
    });
    setAddCustomerModalOpen(true);
  };

  // Arriving from a lead (the Create Order button on My Leads) means the
  // customer does not exist yet, so open Add Customer straight away, seeded
  // with that lead. Fires once - closing it leaves the normal order form.
  useEffect(() => {
    if (isEditMode || isAddPaymentMode) return;
    if (!Number(initialLeadId)) return;
    if (customerPermsLoading || !canCreateCustomer) return;
    if (selectedCustomer) return;
    if (leadAddCustomerOpenedRef.current) return;

    leadAddCustomerOpenedRef.current = true;
    openAddCustomerModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, isAddPaymentMode, initialLeadId, customerPermsLoading, canCreateCustomer, selectedCustomer]);

  useEffect(() => {
    if (!addCustomerModalOpen) return;
    const fetchLookups = async () => {
      try {
        const [usersResult, countriesResult] = await Promise.all([
          salesPersons?.length
            ? Promise.resolve({ data: salesPersons })
            : fetchSalesPersonList({ pageSize: 1000 }).then((data) => ({ data })),
          countryService.getCountries({ PageNumber: 1, PageSize: 200, SortProperty: 'countryId', IsDescending: false }),
        ]);

        if (!salesPersons?.length) setSalesPersons(usersResult.data || []);
        setCustomerCountries(countriesResult.data || []);
      } catch (error) {
        console.error('Failed to load customer lookups:', error);
      }
    };

    fetchLookups();
  }, [addCustomerModalOpen]);

  if (loadingPayment && isEditMode && !payment?.paymentId) {
    return (
      <div className="w-full min-h-full bg-white dark:bg-coal-500 relative overflow-x-hidden p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-24" />
              <div className="h-9 bg-gray-200 dark:bg-slate-700 rounded w-full" />
            </div>
          ))}
        </div>
        <div className="h-9 bg-gray-200 dark:bg-slate-700 rounded w-32 mt-6" />
      </div>
    );
  }

  return (
    <div className="create-order-page relative min-h-full w-full overflow-x-clip bg-transparent p-4 sm:p-6">
      <PageHeader
        title={isOrderEditMode ? `Edit Order #${orderIdForEdit}` : isEditMode ? `Edit Payment #${payment.paymentId || paymentIdForEdit}` : isAddPaymentMode ? `Add Payment to Order #${payment.orderId || orderDataFromState?.orderId || numericOrderId}` : 'Create Order'}
        description={isOrderEditMode ? 'Update the saved customer, products, discounts, and order details. Existing payments are kept.' : isEditMode ? 'Update payment details for this order.' : isAddPaymentMode ? 'Add a new payment using the order’s existing details.' : 'Build the order, capture payment, and review the receipt before saving.'}
      >
        <Button
          type="button"
          variant="outline"
          className="inline-flex h-10 items-center gap-2 rounded-xl border-slate-200 bg-white px-4 text-slate-700 shadow-sm hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200"
          onClick={() => navigate(paths.orders)}
        >
          <ArrowLeft size={16} />
          Back to Orders
        </Button>
      </PageHeader>
      {isOrderEditMode && loadingOrder && <div role="status" className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700">Loading saved order details...</div>}
      {isOrderEditMode && orderLoadError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{orderLoadError}</div>}

      {/* Customer details modal */}
      {!isAddPaymentMode && showCustomerDetailsModal && selectedCustomer && (
        <ModalPortal>
          <div className="create-order-modal fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="create-order-modal-surface my-auto w-full max-w-md bg-white dark:bg-[#17132a] rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50/90 backdrop-blur">
                <h3 className="text-sm font-semibold text-gray-800">Customer Details</h3>
                <button
                  type="button"
                  className="liquid-close-btn"
                  onClick={() => setShowCustomerDetailsModal(false)}
                  aria-label="Close customer details modal"
                >
                  âœ•
                </button>
              </div>
              <div className="px-4 py-3 text-sm">
                <div className="text-xs text-gray-500">Customer ID</div>
                <div className="font-semibold text-gray-900">#{selectedCustomer.customerId}</div>

                <div className="mt-3 text-xs text-gray-500">Name</div>
                <div className="font-semibold text-gray-900">
                  {selectedCustomer.name ||
                    selectedCustomer.customerName ||
                    selectedCustomer.fullName ||
                    `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim() ||
                    `Customer #${selectedCustomer.customerId}`}
                </div>

                {selectedCustomer.email && (
                  <div className="mt-2 text-xs text-gray-600">âœ‰ {selectedCustomer.email}</div>
                )}
                {selectedCustomer.phone && (
                  <div className="mt-1 text-xs text-gray-600">ðŸ“ž {selectedCustomer.phone}</div>
                )}

                {(selectedCustomer.address || selectedCustomer.city || selectedCustomer.stateName || selectedCustomer.state || selectedCustomer.zipCode || selectedCustomer.zip || selectedCustomer.countryName || selectedCustomer.country) && (
                  <div className="mt-2 text-xs text-gray-600">
                    {selectedCustomer.address && <div className="truncate">ðŸ“ {selectedCustomer.address}</div>}
                    <div className="truncate">
                      {[selectedCustomer.city, selectedCustomer.stateName || selectedCustomer.state, selectedCustomer.zipCode || selectedCustomer.zip]
                        .filter(Boolean)
                        .join(', ')}
                      {selectedCustomer.countryName || selectedCustomer.country ? ` • ${selectedCustomer.countryName || selectedCustomer.country}` : ''}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 pb-4 flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCustomerDetailsModal(false)}
                >
                  Close
                </Button>
                <LiquidGlassButton
                  type="button"
                  className="flex-1 !h-10 text-center"
                  onClick={() => {
                    clearSelectedCustomer();
                    setShowCustomerDetailsModal(false);
                  }}
                >
                  Clear Customer
                </LiquidGlassButton>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Select customer modal */}
      {!isAddPaymentMode && customerModalOpen && (
        <ModalPortal>
          <div className="create-order-modal fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="create-order-modal-surface my-auto w-full max-w-3xl bg-white dark:bg-[#17132a] rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 mx-4 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50/90 backdrop-blur">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Select Customer</h3>
                  <p className="text-xs text-gray-500">Search and choose a customer for this order.</p>
                </div>
                <button
                  type="button"
                  className="liquid-close-btn"
                  onClick={() => setCustomerModalOpen(false)}
                  aria-label="Close select customer modal"
                >
                  âœ•
                </button>
              </div>

              <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white flex-1 focus-within:ring-2 focus-within:ring-violet-500/30">
                  <Search size={16} className="text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search customer by name, email, phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Clear customer search"
                    >
                      <X size={14} className="text-gray-500" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!customerPermsLoading && canUpdateCustomer ? (
                    <button
                      type="button"
                      onClick={rebuildCustomerIndex}
                      disabled={customerRebuilding}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {customerRebuilding ? 'Refreshing…' : 'Refresh'}
                    </button>
                  ) : null}
                  {canCreateCustomer ? (
                    <LiquidGlassButton
                      type="button"
                      onClick={openAddCustomerModal}
                      className="!px-3 !py-2 !text-xs !font-semibold"
                    >
                      + Add Customer
                    </LiquidGlassButton>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSearch('');
                      setCustomers([]);
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 bg-white hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {loadingCustomers ? (
                  <div className="space-y-2 animate-pulse">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-gray-50">
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-200 rounded w-1/2" />
                          <div className="h-2.5 bg-gray-200 rounded w-3/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !customerSearch.trim() ? (
                  <div className="text-sm text-gray-500">Type to search customers.</div>
                ) : customers.length === 0 ? (
                  <div className="text-sm text-gray-500">No customers found.</div>
                ) : (
                  <div className="border rounded-lg divide-y overflow-hidden">
                    {customers.map((c) => {
                      const name =
                        c.name ||
                        c.customerName ||
                        c.fullName ||
                        `${c.firstName || ''} ${c.lastName || ''}`.trim();
                      const label = name || c.email || `Customer #${c.customerId}`;
                      const isSelected = selectedCustomer && selectedCustomer.customerId === c.customerId;

                      const city = c.city;
                      const stateLabel = c.stateName || c.state;
                      const zip = c.zipCode || c.zip;
                      const countryLabel = c.countryName || c.country;
                      const locationLine = [city, stateLabel, zip].filter(Boolean).join(', ');

                      return (
                        <button
                          key={c.customerId}
                          type="button"
                          onClick={() => {
                            clearError('customerId');
                            setSelectedCustomer(c);
                            setCustomerModalOpen(false);
                            setCustomerSearch('');
                            setCustomers([]);
                          }}
                          className={
                            `w-full text-left px-4 py-3 hover:bg-gray-50 focus:outline-none ` +
                            (isSelected ? 'bg-gray-100' : 'bg-white')
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-800 truncate">{`${c.customerId}. ${label}`}</div>
                              {(c.email || c.phone) && (
                                <div className="text-xs text-gray-500 mt-1 truncate">
                                  {[c.email, c.phone].filter(Boolean).join(' • ')}
                                </div>
                              )}

                              {(c.address || locationLine || countryLabel) && (
                                <div className="text-xs text-gray-500 mt-1 truncate">
                                  {c.address ? `ðŸ“ ${c.address}` : 'ðŸ“'}
                                  {locationLine ? ` • ${locationLine}` : ''}
                                  {countryLabel ? ` • ${countryLabel}` : ''}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <span className="text-[10px] text-gray-600 border border-gray-300 rounded-full px-2 py-1">Selected</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t bg-white flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCustomerModalOpen(false)}
                >
                  Cancel
                </Button>
                <LiquidGlassButton
                  type="button"
                  className="flex-1 !h-10 text-center"
                  onClick={() => setCustomerModalOpen(false)}
                >
                  Done
                </LiquidGlassButton>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {!isAddPaymentMode && (
        <CustomerFormModal
          open={addCustomerModalOpen}
          onOpenChange={(next) => {
            setAddCustomerModalOpen(next);
          }}
          mode="add"
          initialValues={customerFormData}
          defaultSalesPersonId={Number(selectedSalesPersonId) || 0}
          canPickSalesPerson={canPickSalesPerson}
          overlayZIndex={9999}
          onSaved={(created) => {
            clearError('customerId');
            setSelectedCustomer(created);
            setAddCustomerModalOpen(false);
            setCustomerModalOpen(false);
            setCustomerSearch('');
            setCustomers([]);
          }}
        />
      )}

      {/* Products modal */}
      {productsModalOpen && !isEditMode && !isAddPaymentMode && (
        <ModalPortal>
          <div className="create-order-modal fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="create-order-modal-surface my-auto w-full max-w-3xl bg-white dark:bg-[#17132a] rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 mx-4 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50/90 backdrop-blur">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Browse Products</h3>
                  <p className="text-xs text-gray-500">Search and select products to add to the order.</p>
                </div>
                <button
                  type="button"
                  className="liquid-close-btn"
                  onClick={() => setProductsModalOpen(false)}
                  aria-label="Close browse products modal"
                >
                  âœ•
                </button>
              </div>

              <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white flex-1 focus-within:ring-2 focus-within:ring-violet-500/30">
                  <Search size={16} className="text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search products here..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Clear product search"
                    >
                      <X size={14} className="text-gray-500" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs text-gray-600">
                    Selected: <span className="font-semibold">{selectedProductCount}</span>
                    {selectedProductQty > 0 ? <span> ({selectedProductQty} qty)</span> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuantities({});
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 bg-white hover:bg-gray-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                {loadingProducts ? (
                  <div className="space-y-2 animate-pulse">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-gray-50">
                        <div className="w-12 h-12 rounded-md bg-gray-200 flex-shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-200 rounded w-1/2" />
                          <div className="h-2.5 bg-gray-200 rounded w-1/3" />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-6 h-6 bg-gray-200 rounded-full" />
                          <div className="w-8 h-4 bg-gray-200 rounded" />
                          <div className="w-6 h-6 bg-gray-200 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-sm text-gray-500">No products found.</div>
                ) : (
                  products.map((p) => {
                    const qty = quantities[p.productId] || 0;
                    const totalPrice = qty * (p.price || 0);
                    return (
                      <div
                        key={p.productId}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-lg px-3 py-2 bg-gray-50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-md bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <ProductThumbnail src={p.photo} name={p.name} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div>
                            <div className="text-xs text-gray-500 truncate">{p.productType || 'Product'}</div>
                          </div>
                        </div>
                        <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-3">
                          <div className="flex items-center gap-1 bg-white rounded-full border px-2 py-1">
                            <button
                              type="button"
                              className="p-1 text-gray-600"
                              onClick={() => handleQtyChange(p.productId, -1)}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                            <button
                              type="button"
                              className="p-1 text-gray-600"
                              onClick={() => handleQtyChange(p.productId, 1)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <div className="text-left sm:text-right text-sm min-w-0">
                            <div className="text-gray-500">Price</div>
                            <div className="font-semibold text-gray-800">${p.price ?? 0}</div>
                          </div>
                          <div className="text-left sm:text-right text-sm min-w-0">
                            <div className="text-gray-500">Total</div>
                            <div className="font-semibold text-gray-800">${totalPrice}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-4 py-3 border-t bg-white flex flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setProductsModalOpen(false)}>
                  Done
                </Button>
                <LiquidGlassButton
                  type="button"
                  className="flex-1 w-full !h-10 !rounded-xl !text-sm !font-semibold text-center"
                  onClick={() => setProductsModalOpen(false)}
                >
                  Apply Selection
                </LiquidGlassButton>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Add Custom Item modal */}
      {customItemModalOpen && !isEditMode && !isAddPaymentMode && (
        <ModalPortal>
          <div className="create-order-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="create-order-modal-surface w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200 mx-4 overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50/90 backdrop-blur">
                <div>
                  <h3 className="text-base font-semibold text-gray-800">Add Custom Item</h3>
                  <p className="text-xs text-gray-500">This will also be saved in Products.</p>
                </div>
                <button
                  type="button"
                  className="liquid-close-btn"
                  onClick={() => setCustomItemModalOpen(false)}
                  aria-label="Close add custom item modal"
                >
                  âœ•
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleAddCustomItem();
                }}
                className="p-4 overflow-y-auto flex-1"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Item Name</label>
                    <input
                      value={customItemDraft.name}
                      onChange={handleCustomItemField('name')}
                      className={inputClass}
                      placeholder="Custom item name"
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Type</label>
                    <input
                      value={customItemDraft.productType}
                      onChange={handleCustomItemField('productType')}
                      className={inputClass}
                      placeholder="Type"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Price</label>
                    <input
                      value={customItemDraft.price}
                      onChange={handleCustomItemField('price')}
                      className={inputClass}
                      placeholder="$0.00"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Quantity</label>
                    <input
                      value={customItemDraft.quantity}
                      onChange={handleCustomItemField('quantity')}
                      className={inputClass}
                      placeholder="1"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelClass}>Image URL</label>
                    <input
                      value={customItemDraft.imageUrl}
                      onChange={handleCustomItemField('imageUrl')}
                      className={inputClass}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-slate-300 dark:border-slate-600 font-semibold"
                    onClick={() => setCustomItemModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <LiquidGlassButton type="submit" className="flex-1 w-full !h-11 !rounded-xl !text-sm !font-semibold text-center">
                    Add
                  </LiquidGlassButton>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      <div className="w-full rounded-2xl border border-slate-200 bg-white/75 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#100d1d]/70 sm:p-4">
        <fieldset disabled={isOrderEditMode && (loadingOrder || !!orderLoadError)} className="contents"><div className="create-order-layout flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start">
          {/* Left: products & order summary */}
          <div className="order-first flex min-w-0 flex-1 flex-col gap-4">
            {!isEditMode && !isAddPaymentMode && (
              <div className="create-order-section overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#17132a]">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-violet-50 via-white to-indigo-50 px-4 py-3 dark:border-white/10 dark:from-violet-500/15 dark:via-transparent dark:to-indigo-500/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 p-2 shadow-sm">
                      <Package size={16} className="text-white" />
                    </div>
                    <h2 className={`text-sm font-semibold ${getError('orderItems') ? 'text-red-700 dark:text-red-300' : 'text-gray-800'}`}>Products</h2>
                  </div>

                  {/* Show the product dropdown for every role (Sales Agent included). */}
                  <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 w-full sm:w-[340px] shrink">
                      <Select
                        value={selectedProductDropdownId}
                        onValueChange={handleProductDropdownSelect}
                        disabled={loadingProductDropdown}
                      >
                        <SelectTrigger className={selectTriggerCompactClass}>
                          <SelectValue
                            placeholder={loadingProductDropdown ? 'Loading products...' : 'Select product'}
                          />
                        </SelectTrigger>
                        <SelectContent
                          search={(
                            <SelectSearchInput
                              value={productSelectSearchText}
                              onChange={setProductSelectSearchText}
                              placeholder="Search products..."
                            />
                          )}
                        >
                          {filteredProductDropdownItems.length === 0 ? (
                            <div className="px-3 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                              {loadingProductDropdown ? 'Loading products...' : 'No products found.'}
                            </div>
                          ) : filteredProductDropdownItems.map((p) => (
                            <SelectItem
                              key={p.productId}
                              value={String(p.productId)}
                              textValue={p.name || 'Unnamed Product'}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-md bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  <ProductThumbnail src={p.photo} name={p.name} />
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                    {p.name || 'Unnamed Product'}
                                  </div>
                                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                                    {(p.productType || 'Product')} · ${Number(p.price || 0).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end shrink-0">
                      <LiquidGlassButton
                        type="button"
                        onClick={() => setProductsModalOpen(true)}
                        className="!w-full sm:!w-auto !px-3 sm:!px-4 !py-2 !text-xs !font-semibold whitespace-nowrap"
                      >
                        {selectedProductCount > 0
                          ? `Browse Products (${selectedProductCount})`
                          : 'Browse Products'}
                      </LiquidGlassButton>

                      {canAddCustomItem ? (
                        <LiquidGlassButton
                          type="button"
                          onClick={() => setCustomItemModalOpen(true)}
                          className="!w-full sm:!w-auto !px-3 sm:!px-4 !py-2 !text-xs !font-semibold whitespace-nowrap"
                        >
                          + Add Custom Item
                        </LiquidGlassButton>
                      ) : null}
                    </div>
                  </div>
                </div>

                {getError('orderItems') && (
                  <div className="px-4 pt-2 text-xs font-medium text-red-600 dark:text-red-400">
                    {getError('orderItems')}
                  </div>
                )}

                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                  {customItems.length === 0 && selectedProductLines.length === 0 && (
                    <div className="text-sm text-gray-500">
                      No items yet. Use <span className="font-semibold">Browse Products</span> or the
                      <span className="font-semibold"> product dropdown</span> to add
                      {canAddCustomItem ? (
                        <>
                          from your catalog or <span className="font-semibold">+ Add Custom Item</span> for
                          a one-off item.
                        </>
                      ) : (
                        <>from your catalog.</>
                      )}
                    </div>
                  )}

                  {selectedProductLines.length > 0 &&
                    selectedProductLines.map((p) => {
                      const qty = quantities[p.productId] || p.quantity || 0;
                      const totalPrice = qty * (Number(p.paidPrice ?? p.price) || 0);
                      const priceDisplay =
                        productPriceOverrides?.[p.productId] !== undefined
                          ? productPriceOverrides[p.productId]
                          : String(p.price ?? '');
                      const priceWidthCh = Math.min(
                        14,
                        Math.max(7, String(priceDisplay || '0.00').length + 3),
                      );
                      return (
                        <div
                          key={p.productId}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-lg px-3 py-2 bg-gray-50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-md bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                              <ProductThumbnail src={p.photo} name={p.name} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div>
                              <div className="text-xs text-gray-500 truncate">{p.productType || 'Product'}</div>
                            </div>
                          </div>
                          <div className="w-full sm:w-auto grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
                            <div className="col-span-2 sm:col-span-1 justify-self-start flex items-center gap-1 bg-white rounded-full border px-2 py-1">
                              <button
                                type="button"
                                className="p-1 text-gray-600"
                                onClick={() => handleQtyChange(p.productId, -1)}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                              <button
                                type="button"
                                className="p-1 text-gray-600"
                                onClick={() => handleQtyChange(p.productId, 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <div className="text-left sm:text-right text-sm min-w-0">
                              <div className="flex justify-start sm:justify-end">
                                <div className="relative inline-block w-full max-w-[130px] sm:w-auto" style={{ width: `${priceWidthCh}ch` }}>
                                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-gray-500">
                                    $
                                  </span>
                                  <input
                                    value={priceDisplay}
                                    onClick={() => handleProductPriceOverrideClick(p.productId)}
                                    onChange={(e) => handleProductPriceOverrideChange(p.productId, e.target.value)}
                                    onBlur={() => handleProductPriceOverrideBlur(p.productId)}
                                    className="h-8 w-full pl-5 pr-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                                    placeholder="0.00"
                                    inputMode="decimal"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="text-left sm:text-right text-sm min-w-0 flex items-center sm:block">
                              <div className="font-semibold text-gray-800"> Total : ${totalPrice}</div>
                            </div>
                            <button
                              type="button"
                              className="col-span-2 sm:col-span-1 justify-self-end p-1 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400"
                              onClick={() => clearSelectedProduct(p.productId)}
                              title="Remove product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {customItems.length > 0 &&
                    customItems.map((item) => {
                      const qty = item.quantity || 0;
                      const totalPrice = qty * (item.price || 0);
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-lg px-3 py-2 bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-md bg-gray-200 flex items-center justify-center overflow-hidden">
                              <ProductThumbnail src={item.imageUrl} name={item.name} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-800">{item.name}</div>
                              <div className="text-xs text-gray-500">{item.productType || 'Custom Item'}</div>
                            </div>
                          </div>
                          <div className="w-full sm:w-auto grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
                            <div className="col-span-2 sm:col-span-1 justify-self-start flex items-center gap-1 bg-white rounded-full border px-2 py-1">
                              <button
                                type="button"
                                className="p-1 text-gray-600"
                                onClick={() => handleCustomItemQtyChange(item.id, -1)}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                              <button
                                type="button"
                                className="p-1 text-gray-600"
                                onClick={() => handleCustomItemQtyChange(item.id, 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <div className="text-left sm:text-right text-sm min-w-0">
                              <div className="text-gray-500">Price</div>
                              <div className="font-semibold text-gray-800">${item.price ?? 0}</div>
                            </div>
                            <div className="text-left sm:text-right text-sm min-w-0">
                              <div className="text-gray-500">Total</div>
                              <div className="font-semibold text-gray-800">${totalPrice}</div>
                            </div>
                            <button
                              type="button"
                              className="col-span-2 sm:col-span-1 justify-self-end p-1 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400"
                              onClick={() => handleRemoveCustomItem(item.id)}
                              title="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {!isEditMode && !isAddPaymentMode && (
              <div className="create-order-section overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#17132a]">
                <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 via-white to-indigo-50 px-4 py-3 dark:border-white/10 dark:from-violet-500/15 dark:via-transparent dark:to-indigo-500/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 p-2 shadow-sm">
                      <BadgePercent size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800">Discounts</h3>
                  </div>
                </div>

                <div className="p-4">

                  {/* Discount Input Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
                    <div>
                      <label className={labelClass}>Discount Type</label>
                      {discountTypeOptions.length > 0 ? (
                        <Select
                          value={discountType || ''}
                          onValueChange={(value) => {
                            setDiscountType(value);
                          }}
                          disabled={productSavings > 0}
                        >
                          <SelectTrigger className={selectTriggerClass}>
                            <SelectValue placeholder="Select Discount Type" />
                          </SelectTrigger>
                          <SelectContent className="w-[var(--radix-select-trigger-width)]">
                            {discountTypeOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.name}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <input
                          type="text"
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value)}
                          className={inputClass}
                          placeholder="Discount type"
                          readOnly={productSavings > 0}
                        />
                      )}
                    </div>
                    <div>
                      {isPercentDiscount ? (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 min-w-0">
                            <label className={labelClass}>Discount Amount ($)</label>
                            <input
                              type="text"
                              value={orderSummary.discount.toFixed(2)}
                              readOnly
                              className={`${inputClass} bg-slate-50`}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className={labelClass}>Discount (%)</label>
                            <input
                              type="number"
                              value={discountPercent}
                              onChange={(e) => setDiscountPercent(e.target.value)}
                              className={inputClass}
                              placeholder="0"
                              min="0"
                              max="100"
                              step="0.01"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <label className={labelClass}>Discount Amount ($)</label>
                          <input
                            type="number"
                            value={discountAmount}
                            onFocus={() => {
                              // Clear the placeholder 0 so typing replaces it
                              // instead of appending to it.
                              if (Number(discountAmount) === 0) setDiscountAmount('');
                            }}
                            onBlur={() => {
                              // Left empty: fall back to 0 rather than a blank field.
                              if (String(discountAmount).trim() === '') setDiscountAmount(0);
                            }}
                            onChange={(e) => {
                              setDiscountAmount(e.target.value);
                              applyAutoDiscountCode(e.target.value);
                            }}
                            className={productSavings > 0 ? `${inputClass} bg-slate-50` : inputClass}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            readOnly={productSavings > 0}
                          />
                          {productSavings > 0 && (
                            <div className="mt-1 text-[11px] text-slate-500">Auto-applied from product price reduction</div>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Discount Code</label>
                      <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value)}
                        className={productSavings > 0 ? `${inputClass} bg-slate-50` : inputClass}
                        placeholder="Promo code"
                        readOnly={productSavings > 0}
                      />
                    </div>
                  </div>

                </div>
              </div>
            )}

            {!isEditMode && !isAddPaymentMode && (
              <div className="create-order-section overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#17132a]">
                <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 via-white to-indigo-50 px-4 py-3 dark:border-white/10 dark:from-violet-500/15 dark:via-transparent dark:to-indigo-500/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 p-2 shadow-sm">
                      <CalendarClock size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800">Subscription</h3>
                  </div>
                </div>

                <div className="p-4">
                  <label className={labelClass}>Subscription (Months)<RequiredMark /></label>

                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2">
                    {SUBSCRIPTION_MONTH_OPTIONS.map((months) => {
                      const isSelected = !subscriptionCustom && Number(subscriptionMonths) === months;

                      return (
                        <button
                          key={months}
                          type="button"
                          onClick={() => {
                            clearError('subscriptionMonths');
                            setSubscriptionCustom(false);
                            setSubscriptionMonths(months);
                          }}
                          className={cn(
                            'h-10 rounded-lg border text-sm font-semibold transition-colors',
                            isSelected
                              ? 'border-purple-500 bg-purple-500 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-500/40 hover:bg-purple-50 dark:hover:bg-purple-500/15',
                          )}
                        >
                          {months}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        clearError('subscriptionMonths');
                        setSubscriptionCustom(true);
                        setSubscriptionMonths('');
                      }}
                      className={cn(
                        'h-10 rounded-lg border text-sm font-semibold transition-colors',
                        subscriptionCustom
                          ? 'border-purple-500 bg-purple-500 text-white shadow-sm'
                          : 'border-dashed border-slate-300 dark:border-slate-600 bg-white text-slate-600 hover:border-purple-300 dark:hover:border-purple-500/40 hover:bg-purple-50 dark:hover:bg-purple-500/15',
                      )}
                    >
                      Custom
                    </button>
                  </div>

                  {subscriptionCustom && (
                    <div className="mt-3 max-w-[220px]">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        autoFocus
                        value={subscriptionMonths}
                        onChange={(e) => {
                          clearError('subscriptionMonths');
                          const raw = e.target.value;
                          if (raw === '') {
                            setSubscriptionMonths('');
                            return;
                          }
                          const next = Number(raw);
                          setSubscriptionMonths(Number.isFinite(next) ? Math.max(0, Math.trunc(next)) : '');
                        }}
                        className={withErrorClass(inputClass, getError('subscriptionMonths'))}
                        placeholder="Enter months"
                      />
                    </div>
                  )}

                  <FieldError errorKey="subscriptionMonths" />
                </div>
              </div>
            )}

            {/* Payment Information now below order summary */}
            {!isOrderEditMode && (<div className="create-order-section overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#17132a]">
              <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 via-white to-indigo-50 px-4 py-3 dark:border-white/10 dark:from-violet-500/15 dark:via-transparent dark:to-indigo-500/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 p-2 shadow-sm">
                      <CreditCard size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 truncate">
                      {isEditMode ? 'Payment Information (Edit)' : isAddPaymentMode ? 'Add Payment' : 'Payment Information'}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
                    {(isEditMode || isAddPaymentMode) && (
                      <>
                        {isEditMode && (
                          <span className="text-xs text-gray-700 bg-white/60 dark:bg-white/10 border border-gray-200 dark:border-white/15 px-2 py-1 rounded-full">
                            Payment #{payment.paymentId || paymentIdForEdit}
                          </span>
                        )}
                        <span className="text-xs text-gray-700 bg-white/60 dark:bg-white/10 border border-gray-200 dark:border-white/15 px-2 py-1 rounded-full">
                          Order #{payment.orderId || orderDataFromState?.orderId || ''}
                        </span>
                        <span className="text-xs text-gray-600">
                          Current: <span className="font-semibold capitalize">{activeTab}</span>
                        </span>
                        {isEditMode && (
                          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-medium">
                            Editable Section
                          </span>
                        )}
                      </>
                    )}

                    {/* Amount lives in the header, tinted with the same
                          green-to-emerald wash as the header bar itself. */}
                    <div className="flex h-9 items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1 shadow-sm dark:border-violet-500/30 dark:bg-white/[0.06]">
                      <span className="whitespace-nowrap text-xs font-bold text-violet-700 dark:text-violet-300">Amount: ${formatMoney2(payment.amount)}</span>
                    </div>
                  </div>
                </div>
                {isEditMode && (
                  <p className="text-xs text-gray-600 mt-1">You can update payment details and change payment type below</p>
                )}
              </div>
              <div className="px-4 pt-3">
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-sm sm:grid-cols-3 sm:gap-3 sm:text-base md:grid-cols-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <button
                      type="button"
                      onClick={() => handlePaymentTabChange('card')}
                      className={`w-full rounded-xl px-3 py-2 border text-center flex items-center justify-center transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 ${activeTab === 'card'
                        ? 'border-violet-500 bg-gradient-to-br from-violet-600 to-indigo-600 text-white ring-2 ring-violet-500/15 shadow-violet-500/20'
                        : 'bg-white text-slate-700 dark:text-slate-300 border-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="inline-flex flex-row items-center justify-center gap-1.5">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${activeTab === 'card' ? 'bg-white/15 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>
                          <CreditCard size={18} aria-hidden="true" />
                        </span>
                        <span className="font-semibold leading-none">Card</span>
                      </span>
                    </button>
                  <button
                      type="button"
                      onClick={() => handlePaymentTabChange('bank')}
                      className={`w-full rounded-xl px-3 py-2 border text-center flex items-center justify-center transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 ${activeTab === 'bank'
                        ? 'border-violet-500 bg-gradient-to-br from-violet-600 to-indigo-600 text-white ring-2 ring-violet-500/15 shadow-violet-500/20'
                        : 'bg-white text-slate-700 dark:text-slate-300 border-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="inline-flex flex-row items-center justify-center gap-1.5">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${activeTab === 'bank' ? 'bg-white/15 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>
                          <Landmark size={18} aria-hidden="true" />
                        </span>
                        <span className="font-semibold leading-none">Bank</span>
                      </span>
                    </button>
                  <button
                      type="button"
                      onClick={() => handlePaymentTabChange('cheque')}
                      className={`w-full rounded-xl px-3 py-2 border text-center flex items-center justify-center transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 ${activeTab === 'cheque'
                        ? 'border-violet-500 bg-gradient-to-br from-violet-600 to-indigo-600 text-white ring-2 ring-violet-500/15 shadow-violet-500/20'
                        : 'bg-white text-slate-700 dark:text-slate-300 border-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="inline-flex flex-row items-center justify-center gap-1.5">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${activeTab === 'cheque' ? 'bg-white/15 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>
                          <FileCheck2 size={18} aria-hidden="true" />
                        </span>
                        <span className="font-semibold leading-none">Cheque</span>
                      </span>
                    </button>
                  <button
                      type="button"
                      onClick={() => handlePaymentTabChange('zelle')}
                      className={`w-full rounded-xl px-3 py-2 border text-center flex items-center justify-center transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 ${activeTab === 'zelle'
                        ? 'border-violet-500 bg-gradient-to-br from-violet-600 to-indigo-600 text-white ring-2 ring-violet-500/15 shadow-violet-500/20'
                        : 'bg-white text-slate-700 dark:text-slate-300 border-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="inline-flex flex-row items-center justify-center gap-1.5">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${activeTab === 'zelle' ? 'bg-white/15 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>
                          <Zap size={18} aria-hidden="true" />
                        </span>
                        <span className="font-semibold leading-none">Zelle</span>
                      </span>
                    </button>
                  <button
                      type="button"
                      onClick={() => handlePaymentTabChange('paypal')}
                      className={`w-full rounded-xl px-3 py-2 border text-center flex items-center justify-center transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 ${activeTab === 'paypal'
                        ? 'border-violet-500 bg-gradient-to-br from-violet-600 to-indigo-600 text-white ring-2 ring-violet-500/15 shadow-violet-500/20'
                        : 'bg-white text-slate-700 dark:text-slate-300 border-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="inline-flex flex-row items-center justify-center gap-1.5">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${activeTab === 'paypal' ? 'bg-white/15 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>
                          <WalletCards size={18} aria-hidden="true" />
                        </span>
                        <span className="font-semibold leading-none">PayPal</span>
                      </span>
                    </button>
                </div>
                <FieldError errorKey="payment.paymentType" />

                <div className="mb-3">
                  {(isEditMode || isAddPaymentMode) && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Payment Status</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          onClick={handlePaymentStatusToggle('isVoid')}
                          className={`px-3 py-1 rounded-full border ${payment.isVoid
                            ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-400'
                            : 'bg-white text-gray-700 border-gray-200'
                            }`}
                        >
                          Void
                        </button>
                        <button
                          type="button"
                          onClick={handlePaymentStatusToggle('isChargeBack')}
                          className={`px-3 py-1 rounded-full border ${payment.isChargeBack
                            ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-400'
                            : 'bg-white text-gray-700 border-gray-200'
                            }`}
                        >
                          Chargeback
                        </button>
                        <button
                          type="button"
                          onClick={handlePaymentStatusToggle('isRetrieval')}
                          className={`px-3 py-1 rounded-full border ${payment.isRetrieval
                            ? 'bg-amber-50 text-amber-600 border-amber-400'
                            : 'bg-white text-gray-700 border-gray-200'
                            }`}
                        >
                          Retrieval
                        </button>
                        <button
                          type="button"
                          onClick={handlePaymentStatusToggle('isAlert')}
                          className={`px-3 py-1 rounded-full border ${payment.isAlert
                            ? 'bg-amber-50 text-amber-600 border-amber-400'
                            : 'bg-white text-gray-700 border-gray-200'
                            }`}
                        >
                          Alert
                        </button>
                      </div>
                    </div>
                  )}

                  {(Number(payment?.brandId) > 0 || Number(payment?.gatewayId) > 0) && (
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={clearPaymentBrandAndGateway}
                        title="Clear brand & gateway"
                        aria-label="Clear brand and gateway"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                      >
                        <Eraser size={15} aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-sm">
                    <div className={activeTab === 'card' ? 'lg:col-span-6' : 'lg:col-span-12'}>
                      <label className={labelClass}>Brand<RequiredMark /></label>
                      <Select
                        value={payment.brandId ? String(payment.brandId) : ''}
                        onValueChange={(value) => {
                          const id = value ? Number(value) : 0;
                          clearError('payment.brandId');
                          clearError('payment.gatewayId');
                          clearError('payment.paymentType');
                          setPayment((prev) => {
                            const prevBrandId = Number(prev?.brandId) || 0;
                            const next = { ...prev, brandId: id };
                            if (prevBrandId !== id) next.gatewayId = 0;
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className={withErrorClass(selectTriggerCompactClass, getError('payment.brandId'))}>
                          <SelectValue placeholder="Select Brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentBrands.length > 0 ? (
                            paymentBrands.map((brand) => {
                              const brandId = Number(brand?.brandId ?? brand?.BrandId ?? brand?.id) || 0;
                              if (!brandId) return null;
                              const brandLabel =
                                brand?.brandDisplayName ||
                                brand?.brandName ||
                                brand?.BrandName ||
                                brand?.name ||
                                `Brand ${brandId}`;

                              return (
                                <SelectItem key={brandId} value={String(brandId)}>
                                  {brandLabel}
                                </SelectItem>
                              );
                            })
                          ) : (
                            <div className="px-3 py-2 text-xs text-slate-500">No brands found with active payment types</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FieldError errorKey="payment.brandId" />
                    </div>

                    {activeTab === 'card' && (<div className="lg:col-span-6">
                      <label className={labelClass}>Gateway<RequiredMark /></label>
                      <Select
                        value={payment.gatewayId ? String(payment.gatewayId) : ''}
                        disabled={!Number(payment.brandId) || loadingBrandGateways}
                        onValueChange={(value) => {
                          const id = value ? Number(value) : 0;
                          clearError('payment.gatewayId');
                          clearError('payment.paymentType');
                          const nextGateway = (gateways || []).find((gateway) => getGatewayIdValue(gateway) === id);
                          // Picking a gateway fills the brand in. The map is
                          // tried first because it also covers gateways whose
                          // brand only appears on the payment-type records.
                          const nextBrandId = gatewayBrandIdByGatewayId.get(id) || getGatewayBrandIdValue(nextGateway);
                          clearError('payment.brandId');
                          setPayment((prev) => ({
                            ...prev,
                            gatewayId: id,
                            brandId: nextBrandId || prev.brandId,
                          }));
                        }}
                      >
                        <SelectTrigger className={withErrorClass(selectTriggerCompactClass, getError('payment.gatewayId'))}>
                          <SelectValue placeholder={!Number(payment.brandId) ? 'Select a brand first' : loadingBrandGateways ? 'Loading gateways...' : 'Select Gateway'} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredGateways.length > 0 ? (
                            filteredGateways.map((gateway) => (
                              <SelectItem key={getGatewayIdValue(gateway)} value={String(getGatewayIdValue(gateway))}>
                                {getGatewayNameValue(gateway) || `Gateway ${getGatewayIdValue(gateway)}`}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-xs text-slate-500">
                              {Number(payment?.brandId)
                                ? 'No active gateways are set up for this brand'
                                : `No gateways accept ${paymentTypeFromTab(activeTab) || 'this payment type'}`}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FieldError errorKey="payment.gatewayId" />
                    </div>)}

                    {/* Amount moved up into the section header. */}
                    <div className="lg:col-span-12">
                      <FieldError errorKey="payment.amount" />
                    </div>

                  </div>
                </div>

                {/* Tab-specific fields styled like real cards */}
                <div className="space-y-3 text-sm pb-4">
                  {activeTab === 'card' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="flex items-center justify-center xl:justify-center">
                        <div
                          className="w-full max-w-md rounded-2xl overflow-hidden shadow-md border border-slate-200"
                          style={{ aspectRatio: '1.586 / 1' }}
                        >
                          <div className="relative h-full w-full bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-950">
                            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.25),transparent_55%)]" />
                            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139, 92, 246,0.25),transparent_55%)]" />

                            <div className="relative h-full w-full p-5 flex flex-col justify-between text-white">
                              <div className="flex items-start justify-between">
                                <div className="text-sm font-semibold tracking-wide opacity-95">
                                  {cardPreview.type || 'Card'}
                                </div>
                                <div className="flex items-center gap-3">
                                  <svg
                                    width="22"
                                    height="22"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="opacity-90"
                                  >
                                    <path
                                      d="M2 9.5C6.4 6.2 10.8 6.2 15.2 9.5"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                      strokeLinecap="round"
                                    />
                                    <path
                                      d="M2 13C6 10.4 10 10.4 14 13"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                      strokeLinecap="round"
                                    />
                                    <path
                                      d="M2 16.5C5.2 14.6 8.4 14.6 11.6 16.5"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                  {cardPreview.type === 'Mastercard' ? (
                                    <div className="relative h-8 w-14">
                                      <span className="absolute left-1 top-0 h-8 w-8 rounded-full bg-[#EB001B]/90" />
                                      <span className="absolute left-5 top-0 h-8 w-8 rounded-full bg-[#F79E1B]/90 mix-blend-screen" />
                                    </div>
                                  ) : cardPreview.type === 'Visa' ? (
                                    <div className="text-sm font-bold tracking-widest">VISA</div>
                                  ) : cardPreview.type === 'American Express' ? (
                                    <div className="text-xs font-bold tracking-widest">AMEX</div>
                                  ) : cardPreview.type === 'Discover' ? (
                                    <div className="text-xs font-bold tracking-widest">DISCOVER</div>
                                  ) : (
                                    <div className="text-xs font-semibold tracking-widest">CARD</div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="h-9 w-12 rounded-md bg-gradient-to-br from-yellow-200/90 to-amber-400/90 border border-yellow-100/40" />
                              </div>

                              <div className="text-lg sm:text-2xl font-semibold tracking-[0.12em] sm:tracking-[0.18em] leading-tight break-words">
                                {cardPreview.displayNumber}
                              </div>

                              <div className="flex items-end justify-between text-xs sm:text-sm tracking-wide">
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase opacity-75">Cardholder</div>
                                  <div className="font-semibold truncate">{cardPreview.displayName}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] uppercase opacity-75">Expiry</div>
                                  <div className="font-semibold">{cardPreview.displayExpiry}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <label className={labelClass}>Card Number<RequiredMark /></label>
                          <input
                            value={formattedCardNumber}
                            onChange={handleCardNumberChange}
                            className={withErrorClass(inputClass, getError('payment.cardNumber'))}
                            placeholder="0000 0000 0000 0000"
                            inputMode="numeric"
                            autoComplete="cc-number"
                            maxLength={19}
                          />
                          <FieldError errorKey="payment.cardNumber" />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>Card Type<RequiredMark /></label>
                          <Select
                            value={payment.cardType || ''}
                            onValueChange={(value) => {
                              setCardTypeTouched(true);
                              clearError('payment.cardType');
                              setPayment((prev) => ({ ...prev, cardType: value }));
                            }}
                          >
                            <SelectTrigger className={withErrorClass(selectTriggerClass, getError('payment.cardType'))}>
                              <SelectValue placeholder="Select Card Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {cardTypes.length > 0 ? (
                                cardTypes.map((type) => (
                                  <SelectItem key={type.id || type.name} value={type.name}>
                                    {type.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-xs text-slate-500">No active card types found</div>
                              )}
                            </SelectContent>
                          </Select>
                          <FieldError errorKey="payment.cardType" />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>Name on Card<RequiredMark /></label>
                          <input
                            value={payment.nameOnCard || ''}
                            onChange={handleNameOnCardChange}
                            className={withErrorClass(inputClass, getError('payment.nameOnCard'))}
                            placeholder="Cardholder Name"
                            autoComplete="cc-name"
                          />
                          <FieldError errorKey="payment.nameOnCard" />
                        </div>
                        <div>
                          <label className={labelClass}>Expiry<RequiredMark /></label>
                          <input
                            value={payment.cardExpiryDate || ''}
                            onChange={handleExpiryChange}
                            className={withErrorClass(inputClass, getError('payment.cardExpiryDate'))}
                            placeholder="MM/YY"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                          />
                          <FieldError errorKey="payment.cardExpiryDate" />
                        </div>
                        <div>
                          <label className={labelClass}>CVV<RequiredMark /></label>
                          <input
                            value={payment.cvv || ''}
                            onChange={handleCvvChange}
                            className={withErrorClass(inputClass, getError('payment.cvv'))}
                            placeholder={(payment.cardType || cardPreview.type) === 'American Express' ? '1234' : '123'}
                            inputMode="numeric"
                            autoComplete="cc-csc"
                          />
                          <FieldError errorKey="payment.cvv" />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>Auth Code</label>
                          <input
                            value={payment.authCode || ''}
                            onChange={handlePaymentField('authCode')}
                            className={inputClass}
                            placeholder="Auth code"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>Transaction ID</label>
                          <input
                            value={payment.transactionId || ''}
                            onChange={handlePaymentField('transactionId')}
                            className={withErrorClass(inputClass, getError('payment.transactionId'))}
                            placeholder="Transaction ID"
                          />
                          <FieldError errorKey="payment.transactionId" />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'bank' && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="flex items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-4 dark:border-violet-500/20 dark:from-violet-500/[0.08] dark:to-indigo-500/[0.04] sm:p-6">
                        <div
                          className="relative min-h-[220px] w-full max-w-md overflow-hidden rounded-2xl border border-violet-300/40 bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-950 shadow-xl shadow-violet-950/15 sm:min-h-[240px]"
                        >
                          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/10 bg-violet-400/10" />
                          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full border border-white/10 bg-indigo-400/10" />
                          <div className="relative w-full p-5 text-white sm:p-6">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                                  Bank Transfer
                                </div>
                                <div className="mt-1 truncate text-base font-semibold text-white">
                                  {bankPreview.holder || 'Account holder'}
                                </div>
                              </div>
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-violet-100 shadow-sm backdrop-blur-sm">
                                <Landmark size={21} aria-hidden="true" />
                              </div>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 text-sm">
                              <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-sm">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Account Number</div>
                                <div className="mt-1 min-h-[20px] break-words font-mono font-semibold tracking-[0.12em] text-white">
                                  {bankPreview.acctDisplay || '•••• •••• ••••'}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-sm">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Routing / IFSC</div>
                                  <div className="mt-1 min-h-[20px] break-words font-semibold text-white">
                                    {bankPreview.routingOrIfsc || 'Not entered'}
                                  </div>
                                </div>
                                <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-sm">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Reference</div>
                                  <div className="mt-1 min-h-[20px] break-words font-semibold text-white">
                                    {bankPreview.reference || 'Not entered'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="create-order-section rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#17132a]">
                        <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                            <Landmark size={19} aria-hidden="true" />
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bank transfer details</div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Enter the receiving account and routing information.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <label className={labelClass}>Account Holder Name<RequiredMark /></label>
                            <input
                              value={payment.nameOnCard || ''}
                              onChange={handleNameOnCardChange}
                              className={withErrorClass(inputClass, getError('payment.nameOnCard'))}
                              placeholder="Account holder name"
                            />
                            <FieldError errorKey="payment.nameOnCard" />
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Account Number<RequiredMark /></label>
                            <input
                              value={bankAccountNumberFormatted}
                              onChange={handleBankAccountNumberChange}
                              className={withErrorClass(inputClass, getError('payment.cardNumber'))}
                              placeholder="Account number"
                              inputMode="numeric"
                            />
                            <FieldError errorKey="payment.cardNumber" />
                          </div>
                          <div>
                            <label className={labelClass}>Routing / IFSC<RequiredMark /></label>
                            <input
                              value={payment.chequeRoutingNo || ''}
                              onChange={handleBankRoutingIfscChange}
                              className={withErrorClass(inputClass, getError('payment.chequeRoutingNo'))}
                              placeholder="Routing number or IFSC"
                            />
                            <FieldError errorKey="payment.chequeRoutingNo" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'cheque' && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="flex items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-4 dark:border-violet-500/20 dark:from-violet-500/[0.08] dark:to-indigo-500/[0.04] sm:p-6">
                        <div
                          className="w-full max-w-xl overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-xl shadow-violet-950/10 dark:border-violet-500/25 dark:bg-slate-900"
                          style={{ aspectRatio: '2.35 / 1' }}
                        >
                          <div className="relative h-full w-full bg-gradient-to-br from-white via-violet-50 to-indigo-100 dark:from-slate-900 dark:via-violet-950/50 dark:to-indigo-950">
                            <div className="absolute inset-0 opacity-60 bg-[linear-gradient(135deg,rgba(139,92,246,0.10)_0%,rgba(139,92,246,0.10)_18%,transparent_18%,transparent_35%,rgba(99,102,241,0.08)_35%,rgba(99,102,241,0.08)_55%,transparent_55%,transparent_100%)]" />
                            <div className="relative h-full w-full p-4 text-slate-800 dark:text-slate-200">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm">
                                    <FileCheck2 size={15} aria-hidden="true" />
                                  </span>
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">DashboardKit</div>
                                    <div className="text-[9px] font-semibold uppercase tracking-wide opacity-65">Payment cheque</div>
                                  </div>
                                </div>
                                <div className="w-24 sm:w-[120px] text-right">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">DATE</div>
                                  <div className="mt-0.5 text-xs font-semibold">
                                    {chequePreview.date || 'MM/DD/YYYY'}
                                  </div>
                                  <div className="h-[1px] bg-slate-700/25 mt-1" />
                                </div>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70 whitespace-nowrap">
                                  PAY TO THE ORDER OF
                                </div>
                                <div className="flex-1">
                                  <div className="text-xs font-semibold truncate min-h-[16px]">{chequePreview.payee || 'Payee name'}</div>
                                  <div className="h-[1px] bg-slate-700/25 mt-1" />
                                </div>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">$</div>
                                <div className="w-44">
                                  <div className="text-xs font-semibold min-h-[16px] text-right">{chequePreview.amount || '0.00'}</div>
                                  <div className="h-[1px] bg-slate-700/25 mt-1" />
                                </div>
                                <div className="flex-1 text-right">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">DOLLARS</div>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">FOR</div>
                                <div className="flex-1">
                                  <div className="text-xs font-semibold truncate min-h-[16px]">{chequePreview.memo || 'Payment reference'}</div>
                                  <div className="h-[1px] bg-slate-700/25 mt-1" />
                                </div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                                  {payment.isChequeCleared ? 'CLEARED' : ''}
                                </div>
                              </div>

                              <div className="absolute left-4 right-4 bottom-4">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <div className="font-mono tracking-wider">
                                    {chequePreview.routing ? `|:${chequePreview.routing}:|` : ''}
                                  </div>
                                  <div className="flex-1 font-mono tracking-wider text-center truncate">
                                    {chequePreview.accountOrTracking ? `|:${chequePreview.accountOrTracking}:|` : ''}
                                  </div>
                                  <div className="font-mono tracking-wider">
                                    {chequePreview.chequeNo ? `|${chequePreview.chequeNo}|` : ''}
                                  </div>
                                </div>
                                <div className="h-[1px] bg-slate-900/15 mt-1" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="create-order-section rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#17132a]">
                        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                              <FileCheck2 size={19} aria-hidden="true" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cheque details</div>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Record cheque and clearing information.</p>
                            </div>
                          </div>
                          <label className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                            <Checkbox
                              size="sm"
                              checked={!!payment.isChequeCleared}
                              onCheckedChange={(checked) => {
                                clearError('payment.isChequeCleared');
                                setPayment((prev) => ({ ...prev, isChequeCleared: !!checked }));
                              }}
                            />
                            Cheque Cleared
                          </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <label className={labelClass}>Pay To (Name)<RequiredMark /></label>
                            <input
                              value={payment.nameOnCard || ''}
                              onChange={handleNameOnCardChange}
                              className={withErrorClass(inputClass, getError('payment.nameOnCard'))}
                              placeholder="Payee name"
                            />
                            <FieldError errorKey="payment.nameOnCard" />
                          </div>
                          <div>
                            <label className={labelClass}>Cheque Date<RequiredMark /></label>
                            <input
                              type="date"
                              value={paymentDateForInput}
                              onChange={(e) => {
                                clearError('payment.paymentDate');
                                setPayment((prev) => ({ ...prev, paymentDate: e.target.value }));
                              }}
                              className={withErrorClass(inputClass, getError('payment.paymentDate'))}
                            />
                            <FieldError errorKey="payment.paymentDate" />
                          </div>
                          <div>
                            <label className={labelClass}>Routing No<RequiredMark /></label>
                            <input
                              value={payment.chequeRoutingNo || ''}
                              onChange={handleChequeRoutingChange}
                              className={withErrorClass(inputClass, getError('payment.chequeRoutingNo'))}
                              placeholder="Routing number"
                              inputMode="numeric"
                            />
                            <FieldError errorKey="payment.chequeRoutingNo" />
                          </div>
                          <div>
                            <label className={labelClass}>Cheque No<RequiredMark /></label>
                            <input
                              value={payment.chequeNo || ''}
                              onChange={handleChequeNoChange}
                              className={withErrorClass(inputClass, getError('payment.chequeNo'))}
                              placeholder="Cheque number"
                              inputMode="numeric"
                              maxLength={6}
                            />
                            <FieldError errorKey="payment.chequeNo" />
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Account / Tracking No</label>
                            <input
                              value={payment.chequeTrackingNo || ''}
                              onChange={handleChequeTrackingChange}
                              className={inputClass}
                              placeholder="Account or tracking number"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Transaction ID</label>
                            <input
                              value={payment.transactionId || ''}
                              onChange={handlePaymentField('transactionId')}
                              className={withErrorClass(inputClass, getError('payment.transactionId'))}
                              placeholder="Transaction ID"
                            />
                            <FieldError errorKey="payment.transactionId" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'zelle' && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="flex items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-4 dark:border-violet-500/20 dark:from-violet-500/[0.08] dark:to-indigo-500/[0.04] sm:p-6">
                        <div
                          className="relative min-h-[220px] w-full max-w-md overflow-hidden rounded-2xl border border-violet-300/40 bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-950 shadow-xl shadow-violet-950/15 sm:min-h-[240px]"
                        >
                          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/10 bg-violet-400/10" />
                          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full border border-white/10 bg-indigo-400/10" />
                          <div className="relative w-full p-5 text-white sm:p-6">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">Digital payment</div>
                                <div className="mt-1 min-h-[20px] truncate text-base font-semibold text-white">
                                  {payment.zelleId || 'Email or phone number'}
                                </div>
                              </div>
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-violet-100 shadow-sm backdrop-blur-sm">
                                <Zap size={21} aria-hidden="true" />
                              </div>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                              <div className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-sm">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Amount</div>
                                <div className="mt-1 min-h-[20px] font-semibold text-white">
                                  {chequeAmount > 0 ? `$${formatMoney2(chequeAmount)}` : '$0.00'}
                                </div>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-sm">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Date</div>
                                <div className="mt-1 min-h-[20px] font-semibold text-white">
                                  {formatDateMMDDYYYY(payment.paymentDate) || 'MM/DD/YYYY'}
                                </div>
                              </div>
                              <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-sm sm:col-span-2">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Transaction ID</div>
                                <div className="mt-1 min-h-[20px] truncate font-semibold text-white">
                                  {payment.transactionId || 'Not entered'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="create-order-section rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#17132a]">
                        <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                            <Zap size={19} aria-hidden="true" />
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Zelle payment</div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Record the sender and transfer confirmation.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <label className={labelClass}>Zelle ID (Email/Phone)<RequiredMark /></label>
                            <input
                              value={payment.zelleId || ''}
                              onChange={handlePaymentField('zelleId')}
                              className={withErrorClass(inputClass, getError('payment.zelleId'))}
                              placeholder="Email address or phone number"
                            />
                            <FieldError errorKey="payment.zelleId" />
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Payment Date<RequiredMark /></label>
                            <input
                              type="date"
                              value={paymentDateForInput}
                              onChange={(e) => {
                                clearError('payment.paymentDate');
                                setPayment((prev) => ({ ...prev, paymentDate: e.target.value }));
                              }}
                              className={withErrorClass(inputClass, getError('payment.paymentDate'))}
                            />
                            <FieldError errorKey="payment.paymentDate" />
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Transaction ID<RequiredMark /></label>
                            <input
                              value={payment.transactionId || ''}
                              onChange={handlePaymentField('transactionId')}
                              className={withErrorClass(inputClass, getError('payment.transactionId'))}
                              placeholder="Transaction ID"
                            />
                            <FieldError errorKey="payment.transactionId" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'paypal' && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="flex items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 p-4 dark:border-violet-500/20 dark:from-violet-500/[0.08] dark:to-indigo-500/[0.04] sm:p-6">
                        <div
                          className="relative min-h-[220px] w-full max-w-md overflow-hidden rounded-2xl border border-violet-300/40 bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-950 shadow-xl shadow-violet-950/15 sm:min-h-[240px]"
                        >
                          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/10 bg-violet-400/10" />
                          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full border border-white/10 bg-indigo-400/10" />
                          <div className="relative w-full p-5 text-white sm:p-6">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">Digital wallet</div>
                                <div className="mt-1 min-h-[20px] truncate text-base font-semibold text-white">
                                  {payment.zelleId || 'Email or phone number'}
                                </div>
                              </div>
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-violet-100 shadow-sm backdrop-blur-sm">
                                <WalletCards size={21} aria-hidden="true" />
                              </div>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                              <div className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-sm">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Amount</div>
                                <div className="mt-1 min-h-[20px] font-semibold text-white">
                                  {chequeAmount > 0 ? `$${formatMoney2(chequeAmount)}` : '$0.00'}
                                </div>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-sm">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Date</div>
                                <div className="mt-1 min-h-[20px] font-semibold text-white">
                                  {formatDateMMDDYYYY(payment.paymentDate) || 'MM/DD/YYYY'}
                                </div>
                              </div>
                              <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-sm sm:col-span-2">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">Transaction ID</div>
                                <div className="mt-1 min-h-[20px] truncate font-semibold text-white">
                                  {payment.transactionId || 'Not entered'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="create-order-section rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#17132a]">
                        <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-4 dark:border-white/10">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                            <WalletCards size={19} aria-hidden="true" />
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">PayPal payment</div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Record the wallet account and transaction confirmation.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <label className={labelClass}>PayPal Account (Email/Phone)<RequiredMark /></label>
                            <input
                              value={payment.zelleId || ''}
                              onChange={handlePaymentField('zelleId')}
                              className={withErrorClass(inputClass, getError('payment.zelleId'))}
                              placeholder="PayPal email or phone number"
                            />
                            <FieldError errorKey="payment.zelleId" />
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Payment Date<RequiredMark /></label>
                            <input
                              type="date"
                              value={paymentDateForInput}
                              onChange={(e) => {
                                clearError('payment.paymentDate');
                                setPayment((prev) => ({ ...prev, paymentDate: e.target.value }));
                              }}
                              className={withErrorClass(inputClass, getError('payment.paymentDate'))}
                            />
                            <FieldError errorKey="payment.paymentDate" />
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Transaction ID<RequiredMark /></label>
                            <input
                              value={payment.transactionId || ''}
                              onChange={handlePaymentField('transactionId')}
                              className={withErrorClass(inputClass, getError('payment.transactionId'))}
                              placeholder="Transaction ID"
                            />
                            <FieldError errorKey="payment.transactionId" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>)}
            {(isEditMode || isAddPaymentMode) && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700"
                  onClick={handleSavePayment}
                  disabled={
                    loadingPayment
                    || permissionsLoading
                    || ordersCodesLoading
                    || (isEditMode ? (!canUpdate || !canUpdateOrderPayment) : (!canUpdate || !canAddOrderPayment))
                  }
                >
                  {loadingPayment ? 'Saving...' : isEditMode ? 'Update Payment' : 'Add Payment'}
                </Button>
              </div>
            )}
          </div>

          {/* Right: Order info, notes & customer (like design image) */}
          {!isEditMode && !isAddPaymentMode && (
            <div className="create-order-aside create-order-section w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#17132a] xl:sticky xl:top-24 xl:w-[400px] xl:self-start">
              <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 via-white to-indigo-50 px-4 py-3 dark:border-white/10 dark:from-violet-500/15 dark:via-transparent dark:to-indigo-500/10">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 p-2 shadow-sm">
                    <ClipboardList size={16} className="text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">Order Info</h3>
                </div>
              </div>

              <div className="p-4 space-y-3 text-sm">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className={labelClass}>Customer<RequiredMark /></label>
                    {!isAddPaymentMode && canCreateCustomer && (
                      <button
                        type="button"
                        onClick={openAddCustomerModal}
                        className="mb-1 inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        title="Add customer"
                      >
                        + Add Customer
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setCustomerModalOpen(true)}
                      className={withErrorClass(
                        `${selectTriggerCompactClass} flex items-center justify-between gap-2 pr-16 text-left`,
                        getError('customerId'),
                      )}
                    >
                      <span className="truncate">
                        {selectedCustomer
                          ? `${selectedCustomer.customerId || ''}. ${selectedCustomer.customerName ||
                          selectedCustomer.fullName ||
                          selectedCustomer.name ||
                          'Customer'
                          }`
                          : 'Select Customer'}
                      </span>
                    </button>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1">
                      {selectedCustomer && (
                        <button
                          type="button"
                          className="pointer-events-auto rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                          onClick={() => {
                            clearError('customerId');
                            clearSelectedCustomer();
                          }}
                          aria-label="Clear customer"
                        >
                          <X size={14} className="text-slate-400" />
                        </button>
                      )}
                      <ChevronDown size={16} className="shrink-0 text-slate-400" />
                    </span>
                  </div>
                  <FieldError errorKey="customerId" />
                </div>

                {canPickSalesPerson && (
                  <div>
                    <label className={labelClass}>Sales Person<RequiredMark /></label>
                    <Select
                      value={selectedSalesPersonId ? String(selectedSalesPersonId) : ''}
                      onValueChange={(value) => {
                        clearError('salesPersonId');
                        setSalesPersonSearchText('');
                        setSelectedSalesPersonId(Number(value) || 0);
                      }}
                    >
                      <SelectTrigger className={withErrorClass(selectTriggerCompactClass, getError('salesPersonId'))}>
                        <SelectValue placeholder="Select Sales Person" />
                      </SelectTrigger>
                      <SelectContent
                        className="max-h-72"
                        search={(
                          <SelectSearchInput
                            value={salesPersonSearchText}
                            onChange={setSalesPersonSearchText}
                            placeholder="Search sales person..."
                          />
                        )}
                      >
                        {filteredSalesPersons.length === 0 ? (
                          <div className="px-2 py-2 text-xs text-slate-500">No users found.</div>
                        ) : (
                          filteredSalesPersons.map((u) => (
                            <SelectItem
                              key={u.userId}
                              value={String(u.userId)}
                              meta={<UserOptionBadges user={u} />}
                            >
                              {getSalesPersonLabel(u)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FieldError errorKey="salesPersonId" />
                  </div>
                )}

                {!isOrderEditMode && (<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Share Sale</div>
                    <div className="flex items-center gap-2">
                      {showShareSale && hasManualShareSaleRows && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          onClick={disableShareSale}
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant={showShareSale ? 'default' : 'outline'}
                        className="h-8"
                        onClick={openShareSaleModal}
                      >
                        {showShareSale ? 'Edit Share Sale' : 'Share Sale'}
                      </Button>
                    </div>
                  </div>

                  {showShareSale && (
                    <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-xs">
                      <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Split Receipt</div>
                      <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                        {shareSaleReceiptRows.length === 0 ? (
                          <div className="text-slate-500">No split rows added.</div>
                        ) : (
                          <>
                            {shareSaleReceiptRows.map((row) => (
                              <div key={String(row.rowId)} className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate">{row.label}</div>
                                  <div className="text-xs text-slate-500">{row.splitTypeLabel}</div>
                                </div>
                                <div className="shrink-0 text-right font-medium">${formatMoney2(row.amount)}</div>
                              </div>
                            ))}

                            <div className="mt-2 border-t border-dashed border-slate-200 pt-2 flex items-center justify-between">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">Total Amount</span>
                              <span className="font-semibold text-slate-900">
                                ${formatMoney2((shareSaleReceiptRows || []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0))}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>)}

                <div>
                  <label className={labelClass}>Order Notes</label>
                  <textarea
                    value={orderNotes || ''}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={4}
                    className={textareaClass}
                    placeholder="Add notes (optional)"
                  />
                </div>

                <div className="border-t border-slate-200 pt-3 dark:border-white/10">
                  <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-b from-white to-violet-50/60 px-4 py-4 shadow-inner dark:border-violet-500/20 dark:from-white/[0.06] dark:to-violet-500/10">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" aria-hidden="true" />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold tracking-[0.18em] text-slate-800 dark:text-slate-100">ORDER RECEIPT</div>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {orderSummary.items} items
                      </div>
                    </div>

                    <div className="mt-2 border-t border-dashed border-slate-300 dark:border-slate-600" />

                    <div className="mt-3 max-h-40 space-y-2 overflow-auto pr-1 text-[12px] text-slate-700 dark:text-slate-300">
                      {orderLines.length === 0 ? (
                        <div className="text-slate-500">No items selected</div>
                      ) : (
                        orderLines.map((line, idx) => {
                          const lineName =
                            line?.productName ||
                            line?.name ||
                            line?.itemName ||
                            line?.title ||
                            `Item ${idx + 1}`;
                          const qty = Number(line?.quantity) || 0;
                          const unit = Number(line?.price) || 0;
                          const lineTotal = Number(line?.totalPrice) || 0;
                          return (
                            <div key={`${String(line?.productId ?? line?.id ?? idx)}-${idx}`} className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate flex items-center gap-1">
                                  <Package size={11} className="shrink-0 text-slate-400" />
                                  {lineName}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {qty} x ${formatMoney2(unit)}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">${formatMoney2(lineTotal)}</div>
                            </div>
                          );
                        })
                      )}

                      {Number(orderSummary.subscriptionMonths) > 0 && (
                        <div className="pt-1 mt-1 border-t border-dashed border-slate-200 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate">Subscription (Months)</div>
                          </div>
                          <div className="shrink-0 text-right">{orderSummary.subscriptionMonths}</div>
                        </div>
                      )}

                    </div>

                    <div className="mt-2 border-t border-dashed border-slate-300 dark:border-slate-600" />

                    <div className="mt-3 space-y-2 text-[12px]">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>SUBTOTAL</span>
                        <span>${formatMoney2(orderSummary.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-700 dark:text-slate-300">DISCOUNT</span>
                        <span className="text-orange-700 dark:text-orange-300">-${formatMoney2(orderSummary.discount)}</span>
                      </div>
                      {discountCode && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">CODE</span>
                          <span className="text-emerald-700 font-semibold tracking-wide">{discountCode}</span>
                        </div>
                      )}
                      <div className="mt-2 border-t border-dashed border-slate-300 dark:border-slate-600" />
                      <div className="flex justify-between rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm">
                        <span>TOTAL</span>
                        <span>${formatMoney2(orderSummary.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4 flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleDiscardOrder}
                >
                  Discard
                </Button>
                <LiquidGlassButton
                  type="button"
                  className="flex-1 w-full text-center"
                  onClick={handleSavePayment}
                  disabled={loadingPayment || loadingOrder || !!orderLoadError || permissionsLoading || ordersCodesLoading || (isOrderEditMode ? !canUpdate : (!canAdd && !canAddOrdersByCode))}
                >
                  {loadingPayment ? 'Saving...' : isOrderEditMode ? 'Update Order' : 'Create Order'}
                </LiquidGlassButton>
              </div>
            </div>
          )}
        </div>
        </fieldset>
      </div>

      <DeleteConfirmModal
        isOpen={deletePaymentConfirmOpen}
        onClose={() => {
          if (isDeletingPayment) return;
          setDeletePaymentConfirmOpen(false);
        }}
        onConfirm={handleConfirmDeletePayment}
        title="Delete Payment"
        itemName={payment?.paymentId ? `Payment #${payment.paymentId}` : 'this payment'}
        confirmText={isDeletingPayment ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        isLoading={isDeletingPayment}
      />

      <ShareSaleModal
        open={!isOrderEditMode && !isEditMode && !isAddPaymentMode && shareSaleModalOpen}
        onClose={closeShareSaleModal}
        onSave={handleShareSaleSave}
        saveButtonLabel="Save & Continue"
        salesPersonLabel={selectedSalesPersonLabel}
        salesPersonAmount={salesPersonMainAmount}
        orderTotal={orderSummary.total}
        splitTotal={shareSaleEnteredTotal}
        remainingAmount={shareSaleRemainingAmount}
        isExceeded={isShareSaleExceeded}
        rows={shareSaleRows}
        salesPersonSplitTypeId={shareSalesPersonTypeId}
        onSalesPersonSplitTypeChange={(value) => setShareSalesPersonTypeId(value ? Number(value) : 0)}
        fixedShareWithId={Number(selectedSalesPersonId) || 0}
        salesPersons={salesPersons}
        onUserSearch={fetchShareSaleUsers}
        salesShareTypeOptions={salesShareTypeOptions}
        labelClass={labelClass}
        selectTriggerCompactClass={selectTriggerCompactClass}
        inputCompactClass={inputCompactClass}
        formatMoney2={formatMoney2}
        getSalesPersonLabel={getSalesPersonLabel}
        splitReceiptRows={shareSaleReceiptRows}
        onAddShareSaleRow={addShareSaleRow}
        onRemoveShareSaleRow={removeShareSaleRow}
        onUpdateShareSaleRow={updateShareSaleRow}
      />
    </div>
  );
};

export { CreateOrderPage };
