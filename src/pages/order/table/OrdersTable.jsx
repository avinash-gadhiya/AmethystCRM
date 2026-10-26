import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, CreditCard, ShoppingBag, Ban, Edit, Trash2, Package, CircleDollarSign, Gift, CheckCircle2, Plus,Undo2, Eraser, Landmark, ScrollText, Wallet, Zap } from 'lucide-react';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PaymentsIcon from '@mui/icons-material/Payments';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import LocalGroceryStoreIcon from '@mui/icons-material/LocalGroceryStore';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import LiquidGlassButton from '@/components/ui/LiquidGlassButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IosToggle } from '@/components/ui/ios-toggle';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CommonTable from '@/components/common/CommonTable';
import TableSearchField from '@/components/common/TableSearchField';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import ShareSaleModal from '@/components/common/ShareSaleModal';
import { LiquidGlassDatePicker } from '@/components/common/LiquidGlassDatePicker';
import { brandService, gatewayService, orderLookupService, orderService, paymentService, userService, roleService } from '@/services';
import { getCurrentLoginIpv4 } from '@/services/clientIpService';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePageCrudPermissions } from '@/hooks/usePageCrudPermissions';
import usePagePermissionCodes from '@/hooks/usePagePermissionCodes';
import { useSearchFieldFetchGuard } from '@/hooks/useSearchFieldFetchGuard';
import { TableCard, PageHeader, ModalPortal } from '@/components/common/page-card';
import { resolveDynamicPath } from '@/lib/dynamicPaths';
import { fetchSalesPersonList, searchSalesPersonUsers } from '@/lib/salesRoles';
import SelectSearchInput from '@/components/common/SelectSearchInput';
import UserOptionBadges, {
  getUserBadgeSearchText,
  getUserLocationName,
  getUserRoleName,
} from '@/components/common/UserOptionBadges';


// Matches the frosted look of .tbl-glass-search so the selects, the search box
// and the glass date buttons read as one row of controls. It has to be Tailwind
// rather than a CSS class: SelectTrigger's own rounded-md / border-input come
// from the utilities layer, which outranks anything in @layer components.
const TOOLBAR_SELECT_TRIGGER_CLASS =
    'h-10 w-full rounded-xl border border-[rgba(210,218,240,0.65)] bg-white/75 px-3 text-sm text-gray-700 backdrop-blur '
    + 'hover:border-purple-300 focus:border-purple-400 data-[state=open]:border-purple-400 '
    + 'dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:border-white/20';

// Same look, plus the fixed width the quick-date preset select needs so it
// doesn't stretch with the rest of the filter row.
const TOOLBAR_QUICK_DATE_TRIGGER_CLASS =
    `${TOOLBAR_SELECT_TRIGGER_CLASS} sm:w-[260px] sm:shrink-0`;

// Payment type tabs in the Add/Edit Payment modal, rendered in a loop. Icons are bundled
// lucide icons so the tabs never depend on image files being deployed.
const PAYMENT_TABS = [
    { key: 'card', label: 'Card', icon: CreditCard, tone: 'bg-indigo-50 text-indigo-600' },
    { key: 'bank', label: 'Bank', icon: Landmark, tone: 'bg-sky-50 text-sky-600' },
    { key: 'cheque', label: 'Cheque', icon: ScrollText, tone: 'bg-amber-50 text-amber-600' },
    { key: 'zelle', label: 'Zelle', icon: Zap, tone: 'bg-violet-50 text-violet-600' },
    { key: 'paypal', label: 'PayPal', icon: Wallet, tone: 'bg-blue-50 text-blue-600' },
];

// Maps a payment type name coming from /GatewayPaymentType onto one of the
// modal's tabs. Same mapping the Create Order page uses, so a gateway offers the
// same payment types in both places.
const paymentTabFromName = (name) => {
    const raw = String(name || '').trim().toLowerCase();
    if (!raw) return null;
    if (raw === 'card' || raw.includes('credit') || raw.includes('debit') || raw.includes('card')) return 'card';
    if (raw === 'bank' || raw.includes('wire') || raw.includes('ach') || raw.includes('bank')) return 'bank';
    if (raw === 'cheque' || raw === 'check' || raw.includes('cheque') || raw.includes('check')) return 'cheque';
    if (raw.includes('zelle')) return 'zelle';
    if (raw.includes('paypal') || raw.includes('pay pal')) return 'paypal';
    return null;
};

const PAYMENT_TAB_ORDER = ['card', 'bank', 'cheque', 'zelle', 'paypal'];

// â”€â”€ Date helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const toYmd = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const QUICK_DATE_FILTERS = [
    { value: 'Today', label: 'Today' },
    { value: 'Yesterday', label: 'Yesterday' },
    { value: 'Last Week', label: 'Last Week' },
    { value: 'Current Month', label: 'Current Month' },
    { value: 'Last Month', label: 'Last Month' },
    { value: 'This Year', label: 'This Year' },
    { value: 'Last Year', label: 'Last Year' },
];

const getQuickDatePayload = (value) => {
    const selected = String(value || 'Current Month').trim();
    const now = new Date();
    const today = toYmd(now);

    if (selected === 'Today') {
        return { Date: today, FromDate: '', ToDate: '' };
    }

    if (selected === 'Yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { Date: toYmd(yesterday), FromDate: '', ToDate: '' };
    }

    if (selected === 'Last Week') {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        return { Date: '', FromDate: toYmd(start), ToDate: today };
    }

    if (selected === 'Current Month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { Date: '', FromDate: toYmd(start), ToDate: today };
    }

    if (selected === 'Last Month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { Date: '', FromDate: toYmd(start), ToDate: toYmd(end) };
    }

    if (selected === 'This Year') {
        const start = new Date(now.getFullYear(), 0, 1);
        return { Date: '', FromDate: toYmd(start), ToDate: today };
    }

    if (selected === 'Last Year') {
        const start = new Date(now);
        start.setDate(start.getDate() - 364);
        return { Date: '', FromDate: toYmd(start), ToDate: today };
    }

    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { Date: '', FromDate: toYmd(start), ToDate: today };
};

// Brand / Sales Person are dropdown filters rather than a typed lookup, so they
// keep the selected period.
const LOOKUP_SEARCH_FIELDS = new Set(['brand', 'salesperson', 'sales person']);

// A typed search looks across all time: the date range would otherwise hide the
// very order being searched for.
const withSearchAllDates = (params) => {
    if (!String(params?.Text || '').trim()) return params;

    const field = String(params?.SearchField || '').trim().toLowerCase();
    if (LOOKUP_SEARCH_FIELDS.has(field)) return params;

    return { ...params, Date: '', FromDate: '', ToDate: '' };
};

const DEFAULT_QUICK_DATE_FILTER = 'Current Month';
const DEFAULT_QUICK_DATE_PAYLOAD = getQuickDatePayload(DEFAULT_QUICK_DATE_FILTER);
const SEARCH_ALL_OPTION_VALUE = '__all__';
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    // Desired UI format: 03 Feb 2026 07:47 PM
    try {
        const datePart = format(date, 'dd MMM yyyy hh:mm');
        const amPm = format(date, 'a');
        return `${datePart} ${String(amPm || '').toUpperCase()}`.trim();
    } catch {
        return '-';
    }
};

const toValidDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const pickLatestShareDate = (shareRows = []) => {
    let latest = null;

    for (const row of shareRows) {
        const candidate =
            toValidDate(row?.updatedDate) ||
            toValidDate(row?.createdDate) ||
            toValidDate(row?.paymentDate) ||
            toValidDate(row?.orderDate);

        if (candidate && (!latest || candidate.getTime() > latest.getTime())) {
            latest = candidate;
        }
    }

    return latest ? latest.toISOString() : null;
};

const getSharePaymentRows = (source) => {
    if (!source || typeof source !== 'object') return [];

    const candidates = [
        source?.sharePaymentDTOs,
        source?.sharePaymentDtos,
        source?.SharePaymentDTOs,
        source?.SharePaymentDtos,
    ];

    for (const rows of candidates) {
        if (Array.isArray(rows)) return rows;
    }

    return [];
};

const extractShareRowsFromOrder = (order) => {
    const safeOrder = order || {};
    const orderRows = getSharePaymentRows(safeOrder);
    const paymentRows = Array.isArray(safeOrder?.payments)
        ? safeOrder.payments.flatMap((payment) => getSharePaymentRows(payment))
        : [];

    const combined = [...orderRows, ...paymentRows].filter((row) => row && typeof row === 'object');

    // Deduplicate when API sends the same share row at order and payment levels.
    const seen = new Set();
    const unique = [];
    for (const row of combined) {
        const key = [
            row?.id,
            row?.shareWithId,
            row?.sharewithId,
            row?.shareToId,
            row?.salesPersonId,
            row?.userId,
            row?.amount,
            row?.shareAmount,
            row?.shareWithName,
            row?.sharewithName,
            row?.shareToName,
            row?.salesPersonName,
        ].join('|');

        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(row);
    }

    return unique;
};

const currency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value));
};

const formatMoney2 = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
};

const FALLBACK_CREATE_ORDER_PATH = '/Orders/CreateOrder';

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
    gatewayName: '',
    brandId: 0,
    brandName: '',
    amount: 0,
    saleType: '',
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

const emptyRefund = {
    paymentId: 0,
    orderId: 0,
    amount: 0,
    paymentDate: '',
    transactionId: '',
    authCode: '',
    isChequeCleared: false,
    isChargeBack: false,
    isRetrieval: false,
    isAlert: false,
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

const dateForInput = (value) => {
    if (!value) return '';
    const v = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
};

const OrdersTable = () => {
    const navigate = useNavigate();
    const [createOrderPath, setCreateOrderPath] = useState(FALLBACK_CREATE_ORDER_PATH);

    useEffect(() => {
        let mounted = true;

        const loadCreateOrderPath = async () => {
            const path = await resolveDynamicPath('createOrder', FALLBACK_CREATE_ORDER_PATH);
            if (!mounted) return;
            setCreateOrderPath(path || FALLBACK_CREATE_ORDER_PATH);
        };

        loadCreateOrderPath();
        return () => {
            mounted = false;
        };
    }, []);

    const {
        loading: permissionsLoading,
        canAdd,
        canDelete,
    } = usePageCrudPermissions();

    const {
        loading: orderCodesLoading,
        has: hasOrderCode,
    } = usePagePermissionCodes({ path: '/Orders' });

    const canViewOrders = !orderCodesLoading && hasOrderCode('View_Order');
    const canViewOrderSummary = !orderCodesLoading && hasOrderCode('View_Order_Summary');
    const canViewSearchBar = !orderCodesLoading && hasOrderCode('View_Search_Bar');
    const canViewOrderPayments = !orderCodesLoading && hasOrderCode('View_Order_Payment');

    const canAddOrderPayment = !orderCodesLoading && hasOrderCode('Add_Order_Payment');
    const canUpdateOrderPayment = !orderCodesLoading && hasOrderCode('Update_Order_Payment');
    const canDeleteOrderPayment = !orderCodesLoading && hasOrderCode('Delete_Order_Payment');
    const canVoidOrderPayment = !orderCodesLoading && hasOrderCode('Void_Order_Payment');
    const canRefundOrderPayment = !orderCodesLoading && hasOrderCode('Refund_Order_Payment');
    const [filters, setFilters] = useState({
        SearchField: null,
        Text: '',
        Date: DEFAULT_QUICK_DATE_PAYLOAD.Date,
        FromDate: DEFAULT_QUICK_DATE_PAYLOAD.FromDate,
        ToDate: DEFAULT_QUICK_DATE_PAYLOAD.ToDate,
        PageNumber: 1,
        PageSize: 10,
        SortProperty: 'orderDate',
        IsDescending: true,
    });
    const [searchInput, setSearchInput] = useState('');
    // Newest orders first: the list is sorted by sale date descending.
    const [sorting, setSorting] = useState([{ id: 'orderDate', desc: true }]);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [summary, setSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const latestOrdersFetchIdRef = useRef(0);
    const latestSummaryFetchIdRef = useRef(0);
    const [shareSaleModalOpen, setShareSaleModalOpen] = useState(false);
    const [shareSaleModalOrder, setShareSaleModalOrder] = useState(null);
    const [shareSaleModalPayment, setShareSaleModalPayment] = useState(null);
    const [shareSaleModalExistingRows, setShareSaleModalExistingRows] = useState([]);
    const [shareSaleModalPaymentChanging, setShareSaleModalPaymentChanging] = useState(false);
    const [shareSaleModalRows, setShareSaleModalRows] = useState([]);
    const [shareSaleModalSalesPersonTypeId, setShareSaleModalSalesPersonTypeId] = useState(0);
    const [shareSaleTypeOptions, setShareSaleTypeOptions] = useState([]);
    const [salesAgentRoleIds, setSalesAgentRoleIds] = useState([]);
    const [shareSaleSaving, setShareSaleSaving] = useState(false);
    const [shareSaleSaveMethod, setShareSaleSaveMethod] = useState('post');

    const [paymentDetailsById, setPaymentDetailsById] = useState({});
    const [templateLoadingByPaymentId, setTemplateLoadingByPaymentId] = useState({});
    const [sendingTemplateMailByKey, setSendingTemplateMailByKey] = useState({});
    const [sendingPandaDocMailByPaymentId, setSendingPandaDocMailByPaymentId] = useState({});
    const [mailSuccessModal, setMailSuccessModal] = useState({ open: false, message: '' });

    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentModalMode, setPaymentModalMode] = useState('add');
    const [paymentDraft, setPaymentDraft] = useState(emptyPayment);
    const [paymentActiveTab, setPaymentActiveTab] = useState('card');
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [paymentErrors, setPaymentErrors] = useState({});
    const [activeEditPaymentId, setActiveEditPaymentId] = useState(0);

    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [refundDraft, setRefundDraft] = useState(emptyRefund);
    const [refundOriginalPayment, setRefundOriginalPayment] = useState(null);
    const [refundLoading, setRefundLoading] = useState(false);
    const [refundSaving, setRefundSaving] = useState(false);

    const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
    const [voidContext, setVoidContext] = useState(null);
    const [deleteOrderConfirmOpen, setDeleteOrderConfirmOpen] = useState(false);
    const [deleteOrderContext, setDeleteOrderContext] = useState(null);
    const [deleteOrderSaving, setDeleteOrderSaving] = useState(false);
    const [deletePaymentConfirmOpen, setDeletePaymentConfirmOpen] = useState(false);
    const [deletePaymentContext, setDeletePaymentContext] = useState(null);
    const [deletePaymentSaving, setDeletePaymentSaving] = useState(false);
    const [quickDateFilter, setQuickDateFilter] = useState(DEFAULT_QUICK_DATE_FILTER);
    const [lookupOptionSearch, setLookupOptionSearch] = useState('');
    const [brandSearchOptions, setBrandSearchOptions] = useState([]);
    const [salesPersonSearchOptions, setSalesPersonSearchOptions] = useState([]);
    const [searchOptionsLoading, setSearchOptionsLoading] = useState(false);
    const [brands, setBrands] = useState([]);
    const [gateways, setGateways] = useState([]);
    // Gateway -> payment type mapping from /GatewayPaymentType. Drives which
    // payment type tiles a gateway offers, exactly as on the Create Order page.
    const [gatewayPaymentTypes, setGatewayPaymentTypes] = useState([]);
    // gatewayId -> brandId straight off the full /Gateway records. The dropdown
    // endpoint that feeds `gateways` does not reliably carry a brand id, so this
    // is what makes the brand auto-fill work for every brand rather than only
    // the ones whose name happens to appear in the gateway name.
    const [gatewayBrandById, setGatewayBrandById] = useState(() => new Map());
    const [saleTypes, setSaleTypes] = useState([]);
    const [cardTypes, setCardTypes] = useState([]);
    const [users, setUsers] = useState([]);
    // Sales-role users only - what the Share Sale "Split With" picker offers.
    // `users` stays the full list because it also resolves names on existing
    // share rows, which can point at someone outside the sales roles.
    const [shareSaleUsers, setShareSaleUsers] = useState([]);

    const labelClass = 'block mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300';
    const inputClass =
        'w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';
    const selectTriggerClass =
        'w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm font-normal text-slate-900 hover:border-slate-300 focus:ring-2 focus:ring-violet-500/30 focus:ring-offset-0 focus:border-violet-500 data-[state=open]:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

    const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');
    const formatCardNumberGroups = (digits) =>
        String(digits ?? '')
            .replace(/\D/g, '')
            .replace(/(\d{4})(?=\d)/g, '$1 ')
            .trim();

    const maskCardToLast4 = (value) => {
        const digits = onlyDigits(value);
        if (!digits) return '-';
        if (digits.length <= 4) return digits;
        return digits.slice(-4);
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

    const toNumber = (value) => {
        if (value === null || value === undefined) return NaN;
        if (typeof value === 'number') return value;
        const cleaned = String(value).replace(/,/g, '').trim();
        if (!cleaned) return NaN;
        return Number(cleaned);
    };

    const resolvePaymentAmount = (source) => {
        if (!source) return 0;

        const directKeys = [
            'amount',
            'Amount',
            'paymentAmount',
            'PaymentAmount',
            'paymentAmt',
            'PaymentAmt',
            'paidAmount',
            'PaidAmount',
            'totalPaid',
            'TotalPaid',
            'totalAmount',
            'TotalAmount',
            'amt',
            'Amt',
        ];

        for (const key of directKeys) {
            const n = toNumber(source[key]);
            if (Number.isFinite(n)) return n;
        }

        // Fallback: pick first finite number from any key containing "amount".
        const keys = Object.keys(source);
        for (const key of keys) {
            if (!/amount/i.test(key)) continue;
            const n = toNumber(source[key]);
            if (Number.isFinite(n)) return n;
        }

        return 0;
    };

    const fieldClass = (base, hasError) => (hasError ? `${base} border-red-400 focus:border-red-500 focus:ring-red-500/20` : base);

    const clearPaymentError = (field) => {
        setPaymentErrors((prev) => {
            if (!prev || !prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const validatePaymentDraft = (draft, activeTab, mode) => {
        const errors = {};

        const amount = Number(draft.amount);
        if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Amount must be greater than 0.';

        const brandId = Number(draft.brandId) || 0;
        if (!brandId) errors.brandId = 'Brand is required.';

        const gatewayId = Number(draft.gatewayId) || 0;
        if (!gatewayId) errors.gatewayId = 'Gateway is required.';

        const paymentDate = dateForInput(draft.paymentDate);
        if (!paymentDate) errors.paymentDate = 'Payment date is required.';

        const transactionId = String(draft.transactionId || '').trim();
        if (!transactionId) errors.transactionId = 'Transaction ID is required.';

        if (activeTab === 'card') {
            const cardType = String(draft.cardType || '').trim();
            if (mode === 'add' && !cardType) errors.cardType = 'Card type is required.';

            const nameOnCard = String(draft.nameOnCard || '').trim();
            if (!nameOnCard) errors.nameOnCard = 'Name on card is required.';

            const cardNumberDigits = onlyDigits(draft.cardNumber).slice(0, 16);
            if (!cardNumberDigits) {
                if (mode === 'add') errors.cardNumber = 'Card number is required.';
            } else if (mode === 'add') {
                if (cardNumberDigits.length < 13 || cardNumberDigits.length > 16) {
                    errors.cardNumber = 'Card number must be 13-16 digits.';
                }
            } else {
                // In edit mode, APIs often return only last-4. Allow 4 digits or full PAN length.
                const len = cardNumberDigits.length;
                if (!(len === 4 || (len >= 13 && len <= 16))) {
                    errors.cardNumber = 'Card number must be 4 digits (last 4) or 13-16 digits.';
                }
            }

            const expiryRaw = String(draft.cardExpiryDate || '').trim();
            if (!expiryRaw) {
                if (mode === 'add') errors.cardExpiryDate = 'Expiry date is required.';
            } else {
                const match = expiryRaw.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
                if (!match) {
                    errors.cardExpiryDate = 'Expiry must be MM/YY.';
                } else {
                    const month = Number(match[1]);
                    if (!month || month < 1 || month > 12) errors.cardExpiryDate = 'Expiry month must be 01â€“12.';
                }
            }

            const cvvDigits = onlyDigits(draft.cvv).slice(0, 4);
            if (!cvvDigits) {
                if (mode === 'add') errors.cvv = 'CVV is required.';
            } else if (cvvDigits.length < 3 || cvvDigits.length > 4) {
                errors.cvv = 'CVV must be 3â€“4 digits.';
            }
        }

        if (activeTab === 'bank') {
            const nameOnCard = String(draft.nameOnCard || '').trim();
            if (!nameOnCard) errors.nameOnCard = 'Account holder name is required.';

            const accountDigits = onlyDigits(draft.cardNumber).slice(0, 22);
            if (!accountDigits) errors.cardNumber = 'Account number is required.';

            const routingIfsc = String(draft.chequeRoutingNo ?? '').trim();
            if (!routingIfsc) errors.chequeRoutingNo = 'Routing / IFSC is required.';
        }

        if (activeTab === 'cheque') {
            const nameOnCard = String(draft.nameOnCard || '').trim();
            if (!nameOnCard) errors.nameOnCard = 'Name is required.';

            const routingNo = String(draft.chequeRoutingNo ?? '').trim();
            const routingDigits = routingNo.replace(/\D/g, '');
            if (!routingDigits) {
                errors.chequeRoutingNo = 'Routing number is required.';
            } else if (routingDigits.length !== 9) {
                errors.chequeRoutingNo = 'Routing number must be exactly 9 digits.';
            }

            const chequeNo = String(draft.chequeNo ?? '').trim();
            const chequeDigits = chequeNo.replace(/\D/g, '');
            if (!chequeDigits) errors.chequeNo = 'Cheque number is required.';

            const trackingNo = String(draft.chequeTrackingNo || '').trim();
            if (!trackingNo) errors.chequeTrackingNo = 'Cheque tracking number is required.';
        }

        if (activeTab === 'zelle' || activeTab === 'paypal') {
            const zelleId = String(draft.zelleId || '').trim();
            if (!zelleId) errors.zelleId = activeTab === 'paypal' ? 'PayPal ID is required.' : 'Zelle ID is required.';
            if (activeTab === 'paypal' && zelleId) {
                const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(zelleId);
                const phoneDigits = zelleId.replace(/\D/g, '');
                if (!isEmail && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
                    errors.zelleId = 'Enter a valid PayPal email or phone number.';
                }
            }
        }

        return errors;
    };

    const formattedCardNumber = useMemo(() => {
        const digits = onlyDigits(paymentDraft.cardNumber).slice(0, 16);
        return digits ? formatCardNumberGroups(digits) : '';
    }, [paymentDraft.cardNumber]);

    const formatAccountNumber = (raw) => {
        const digits = onlyDigits(raw).slice(0, 22);
        if (!digits) return '';
        return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    };

    const formattedBankAccountNumber = useMemo(() => formatAccountNumber(paymentDraft.cardNumber), [paymentDraft.cardNumber]);

    const handleCardNumberChange = (e) => {
        const digits = onlyDigits(e?.target?.value).slice(0, 16);
        setPaymentDraft((prev) => ({ ...prev, cardNumber: digits }));
        clearPaymentError('cardNumber');
    };

    const handleExpiryChange = (e) => {
        const value = formatExpiryForInput(e?.target?.value);
        setPaymentDraft((prev) => ({ ...prev, cardExpiryDate: value }));
        clearPaymentError('cardExpiryDate');
    };

    const handleCvvChange = (e) => {
        const value = onlyDigits(e?.target?.value).slice(0, 4);
        setPaymentDraft((prev) => ({ ...prev, cvv: value }));
        clearPaymentError('cvv');
    };

    const handleBankAccountNumberChange = (e) => {
        const digits = onlyDigits(e?.target?.value).slice(0, 22);
        setPaymentDraft((prev) => ({ ...prev, cardNumber: digits }));
        clearPaymentError('cardNumber');
    };

    // chequeRoutingNo / chequeNo bind to int? on the API. Capping the digits
    // here is what keeps them inside Int32 - the same limits CreateOrderPage
    // uses. Without it a long routing number overflows and the whole DTO fails
    // to deserialize ("The dto field is required").
    const handleChequeRoutingChange = (e) => {
        const value = onlyDigits(e?.target?.value).slice(0, 9);
        setPaymentDraft((prev) => ({ ...prev, chequeRoutingNo: value }));
        clearPaymentError('chequeRoutingNo');
    };

    const handleChequeNoChange = (e) => {
        const value = onlyDigits(e?.target?.value).slice(0, 6);
        setPaymentDraft((prev) => ({ ...prev, chequeNo: value }));
        clearPaymentError('chequeNo');
    };

    // Last line of defence for values that never went through the inputs above -
    // a record loaded from the API, or an IFSC code typed on the bank tab.
    // Anything not representable as Int32 goes out as 0 rather than 400-ing.
    const toInt32 = (value) => {
        const digits = onlyDigits(value);
        if (!digits) return 0;
        const parsed = Number(digits);
        if (!Number.isSafeInteger(parsed) || parsed > 2147483647) return 0;
        return parsed;
    };

    const handleBankRoutingIfscChange = (e) => {
        const value = String(e?.target?.value ?? '')
            .replace(/\s/g, '')
            .slice(0, 18)
            .toUpperCase();
        setPaymentDraft((prev) => ({ ...prev, chequeRoutingNo: value }));
        clearPaymentError('chequeRoutingNo');
    };

    const tabFromPaymentType = (type) => {
        const normalized = String(type || '').trim().toLowerCase();
        if (normalized === 'bank' || normalized === 'bank transfer' || normalized === 'wire' || normalized.includes('ach') || normalized.includes('bank')) return 'bank';
        if (normalized === 'cheque' || normalized === 'check') return 'cheque';
        if (normalized === 'zelle') return 'zelle';
        if (normalized === 'paypal' || normalized === 'pay pal') return 'paypal';
        return 'card';
    };

    const paymentTypeFromTab = (tab) => {
        if (tab === 'bank') return 'Bank';
        if (tab === 'cheque') return 'Cheque';
        if (tab === 'zelle') return 'Zelle';
        if (tab === 'paypal') return 'PayPal';
        return 'Card';
    };

    const setPaymentTab = (tab) => {
        setPaymentActiveTab(tab);
        setPaymentDraft((prev) => ({ ...prev, paymentType: paymentTypeFromTab(tab) }));
    };

    // Wipes the brand/gateway pair back to unselected - the way out of a wrong
    // pick, since choosing a brand filters the gateway list and choosing a
    // gateway fills the brand back in. Names go too, or a stale one would be
    // saved with the payment.
    const clearPaymentBrandAndGateway = () => {
        setPaymentDraft((prev) => ({
            ...prev,
            brandId: 0,
            brandName: '',
            gatewayId: 0,
            gatewayName: '',
        }));
        clearPaymentError('brandId');
        clearPaymentError('gatewayId');

        // Add Payment narrows `gateways` server-side by brand, so restore the
        // unfiltered list - otherwise clearing leaves the old brand's gateways.
        gatewayService
            .getGatewayDropdown({ PageNumber: 1, PageSize: 200, SortProperty: 'gatewayId', IsDescending: false })
            .then((result) => setGateways(result?.data || []))
            .catch((err) => console.error('Failed to reload gateways after clearing', err));
    };

    // Selecting a search field alone is not a query yet - see the hook. The list
    // and the summary each keep their own guard, since both effects run off the
    // same field change.
    // "All Orders" is stored as a null SearchField, so that is the browse-all value.
    const skipOrdersFetchOnSearchFieldChange = useSearchFieldFetchGuard(filters.SearchField, null);
    const skipSummaryFetchOnSearchFieldChange = useSearchFieldFetchGuard(filters.SearchField, null);

    const fetchOrders = useCallback(async () => {
        const requestId = latestOrdersFetchIdRef.current + 1;
        latestOrdersFetchIdRef.current = requestId;

        if (orderCodesLoading) return;
        if (!canViewOrders) {
            setData([]);
            setTotal(0);
            return;
        }
        setLoading(true);
        try {
            const response = await orderService.getOrders(withSearchAllDates(filters));
            if (latestOrdersFetchIdRef.current !== requestId) return;
            setData(response.data || []);
            setTotal(response.totalCount || 0);
        } catch (err) {
            if (latestOrdersFetchIdRef.current !== requestId) return;
            console.error('Failed to load orders', err);
            toast.error(getApiErrorMessage(err, 'Failed to load orders'));
            setData([]);
            setTotal(0);
        } finally {
            if (latestOrdersFetchIdRef.current === requestId) {
                setLoading(false);
            }
        }
    }, [filters, orderCodesLoading, canViewOrders]);

    useEffect(() => {
        // Picking a search field on its own is not a query yet: wait for the Text.
        if (skipOrdersFetchOnSearchFieldChange(filters.Text)) return;
        fetchOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchOrders]);

    useEffect(() => {
        if (LOOKUP_SEARCH_FIELDS.has(String(filters.SearchField || '').trim().toLowerCase())) return undefined;

        const timeoutId = window.setTimeout(() => {
            setFilters((previous) => {
                if (previous.Text === searchInput) return previous;
                return { ...previous, Text: searchInput, PageNumber: 1 };
            });
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [filters.SearchField, searchInput]);

    const fetchOrderSummary = useCallback(async () => {
        const requestId = latestSummaryFetchIdRef.current + 1;
        latestSummaryFetchIdRef.current = requestId;

        if (orderCodesLoading) return;
        if (!canViewOrderSummary) {
            setSummary(null);
            setSummaryLoading(false);
            return;
        }

        setSummaryLoading(true);
        try {
            const result = await orderService.getOrderSummary(
                withSearchAllDates({
                    SearchField: filters.SearchField || '',
                    Text: filters.Text || '',
                    Date: filters.Date || '',
                    FromDate: filters.FromDate || '',
                    ToDate: filters.ToDate || '',
                }),
            );
            if (latestSummaryFetchIdRef.current !== requestId) return;
            setSummary(result);
        } catch (err) {
            if (latestSummaryFetchIdRef.current !== requestId) return;
            console.error('Failed to load order summary', err);
            toast.error(getApiErrorMessage(err, 'Failed to load order summary'));
            setSummary(null);
        } finally {
            if (latestSummaryFetchIdRef.current === requestId) {
                setSummaryLoading(false);
            }
        }
    }, [filters.SearchField, filters.Text, filters.Date, filters.FromDate, filters.ToDate, orderCodesLoading, canViewOrderSummary]);

    useEffect(() => {
        // Picking a search field on its own is not a query yet: wait for the Text.
        if (skipSummaryFetchOnSearchFieldChange(filters.Text)) return;
        fetchOrderSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchOrderSummary]);

    useEffect(() => {
        const orderId = Number(expandedOrderId) || 0;
        if (!orderId) return;

        const order = (data || []).find((o) => Number(o?.orderId) === orderId);
        const payments = order?.payments || [];
        if (!Array.isArray(payments) || payments.length === 0) return;

        // The /Order API already returns payments; avoid eager per-payment fetch here.
        // We'll only fetch /Payment/{id} when opening Edit/Refund and required fields are missing.
        const next = {};
        for (const p of payments) {
            const id = Number(p?.paymentId) || 0;
            if (!id) continue;
            if (!paymentDetailsById?.[id]) {
                next[id] = p;
            }
        }

        if (Object.keys(next).length > 0) {
            setPaymentDetailsById((prev) => ({ ...prev, ...next }));
        }
    }, [expandedOrderId, data, paymentDetailsById]);

    useEffect(() => {
        if (!paymentModalOpen) return;

        const fetchLookups = async () => {
            try {
                const lookupResults = await Promise.allSettled([
                    brandService.getBrandDropdown(),
                    gatewayService.getGatewayDropdown({ PageNumber: 1, PageSize: 200, SortProperty: 'gatewayId', IsDescending: false }),
                    userService.getUsers({ PageNumber: 1, PageSize: 200, SortProperty: 'userId', IsDescending: false }),
                    orderLookupService.getSaleTypes(),
                    orderLookupService.getCardTypes(),
                    gatewayService.getGatewayPaymentTypes(),
                ]);

                const lookupNames = ['brands', 'gateways', 'users', 'sale types', 'card types', 'gateway payment types'];
                const failedLookups = lookupResults
                    .map((result, index) => ({ result, name: lookupNames[index] }))
                    .filter(({ result }) => result.status === 'rejected');
                failedLookups.forEach(({ result, name }) => {
                    console.error(`Failed to load ${name}`, result.reason);
                });
                if (failedLookups.length > 0) {
                    toast.error(`Some payment options could not be loaded: ${failedLookups.map(({ name }) => name).join(', ')}`);
                }

                const valueAt = (index, fallback) =>
                    lookupResults[index]?.status === 'fulfilled' ? lookupResults[index].value : fallback;
                const brandsResult = valueAt(0, []);
                const gatewaysResult = valueAt(1, { data: [] });
                const usersResult = valueAt(2, { data: [] });
                const saleTypeResult = valueAt(3, { data: [] });
                const cardTypeResult = valueAt(4, { data: [] });
                const gatewayPaymentTypeResult = valueAt(5, { data: [] });

                setBrands(Array.isArray(brandsResult) ? brandsResult : brandsResult?.data || []);
                setGateways(gatewaysResult?.data || []);
                setUsers(usersResult?.data || []);

                const gatewayPaymentTypeList = gatewayPaymentTypeResult?.data || [];
                setGatewayPaymentTypes(Array.isArray(gatewayPaymentTypeList) ? gatewayPaymentTypeList : []);

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

                const cardValues = Array.isArray(cardTypeResult?.data) ? cardTypeResult.data : [];
                const cardOptions = cardValues
                    .filter((v) => v?.isActive !== false)
                    .map((v) => ({
                        id: v?.settingValueId ?? v?.id ?? v?.valueId ?? v?.name,
                        name: String(v?.settingValueText ?? v?.name ?? v?.label ?? v?.text ?? '').trim(),
                    }))
                    .filter((v) => v.name);
                setCardTypes(cardOptions);
            } catch (err) {
                console.error('Failed to load payment lookups', err);
                toast.error(getApiErrorMessage(err, 'Failed to load payment lookups'));
                setBrands([]);
                setGateways([]);
                setGatewayPaymentTypes([]);
                setSaleTypes([]);
                setCardTypes([]);
                setUsers([]);
            }
        };

        fetchLookups();
    }, [paymentModalOpen]);

    // Build the gateway -> brand mapping from the lookup endpoint. Payment forms
    // must not require View_Gateway, which is reserved for the Gateway admin page.
    useEffect(() => {
        if (!paymentModalOpen) return undefined;

        let cancelled = false;

        const loadGatewayBrandMap = async () => {
            try {
                const response = await gatewayService.getGatewayDropdown({
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
            } catch (err) {
                console.error('Failed to load gateway brand mapping', err);
            }
        };

        loadGatewayBrandMap();

        return () => {
            cancelled = true;
        };
    }, [paymentModalOpen]);

    // One row per gateway/payment-type pair. The API may return a single record
    // carrying several ids and a comma separated name, so it is flattened first.
    const activeGatewayPaymentTypeRecords = useMemo(() => {
        const source = Array.isArray(gatewayPaymentTypes) ? gatewayPaymentTypes : [];
        const normalized = [];

        source.forEach((record) => {
            const gatewayId = Number(
                record?.gatewayId ?? record?.GatewayId ?? record?.getwayId ?? record?.GetwayId,
            ) || 0;
            if (!gatewayId) return;
            if (record?.isActive === false) return;

            const nameParts = String(record?.paymentTypeName ?? record?.PaymentTypeName ?? '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);

            const paymentTypeIds = Array.isArray(record?.paymentTypeIds)
                ? record.paymentTypeIds
                : (record?.paymentTypeId != null ? [record.paymentTypeId] : []);

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

    const hasGatewayPaymentTypeData = activeGatewayPaymentTypeRecords.length > 0;

    const paymentEnabledGatewayIds = useMemo(
        () => new Set(
            activeGatewayPaymentTypeRecords
                .map((record) => Number(record?.gatewayId) || 0)
                .filter((gatewayId) => gatewayId > 0),
        ),
        [activeGatewayPaymentTypeRecords],
    );

    // Which payment type tiles the selected gateway accepts. `null` means no
    // gateway is picked yet, so every tile stays available.
    const allowedPaymentTabs = useMemo(() => {
        const gatewayId = Number(paymentDraft?.gatewayId) || 0;
        if (!gatewayId || !hasGatewayPaymentTypeData) return null;

        const tabs = new Set();
        activeGatewayPaymentTypeRecords
            .filter((record) => Number(record?.gatewayId) === gatewayId)
            .forEach((record) => {
                String(record?.paymentTypeName ?? record?.PaymentTypeName ?? '')
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)
                    .forEach((name) => {
                        const tab = paymentTabFromName(name);
                        if (tab) tabs.add(tab);
                    });
            });

        return Array.from(tabs);
    }, [activeGatewayPaymentTypeRecords, hasGatewayPaymentTypeData, paymentDraft?.gatewayId]);

    const isPaymentTabAllowed = useCallback(
        (tab) => {
            if (!allowedPaymentTabs) return true;
            return allowedPaymentTabs.includes(tab);
        },
        [allowedPaymentTabs],
    );

    // The mapping read the other way round: which gateways accept the payment
    // type on the active tile, so picking "Card" narrows the Gateway list.
    const gatewayIdsForActiveTab = useMemo(() => {
        const ids = new Set();
        if (!paymentActiveTab || !hasGatewayPaymentTypeData) return ids;

        activeGatewayPaymentTypeRecords.forEach((record) => {
            const gatewayId = Number(record?.gatewayId) || 0;
            if (!gatewayId) return;

            String(record?.paymentTypeName ?? record?.PaymentTypeName ?? '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
                .forEach((name) => {
                    if (paymentTabFromName(name) === paymentActiveTab) ids.add(gatewayId);
                });
        });

        return ids;
    }, [activeGatewayPaymentTypeRecords, hasGatewayPaymentTypeData, paymentActiveTab]);

    // Gateway id -> brand id, resolved from whatever carries it. Gateway rows
    // often arrive with no brand id at all, so this falls back to the
    // /GatewayPaymentType records and finally to the gateway's own name, which is
    // written as "<Payment type> - <Brand>".
    const gatewayBrandIdByGatewayId = useMemo(() => {
        // Full /Gateway records first - they are the authoritative pairing.
        const brandMap = new Map(gatewayBrandById);

        (Array.isArray(gateways) ? gateways : []).forEach((gateway) => {
            const gatewayId = Number(gateway?.gatewayId ?? gateway?.GatewayId ?? gateway?.id) || 0;
            const brandId = Number(gateway?.brandId ?? gateway?.BrandId) || 0;
            if (gatewayId > 0 && brandId > 0 && !brandMap.has(gatewayId)) brandMap.set(gatewayId, brandId);
        });

        activeGatewayPaymentTypeRecords.forEach((record) => {
            const gatewayId = Number(record?.gatewayId) || 0;
            const brandId = Number(record?.brandId ?? record?.BrandId) || 0;
            if (gatewayId > 0 && brandId > 0 && !brandMap.has(gatewayId)) {
                brandMap.set(gatewayId, brandId);
            }
        });

        // Longest brand name first, so "QF360 Pro" wins over "QF360".
        const brandsByName = (Array.isArray(brands) ? brands : [])
            .map((brand) => ({
                id: Number(brand?.brandId ?? brand?.BrandId ?? brand?.id) || 0,
                name: String(brand?.brandName ?? brand?.BrandName ?? brand?.name ?? '').trim().toLowerCase(),
            }))
            .filter((brand) => brand.id > 0 && brand.name)
            .sort((a, b) => b.name.length - a.name.length);

        if (brandsByName.length > 0) {
            (Array.isArray(gateways) ? gateways : []).forEach((gateway) => {
                const gatewayId = Number(gateway?.gatewayId ?? gateway?.GatewayId ?? gateway?.id) || 0;
                if (!gatewayId || brandMap.has(gatewayId)) return;

                const gatewayName = String(gateway?.gatewayName ?? gateway?.GatewayName ?? gateway?.name ?? '')
                    .trim()
                    .toLowerCase();
                if (!gatewayName) return;

                const match = brandsByName.find((brand) => gatewayName.includes(brand.name));
                if (match) brandMap.set(gatewayId, match.id);
            });
        }

        return brandMap;
    }, [gatewayBrandById, gateways, brands, activeGatewayPaymentTypeRecords]);

    const resolveGatewayBrandId = useCallback(
        (gatewayId) => Number(gatewayBrandIdByGatewayId.get(Number(gatewayId) || 0)) || 0,
        [gatewayBrandIdByGatewayId],
    );

    const filteredGateways = useMemo(() => {
        const brandId = Number(paymentDraft?.brandId) || 0;
        const selectedGatewayId = Number(paymentDraft?.gatewayId) || 0;
        const all = Array.isArray(gateways) ? gateways : [];

        return all.filter((g) => {
            const gatewayId = Number(g?.gatewayId) || 0;
            // The already-saved gateway always stays selectable, so opening an
            // existing payment never blanks its own gateway.
            if (selectedGatewayId > 0 && gatewayId === selectedGatewayId) return true;

            // The GatewayDropdown response may not carry a brand id per row
            // (normalized to 0). Show gateways tied to the selected brand PLUS any
            // that aren't bound to a brand, so the dropdown isn't empty.
            const gatewayBrandId = gatewayBrandIdByGatewayId.get(gatewayId) || Number(g?.brandId) || 0;
            const matchesBrand = !brandId || !gatewayBrandId || gatewayBrandId === brandId;
            if (!matchesBrand) return false;

            // A chosen brand shows all of its active gateways; the payment-type tabs
            // then follow the gateway that is picked.
            if (brandId) return g?.isActive !== false;

            // Until the mapping loads, don't filter on it - an empty lookup would
            // otherwise blank the dropdown while the request is in flight.
            if (!hasGatewayPaymentTypeData) return true;

            return paymentEnabledGatewayIds.has(gatewayId)
                && g?.isActive !== false
                && gatewayIdsForActiveTab.has(gatewayId);
        });
    }, [
        gateways,
        paymentDraft?.brandId,
        paymentDraft?.gatewayId,
        gatewayBrandIdByGatewayId,
        hasGatewayPaymentTypeData,
        paymentEnabledGatewayIds,
        gatewayIdsForActiveTab,
    ]);

    // Safety net for a gateway that arrives already set with no brand beside it -
    // an existing payment being edited, or a gateway picked before the lookups
    // finished resolving its brand. Only ever fills a blank brand.
    useEffect(() => {
        if (!paymentModalOpen) return;

        const gatewayId = Number(paymentDraft?.gatewayId) || 0;
        if (!gatewayId) return;
        if (Number(paymentDraft?.brandId) > 0) return;

        const inferredBrandId = resolveGatewayBrandId(gatewayId);
        if (!inferredBrandId) return;

        setPaymentDraft((prev) => (Number(prev.brandId) > 0 ? prev : { ...prev, brandId: inferredBrandId }));
        clearPaymentError('brandId');
    }, [paymentModalOpen, paymentDraft?.gatewayId, paymentDraft?.brandId, resolveGatewayBrandId]);

    // The selected gateway decides the payment type: if the tile in view is not
    // one the gateway accepts, move to the first one it does and carry the draft's
    // paymentType with it.
    useEffect(() => {
        if (!paymentModalOpen) return;
        if (!allowedPaymentTabs || allowedPaymentTabs.length === 0) return;
        if (allowedPaymentTabs.includes(paymentActiveTab)) return;

        const nextTab = PAYMENT_TAB_ORDER.find((tab) => allowedPaymentTabs.includes(tab));
        if (!nextTab) return;

        setPaymentActiveTab(nextTab);
        setPaymentDraft((prev) => ({ ...prev, paymentType: paymentTypeFromTab(nextTab) }));
    }, [paymentModalOpen, allowedPaymentTabs, paymentActiveTab]);

    // In Add Payment, also narrow the gateway list server-side by the selected
    // brand (the dropdown endpoint supports a BrandId filter), matching how the
    // Create Order page loads brand-specific gateways.
    useEffect(() => {
        if (!paymentModalOpen) return;
        if (paymentModalMode === 'edit') return;
        const brandId = Number(paymentDraft?.brandId) || 0;
        if (!brandId) return;

        let cancelled = false;
        const loadGatewaysForBrand = async () => {
            try {
                // Only this brand's gateways (exact brandId match from the Gateway records).
                const result = await gatewayService.getBrandGateways(brandId);
                if (!cancelled) setGateways(result?.data || []);
            } catch (err) {
                if (!cancelled) console.error('Failed to load gateways for selected brand', err);
            }
        };

        loadGatewaysForBrand();
        return () => {
            cancelled = true;
        };
    }, [paymentModalOpen, paymentModalMode, paymentDraft?.brandId]);

    useEffect(() => {
        if (!paymentModalOpen) return;

        const brandId = Number(paymentDraft?.brandId) || 0;
        const gatewayId = Number(paymentDraft?.gatewayId) || 0;
        if (!brandId || !gatewayId) return;

        // Don't clear the selected gateway until lookups are loaded.
        // Otherwise, opening Edit Payment can briefly see an empty gateways list
        // and incorrectly reset gatewayId to 0.
        const allGateways = Array.isArray(gateways) ? gateways : [];
        if (allGateways.length === 0) return;

        const stillValid = (filteredGateways || []).some((g) => Number(g?.gatewayId) === gatewayId);
        if (!stillValid) {
            setPaymentDraft((prev) => ({ ...prev, gatewayId: 0 }));
        }
    }, [paymentModalOpen, paymentDraft?.brandId, paymentDraft?.gatewayId, filteredGateways, gateways]);

    useEffect(() => {
        if (!paymentModalOpen) return;
        if (paymentModalMode !== 'edit') return;

        const hasBrands = Array.isArray(brands) && brands.length > 0;
        const hasGateways = Array.isArray(gateways) && gateways.length > 0;
        if (!hasBrands && !hasGateways) return;

        setPaymentDraft((prev) => {
            const next = { ...prev };
            let changed = false;

            const currentBrandId = Number(next.brandId) || 0;
            const currentGatewayId = Number(next.gatewayId) || 0;

            // If we have gatewayId but missing brandId, infer brand from the gateway.
            if (!currentBrandId && currentGatewayId && hasGateways) {
                const gw = (gateways || []).find((g) => Number(g?.gatewayId) === currentGatewayId);
                const inferredBrandId = Number(gw?.brandId) || 0;
                if (inferredBrandId) {
                    next.brandId = inferredBrandId;
                    changed = true;
                }
            }

            // If ids are missing but names exist, map names to ids.
            if (!Number(next.brandId) && next.brandName && hasBrands) {
                const wanted = String(next.brandName).trim().toLowerCase();
                const match = (brands || []).find((b) => {
                    const name = String(b?.brandName || b?.name || '').trim().toLowerCase();
                    return name && name === wanted;
                });
                const inferredBrandId = Number(match?.brandId) || 0;
                if (inferredBrandId) {
                    next.brandId = inferredBrandId;
                    changed = true;
                }
            }

            if (!Number(next.gatewayId) && next.gatewayName && hasGateways) {
                const wanted = String(next.gatewayName).trim().toLowerCase();
                const match = (gateways || []).find((g) => {
                    const name = String(g?.gatewayName || g?.name || '').trim().toLowerCase();
                    return name && name === wanted;
                });
                const inferredGatewayId = Number(match?.gatewayId) || 0;
                if (inferredGatewayId) {
                    next.gatewayId = inferredGatewayId;
                    changed = true;
                }

                const inferredBrandId = Number(match?.brandId) || 0;
                if (!Number(next.brandId) && inferredBrandId) {
                    next.brandId = inferredBrandId;
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [brands, gateways, paymentModalMode, paymentModalOpen]);

    const getUserFullName = useCallback(
        (id) => {
            const userId = Number(id) || 0;
            if (!userId) return '';
            const u = (users || []).find((x) => Number(x.userId) === userId);
            if (!u) return `User #${userId}`;
            const fullName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim();
            return fullName || u.username || u.userName || u.email || `User #${userId}`;
        },
        [users],
    );

    // Merge freshly searched users into the existing `users` list without
    // dropping anyone already loaded (mirrors Create Order's Share Sale search).
    const mergeUsers = useCallback((nextUsers = []) => {
        setUsers((prev) => {
            const map = new Map();

            (Array.isArray(prev) ? prev : []).forEach((user) => {
                const userId = Number(user?.userId ?? user?.UserId ?? user?.id) || 0;
                if (userId > 0) map.set(userId, user);
            });

            (Array.isArray(nextUsers) ? nextUsers : []).forEach((user) => {
                const userId = Number(user?.userId ?? user?.UserId ?? user?.id) || 0;
                if (userId > 0) map.set(userId, { ...map.get(userId), ...user });
            });

            return Array.from(map.values());
        });
    }, []);

    // Same merge for the Share Sale picker list, which is sales-only.
    const mergeShareSaleUsers = useCallback((nextUsers = []) => {
        setShareSaleUsers((prev) => {
            const map = new Map();

            (Array.isArray(prev) ? prev : []).forEach((user) => {
                const userId = Number(user?.userId ?? user?.UserId ?? user?.id) || 0;
                if (userId > 0) map.set(userId, user);
            });

            (Array.isArray(nextUsers) ? nextUsers : []).forEach((user) => {
                const userId = Number(user?.userId ?? user?.UserId ?? user?.id) || 0;
                if (userId > 0) map.set(userId, { ...map.get(userId), ...user });
            });

            return Array.from(map.values());
        });
    }, []);

    // Live server-side user search for the Share Sale "Sale With" dropdown,
    // so the Orders table behaves the same as the Create Order page.
    const fetchShareSaleUsers = useCallback(
        async (searchText) => {
            const query = String(searchText || '').trim();
            if (!query) return;

            try {
                const salesUsers = await searchSalesPersonUsers(query, { pageSize: 200 });
                // `users` also backs the name lookups, so matches go to both.
                mergeUsers(salesUsers);
                mergeShareSaleUsers(salesUsers);
            } catch (error) {
                console.error('Failed to search Share Sale users', error);
            }
        },
        [mergeUsers, mergeShareSaleUsers],
    );

    const normalizePersonName = useCallback(
        (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' '),
        [],
    );

    const resolveOrderSalesPerson = useCallback(
        (order) => {
            const safeOrder = order || {};
            const rawName =
                String(
                    safeOrder?.salesPersonName ||
                    safeOrder?.salespersonName ||
                    safeOrder?.salePersonName ||
                    safeOrder?.salesPerson ||
                    '',
                ).trim();

            const directId =
                Number(
                    safeOrder?.salesPersonId ??
                    safeOrder?.salespersonId ??
                    safeOrder?.salesPersonID ??
                    safeOrder?.salePersonId,
                ) || 0;

            if (directId > 0) {
                return {
                    id: directId,
                    name: rawName || getUserFullName(directId),
                };
            }

            const normalizedName = normalizePersonName(rawName);
            if (!normalizedName) {
                return { id: 0, name: rawName };
            }

            const matchedUser = (users || []).find((u) => normalizePersonName(getUserFullName(u?.userId)) === normalizedName);

            return {
                id: Number(matchedUser?.userId) || 0,
                name: rawName || (matchedUser ? getUserFullName(matchedUser.userId) : ''),
            };
        },
        [users, getUserFullName, normalizePersonName],
    );

    const closePaymentModal = () => {
        setPaymentModalOpen(false);
        setPaymentLoading(false);
        setPaymentSaving(false);
        setPaymentDraft(emptyPayment);
        setPaymentModalMode('add');
        setPaymentActiveTab('card');
        setPaymentErrors({});
        setActiveEditPaymentId(0);
    };

    const closeRefundModal = () => {
        setRefundModalOpen(false);
        setRefundDraft(emptyRefund);
        setRefundOriginalPayment(null);
        setRefundLoading(false);
        setRefundSaving(false);
    };

    const validatePaymentBeforeSave = () => {
        if (orderCodesLoading) {
            toast.error('Permissions are still loading, please try again.');
            return false;
        }
        if (paymentModalMode === 'edit' && !canUpdateOrderPayment) {
            toast.error("You don't have permission to update order payments.");
            return false;
        }
        if (paymentModalMode !== 'edit' && !canAddOrderPayment) {
            toast.error("You don't have permission to add order payments.");
            return false;
        }

        const validationErrors = validatePaymentDraft(paymentDraft, paymentActiveTab, paymentModalMode);
        if (Object.keys(validationErrors).length > 0) {
            setPaymentErrors(validationErrors);
            toast.error('Please fix the highlighted fields');
            return false;
        }

        return true;
    };

    const loadShareSaleModalPayment = useCallback(async (order, payment, saveMethod = 'post', options = {}) => {
        const safeOrder = order || {};
        const safePayment = payment || {};
        const useFreshRows = !!options?.fresh;
        const resolvedSalesPerson = resolveOrderSalesPerson(safeOrder);
        const resolvedSalesPersonId = Number(resolvedSalesPerson?.id) || 0;
        const paymentId = Number(safePayment?.paymentId) || 0;

        if (!paymentId) {
            toast.error('Please select a valid payment to share.');
            return false;
        }

        let shareRows = [];
        const fallbackShareRows = extractShareRowsFromOrder(safeOrder)
            .filter((row) => {
                const rowPaymentId = Number(
                    row?.paymentId ??
                    row?.PaymentId ??
                    row?.paymentID ??
                    row?.PaymentID,
                ) || 0;

                return rowPaymentId > 0 ? rowPaymentId === paymentId : true;
            });

        if (!useFreshRows) {
            try {
                shareRows = await paymentService.getSharePayments({ paymentId });
            } catch (err) {
                console.error('Failed to load share payment rows', err);
                toast.error(getApiErrorMessage(err, 'Failed to load share payment rows'));
                return false;
            }

            // If API returns empty but order payload already has share rows, keep UI populated.
            if (!Array.isArray(shareRows) || shareRows.length === 0) {
                shareRows = fallbackShareRows;
            }
        }

        const resolvedSalesPersonNameNormalized = String(resolvedSalesPerson?.name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');

        const getShareWithId = (row) => Number(
            row?.shareWithId ??
            row?.ShareWithId ??
            row?.sharewithId ??
            row?.shareToId ??
            row?.salesPersonId ??
            row?.userId,
        ) || 0;

        const getShareWithNameNormalized = (row) => String(
            row?.shareWithName ??
            row?.ShareWithName ??
            row?.sharewithName ??
            row?.shareToName ??
            row?.salesPersonName ??
            row?.userName ??
            '',
        )
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');

        const isSalesPersonShareRow = (row) => {
            const shareWithId = getShareWithId(row);
            if (resolvedSalesPersonId > 0 && shareWithId === resolvedSalesPersonId) return true;

            if (resolvedSalesPersonId <= 0 && resolvedSalesPersonNameNormalized) {
                return getShareWithNameNormalized(row) === resolvedSalesPersonNameNormalized;
            }

            return false;
        };

        const salesPersonShareRows = !useFreshRows
            ? (shareRows || []).filter((row) => isSalesPersonShareRow(row))
            : [];

        const salesPersonShareRow = salesPersonShareRows?.[0] || null;

        // Keep salesperson rows out of the editable split rows grid.
        const nonSalesPersonRows = !useFreshRows
            ? (shareRows || []).filter((row) => !isSalesPersonShareRow(row))
            : shareRows;

        const mappedRows = useFreshRows
            ? []
            : (nonSalesPersonRows || []).map((row, idx) => ({
                rowId: Number(row?.id) || Date.now() + idx + Math.random(),
                id: Number(row?.id ?? row?.Id) || 0,
                paymentId: Number(row?.paymentId ?? row?.PaymentId) || paymentId,
                shareWithId: Number(
                    row?.shareWithId ??
                    row?.ShareWithId ??
                    row?.sharewithId ??
                    row?.shareToId ??
                    row?.salesPersonId ??
                    row?.userId,
                ) || 0,
                shareWithName: String(
                    row?.shareWithName ??
                    row?.ShareWithName ??
                    row?.sharewithName ??
                    row?.shareToName ??
                    row?.salesPersonName ??
                    row?.userName ??
                    '',
                ).trim(),
                amount: String(Number(row?.amount ?? row?.Amount ?? row?.shareAmount) || 0),
                splitTypeId: Number(row?.shareTypeId ?? row?.ShareTypeId ?? row?.splitTypeId ?? row?.SplitTypeId) || 0,
                createdDate: row?.createdDate ?? row?.CreatedDate ?? null,
                updatedDate: row?.updatedDate ?? row?.UpdatedDate ?? null,
                entIp: String(row?.entIp ?? row?.EntIp ?? ''),
                udpIp: String(row?.udpIp ?? row?.UdpIp ?? ''),
                createdBy: Number(row?.createdBy ?? row?.CreatedBy) || 0,
                updatedBy: Number(row?.updatedBy ?? row?.UpdatedBy) || 0,
            }));

        const initialSalesPersonTypeId = useFreshRows
            ? 0
            : (
                Number(salesPersonShareRow?.shareTypeId ?? salesPersonShareRow?.ShareTypeId ?? salesPersonShareRow?.splitTypeId) ||
                Number(mappedRows?.[0]?.splitTypeId) ||
                0
            );

        const resolvedSaveMethod = useFreshRows
            ? 'post'
            : ((shareRows || []).length > 0 ? 'put' : (saveMethod === 'put' ? 'put' : 'post'));

        setShareSaleModalOrder(safeOrder);
        setShareSaleModalPayment(safePayment);
        setShareSaleModalExistingRows(Array.isArray(shareRows) ? shareRows : []);
        setShareSaleModalRows(mappedRows);
        setShareSaleModalSalesPersonTypeId(initialSalesPersonTypeId);
        setShareSaleSaveMethod(resolvedSaveMethod);
        return true;
    }, [resolveOrderSalesPerson, shareSaleTypeOptions, users, getUserFullName]);

    const openShareSaleModal = async (order, payment, saveMethod = 'post', options = {}) => {
        const loaded = await loadShareSaleModalPayment(order, payment, saveMethod, options);
        if (!loaded) return;
        setShareSaleModalOpen(true);
    };

    const handleShareSaleModalPaymentChange = async (paymentIdValue) => {
        if (shareSaleSaving) return;

        const nextPaymentId = Number(paymentIdValue) || 0;
        const currentPaymentId = Number(shareSaleModalPayment?.paymentId) || 0;
        if (!nextPaymentId || nextPaymentId === currentPaymentId) return;

        const orderPayments = Array.isArray(shareSaleModalOrder?.payments) ? shareSaleModalOrder.payments : [];
        const nextPayment = orderPayments.find((p) => Number(p?.paymentId) === nextPaymentId);
        if (!nextPayment) return;

        setShareSaleModalPaymentChanging(true);
        try {
            await loadShareSaleModalPayment(shareSaleModalOrder, nextPayment, 'put');
        } finally {
            setShareSaleModalPaymentChanging(false);
        }
    };

    const handleOpenSharePaymentFromOrder = (order) => {
        const payments = Array.isArray(order?.payments) ? order.payments : [];
        if (payments.length === 0) {
            toast.error('No payment found for this order.');
            return;
        }

        const paymentWithShareRows = payments.find((payment) => getSharePaymentRows(payment).length > 0);

        const orderLevelShareRows = getSharePaymentRows(order);
        const paymentIdFromOrderShareRows = Number(
            orderLevelShareRows.find((row) => Number(row?.paymentId ?? row?.PaymentId) > 0)?.paymentId ??
            orderLevelShareRows.find((row) => Number(row?.paymentId ?? row?.PaymentId) > 0)?.PaymentId,
        ) || 0;

        const paymentFromOrderShareRows = paymentIdFromOrderShareRows > 0
            ? payments.find((payment) => Number(payment?.paymentId) === paymentIdFromOrderShareRows)
            : null;

        const targetPayment = paymentWithShareRows || paymentFromOrderShareRows || payments[0];

        openShareSaleModal(order, targetPayment, 'put');
    };

    const closeShareSaleModal = () => {
        if (shareSaleSaving) return;
        setShareSaleModalOpen(false);
        setShareSaleModalOrder(null);
        setShareSaleModalPayment(null);
        setShareSaleModalExistingRows([]);
        setShareSaleModalPaymentChanging(false);
        setShareSaleModalRows([]);
        setShareSaleModalSalesPersonTypeId(0);
        setShareSaleSaveMethod('post');
    };

    const addShareSaleModalRow = () => {
        setShareSaleModalRows((prev) => [
            ...prev,
            {
                rowId: Date.now() + Math.random(),
                id: 0,
                paymentId: Number(shareSaleModalPayment?.paymentId) || 0,
                shareWithId: 0,
                shareWithName: '',
                amount: '',
                splitTypeId: 0,
                createdDate: null,
                updatedDate: null,
                entIp: '',
                udpIp: '',
                createdBy: 0,
                updatedBy: 0,
            },
        ]);
    };

    const removeShareSaleModalRow = async (rowId) => {
        const targetRow = (shareSaleModalRows || []).find((row) => row.rowId === rowId);
        if (!targetRow) return;

        const sharePaymentId = Number(targetRow?.id) || 0;
        const isExistingRow = sharePaymentId > 0;

        if (isExistingRow && shareSaleSaveMethod === 'put') {
            try {
                setShareSaleSaving(true);
                await paymentService.deleteSharePayment(sharePaymentId);
            } catch (err) {
                console.error('Failed to delete share sale row', err);
                toast.error(getApiErrorMessage(err, 'Failed to delete share sale row'));
                return;
            } finally {
                setShareSaleSaving(false);
            }
        }

        setShareSaleModalRows((prev) =>
            prev.filter((row) => {
                if (row.rowId !== rowId) return true;
                const isExistingPostRow = shareSaleSaveMethod === 'post' && Number(row?.id) > 0;
                return isExistingPostRow;
            })
        );
    };

    const updateShareSaleModalRow = (rowId, field, value) => {
        setShareSaleModalRows((prev) =>
            prev.map((row) => {
                if (row.rowId !== rowId) return row;

                const isExistingPostRow = shareSaleSaveMethod === 'post' && Number(row?.id) > 0;
                if (isExistingPostRow) return row;

                if (field === 'amount') {
                    if (Number(row?.shareWithId) <= 0) {
                        return { ...row, amount: '' };
                    }

                    let cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
                    if (!cleaned) {
                        return { ...row, amount: '' };
                    }

                    // Keep only one decimal point and at most 2 decimal digits.
                    const firstDotIndex = cleaned.indexOf('.');
                    if (firstDotIndex >= 0) {
                        const intPart = cleaned.slice(0, firstDotIndex);
                        const fracPart = cleaned
                            .slice(firstDotIndex + 1)
                            .replace(/\./g, '')
                            .slice(0, 2);
                        cleaned = `${intPart}.${fracPart}`;
                    } else {
                        cleaned = cleaned.replace(/\./g, '');
                    }

                    if (cleaned === '.') {
                        cleaned = '0.';
                    }

                    const parsed = Number(cleaned);
                    if (!Number.isFinite(parsed)) {
                        return { ...row, amount: cleaned };
                    }

                    // Preserve partial input like "199." while typing.
                    if (cleaned.endsWith('.')) {
                        return { ...row, amount: cleaned };
                    }

                    return { ...row, amount: cleaned };
                }

                if (field === 'shareWithId') {
                    const nextShareWithId = value ? Number(value) : 0;
                    const matchedUser = (users || []).find((u) => Number(u?.userId) === nextShareWithId);
                    return {
                        ...row,
                        shareWithId: nextShareWithId,
                        shareWithName: matchedUser ? getUserFullName(nextShareWithId) : row.shareWithName,
                    };
                }

                if (field === 'splitTypeId') {
                    return { ...row, splitTypeId: value ? Number(value) : 0 };
                }

                return { ...row, [field]: value };
            }),
        );
    };

    const handleSaveShareSaleRows = async () => {
        try {
            setShareSaleSaving(true);
            const now = new Date().toISOString();
            const currentUserId = Number(localStorage.getItem('userId')) || 0;
            const ipv4 = await getCurrentLoginIpv4();
            const paymentId = Number(shareSaleModalPayment?.paymentId) || 0;
            if (!paymentId) {
                toast.error('Payment ID is required.');
                return;
            }

            const resolvedSalesPerson = resolveOrderSalesPerson(shareSaleModalOrder);
            const salesPersonId = Number(resolvedSalesPerson?.id) || 0;
            const existingShareRows = Array.isArray(shareSaleModalExistingRows) ? shareSaleModalExistingRows : [];
            const existingSalesPersonRow = (existingShareRows || []).find(
                (row) => Number(row?.shareWithId) === salesPersonId,
            );
            const orderTotal = Number(shareSaleModalPayment?.amount) || 0;
            const splitTotal = (shareSaleModalRows || []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);

            if (splitTotal > orderTotal) {
                toast.error('Share amount cannot be more than order total amount.');
                return;
            }

            const salesPersonAmount = Math.max(0, orderTotal - splitTotal);
            const fullShareTypeId =
                Number(
                    (shareSaleTypeOptions || []).find(
                        (opt) => String(opt?.name || '').trim().toLowerCase() === 'full',
                    )?.id,
                ) || 0;
            const salesPersonShareTypeId =
                (shareSaleModalRows || []).length > 0
                    ? Number(shareSaleModalSalesPersonTypeId) || 0
                    : fullShareTypeId;

            const payload = (shareSaleModalRows || []).map((row) => {
                const shareWithId = Number(row?.shareWithId) || 0;
                const matchedUser = (users || []).find((u) => Number(u?.userId) === shareWithId);
                return {
                    id: Number(row?.id) || 0,
                    paymentId: Number(row?.paymentId) || paymentId,
                    shareWithId,
                    shareWithName: matchedUser ? getUserFullName(shareWithId) : String(row?.shareWithName || '').trim(),
                    shareTypeId: Number(row?.splitTypeId) || 0,
                    amount: Number(row?.amount) || 0,
                    createdDate: row?.createdDate || now,
                    updatedDate: now,
                    entIp: ipv4 || String(row?.entIp || ''),
                    udpIp: ipv4 || String(row?.udpIp || ''),
                    createdBy: Number(row?.createdBy) || currentUserId,
                    updatedBy: currentUserId,
                };
            });

            const salesPersonPayloadRow = salesPersonId
                ? {
                    id: Number(existingSalesPersonRow?.id) || 0,
                    paymentId,
                    shareWithId: salesPersonId,
                    shareWithName: String(resolvedSalesPerson?.name || '').trim() || getUserFullName(salesPersonId),
                    shareTypeId: salesPersonShareTypeId,
                    amount: salesPersonAmount,
                    createdDate: existingSalesPersonRow?.createdDate || now,
                    updatedDate: now,
                    entIp: ipv4 || String(existingSalesPersonRow?.entIp || ''),
                    udpIp: ipv4 || '',
                    createdBy: Number(existingSalesPersonRow?.createdBy) || currentUserId,
                    updatedBy: currentUserId,
                }
                : null;

            const hasExistingIds =
                (existingShareRows || []).some((row) => Number(row?.id) > 0) ||
                (payload || []).some((row) => Number(row?.id) > 0) ||
                Number(salesPersonPayloadRow?.id) > 0;

            if (shareSaleSaveMethod === 'put' || hasExistingIds) {
                const putPayload = salesPersonPayloadRow
                    ? [salesPersonPayloadRow, ...payload]
                    : payload;
                await paymentService.updateSharePayments(putPayload);
            } else {
                const createPayload = payload
                    .filter((row) => !Number(row?.id))
                    .map((row) => ({ ...row, id: 0 }));

                if (createPayload.length === 0) {
                    toast.info('No new share sale rows to save');
                    return;
                }

                await paymentService.createSharePayments(createPayload);
            }
            toast.success('Share sale updated');
            closeShareSaleModal();
            await fetchOrders();
        } catch (err) {
            console.error('Failed to update share sale', err);
            toast.error(getApiErrorMessage(err, 'Failed to update share sale'));
        } finally {
            setShareSaleSaving(false);
        }
    };

    const shareSaleModalOrderTotal = Number(shareSaleModalOrder?.totalAmount) || 0;
    const shareSaleModalPaymentTotal = Number(shareSaleModalPayment?.amount) || shareSaleModalOrderTotal;
    const shareSaleModalPaymentOptions = useMemo(() => {
        const orderPayments = Array.isArray(shareSaleModalOrder?.payments) ? shareSaleModalOrder.payments : [];
        return orderPayments
            .map((p) => {
                const pid = Number(p?.paymentId) || 0;
                const typeLabel = String(p?.paymentType || p?.cardType || 'Payment').trim() || 'Payment';
                const amountLabel = currency(Number(p?.amount) || 0);
                return {
                    id: pid,
                    label: `#${pid} â€¢ ${typeLabel} â€¢ ${amountLabel}`,
                };
            })
            .filter((p) => p.id > 0);
    }, [shareSaleModalOrder]);
    const shareSaleModalResolvedSalesPerson = useMemo(
        () => resolveOrderSalesPerson(shareSaleModalOrder),
        [resolveOrderSalesPerson, shareSaleModalOrder],
    );
    const shareSaleModalSplitTotal = useMemo(
        () => (shareSaleModalRows || []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0),
        [shareSaleModalRows],
    );
    const shareSaleModalRemaining = Math.max(0, shareSaleModalPaymentTotal - shareSaleModalSplitTotal);
    const shareSaleModalExceeded = shareSaleModalSplitTotal > shareSaleModalPaymentTotal;

    const shareSaleModalReceiptRows = useMemo(() => {
        const rows = [];
        const salesPersonName = String(shareSaleModalResolvedSalesPerson?.name || '').trim() || 'Sales Person';

        if ((shareSaleModalRows || []).length === 0) {
            rows.push({
                rowId: 'main-sales-person',
                label: salesPersonName,
                splitTypeLabel: 'Full',
                amount: shareSaleModalPaymentTotal,
            });
            return rows;
        }

        const selectedType = (shareSaleTypeOptions || []).find((opt) => Number(opt?.id) === Number(shareSaleModalSalesPersonTypeId));
        rows.push({
            rowId: 'main-sales-person',
            label: salesPersonName,
            splitTypeLabel: selectedType?.name || 'Split Type',
            amount: Math.max(0, shareSaleModalPaymentTotal - shareSaleModalSplitTotal),
        });

        (shareSaleModalRows || []).forEach((row, idx) => {
            const amount = Number(row?.amount) || 0;
            if (amount <= 0) return;
            const shareWithId = Number(row?.shareWithId) || 0;
            const matchedUser = (users || []).find((u) => Number(u?.userId) === shareWithId);
            const splitType = (shareSaleTypeOptions || []).find((opt) => Number(opt?.id) === Number(row?.splitTypeId));
            rows.push({
                rowId: row.rowId,
                label: matchedUser ? getUserFullName(shareWithId) : (String(row?.shareWithName || '').trim() || `Share ${idx + 1}`),
                splitTypeLabel: splitType?.name || 'Split Type',
                amount,
            });
        });

        return rows;
    }, [
        shareSaleModalResolvedSalesPerson?.name,
        shareSaleModalPaymentTotal,
        shareSaleModalRows,
        shareSaleModalSalesPersonTypeId,
        shareSaleTypeOptions,
        shareSaleModalSplitTotal,
        users,
        getUserFullName,
    ]);

    useEffect(() => {
        if (!shareSaleModalOpen) return;
        let cancelled = false;

        const fetchShareLookups = async () => {
            try {
                const [usersResult, salesUsers, shareTypeResult, roleResult] = await Promise.all([
                    userService.getUsers({ PageNumber: 1, PageSize: 500, SortProperty: 'userId', IsDescending: false }),
                    fetchSalesPersonList({ pageSize: 1000 }),
                    orderLookupService.getSalesShareTypes(),
                    roleService.getRoles({ PageNumber: 1, PageSize: 500, SortProperty: 'roleId', IsDescending: false }),
                ]);

                if (cancelled) return;

                setUsers(usersResult?.data || []);
                setShareSaleUsers(salesUsers || []);

                const shareValues = Array.isArray(shareTypeResult?.data) ? shareTypeResult.data : [];
                const options = shareValues
                    .filter((v) => v?.isActive !== false)
                    .map((v) => ({
                        id: Number(v?.settingValueId ?? v?.id ?? v?.valueId) || 0,
                        name: String(v?.settingValueText ?? v?.name ?? v?.text ?? '').trim(),
                    }))
                    .filter((v) => v.id > 0 && v.name);
                setShareSaleTypeOptions(options);

                const roles = roleResult?.data || [];
                const salesAgentIds = roles
                    .filter((role) => {
                        const roleName = String(role?.roleName || role?.name || '').trim().toLowerCase();
                        if (!roleName) return false;

                        const normalized = roleName.replace(/[\s_-]+/g, ' ').trim();
                        return (
                            normalized.includes('superadmin') ||
                            normalized.includes('super admin') ||
                            normalized.includes('admin') ||
                            normalized.includes('sales agent') ||
                            normalized.includes('sales manager')
                        );
                    })
                    .map((role) => Number(role?.roleId ?? role?.id) || 0)
                    .filter((id) => id > 0);
                setSalesAgentRoleIds(salesAgentIds);
            } catch (err) {
                console.error('Failed to load share sale lookups', err);
                if (!cancelled) {
                    setShareSaleUsers([]);
                    setShareSaleTypeOptions([]);
                    setSalesAgentRoleIds([]);
                }
            }
        };

        fetchShareLookups();

        return () => {
            cancelled = true;
        };
    }, [shareSaleModalOpen]);

    const openAddPaymentModal = (order) => {
        if (orderCodesLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canAddOrderPayment) {
            toast.error("You don't have permission to add order payments.");
            return;
        }

        const totalAmount = Number(order?.totalAmount) || 0;
        const paidAmount = Number(order?.paidAmount) || 0;
        const dueAmount = Math.max(0, totalAmount - paidAmount);

        setPaymentModalMode('add');
        setPaymentActiveTab('card');
        setPaymentDraft({
            ...emptyPayment,
            orderId: Number(order?.orderId) || 0,
            paymentType: 'Card',
            amount: dueAmount,
            gatewayId: Number(order?.gatewayId) || 0,
            brandId: Number(order?.brandId) || 0,
            paymentDate: new Date().toISOString(),
        });
        setPaymentErrors({});
        setPaymentModalOpen(true);
    };

    const openEditPaymentModal = async (paymentOrId) => {
        if (orderCodesLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canUpdateOrderPayment) {
            toast.error("You don't have permission to update order payments.");
            return;
        }

        const id = typeof paymentOrId === 'object' && paymentOrId ? Number(paymentOrId.paymentId) || 0 : Number(paymentOrId) || 0;
        if (!id) return;

        setActiveEditPaymentId(id);

        // Prefer cached details (already fetched when expanding rows), otherwise use the row payload.
        const cached = paymentDetailsById?.[id];
        let source = cached || (typeof paymentOrId === 'object' ? paymentOrId : null);

        if (!source && expandedOrderId) {
            const order = (data || []).find((o) => Number(o?.orderId) === Number(expandedOrderId));
            source = (order?.payments || []).find((p) => Number(p?.paymentId) === id) || null;
        }

        const fallbackOrderId =
            Number(source?.orderId) ||
            Number(expandedOrderId) ||
            0;

        const parentOrder =
            (data || []).find((o) => Number(o?.orderId) === Number(fallbackOrderId)) ||
            (data || []).find((o) => Number(o?.orderId) === Number(expandedOrderId)) ||
            null;

        const inferredBrandId = Number(source?.brandId) || Number(parentOrder?.brandId) || 0;
        const inferredGatewayId = Number(source?.gatewayId) || Number(parentOrder?.gatewayId) || 0;

        setPaymentModalMode('edit');
        setPaymentModalOpen(true);
        setPaymentErrors({});

        const amountFromSource = resolvePaymentAmount(source);
        const shouldFetch =
            !cached ||
            !Number.isFinite(amountFromSource) ||
            amountFromSource <= 0 ||
            !inferredBrandId ||
            !inferredGatewayId;

        if (shouldFetch) {
            try {
                setPaymentLoading(true);
                const fetched = await paymentService.getPaymentById(id);
                if (!fetched) {
                    toast.error('Payment not found');
                    setPaymentDraft(emptyPayment);
                    return;
                }
                setPaymentDetailsById((prev) => ({ ...prev, [id]: fetched }));

                const resolvedAmount = resolvePaymentAmount(fetched);
                setPaymentActiveTab(tabFromPaymentType(fetched.paymentType));
                setPaymentDraft(
                    normalizeExclusiveFlags({
                        ...emptyPayment,
                        ...fetched,
                        orderId: Number(fetched?.orderId) || fallbackOrderId,
                        brandId: Number(fetched?.brandId) || inferredBrandId,
                        gatewayId: Number(fetched?.gatewayId) || inferredGatewayId,
                        amount: Number.isFinite(resolvedAmount) ? resolvedAmount : 0,
                    }),
                );
                return;
            } catch (err) {
                console.error('Failed to load payment', err);
                toast.error(getApiErrorMessage(err, 'Failed to load payment'));
                setPaymentDraft(emptyPayment);
                return;
            } finally {
                setPaymentLoading(false);
            }
        }

        // Use cached/row data when it already contains a valid amount.
        setPaymentLoading(false);
        setPaymentActiveTab(tabFromPaymentType(source?.paymentType));
        setPaymentDraft(
            normalizeExclusiveFlags({
                ...emptyPayment,
                ...source,
                orderId: Number(source?.orderId) || fallbackOrderId,
                brandId: Number(source?.brandId) || inferredBrandId,
                gatewayId: Number(source?.gatewayId) || inferredGatewayId,
                amount: Number.isFinite(amountFromSource) ? amountFromSource : 0,
            }),
        );
    };

    useEffect(() => {
        if (!paymentModalOpen) return;
        if (paymentModalMode !== 'edit') return;
        if (!paymentLoading) return;

        const id = Number(activeEditPaymentId) || 0;
        if (!id) return;

        const cached = paymentDetailsById?.[id];
        if (!cached) return;

        const resolvedAmount = resolvePaymentAmount(cached);

        setPaymentActiveTab(tabFromPaymentType(cached.paymentType));
        // Keep inferred order/brand/gateway from the modal draft when cached data is partial.
        setPaymentDraft((prev) =>
            normalizeExclusiveFlags({
                ...emptyPayment,
                ...prev,
                ...cached,
                orderId: Number(cached?.orderId) || Number(prev?.orderId) || 0,
                brandId: Number(cached?.brandId) || Number(prev?.brandId) || 0,
                gatewayId: Number(cached?.gatewayId) || Number(prev?.gatewayId) || 0,
                amount: Number.isFinite(resolvedAmount) ? resolvedAmount : 0,
            }),
        );
        setPaymentLoading(false);
    }, [activeEditPaymentId, paymentDetailsById, paymentLoading, paymentModalMode, paymentModalOpen]);

    const openRefundModal = async (paymentOrId) => {
        if (orderCodesLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canRefundOrderPayment) {
            toast.error("You don't have permission to refund order payments.");
            return;
        }

        const id = typeof paymentOrId === 'object' && paymentOrId ? Number(paymentOrId.paymentId) || 0 : Number(paymentOrId) || 0;
        if (!id) return;

        setRefundModalOpen(true);
        setRefundLoading(true);

        try {
            const cached = paymentDetailsById?.[id];
            const seedPayment = cached || (typeof paymentOrId === 'object' ? paymentOrId : null);
            let payment = seedPayment;

            if (!payment && expandedOrderId) {
                const order = (data || []).find((o) => Number(o?.orderId) === Number(expandedOrderId));
                payment = (order?.payments || []).find((p) => Number(p?.paymentId) === id) || null;
            }

            // Use table/cached data directly; fetch only when we only have an id.
            if (!payment) {
                const fetchedPayment = await paymentService.getPaymentById(id);
                if (fetchedPayment) {
                    payment = fetchedPayment;
                    setPaymentDetailsById((prev) => ({ ...prev, [id]: payment }));
                }
            }

            if (!payment) {
                toast.error('Payment not found');
                closeRefundModal();
                return;
            }

            const fallbackOrderId = Number(payment?.orderId) || Number(expandedOrderId) || 0;
            const paymentSaleType = String(payment?.saleType ?? payment?.SaleType ?? '').trim().toLowerCase();
            const isEditingExistingRefund = paymentSaleType.includes('refund');
            const liveRefundDate = dateForInput(new Date());

            setRefundOriginalPayment(payment);
            setRefundDraft({
                paymentId: Number(payment.paymentId) || id,
                orderId: Number(payment.orderId) || fallbackOrderId,
                brandId: Number(payment.brandId) || Number(payment.BrandId) || 0,
                gatewayId: Number(payment.gatewayId) || Number(payment.GatewayId) || 0,
                amount: resolvePaymentAmount(payment),
                paymentDate: isEditingExistingRefund
                    ? dateForInput(payment.paymentDate || payment.PaymentDate || payment.createdAt || payment.CreatedAt || '')
                    : liveRefundDate,
                transactionId: payment.transactionId || payment.TransactionId || '',
                authCode: payment.authCode || payment.AuthCode || '',
                isChequeCleared: !!(payment.isChequeCleared ?? payment.IsChequeCleared),
                isChargeBack: !!(payment.isChargeBack ?? payment.IsChargeBack),
                isRetrieval: !!(payment.isRetrieval ?? payment.IsRetrieval),
                isAlert: !!(payment.isAlert ?? payment.IsAlert),
            });
        } catch (err) {
            console.error('Failed to load payment for refund', err);
            toast.error(getApiErrorMessage(err, 'Failed to load payment'));
            closeRefundModal();
        } finally {
            setRefundLoading(false);
        }
    };

    const handleRefundField = (key) => (event) => {
        const value = event?.target?.type === 'checkbox' ? !!event.target.checked : event?.target?.value;
        setRefundDraft((prev) => ({ ...prev, [key]: value }));
    };

    const setRefundFlag = (flagKey) => {
        if (!flagKey) {
            setRefundDraft((prev) => ({ ...prev, isChargeBack: false, isRetrieval: false, isAlert: false }));
            return;
        }

        setRefundDraft((prev) => ({
            ...prev,
            isChargeBack: false,
            isRetrieval: false,
            isAlert: false,
            [flagKey]: true,
        }));
    };

    const handlePaymentField = (field) => (e) => {
        const rawValue = e?.target?.type === 'checkbox' ? e.target.checked : e?.target?.value;

        let value = rawValue;
        if (field === 'amount') {
            // Keep the amount as a string while editing so the field can be cleared
            // (empty) instead of snapping back to 0. Converted via Number() at save.
            value = rawValue === '' || rawValue === null ? '' : rawValue;
        } else if (
            ['paymentId', 'orderId', 'gatewayId', 'brandId', 'chequeRoutingNo', 'chequeNo', 'createdBy', 'updatedBy'].includes(
                field,
            )
        ) {
            value = rawValue === '' || rawValue === null ? 0 : Number(rawValue);
        }

        setPaymentDraft((prev) => ({ ...prev, [field]: value }));
        clearPaymentError(field);
    };

    const exclusiveFlagKeys = ['isVoid', 'isChargeBack', 'isRetrieval', 'isAlert'];

    const normalizeExclusiveFlags = (draft) => {
        const next = { ...draft };
        const firstTrueKey = exclusiveFlagKeys.find((k) => !!next[k]);
        exclusiveFlagKeys.forEach((k) => {
            next[k] = false;
        });
        if (firstTrueKey) next[firstTrueKey] = true;
        return next;
    };

    const savePayment = async () => {
        if (!validatePaymentBeforeSave()) return;

        try {
            setPaymentSaving(true);
            const currentUserId = Number(localStorage.getItem('userId')) || 0;
            const nowIso = new Date().toISOString();

            const normalizedFlagsDraft = normalizeExclusiveFlags(paymentDraft);

            const paymentId = Number(paymentDraft.paymentId) || 0;
            const orderId = Number(paymentDraft.orderId) || 0;
            if (!orderId) {
                toast.error('Order ID is required');
                return;
            }

            const isEditPayment = paymentId > 0;

            const paymentType = paymentDraft.paymentType || 'Card';
            const normalizedPaymentDate = normalizeIsoDate(paymentDraft.paymentDate);
            const paymentDate = normalizedPaymentDate || nowIso;

            // Keep create behavior consistent with CreateOrderPage:
            // - include gatewayName/brandName only when adding a new payment to an existing order
            // - force isDeleted=false on create
            const selectedBrand = (brands || []).find((b) => Number(b.brandId) === Number(paymentDraft.brandId));
            const selectedGateway = (gateways || []).find((g) => Number(g.gatewayId) === Number(paymentDraft.gatewayId));
            const brandName = selectedBrand?.brandName || selectedBrand?.name || paymentDraft.brandName || '';
            const gatewayName = selectedGateway?.gatewayName || selectedGateway?.name || paymentDraft.gatewayName || '';

            // Straight from /SettingValue/SettingValueDropDown?settingKey=SaleTypes.
            const resolvedSaleType =
                String(paymentDraft.saleType || '').trim()
                || String(saleTypes?.[0]?.name || '').trim();

            if (isEditPayment) {
                const updatePaymentPayload = {
                    paymentId,
                    orderId,
                    paymentType,
                    cardType: paymentDraft.cardType || '',
                    cardNumber: paymentDraft.cardNumber || '',
                    cardExpiryDate: paymentDraft.cardExpiryDate || '',
                    cvv: paymentDraft.cvv || '',
                    nameOnCard: paymentDraft.nameOnCard || '',
                    transactionId: paymentDraft.transactionId || '',
                    authCode: paymentDraft.authCode || '',
                    gatewayId: Number(paymentDraft.gatewayId) || 0,
                    gatewayName,
                    brandId: Number(paymentDraft.brandId) || 0,
                    brandName,
                    amount: Number(paymentDraft.amount) || 0,
                    saleType: resolvedSaleType,
                    isVoid: !!normalizedFlagsDraft.isVoid,
                    isChargeBack: !!normalizedFlagsDraft.isChargeBack,
                    isRetrieval: !!normalizedFlagsDraft.isRetrieval,
                    isAlert: !!normalizedFlagsDraft.isAlert,
                    paymentDate,
                    createdAt: paymentDraft.createdAt || nowIso,
                    createdBy: Number(paymentDraft.createdBy) || currentUserId,
                    updatedAt: nowIso,
                    updatedBy: currentUserId,
                    isDeleted: !!paymentDraft.isDeleted,
                    isChequeCleared: !!paymentDraft.isChequeCleared,
                    chequeRoutingNo: toInt32(paymentDraft.chequeRoutingNo),
                    chequeNo: toInt32(paymentDraft.chequeNo),
                    chequeTrackingNo: paymentDraft.chequeTrackingNo || '',
                    zelleId: paymentDraft.zelleId || '',
                };

                await paymentService.updatePayment(updatePaymentPayload);

                // Refresh latest saved payment from API so expanded payment details do not show stale cached data.
                try {
                    const refreshedPayment = await paymentService.getPaymentById(paymentId);
                    if (refreshedPayment) {
                        setPaymentDetailsById((prev) => ({ ...prev, [paymentId]: refreshedPayment }));
                    } else {
                        setPaymentDetailsById((prev) => {
                            if (!prev || !prev[paymentId]) return prev;
                            const next = { ...prev };
                            delete next[paymentId];
                            return next;
                        });
                    }
                } catch (refreshErr) {
                    console.error('Failed to refresh updated payment by id', refreshErr);
                    // Fall back to payload to keep UI aligned until table refetch completes.
                    setPaymentDetailsById((prev) => ({ ...prev, [paymentId]: updatePaymentPayload }));
                }

                toast.success('Payment updated');
                closePaymentModal();
                await Promise.all([fetchOrders(), fetchOrderSummary()]);
                return;
            }

            const createPaymentPayload = {
                paymentId: 0,
                orderId,
                paymentType,
                cardType: paymentDraft.cardType || '',
                cardNumber: paymentDraft.cardNumber || '',
                cardExpiryDate: paymentDraft.cardExpiryDate || '',
                cvv: paymentDraft.cvv || '',
                nameOnCard: paymentDraft.nameOnCard || '',
                transactionId: paymentDraft.transactionId || '',
                authCode: paymentDraft.authCode || '',
                gatewayId: Number(paymentDraft.gatewayId) || 0,
                gatewayName,
                brandId: Number(paymentDraft.brandId) || 0,
                brandName,
                amount: Number(paymentDraft.amount) || 0,
                saleType: resolvedSaleType,
                isVoid: !!normalizedFlagsDraft.isVoid,
                isChargeBack: !!normalizedFlagsDraft.isChargeBack,
                isRetrieval: !!normalizedFlagsDraft.isRetrieval,
                isAlert: !!normalizedFlagsDraft.isAlert,
                paymentDate,
                createdAt: nowIso,
                createdBy: currentUserId,
                updatedAt: nowIso,
                updatedBy: currentUserId,
                isDeleted: false,
                isChequeCleared: !!paymentDraft.isChequeCleared,
                chequeRoutingNo: toInt32(paymentDraft.chequeRoutingNo),
                chequeNo: toInt32(paymentDraft.chequeNo),
                chequeTrackingNo: paymentDraft.chequeTrackingNo || '',
                zelleId: paymentDraft.zelleId || '',
            };

            await paymentService.createPayment(createPaymentPayload);
            toast.success('Payment added');
            closePaymentModal();
            await Promise.all([fetchOrders(), fetchOrderSummary()]);
            return;
        } catch (err) {
            console.error('Failed to save payment', err);
            toast.error(getApiErrorMessage(err, 'Failed to save payment'));
        } finally {
            setPaymentSaving(false);
        }
    };

    const saveRefund = async () => {
        if (orderCodesLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canRefundOrderPayment) {
            toast.error("You don't have permission to refund order payments.");
            return;
        }

        const id = Number(refundDraft.paymentId) || 0;
        if (!id) return;

        try {
            setRefundSaving(true);
            const currentUserId = Number(localStorage.getItem('userId')) || 0;
            const nowIso = new Date().toISOString();

            const basePayment =
                (refundOriginalPayment?.paymentId === id ? refundOriginalPayment : null) ||
                paymentDetailsById?.[id] ||
                (data || []).flatMap((o) => (Array.isArray(o?.payments) ? o.payments : [])).find((p) => Number(p?.paymentId) === id) ||
                null;
            if (!basePayment) {
                toast.error('Payment not found');
                return;
            }

            const parentOrderByOrderId = (data || []).find((o) => Number(o?.orderId) === Number(basePayment?.orderId));
            const parentOrderByPaymentId = (data || []).find((o) =>
                Array.isArray(o?.payments) && o.payments.some((p) => Number(p?.paymentId) === id),
            );
            const parentOrder = parentOrderByOrderId || parentOrderByPaymentId || null;

            const resolvedOrderId =
                Number(refundDraft?.orderId) ||
                Number(basePayment?.orderId) ||
                Number(refundOriginalPayment?.orderId) ||
                Number(parentOrder?.orderId) ||
                0;

            if (!resolvedOrderId) {
                toast.error('Order ID is missing for refund');
                return;
            }

            const brandIdFromPayment = Number(basePayment?.brandId) || Number(basePayment?.BrandId) || 0;
            const gatewayIdFromPayment = Number(basePayment?.gatewayId) || Number(basePayment?.GatewayId) || 0;
            const brandIdFromDraft = Number(refundDraft?.brandId) || 0;
            const gatewayIdFromDraft = Number(refundDraft?.gatewayId) || 0;
            const brandIdFromOrder = Number(parentOrder?.brandId) || 0;
            const gatewayIdFromOrder = Number(parentOrder?.gatewayId) || 0;

            const brandNameHint =
                basePayment?.brandName ||
                basePayment?.BrandName ||
                refundOriginalPayment?.brandName ||
                parentOrder?.brandName ||
                '';
            const gatewayNameHint =
                basePayment?.gatewayName ||
                basePayment?.GatewayName ||
                refundOriginalPayment?.gatewayName ||
                parentOrder?.gatewayName ||
                '';

            const selectedBrandById = (brands || []).find(
                (b) => Number(b.brandId) === (brandIdFromPayment || brandIdFromDraft),
            );
            const selectedGatewayById = (gateways || []).find(
                (g) => Number(g.gatewayId) === (gatewayIdFromPayment || gatewayIdFromDraft),
            );

            const selectedBrandByName =
                !selectedBrandById && brandNameHint
                    ? (brands || []).find(
                        (b) => String(b.brandName || b.name || '').trim().toLowerCase() === String(brandNameHint).trim().toLowerCase(),
                    )
                    : null;

            const selectedGatewayByName =
                !selectedGatewayById && gatewayNameHint
                    ? (gateways || []).find(
                        (g) => String(g.gatewayName || g.name || '').trim().toLowerCase() === String(gatewayNameHint).trim().toLowerCase(),
                    )
                    : null;

            let resolvedBrandId =
                brandIdFromPayment ||
                brandIdFromDraft ||
                brandIdFromOrder ||
                Number(selectedBrandByName?.brandId) ||
                0;

            let resolvedGatewayId =
                gatewayIdFromPayment ||
                gatewayIdFromDraft ||
                gatewayIdFromOrder ||
                Number(selectedGatewayByName?.gatewayId) ||
                0;

            let brandName =
                selectedBrandById?.brandName ||
                selectedBrandById?.name ||
                selectedBrandByName?.brandName ||
                selectedBrandByName?.name ||
                brandNameHint ||
                '';

            let gatewayName =
                selectedGatewayById?.gatewayName ||
                selectedGatewayById?.name ||
                selectedGatewayByName?.gatewayName ||
                selectedGatewayByName?.name ||
                gatewayNameHint ||
                '';

            if (!resolvedBrandId || !resolvedGatewayId) {
                try {
                    const fullPayment = await paymentService.getPaymentById(id);
                    if (fullPayment) {
                        resolvedBrandId = resolvedBrandId || Number(fullPayment?.brandId) || Number(fullPayment?.BrandId) || 0;
                        resolvedGatewayId = resolvedGatewayId || Number(fullPayment?.gatewayId) || Number(fullPayment?.GatewayId) || 0;
                        brandName =
                            brandName ||
                            fullPayment?.brandName ||
                            fullPayment?.BrandName ||
                            '';
                        gatewayName =
                            gatewayName ||
                            fullPayment?.gatewayName ||
                            fullPayment?.GatewayName ||
                            '';
                    }
                } catch (resolveErr) {
                    console.error('Failed to resolve brand/gateway for refund:', resolveErr);
                }
            }

            let canonicalPayment = null;
            try {
                canonicalPayment = await paymentService.getPaymentById(id);
            } catch (fetchErr) {
                console.error('Failed to fetch canonical payment for refund payload:', fetchErr);
            }
            const schemaSource = {
                ...(canonicalPayment || {}),
                ...(basePayment || {}),
            };

            const resolvedRefundSaleType = String(
                (saleTypes || []).find((s) => String(s?.name || '').trim().toLowerCase().includes('refund'))?.name || '',
            ).trim();

            const sourceSaleType = String(
                basePayment?.saleType ??
                basePayment?.SaleType ??
                refundOriginalPayment?.saleType ??
                refundOriginalPayment?.SaleType ??
                '',
            )
                .trim()
                .toLowerCase();

            const isEditingExistingRefund = sourceSaleType.includes('refund');

            const buildRefundPayload = () => {
                const pick = (camel, pascal, fallback = '') => {
                    const v = schemaSource?.[camel] ?? schemaSource?.[pascal];
                    return v === undefined || v === null ? fallback : v;
                };
                const pickRaw = (camel, pascal, fallback = null) => {
                    const v = schemaSource?.[camel] ?? schemaSource?.[pascal];
                    return v === undefined ? fallback : v;
                };

                const paymentIdFromSource = Number(pick('paymentId', 'PaymentId', 0)) || Number(refundDraft.paymentId) || id;
                const refundPaymentIdFromSource = Number(pick('refundPaymentId', 'RefundPaymentId', 0)) || paymentIdFromSource || id;
                const orderIdFromSource = Number(pick('orderId', 'OrderId', 0)) || resolvedOrderId;
                const paymentTypeFromSource = String(pick('paymentType', 'PaymentType', 'Card') || 'Card');

                const cardTypeFromSource = String(pick('cardType', 'CardType', ''));
                const cardNumberFromSource = String(pick('cardNumber', 'CardNumber', ''));
                const cardExpiryDateFromSource = String(pick('cardExpiryDate', 'CardExpiryDate', ''));
                const cvvFromSource = String(pick('cvv', 'CVV', ''));
                const nameOnCardFromSource = String(pick('nameOnCard', 'NameOnCard', ''));

                const resolvedTransactionId = String(
                    refundDraft?.transactionId ??
                    refundDraft?.TransactionId ??
                    schemaSource?.transactionId ??
                    schemaSource?.TransactionId ??
                    '',
                );
                const resolvedAuthCode = String(
                    refundDraft?.authCode ??
                    refundDraft?.AuthCode ??
                    schemaSource?.authCode ??
                    schemaSource?.AuthCode ??
                    '',
                );

                const gatewayIdFromSource = resolvedGatewayId || Number(pick('gatewayId', 'GatewayId', 0)) || 0;
                const gatewayNameFromSource = String(
                    gatewayName ||
                    pick('gatewayName', 'GatewayName', ''),
                );
                const brandIdFromSource = resolvedBrandId || Number(pick('brandId', 'BrandId', 0)) || 0;
                const brandNameFromSource = String(
                    brandName ||
                    pick('brandName', 'BrandName', ''),
                );

                const amountFromDraft = Number(refundDraft.amount);
                const amountFromSource = Number(pick('amount', 'Amount', 0));
                const resolvedAmount = Number.isFinite(amountFromDraft) ? amountFromDraft : (Number.isFinite(amountFromSource) ? amountFromSource : 0);

                const paymentDateRaw = pickRaw('paymentDate', 'PaymentDate', null);
                const createdAtRaw = pickRaw('createdAt', 'CreatedAt', null);
                const paymentDateFromSource = paymentDateRaw ?? null;
                const createdAtFromSource = createdAtRaw ?? null;

                const refundDateInput = dateForInput(refundDraft.paymentDate);
                const sourceDateTime = isEditingExistingRefund
                    ? String(paymentDateFromSource || createdAtFromSource || '')
                    : '';
                const sourceTimeMatch = sourceDateTime.match(/T(\d{2}:\d{2}:\d{2})/);
                const nowLocal = new Date();
                const pad2 = (n) => String(n).padStart(2, '0');
                const fallbackTimePart = `${pad2(nowLocal.getHours())}:${pad2(nowLocal.getMinutes())}:${pad2(nowLocal.getSeconds())}`;
                const resolvedTimePart = sourceTimeMatch?.[1] || fallbackTimePart;
                const normalizedRefundPaymentDate = refundDateInput ? `${refundDateInput}T${resolvedTimePart}` : '';

                const resolvedRefundPaymentDate = normalizedRefundPaymentDate || (isEditingExistingRefund ? (paymentDateFromSource || createdAtFromSource || '') : '');
                const createdByFromSource = Number(pick('createdBy', 'CreatedBy', 0)) || 0;
                const isDeletedFromSource = !!pick('isDeleted', 'IsDeleted', false);
                const isVoidFromSource = !!pick('isVoid', 'IsVoid', false);

                const chequeRoutingNoFromSource = Number(pick('chequeRoutingNo', 'ChequeRoutingNo', 0)) || 0;
                const chequeNoFromSource = Number(pick('chequeNo', 'ChequeNo', 0)) || 0;
                const chequeTrackingNoFromSource = String(pick('chequeTrackingNo', 'ChequeTrackingNo', ''));
                const zelleIdFromSource = String(
                    schemaSource?.zelleId ??
                    schemaSource?.ZelleId ??
                    schemaSource?.zelleID ??
                    schemaSource?.ZelleID ??
                    '',
                );

                return {
                    paymentId: paymentIdFromSource,
                    refundPaymentId: refundPaymentIdFromSource,
                    orderId: orderIdFromSource,
                    paymentType: paymentTypeFromSource,
                    cardType: cardTypeFromSource,
                    cardNumber: cardNumberFromSource,
                    cardExpiryDate: cardExpiryDateFromSource,
                    cvv: cvvFromSource,
                    nameOnCard: nameOnCardFromSource,
                    transactionId: resolvedTransactionId,
                    authCode: resolvedAuthCode,
                    gatewayId: gatewayIdFromSource,
                    gatewayName: gatewayNameFromSource,
                    brandId: brandIdFromSource,
                    brandName: brandNameFromSource,
                    amount: resolvedAmount,
                    saleType: resolvedRefundSaleType,
                    isVoid: isVoidFromSource,
                    isChargeBack: !!refundDraft.isChargeBack,
                    isRetrieval: !!refundDraft.isRetrieval,
                    isAlert: !!refundDraft.isAlert,
                    paymentDate: resolvedRefundPaymentDate,
                    createdAt: createdAtFromSource || nowIso,
                    createdBy: createdByFromSource || currentUserId,
                    updatedAt: nowIso,
                    updatedBy: currentUserId,
                    isDeleted: isDeletedFromSource,
                    isChequeCleared: !!(schemaSource?.isChequeCleared ?? schemaSource?.IsChequeCleared),
                    chequeRoutingNo: chequeRoutingNoFromSource,
                    chequeNo: chequeNoFromSource,
                    chequeTrackingNo: chequeTrackingNoFromSource,
                    zelleId: zelleIdFromSource,
                };
            };

            const upsertPaymentIntoOrder = (orders, orderId, paymentRow) => {
                if (!Array.isArray(orders) || !orderId || !paymentRow) return orders;
                const pid = Number(paymentRow.paymentId) || 0;
                return orders.map((o) => {
                    if (Number(o?.orderId) !== Number(orderId)) return o;
                    const currentPayments = Array.isArray(o.payments) ? o.payments : [];
                    if (!pid) return { ...o, payments: currentPayments };

                    const exists = currentPayments.some((p) => Number(p?.paymentId) === pid);
                    const nextPayments = exists
                        ? currentPayments.map((p) => (Number(p?.paymentId) === pid ? { ...p, ...paymentRow } : p))
                        : [{ ...paymentRow }, ...currentPayments];

                    return { ...o, payments: nextPayments };
                });
            };

            const refundPayload = buildRefundPayload();
            if (!String(refundPayload?.paymentDate || '').trim()) {
                toast.error('Refund date is required');
                return;
            }

            if (isEditingExistingRefund) {
                const updated = await paymentService.updatePayment(refundPayload);
                const updatedRow = updated || refundPayload;
                const updatedId = Number(updatedRow.paymentId) || Number(basePayment.paymentId) || id;
                if (updatedId > 0) {
                    setPaymentDetailsById((prev) => ({ ...prev, [updatedId]: updatedRow }));
                }
                setData((prev) => upsertPaymentIntoOrder(prev, updatedRow.orderId || resolvedOrderId, updatedRow));
            } else {
                // Creating a refund from a non-refund payment should create a new row (POST).
                const createRefundPayload = {
                    ...refundPayload,
                    paymentId: 0,
                    refundPaymentId: Number(refundPayload.refundPaymentId) || id,
                    createdAt: nowIso,
                    createdBy: currentUserId,
                    updatedAt: nowIso,
                    updatedBy: currentUserId,
                };

                const created = await paymentService.createPayment(createRefundPayload);
                const createdRow = created || createRefundPayload;
                const createdId = Number(createdRow.paymentId) || 0;

                if (createdId > 0) {
                    setPaymentDetailsById((prev) => ({ ...prev, [createdId]: createdRow }));
                }
                setData((prev) => upsertPaymentIntoOrder(prev, createdRow.orderId || resolvedOrderId, createdRow));
            }
            toast.success('Refund saved');
            closeRefundModal();
            await Promise.all([fetchOrders(), fetchOrderSummary()]);
        } catch (err) {
            console.error('Failed to save refund', err);
            toast.error(getApiErrorMessage(err, 'Failed to save refund'));
        } finally {
            setRefundSaving(false);
        }
    };

    const voidPayment = async (paymentId) => {
        if (orderCodesLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canVoidOrderPayment) {
            toast.error("You don't have permission to void order payments.");
            return;
        }

        const id = Number(paymentId) || 0;
        if (!id) return;

        try {
            setPaymentSaving(true);
            const currentUserId = Number(localStorage.getItem('userId')) || 0;
            const nowIso = new Date().toISOString();

            const fetched = await paymentService.getPaymentById(id);
            if (!fetched) {
                toast.error('Payment not found');
                return;
            }

            const payload = {
                ...fetched,
                paymentId: Number(fetched.paymentId) || id,
                orderId: Number(fetched.orderId) || 0,
                isVoid: true,
                isChargeBack: false,
                isRetrieval: false,
                isAlert: false,
                updatedAt: nowIso,
                updatedBy: currentUserId,
            };

            await paymentService.updatePayment(payload);
            // Keep the cached copy in step - it is only refetched when that
            // payment is opened, so without this the row's action buttons keep
            // reading a pre-void `isVoid: false`.
            setPaymentDetailsById((prev) => ({
                ...prev,
                [Number(payload.paymentId) || id]: payload,
            }));
            toast.success('Payment voided');
            await Promise.all([fetchOrders(), fetchOrderSummary()]);
        } catch (err) {
            console.error('Failed to void payment', err);
            toast.error(getApiErrorMessage(err, 'Failed to void payment'));
        } finally {
            setPaymentSaving(false);
        }
    };

    // A voided payment is settled: it can no longer be edited, deleted or
    // refunded.
    //
    // Either source may be the stale one - the row is refreshed by fetchOrders
    // while the cached details are only refreshed when that payment is opened -
    // so a void on either counts. Voiding is one-way, so this can't wrongly
    // latch a payment as voided.
    const isPaymentVoided = useCallback(
        (payment) => {
            const paymentId = Number(payment?.paymentId) || 0;
            const cachedDetails = (paymentId && paymentDetailsById?.[paymentId]) || null;

            return !!(payment?.isVoid ?? payment?.IsVoid)
                || !!(cachedDetails?.isVoid ?? cachedDetails?.IsVoid);
        },
        [paymentDetailsById],
    );

    const openVoidConfirm = (payment, order) => {
        if (orderCodesLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canVoidOrderPayment) {
            toast.error("You don't have permission to void order payments.");
            return;
        }

        const paymentId = Number(payment?.paymentId) || 0;
        if (!paymentId || payment?.isVoid) return;
        setVoidContext({
            paymentId,
            orderId: Number(order?.orderId) || 0,
        });
        setVoidConfirmOpen(true);
    };

    const closeVoidConfirm = () => {
        if (paymentSaving) return;
        setVoidConfirmOpen(false);
        setVoidContext(null);
    };

    const openDeleteOrderConfirm = (order) => {
        if (permissionsLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canDelete) {
            toast.error("You don't have permission to delete orders.");
            return;
        }

        const orderId = Number(order?.orderId) || 0;
        if (!orderId) return;

        setDeleteOrderContext({
            orderId,
            orderNo: order?.orderNo || order?.orderNumber || order?.invoiceNo || null,
        });
        setDeleteOrderConfirmOpen(true);
    };

    const closeDeleteOrderConfirm = () => {
        if (deleteOrderSaving) return;
        setDeleteOrderConfirmOpen(false);
        setDeleteOrderContext(null);
    };

    const confirmDeleteOrder = async () => {
        if (permissionsLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canDelete) {
            toast.error("You don't have permission to delete orders.");
            return;
        }

        const orderId = Number(deleteOrderContext?.orderId) || 0;
        if (!orderId) return;

        try {
            setDeleteOrderSaving(true);
            await orderService.deleteOrder(orderId);
            toast.success('Order deleted');
            setData((prev) => (Array.isArray(prev) ? prev.filter((order) => Number(order?.orderId) !== orderId) : prev));
            setTotal((prev) => Math.max(0, Number(prev) - 1));
            await Promise.all([fetchOrders(), fetchOrderSummary()]);
            setDeleteOrderConfirmOpen(false);
            setDeleteOrderContext(null);
        } catch (err) {
            console.error('Failed to delete order', err);
            toast.error(getApiErrorMessage(err, 'Failed to delete order'));
        } finally {
            setDeleteOrderSaving(false);
        }
    };

    const confirmVoidPayment = async () => {
        const paymentId = Number(voidContext?.paymentId) || 0;
        if (!paymentId) return;
        await voidPayment(paymentId);
        setVoidConfirmOpen(false);
        setVoidContext(null);
    };

    const openDeletePaymentConfirm = (payment, order) => {
        if (orderCodesLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canDeleteOrderPayment) {
            toast.error("You don't have permission to delete order payments.");
            return;
        }

        const paymentId = Number(payment?.paymentId) || 0;
        if (!paymentId) return;
        setDeletePaymentContext({
            paymentId,
            orderId: Number(order?.orderId) || 0,
        });
        setDeletePaymentConfirmOpen(true);
    };

    const closeDeletePaymentConfirm = () => {
        if (deletePaymentSaving) return;
        setDeletePaymentConfirmOpen(false);
        setDeletePaymentContext(null);
    };

    const confirmDeletePayment = async () => {
        if (orderCodesLoading) {
            toast.error('Permissions are still loading, please try again.');
            return;
        }
        if (!canDeleteOrderPayment) {
            toast.error("You don't have permission to delete order payments.");
            return;
        }

        const paymentId = Number(deletePaymentContext?.paymentId) || 0;
        if (!paymentId) return;
        try {
            setDeletePaymentSaving(true);
            await paymentService.deletePayment(paymentId);
            toast.success('Payment deleted');
            setPaymentDetailsById((prev) => {
                if (!prev || !prev[paymentId]) return prev;
                const next = { ...prev };
                delete next[paymentId];
                return next;
            });
            setData((prev) => {
                if (!Array.isArray(prev)) return prev;
                return prev.map((o) => {
                    const payments = Array.isArray(o?.payments) ? o.payments : [];
                    if (!payments.length) return o;
                    const nextPayments = payments.filter((p) => Number(p?.paymentId) !== paymentId);
                    if (nextPayments.length === payments.length) return o;
                    return { ...o, payments: nextPayments };
                });
            });
            await Promise.all([fetchOrders(), fetchOrderSummary()]);
            setDeletePaymentConfirmOpen(false);
            setDeletePaymentContext(null);
        } catch (err) {
            console.error('Failed to delete payment', err);
            toast.error(getApiErrorMessage(err, 'Failed to delete payment'));
        } finally {
            setDeletePaymentSaving(false);
        }
    };

    const handleSortingChange = (newSorting) => {
        setSorting(newSorting);
        if (newSorting && newSorting.length > 0) {
            const { id, desc } = newSorting[0];
            setFilters((prev) => ({
                ...prev,
                SortProperty: id,
                IsDescending: !!desc,
                PageNumber: 1,
            }));
        }
    };

    const handlePageChange = (page) => {
        setFilters((prev) => ({ ...prev, PageNumber: page }));
    };

    const handlePageSizeChange = (event) => {
        const pageSize = Number(event.target.value) || 10;
        setFilters((prev) => ({ ...prev, PageSize: pageSize, PageNumber: 1 }));
    };

    const handleSearchFieldChange = (value) => {
        const normalized = String(value || '').trim();
        setLookupOptionSearch('');
        setSearchInput('');
        setFilters((prev) => ({
            ...prev,
            SearchField: normalized.toLowerCase() === 'all orders' ? null : (normalized || null),
            Text: '',
            PageNumber: 1,
        }));
    };

    const handleQuickDateChange = (value) => {
        const selected = String(value || DEFAULT_QUICK_DATE_FILTER).trim() || DEFAULT_QUICK_DATE_FILTER;
        const payload = getQuickDatePayload(selected);
        setQuickDateFilter(selected);
        setFilters((prev) => ({
            ...prev,
            ...payload,
            PageNumber: 1,
        }));
    };

    const handleResetFilters = () => {
        setQuickDateFilter(DEFAULT_QUICK_DATE_FILTER);
        setSearchInput('');
        setFilters({
            SearchField: null,
            Text: '',
            Date: DEFAULT_QUICK_DATE_PAYLOAD.Date,
            FromDate: DEFAULT_QUICK_DATE_PAYLOAD.FromDate,
            ToDate: DEFAULT_QUICK_DATE_PAYLOAD.ToDate,
            PageNumber: 1,
            PageSize: filters.PageSize,
            SortProperty: 'orderDate',
            IsDescending: true,
        });
        setSorting([{ id: 'orderDate', desc: true }]);
    };

    const handleRefresh = useCallback(
        () => Promise.all([fetchOrders(), fetchOrderSummary()]),
        [fetchOrders, fetchOrderSummary],
    );

    const searchPlaceholder = useMemo(() => {
        const field = String(filters.SearchField || '').trim().toLowerCase();
        if (!field) return 'Search all orders';
        if (field === 'brand') return 'Search by brand';
        if (field === 'salesperson' || field === 'sales person') return 'Search by sales person';
        if (field === 'cardnumber') return 'Search by card last 4 digit';
        return 'Search by customer';
    }, [filters.SearchField]);

    const searchFieldSelectValue = filters.SearchField == null
        ? 'All Orders'
        : String(filters.SearchField || 'Customer');

    const normalizedSearchField = useMemo(
        () => String(filters.SearchField || '').trim().toLowerCase(),
        [filters.SearchField],
    );
    const isBrandSearch = normalizedSearchField === 'brand';
    const isSalesPersonSearch = normalizedSearchField === 'salesperson' || normalizedSearchField === 'sales person';

    const lookupSearchOptions = useMemo(() => {
        if (isBrandSearch) {
            return (brandSearchOptions || []).map((b) => {
                const label = String(b?.brandName || b?.name || '').trim();
                const id = Number(b?.brandId) || 0;
                return { value: id ? `brand:${id}` : `brand:${label}`, label, queryText: label };
            }).filter((o) => o.value);
        }

        if (isSalesPersonSearch) {
            return (salesPersonSearchOptions || []).map((u) => {
                const label = String(
                    u?.fullName || `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.username || u?.userName || u?.email || '',
                ).trim();
                const id = Number(u?.userId) || 0;
                return {
                    value: id ? `user:${id}` : `user:${label}`,
                    label,
                    queryText: label,
                    // Badged on the option row. Brand options carry neither, so
                    // the badges render only on this branch.
                    roleName: getUserRoleName(u),
                    locationName: getUserLocationName(u),
                };
            }).filter((o) => o.value);
        }

        return [];
    }, [isBrandSearch, isSalesPersonSearch, brandSearchOptions, salesPersonSearchOptions]);

    const lookupSearchValue = useMemo(() => {
        if (!filters.Text) return SEARCH_ALL_OPTION_VALUE;
        const matched = lookupSearchOptions.find((option) => option.queryText === filters.Text);
        return matched?.value || SEARCH_ALL_OPTION_VALUE;
    }, [filters.Text, lookupSearchOptions]);

    const filteredLookupSearchOptions = useMemo(() => {
        const term = String(lookupOptionSearch || '').trim().toLowerCase();
        if (!term) return lookupSearchOptions;
        return lookupSearchOptions.filter(
            (option) => String(option?.label || '').toLowerCase().includes(term)
                || getUserBadgeSearchText(option).includes(term),
        );
    }, [lookupSearchOptions, lookupOptionSearch]);

    useEffect(() => {
        let cancelled = false;

        const loadLookupOptions = async () => {
            if (isBrandSearch) {
                if ((brandSearchOptions || []).length > 0) return;
                setSearchOptionsLoading(true);
                try {
                    const result = await brandService.getBrands({
                        PageNumber: 1,
                        PageSize: 500,
                        SortProperty: 'brandName',
                        IsDescending: false,
                    });
                    if (!cancelled) setBrandSearchOptions(result?.data || []);
                } catch (err) {
                    console.error('Failed to load brand search options', err);
                    if (!cancelled) {
                        setBrandSearchOptions([]);
                        toast.error(getApiErrorMessage(err, 'Failed to load brands'));
                    }
                } finally {
                    if (!cancelled) setSearchOptionsLoading(false);
                }
                return;
            }

            if (isSalesPersonSearch) {
                if ((salesPersonSearchOptions || []).length > 0) return;
                setSearchOptionsLoading(true);
                try {
                    // Active Sales Agents and Sales Managers only.
                    const salesUsers = await fetchSalesPersonList({ pageSize: 1000, sortProperty: 'fullName' });
                    if (!cancelled) setSalesPersonSearchOptions(salesUsers);
                } catch (err) {
                    console.error('Failed to load sales person search options', err);
                    if (!cancelled) {
                        setSalesPersonSearchOptions([]);
                        toast.error(getApiErrorMessage(err, 'Failed to load users'));
                    }
                } finally {
                    if (!cancelled) setSearchOptionsLoading(false);
                }
                return;
            }

            setSearchOptionsLoading(false);
        };

        loadLookupOptions();

        return () => {
            cancelled = true;
        };
    }, [isBrandSearch, isSalesPersonSearch, brandSearchOptions, salesPersonSearchOptions]);

    const columns = useMemo(
        () => [
            {
                id: 'orderId',
                header: 'Order ID',
                cell: ({ row }) => {
                    const order = row.original;
                    const hasPayments = Array.isArray(order.payments) && order.payments.length > 0;
                    const isExpanded = expandedOrderId === order.orderId;

                    const canTogglePayments = hasPayments && canViewOrderPayments;

                    return (
                        <div className="flex items-center gap-2">
                            {canTogglePayments ? (
                                <button
                                    type="button"
                                    onClick={() => setExpandedOrderId((prev) => (prev === order.orderId ? null : order.orderId))}
                                    className="p-1 rounded hover:bg-gray-100"
                                    aria-label={isExpanded ? 'Collapse payments' : 'Expand payments'}
                                >
                                    {isExpanded ? <ChevronDown size={16} className="text-gray-600" /> : <ChevronRight size={16} className="text-gray-600" />}
                                </button>
                            ) : (
                                <span className="w-4" />
                            )}
                            <span className="font-semibold">{order.orderId ?? '-'}</span>
                        </div>
                    );
                },
                enableSorting: false,
                meta: { headerClassName: 'text-center w-[110px]', cellClassName: 'text-center' },
            },
            {
                id: 'customerName',
                header: 'Customer Name',
                cell: ({ row }) => <span className="text-sm font-medium text-gray-900">{row.original.customerName || '-'}</span>,
                enableSorting: false,
            },
            {
                id: 'brand',
                header: 'Brand',
                cell: ({ row }) => {
                    const order = row.original;
                    return (
                        <div className="flex flex-col text-sm text-gray-800">
                            <div className="flex items-center gap-2 font-medium text-gray-900">
                                <CorporateFareIcon sx={{ fontSize: '14px' }} />
                                <span className="truncate">{order.brandName || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <LocalGroceryStoreIcon sx={{ fontSize: '14px' }} />
                                <span className="truncate">{order.gatewayName || '-'}</span>
                            </div>
                        </div>
                    );
                },
                enableSorting: false,
                meta: { headerClassName: 'text-start', cellClassName: 'text-center' },
            },
            {
                id: 'salesPersonName',
                header: 'Sales Person',
                cell: ({ row }) => {
                    const order = row.original || {};
                    const shareRows = extractShareRowsFromOrder(order);
                    const salesPersonName = String(order?.salesPersonName || order?.salespersonName || '').trim() || '-';

                    const normalizedShareRows = shareRows
                        .map((share, idx) => {
                            const shareWithId = Number(
                                share?.shareWithId ??
                                share?.sharewithId ??
                                share?.shareToId ??
                                share?.salesPersonId ??
                                share?.userId,
                            ) || 0;

                            const rawName = String(
                                share?.shareWithName ??
                                share?.sharewithName ??
                                share?.shareToName ??
                                share?.salesPersonName ??
                                share?.userName ??
                                '',
                            ).trim();

                            const amount = Number(share?.amount ?? share?.shareAmount ?? 0) || 0;

                            return {
                                key: String(share?.id ?? `${shareWithId || 'share'}-${idx}`),
                                shareWithId,
                                name: rawName || (shareWithId > 0 ? getUserFullName(shareWithId) : ''),
                                amount,
                            };
                        })
                        .filter((share) => share.name || share.amount > 0);

                    const aggregatedShareRows = (() => {
                        const grouped = new Map();

                        normalizedShareRows.forEach((share, idx) => {
                            const normalizedName = String(share?.name || '').trim().toLowerCase();
                            const groupKey = Number(share?.shareWithId) > 0
                                ? `id:${Number(share.shareWithId)}`
                                : `name:${normalizedName || `share-${idx}`}`;

                            if (!grouped.has(groupKey)) {
                                grouped.set(groupKey, {
                                    key: String(share?.key || groupKey),
                                    name: String(share?.name || '').trim() || `Share ${idx + 1}`,
                                    amount: Number(share?.amount) || 0,
                                });
                                return;
                            }

                            const existing = grouped.get(groupKey);
                            grouped.set(groupKey, {
                                ...existing,
                                amount: (Number(existing?.amount) || 0) + (Number(share?.amount) || 0),
                            });
                        });

                        return Array.from(grouped.values());
                    })();

                    return (
                        <button
                            type="button"
                            className="w-full text-start rounded px-1 py-0.5 hover:bg-slate-50"
                            onClick={() => handleOpenSharePaymentFromOrder(order)}
                            title="Open share sale details"
                        >
                            {aggregatedShareRows.length > 0 ? (
                                <div className="mt-1 space-y-0.5">
                                    {aggregatedShareRows.map((share, idx) => {
                                        const shareWithName = share.name || `Share ${idx + 1}`;
                                        const amount = share.amount;
                                        return (
                                            <div key={`${share.key}-${idx}`} className="text-xs text-gray-600">
                                                {idx === 0 ? (
                                                    <span className="font-medium text-sm text-gray-900">{shareWithName}: {currency(amount)}</span>
                                                ) : (
                                                    <>{shareWithName}: {currency(amount)}</>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <span className="font-medium text-sm text-gray-900">{salesPersonName}</span>
                            )}
                        </button>
                    );
                },
                enableSorting: false,
                meta: { headerClassName: 'text-start ', cellClassName: 'text-start' },
            },
            {
                id: 'paymentSummary',
                header: 'Payment',
                cell: ({ row }) => {
                    const order = row.original;
                    const total = order.totalAmount;
                    const paid = order.paidAmount;
                    const refund = order.refundAmount;
                    const hasRefund = typeof refund === 'number' ? refund > 0 : !!refund;
                    const orderStatus = (order?.orderStatus ?? '').toString().trim();

                    return (
                        <div className="flex items-center gap-3 overflow-hidden w-full">
                            <div className="flex flex-col gap-0.5 w-full">
                                <span className="text-sm font-medium text-gray-900 mb-px gap-1 flex items-center whitespace-nowrap">
                                    <ReceiptIcon sx={{ fontSize: '16px' }} />
                                    <span className="whitespace-nowrap">{currency(total) || '0'}</span>
                                </span>
                                <div className="flex justify-between gap-3">
                                    <span className="text-xs text-gray-700 font-normal gap-1 flex items-center whitespace-nowrap">
                                        <PaymentsIcon sx={{ fontSize: '14px' }} />
                                        <span className="whitespace-nowrap">{currency(paid) || '0'}</span>
                                    </span>
                                </div>
                                {orderStatus ? (
                                    <span className="text-xs text-gray-700 font-normal gap-1 flex items-center overflow-hidden mt-0.5">
                                        <Package size={14} className="text-slate-500 flex-shrink-0" aria-hidden="true" />
                                        <span className="truncate">{orderStatus}</span>
                                    </span>
                                ) : null}
                                {hasRefund && (
                                    <span className="text-xs text-gray-700 font-normal gap-1 flex items-center whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                        <span className="whitespace-nowrap">Refund: {currency(refund) || '0'}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                },
                enableSorting: false,
                meta: { cellClassName: 'text-gray-800 font-normal w-[240px]', headerClassName: 'w-[170px]' },
            },
            {
                id: 'orderDates',
                header: 'Date',
                cell: ({ row }) => {
                    const order = row.original;
                    const shareRows = extractShareRowsFromOrder(order);

                    const latestShareDate = pickLatestShareDate(shareRows);
                    const paymentDate = order.paymentDate || latestShareDate;
                    const saleDate = order.orderDate || order.createdDate || order.createdAt;
                    const hasAnyDate = paymentDate || saleDate;

                    if (!hasAnyDate) {
                        return <span className="text-xs text-gray-500">-</span>;
                    }

                    return (
                        <div className="rounded-lg border border-gray-200 p-3 shadow-sm bg-white w-full">
                            <div className="flex flex-col">
                                {paymentDate && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/15 flex-shrink-0">
                                            <CreditCard size={16} className="text-green-600" />
                                        </div>
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-xs font-semibold text-green-600">Payment</span>
                                            <span className="text-xs text-slate-700 whitespace-nowrap">{formatDateTime(paymentDate)}</span>
                                        </div>
                                    </div>
                                )}

                                {paymentDate && saleDate && <div className="my-2 border-t border-gray-200" />}

                                {saleDate && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/15 flex-shrink-0">
                                            <ShoppingBag size={16} className="text-amber-500" />
                                        </div>
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-xs font-semibold text-amber-500">Sale</span>
                                            <span className="text-xs text-slate-700 whitespace-nowrap">{formatDateTime(saleDate)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                },
                enableSorting: false,
                meta: { cellClassName: 'pl-0 pr-0 w-[230px]', headerClassName: 'w-[230px] text-center' },
            },
            {
                id: 'actions',
                header: 'Actions',
                cell: ({ row }) => {
                    const order = row.original;

                    return (
                        <div className="flex items-center gap-2 justify-center">
                            {canAddOrderPayment && (
                                <ActionIconButton
                                    label="Add payment"
                                    className="w-8 h-8 text-emerald-700 hover:bg-gray-100"
                                    onClick={() => openAddPaymentModal(order)}
                                >
                                    <Plus size={16} />
                                </ActionIconButton>
                            )}
                            {canDelete && (
                                <ActionIconButton
                                    label="Delete order"
                                    className="w-8 h-8 text-red-600 hover:bg-gray-100"
                                    variant="delete"
                                    onClick={() => openDeleteOrderConfirm(order)}
                                >
                                    <Trash2 size={16} />
                                </ActionIconButton>
                            )}
                        </div>
                    );
                },
                enableSorting: false,
                meta: { headerClassName: 'text-center ', cellClassName: 'text-start' },
            },
        ],
        [expandedOrderId, canViewOrderPayments, canAddOrderPayment, getUserFullName, handleOpenSharePaymentFromOrder]
    );

    const columnCount = columns.length;

    const getTemplateRowsFromPayment = useCallback(
        (payment) => {
            const paymentId = Number(payment?.paymentId) || 0;
            const details = (paymentId && paymentDetailsById?.[paymentId]) || payment || {};
            const rows = details?.bMailTempletes || details?.bMailTemplates || payment?.bMailTempletes || payment?.bMailTemplates || [];
            return Array.isArray(rows) ? rows : [];
        },
        [paymentDetailsById]
    );

    const isTemplateLoading = useCallback(
        (payment) => {
            const paymentId = Number(payment?.paymentId) || 0;
            if (!paymentId) return false;
            return !!templateLoadingByPaymentId[paymentId];
        },
        [templateLoadingByPaymentId]
    );

    const handleTemplateMenuOpen = useCallback(
        async (payment) => {
            const paymentId = Number(payment?.paymentId) || 0;
            if (!paymentId) return;

            const existingRows = getTemplateRowsFromPayment(payment);
            if (existingRows.length > 0 || templateLoadingByPaymentId[paymentId]) return;

            setTemplateLoadingByPaymentId((prev) => ({ ...prev, [paymentId]: true }));
            try {
                const fetched = await paymentService.getPaymentById(paymentId);
                if (fetched) {
                    setPaymentDetailsById((prev) => ({ ...prev, [paymentId]: fetched }));
                }
            } catch (error) {
                console.error('Failed to fetch payment templates:', error);
            } finally {
                setTemplateLoadingByPaymentId((prev) => ({ ...prev, [paymentId]: false }));
            }
        },
        [getTemplateRowsFromPayment, templateLoadingByPaymentId]
    );

    useEffect(() => {
        if (!mailSuccessModal.open) return undefined;

        const timeoutId = window.setTimeout(() => {
            setMailSuccessModal({ open: false, message: '' });
        }, 1800);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [mailSuccessModal.open]);


    const handleSendPaymentTemplateMail = useCallback(async (payment, templateRow, templateIndex = 0) => {
        const paymentId = Number(payment?.paymentId) || 0;
        if (!paymentId) {
            toast.error('Invalid payment id.');
            return;
        }

        const templateId = Number(
            templateRow?.brandEmailTempleteId ??
            templateRow?.brandEmailTemplateId ??
            templateRow?.templateId ??
            templateRow?.id ??
            0
        );

        if (!templateId) {
            toast.error('Template id is missing.');
            return;
        }

        const key = `${paymentId}-${templateId || templateIndex}`;
        if (sendingTemplateMailByKey[key]) return;

        setSendingTemplateMailByKey((prev) => ({ ...prev, [key]: true }));

        try {
            await paymentService.sendPaymentMail({
                paymentId,
                brandEmailTempleteId: templateId,
            });
            setMailSuccessModal({
                open: true,
                message: 'Send mail successfully',
            });
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to send mail'));
        } finally {
            setSendingTemplateMailByKey((prev) => ({ ...prev, [key]: false }));
        }
    }, [sendingTemplateMailByKey]);

    const handleSendPandaDocMail = useCallback(async (payment) => {
        const paymentId = Number(payment?.paymentId) || 0;
        if (!paymentId) {
            toast.error('Invalid payment id.');
            return;
        }

        if (sendingPandaDocMailByPaymentId[paymentId]) return;

        setSendingPandaDocMailByPaymentId((prev) => ({ ...prev, [paymentId]: true }));

        try {
            await paymentService.sendPandaDocMail(paymentId);
            setMailSuccessModal({
                open: true,
                message: 'Panda Doc mail sent successfully',
            });
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to send Panda Doc mail'));
        } finally {
            setSendingPandaDocMailByPaymentId((prev) => ({ ...prev, [paymentId]: false }));
        }
    }, [sendingPandaDocMailByPaymentId]);

    const getPaymentStatusMeta = useCallback(
        (payment, details) => {
            const source = details || payment || {};
            const saleTypeRaw = source.saleType || payment?.saleType || '';
            const isRefund = String(saleTypeRaw).trim().toLowerCase() === 'refund';

            let label = saleTypeRaw || '';

            if (isRefund) {
                const labelParts = ['Refund'];
                if (source.isChargeBack) labelParts.push('Chargeback');
                if (source.isAlert) labelParts.push('Alert');
                if (source.isRetrieval) labelParts.push('Retrieval');
                label = labelParts.join(' â€¢ ');
            } else if (source.isChargeBack) {
                label = 'Chargeback';
            } else if (source.isVoid) {
                label = 'Void';
            } else if (source.isRetrieval) {
                label = 'Retrieval';
            } else if (source.isAlert) {
                label = 'Alert';
            }

            const normalized = String(label || '').trim().toLowerCase();
            const color = (() => {
                if (normalized.includes('refund')) return 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30';
                if (normalized.includes('void') || normalized.includes('cancel') || normalized.includes('canceled')) return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30';
                if (normalized.includes('chargeback') || normalized.includes('dispute') || normalized.includes('reversal')) return 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30';
                if (normalized.includes('retrieval')) return 'bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30';
                if (normalized.includes('alert') || normalized.includes('review')) return 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30';

                if (
                    normalized.includes('sale') ||
                    normalized.includes('done') ||
                    normalized.includes('success') ||
                    normalized.includes('paid') ||
                    normalized.includes('completed') ||
                    normalized.includes('approved') ||
                    normalized.includes('captured') ||
                    normalized.includes('settled')
                ) {
                    return 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30';
                }

                if (
                    normalized.includes('pending') ||
                    normalized.includes('process') ||
                    normalized.includes('in progress') ||
                    normalized.includes('hold')
                ) {
                    return 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30';
                }

                if (
                    normalized.includes('fail') ||
                    normalized.includes('declin') ||
                    normalized.includes('reject') ||
                    normalized.includes('error')
                ) {
                    return 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30';
                }

                return 'bg-purple-100 text-purple-700 ring-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-500/30';
            })();

            return { label, color, normalized };
        },
        []
    );

    const renderPayments = useCallback(
        (row) => {
            const order = row?.original || row;
            const isExpanded = expandedOrderId === order.orderId;
            const payments = order.payments || [];
            if (!isExpanded || payments.length === 0) return null;
            if (!canViewOrderPayments) return null;

            return (
                <tr key={`payment-section-${order.orderId}`} className="bg-white">
                    <td colSpan={columnCount} className="pt-0 pb-4 px-4">
                        <div className="mt-2 rounded-b-md border border-gray-200 border-t-0 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm border-t border-gray-200">
                                    <thead className="bg-gray-200 text-gray-700 border-b border-gray-300">
                                        <tr className="border-b border-gray-300">
                                            <th className="px-4 py-2 text-left text-xs font-semibold border-r border-gray-300 last:border-r-0">Payment ID</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold border-r border-gray-300 last:border-r-0">Payment Type</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold border-r border-gray-300 last:border-r-0">Auth Code</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold border-r border-gray-300 last:border-r-0">Date</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold border-r border-gray-300 last:border-r-0">Brand &amp; Gateway</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold border-r border-gray-300 last:border-r-0">Amount</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold border-r border-gray-300 last:border-r-0">Payment Status</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold border-r border-gray-300 last:border-r-0">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {payments.map((payment) => (
                                            <tr
                                                key={`payment-${order.orderId}-${payment.paymentId}`}
                                                className="hover:bg-gray-50 border-b border-gray-200 last:border-b-0"
                                            >
                                                <td className="px-4 py-3 align-middle border-r border-gray-200 last:border-r-0">
                                                    <span className="text-xs font-medium text-gray-900">{payment.paymentId || '-'}</span>
                                                </td>
                                                <td className="px-4 py-3 align-middle border-r border-gray-200 last:border-r-0">
                                                    {(() => {
                                                        const paymentId = Number(payment?.paymentId) || 0;
                                                        const details = (paymentId && paymentDetailsById?.[paymentId]) || payment || {};
                                                        const paymentTypeText = details.paymentType || payment.paymentType || payment.cardType || 'Payment';
                                                        const normalizedType = String(paymentTypeText || '').trim().toLowerCase();

                                                        let secondaryLabel = 'Card';
                                                        let secondaryValue = maskCardToLast4(details.cardNumber || payment.cardNumber || '');

                                                        if (normalizedType.includes('zelle')) {
                                                            secondaryLabel = 'Zelle ID';
                                                            secondaryValue = details.zelleId || payment.zelleId || '-';
                                                        } else if (normalizedType.includes('paypal') || normalizedType.includes('pay pal')) {
                                                            secondaryLabel = 'PayPal ID';
                                                            secondaryValue = details.zelleId || payment.zelleId || '-';
                                                        } else if (normalizedType.includes('cheque') || normalizedType.includes('check')) {
                                                            secondaryLabel = 'Cheque No';
                                                            secondaryValue = details.chequeNo != null && details.chequeNo !== 0 ? String(details.chequeNo) : '-';
                                                        } else if (normalizedType.includes('bank') || normalizedType.includes('wire')) {
                                                            secondaryLabel = 'Ref';
                                                            secondaryValue = details.transactionId || payment.transactionId || '-';
                                                        }

                                                        return (
                                                            <>
                                                                <div className="font-semibold text-gray-900">{paymentTypeText}</div>
                                                                <div className="text-xs text-gray-600">
                                                                    {secondaryLabel}: {secondaryValue || '-'}
                                                                </div>
                                                                <div className="text-xs text-gray-600">Trans: {details.transactionId || payment.transactionId || '-'}</div>
                                                            </>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 align-middle border-r border-gray-200 last:border-r-0">
                                                    {(() => {
                                                        const paymentId = Number(payment?.paymentId) || 0;
                                                        const details = (paymentId && paymentDetailsById?.[paymentId]) || payment || {};
                                                        return (
                                                            <span className="text-xs font-medium text-gray-800">
                                                                {details.authCode || details.authorizationCode || payment.authCode || payment.authorizationCode || '-'}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 align-middle text-xs text-center border-r border-gray-200 last:border-r-0">
                                                    {payment.paymentDate ? (
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 dark:bg-green-500/15">
                                                                <CreditCard size={14} className="text-green-600" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-gray-700 leading-tight whitespace-nowrap">{formatDateTime(payment.paymentDate)}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 align-middle text-center border-r border-gray-200 last:border-r-0">
                                                    <div className="text-sm font-semibold text-gray-900">{payment.brandName || '-'}</div>
                                                    <div className="text-xs text-gray-600">{payment.gatewayName || '-'}</div>
                                                </td>
                                                <td className="px-4 py-3 align-middle text-center border-r border-gray-200 last:border-r-0">
                                                    {(() => {
                                                        const paymentId = Number(payment?.paymentId) || 0;
                                                        const details = (paymentId && paymentDetailsById?.[paymentId]) || payment || {};
                                                        const amount = Number(details?.amount ?? payment?.amount ?? 0);
                                                        return (
                                                            <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                                                {currency(amount)}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 align-middle text-center border-r border-gray-200 last:border-r-0">
                                                    {(() => {
                                                        const paymentId = Number(payment?.paymentId) || 0;
                                                        const details = (paymentId && paymentDetailsById?.[paymentId]) || payment || {};
                                                        const statusMeta = getPaymentStatusMeta(payment, details);

                                                        return (
                                                            <div className="flex justify-center">
                                                                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${statusMeta.color}`}>
                                                                    {statusMeta.label}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 align-middle border-r border-gray-200 last:border-r-0">
                                                    <div className="flex items-center gap-2 text-xs text-gray-700 justify-center">
                                                        {(() => {
                                                            const templateRows = getTemplateRowsFromPayment(payment);
                                                            const loadingTemplates = isTemplateLoading(payment);
                                                            const paymentId = Number(payment?.paymentId) || 0;
                                                            const details = (paymentId && paymentDetailsById?.[paymentId]) || payment || {};
                                                            const statusMeta = getPaymentStatusMeta(payment, details);
                                                            const showPandaDocMail = String(statusMeta.label || '').trim().toLowerCase() === 'sale';
                                                            const templates = templateRows
                                                                .map((t, index) => {
                                                                    const templateName = String(t?.templateName || t?.name || '').trim();
                                                                    const templateId = Number(
                                                                        t?.brandEmailTempleteId ??
                                                                        t?.brandEmailTemplateId ??
                                                                        t?.templateId ??
                                                                        t?.id ??
                                                                        0
                                                                    );

                                                                    return {
                                                                        row: t,
                                                                        index,
                                                                        templateName,
                                                                        templateId,
                                                                    };
                                                                })
                                                                .filter((t) => t.templateName);

                                                            return (
                                                                <DropdownMenu
                                                                    onOpenChange={(open) => {
                                                                        if (open) handleTemplateMenuOpen(payment);
                                                                    }}
                                                                >
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-violet-700 transition-colors hover:bg-gray-100"
                                                                            aria-label="Payment templates"
                                                                            title="Payment templates"
                                                                        >
                                                                            <ChevronDown size={16} />
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="start" className="min-w-[220px]">
                                                                        {showPandaDocMail && (
                                                                            <DropdownMenuItem
                                                                                disabled={!!sendingPandaDocMailByPaymentId[payment?.paymentId]}
                                                                                onClick={() => handleSendPandaDocMail(payment)}
                                                                            >
                                                                                {sendingPandaDocMailByPaymentId[payment?.paymentId] ? 'Sending Panda Doc Mail...' : 'Panda Doc Mail'}
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        <DropdownMenuItem onClick={() => openShareSaleModal(order, payment, 'put')}>
                                                                            Share Payment
                                                                        </DropdownMenuItem>
                                                                        {loadingTemplates && <DropdownMenuItem disabled>Loading templates...</DropdownMenuItem>}
                                                                        {!loadingTemplates && templates.length === 0 && <DropdownMenuItem disabled>No templates found</DropdownMenuItem>}
                                                                        {!loadingTemplates && templates.map((template) => {
                                                                            const actionKey = `${payment?.paymentId || 'payment'}-${template.templateId || template.index}`;
                                                                            const isSending = !!sendingTemplateMailByKey[actionKey];

                                                                            return (
                                                                            <DropdownMenuItem
                                                                                key={`${payment?.paymentId || 'payment'}-template-${template.index}`}
                                                                                disabled={isSending}
                                                                                onClick={() => handleSendPaymentTemplateMail(payment, template.row, template.index)}
                                                                            >
                                                                                {isSending ? 'Sending...' : template.templateName}
                                                                            </DropdownMenuItem>
                                                                            );
                                                                        })}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            );
                                                        })()}
                                                        {(() => {
                                                            const paymentId = Number(payment?.paymentId) || 0;
                                                            const cachedDetails = (paymentId && paymentDetailsById?.[paymentId]) || null;
                                                            const saleTypeText = String(cachedDetails?.saleType || payment.saleType || '').trim().toLowerCase();
                                                            const isRefunded = saleTypeText.includes('refund');

                                                            if (isRefunded) return null;

                                                            return (
                                                                <>
                                                                    {canVoidOrderPayment && (
                                                                        <ActionIconButton
                                                                            label={payment.isVoid ? 'Already voided' : 'Void payment'}
                                                                            className={`w-8 h-8 ${payment.isVoid ? 'text-slate-400 cursor-not-allowed' : 'text-amber-700 hover:bg-gray-100'}`}
                                                                            onClick={() => {
                                                                                if (!payment?.paymentId || payment.isVoid) return;
                                                                                openVoidConfirm(payment, order);
                                                                            }}
                                                                            disabled={paymentSaving}
                                                                        >
                                                                            <Ban size={16} />
                                                                        </ActionIconButton>
                                                                    )}
                                                                    {(() => {
                                                                        if (isPaymentVoided(payment)) return null;

                                                                        return (
                                                                            canRefundOrderPayment ? (
                                                                                <ActionIconButton
                                                                                    label="Refund"
                                                                                    className="w-8 h-8 text-emerald-700 hover:bg-gray-100"
                                                                                    onClick={() => {
                                                                                        if (!payment?.paymentId) return;
                                                                                        openRefundModal({ ...payment, orderId: order.orderId });
                                                                                    }}
                                                                                >
                                                                                    <Undo2 size={20} />
                                                                                </ActionIconButton>
                                                                            ) : null
                                                                        );
                                                                    })()}
                                                                </>
                                                            );
                                                        })()}
                                                        {(canUpdateOrderPayment || canRefundOrderPayment) && !isPaymentVoided(payment) && (
                                                            <ActionIconButton
                                                                label="Edit"
                                                                className="w-8 h-8 text-violet-600 hover:bg-gray-100"
                                                                onClick={() => {
                                                                    if (!payment?.paymentId) return;
                                                                    const paymentId = Number(payment?.paymentId) || 0;
                                                                    const details = (paymentId && paymentDetailsById?.[paymentId]) || payment || {};
                                                                    const saleTypeText = String(details.saleType || '').trim().toLowerCase();

                                                                    // If the row is a Refund, edit it using the Refund modal.
                                                                    if (saleTypeText.includes('refund')) {
                                                                        if (!canRefundOrderPayment) {
                                                                            toast.error("You don't have permission to refund order payments.");
                                                                            return;
                                                                        }
                                                                        openRefundModal({ ...details, ...payment, orderId: order.orderId });
                                                                        return;
                                                                    }

                                                                    openEditPaymentModal({ ...payment, orderId: order.orderId });
                                                                }}
                                                            >
                                                                <Edit size={16} />
                                                            </ActionIconButton>
                                                        )}
                                                        {canDeleteOrderPayment && !isPaymentVoided(payment) && (
                                                            <ActionIconButton
                                                                label="Delete payment"
                                                                className="w-8 h-8 text-red-600 hover:bg-gray-100"
                                                                variant="delete"
                                                                onClick={() => {
                                                                    if (!payment?.paymentId) return;
                                                                    openDeletePaymentConfirm(payment, order);
                                                                }}
                                                                disabled={deletePaymentSaving}
                                                            >
                                                                <Trash2 size={16} />
                                                            </ActionIconButton>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </td>
                </tr>
            );
        },
        [columnCount, expandedOrderId, paymentDetailsById, getTemplateRowsFromPayment, isTemplateLoading, handleTemplateMenuOpen, handleSendPaymentTemplateMail, sendingTemplateMailByKey, sendingPandaDocMailByPaymentId, handleSendPandaDocMail, getPaymentStatusMeta, openShareSaleModal, openRefundModal, openEditPaymentModal, openVoidConfirm, openDeletePaymentConfirm, canViewOrderPayments, canVoidOrderPayment, canRefundOrderPayment, canUpdateOrderPayment, canDeleteOrderPayment, paymentSaving, deletePaymentSaving, orderCodesLoading]
    );

    return (
        <div className="orders-table-page">
            <PageHeader title="Orders" description="Browse orders and payment details">
                {!permissionsLoading && canAdd && (
                    <LiquidGlassButton
                        type="button"
                        className="w-full sm:w-auto text-center"
                        onClick={() => {
                            if (permissionsLoading) return;
                            if (!canAdd) return;
                            navigate(createOrderPath);
                        }}
                    >
                        Create Order
                    </LiquidGlassButton>
                )}
            </PageHeader>

            <TableCard>
                {/* Order Summary Cards - now shown at the very top of the main Orders card */}

                {/* <div className="px-3 py-4 border-b border-gray-200 dark:bg-gray-100 dark:border-gray-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 truncate">Orders</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-600 mt-1">Browse orders and payment details</p>
                    </div>
                <div className="w-full sm:w-auto flex justify-start sm:justify-end">
                    {!permissionsLoading && canAdd && (
                        <LiquidGlassButton
                            type="button"
                            className="w-full sm:w-auto text-center"
                            onClick={() => {
                                if (permissionsLoading) return;
                                if (!canAdd) return;
                                navigate(createOrderPath);
                                }}
                                >
                                Create Order
                                </LiquidGlassButton>
                                )}
                                </div>
                                </div> */}

                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.02] xl:flex-row xl:items-center">
                    <div className="flex items-center justify-between gap-2 xl:shrink-0">
                        <span className="inline-flex min-w-0 shrink-0 items-center gap-2 rounded-full border border-purple-100/80 bg-white/80 px-3 py-2 text-xs text-gray-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" aria-hidden="true" />
                            <span className="truncate whitespace-nowrap">
                                <strong className="font-semibold text-gray-900 dark:text-white">{data.length}</strong>
                                {' of '}
                                <strong className="font-semibold text-gray-900 dark:text-white">{total}</strong>
                                {' Orders'}
                            </span>
                        </span>

                        {canViewSearchBar && (
                            <div className="flex shrink-0 items-center gap-2 xl:hidden">
                                <TableRefreshButton
                                    className="shrink-0"
                                    title="Refresh orders"
                                    loading={loading || summaryLoading}
                                    onClick={handleRefresh}
                                />
                            </div>
                        )}
                    </div>

                    {canViewSearchBar && (
                        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[150px_minmax(220px,1fr)] lg:grid-cols-[150px_minmax(240px,1fr)_auto] xl:ml-auto xl:flex xl:flex-none xl:items-center">
                            <div className="w-full sm:w-[150px]">
                                <Select value={searchFieldSelectValue} onValueChange={handleSearchFieldChange}>
                                    <SelectTrigger className={TOOLBAR_SELECT_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Customer" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" sideOffset={4} className="min-w-[var(--radix-select-trigger-width)]">
                                        <SelectItem value="All Orders">All Orders</SelectItem>
                                        <SelectItem value="Customer">Customer</SelectItem>
                                        <SelectItem value="Brand">Brand</SelectItem>
                                        <SelectItem value="SalesPerson">Sales Person</SelectItem>
                                        <SelectItem value="CardNumber">Card Number</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {(isBrandSearch || isSalesPersonSearch) ? (
                                <div className="w-full min-w-0 sm:min-w-[220px] xl:w-[300px]">
                                    <Select
                                        value={lookupSearchValue}
                                        onValueChange={(selected) => {
                                            if (selected === SEARCH_ALL_OPTION_VALUE) {
                                                setFilters((prev) => ({ ...prev, Text: '', PageNumber: 1 }));
                                                setLookupOptionSearch('');
                                                return;
                                            }

                                            const option = lookupSearchOptions.find((item) => item.value === selected);
                                            setFilters((prev) => ({ ...prev, Text: option?.queryText || '', PageNumber: 1 }));
                                            setLookupOptionSearch('');
                                        }}
                                    >
                                        <SelectTrigger className={TOOLBAR_SELECT_TRIGGER_CLASS}>
                                            <SelectValue placeholder={searchOptionsLoading ? 'Loading...' : searchPlaceholder} />
                                        </SelectTrigger>
                                        <SelectContent
                                            position="popper"
                                            sideOffset={4}
                                            className="min-w-[var(--radix-select-trigger-width)] max-h-72"
                                            search={(
                                                <SelectSearchInput
                                                    value={lookupOptionSearch}
                                                    onChange={setLookupOptionSearch}
                                                    placeholder={isBrandSearch ? 'Search brands...' : 'Search sales persons...'}
                                                />
                                            )}
                                        >
                                            <SelectItem value={SEARCH_ALL_OPTION_VALUE}>
                                                {isBrandSearch ? 'All Brands' : 'All Sales Persons'}
                                            </SelectItem>
                                            {filteredLookupSearchOptions.map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                    meta={<UserOptionBadges user={option} />}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                            {!searchOptionsLoading && filteredLookupSearchOptions.length === 0 && (
                                                <div className="px-2 py-2 text-sm text-gray-500">No options found.</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <TableSearchField
                                    className="relative flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-[rgba(210,218,240,0.65)] bg-white/75 px-3 text-sm text-gray-700 backdrop-blur transition-colors hover:border-purple-300 focus-within:border-purple-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 sm:min-w-[220px] xl:w-[300px]"
                                    placeholder={searchPlaceholder}
                                    value={searchInput}
                                    onChange={(event) => setSearchInput(event.target.value)}
                                    onClear={() => {
                                        setSearchInput('');
                                        setFilters((prev) => ({ ...prev, Text: '', PageNumber: 1 }));
                                    }}
                                />
                            )}

                            <LiquidGlassDatePicker
                                key={`order-date-${filters.Date || ''}-${filters.FromDate || ''}-${filters.ToDate || ''}`}
                                initialFromDate={filters.Date || filters.FromDate || ''}
                                initialToDate={filters.Date || filters.ToDate || ''}
                                emptyLabel="All Orders"
                                showQuickDateDropdown={true}
                                quickDateOptions={QUICK_DATE_FILTERS}
                                quickDateValue={quickDateFilter}
                                onQuickDateChange={handleQuickDateChange}
                                showQuickDateCustomOption={false}
                                quickDatePlaceholder="Current Month"
                                onChange={(from, to, isSingle) => {
                                    setQuickDateFilter('');
                                    if (isSingle) {
                                        setFilters((f) => ({
                                            ...f,
                                            Date: '',
                                            FromDate: from || '',
                                            ToDate: to || from || '',
                                            PageNumber: 1,
                                        }));
                                    } else {
                                        setFilters((f) => ({
                                            ...f,
                                            Date: '',
                                            FromDate: from || '',
                                            ToDate: to || '',
                                            PageNumber: 1,
                                        }));
                                    }
                                }}
                                onClear={handleResetFilters}
                                showClearButton={false}
                                quickDateTriggerClassName={TOOLBAR_QUICK_DATE_TRIGGER_CLASS}
                                className="w-full shrink-0 sm:col-span-2 lg:col-span-1 lg:w-auto"
                            />

                            <div className="hidden shrink-0 xl:block">
                                <TableRefreshButton
                                    title="Refresh orders"
                                    loading={loading || summaryLoading}
                                    onClick={handleRefresh}
                                />
                            </div>
                        </div>
                    )}
                </div>
                {canViewOrderSummary && (
                    <div className="px-3 pt-3 pb-3 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-white">
                                    <Package size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-gray-500">Total Order</span>
                                    <span className="text-lg font-semibold text-gray-900">
                                        {summaryLoading ? '...' : (summary?.totalOrders ?? 0)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-white">
                                    <CircleDollarSign size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-gray-500">Sales Amount</span>
                                    <span className="text-lg font-semibold text-gray-900">
                                        {summaryLoading ? '...' : currency(summary?.totalSales || 0)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-white">
                                    <CreditCard size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-gray-500">Refund Amount</span>
                                    <span className="text-lg font-semibold text-gray-900">
                                        {summaryLoading ? '...' : currency(summary?.totalRefunds || 0)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-white">
                                    <Gift size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-gray-500">Order Fulfilled</span>
                                    <span className="text-lg font-semibold text-gray-900">
                                        {summaryLoading ? '...' : (summary?.totalFullFilled ?? 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid">
                    <CommonTable
                        columns={columns}
                        data={data}
                        sorting={sorting}
                        onSortingChange={handleSortingChange}
                        isLoading={loading}
                        emptyMessage="No orders found"
                        pageNo={filters.PageNumber}
                        pageSize={filters.PageSize}
                        total={total}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        renderSubRows={renderPayments}
                    />
                </div>

                {paymentModalOpen && (
                    <ModalPortal>
                        <div className="orders-table-modal fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 truncate">
                                            {paymentModalMode === 'edit' ? 'Edit Payment' : 'Add Payment'}
                                        </h3>
                                    </div>
                                    <GlassCloseButton
                                        onClick={closePaymentModal}
                                        disabled={paymentSaving}
                                    />
                                </div>

                                <div className="p-6 overflow-y-auto flex-1">
                                    {paymentLoading ? (
                                        <div className="text-sm text-gray-600">Loading payment...</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Payment type tabs (same design as CreateOrderPage) */}
                                            <div className="border rounded-xl bg-white shadow-sm">
                                                <div className="px-4 py-3 border-b bg-gradient-to-r from-green-50 to-emerald-50 dark:from-emerald-500/10 dark:to-emerald-500/5">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="bg-green-500 p-1.5 rounded-full">
                                                                <CreditCard size={16} className="text-white" />
                                                            </div>
                                                            <h3 className="text-sm font-semibold text-gray-800 truncate">Payment Information</h3>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-xs text-gray-700 bg-white/60 dark:bg-white/10 border border-gray-200 dark:border-white/15 px-2 py-1 rounded-full">
                                                                Order #{paymentDraft.orderId || '-'}
                                                            </span>
                                                            {paymentModalMode === 'edit' && Number(paymentDraft.paymentId) > 0 ? (
                                                                <span className="text-xs text-gray-700 bg-white/60 dark:bg-white/10 border border-gray-200 dark:border-white/15 px-2 py-1 rounded-full">
                                                                    Payment #{paymentDraft.paymentId}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="px-4 pt-3 pb-4">
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4 text-sm sm:text-base rounded-2xl bg-slate-50 p-2 border border-slate-200">
                                                        {PAYMENT_TABS.filter((tab) => isPaymentTabAllowed(tab.key)).map(({ key, label, icon: TabIcon, tone }) => {
                                                            const active = paymentActiveTab === key;
                                                            return (
                                                                <button
                                                                    key={key}
                                                                    type="button"
                                                                    onClick={() => setPaymentTab(key)}
                                                                    aria-pressed={active}
                                                                    className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${active
                                                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-2 ring-emerald-500/15 dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-500/40'
                                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700'
                                                                        }`}
                                                                >
                                                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-emerald-500 text-white' : tone}`}>
                                                                        <TabIcon size={15} aria-hidden="true" />
                                                                    </span>
                                                                    <span className="leading-none">{label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {allowedPaymentTabs && allowedPaymentTabs.length === 0 ? (
                                                        <p className="-mt-2 mb-4 text-xs font-medium text-amber-600">
                                                            No active payment types are configured for the selected gateway.
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* Common fields */}
                                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                                <div className="mb-3 flex items-center justify-between gap-2">
                                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Common</div>
                                                    {Number(paymentDraft.brandId) > 0 || Number(paymentDraft.gatewayId) > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={clearPaymentBrandAndGateway}
                                                            title="Clear brand & gateway"
                                                            aria-label="Clear brand and gateway"
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:text-slate-300 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/15 dark:hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
                                                        >
                                                            <Eraser size={15} aria-hidden="true" />
                                                        </button>
                                                    ) : null}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className={labelClass}>Brand</label>
                                                        <Select
                                                            value={paymentDraft.brandId ? String(paymentDraft.brandId) : ''}
                                                            onValueChange={(value) => {
                                                                const nextBrandId = value ? Number(value) : 0;
                                                                setPaymentDraft((prev) => ({
                                                                    ...prev,
                                                                    brandId: nextBrandId,
                                                                    gatewayId: 0,
                                                                }));
                                                                clearPaymentError('brandId');
                                                                clearPaymentError('gatewayId');
                                                            }}
                                                        >
                                                            <SelectTrigger className={fieldClass(selectTriggerClass, !!paymentErrors.brandId)}>
                                                                <SelectValue placeholder="Select Brand" />
                                                            </SelectTrigger>
                                                            <SelectContent className="max-h-72">
                                                                {(brands || []).map((b) => (
                                                                    <SelectItem key={b.brandId} value={String(b.brandId)}>
                                                                        {b.brandName || b.name || `Brand ${b.brandId}`}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {paymentErrors.brandId ? <p className="mt-1 text-xs text-red-600">{paymentErrors.brandId}</p> : null}
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Gateway</label>
                                                        <Select
                                                            value={paymentDraft.gatewayId ? String(paymentDraft.gatewayId) : ''}
                                                            onValueChange={(value) => {
                                                                const nextGatewayId = value ? Number(value) : 0;
                                                                // Picking a gateway with no brand chosen fills the brand
                                                                // in from that gateway, so the pair can never disagree.
                                                                const inferredBrandId = resolveGatewayBrandId(nextGatewayId);

                                                                setPaymentDraft((prev) => ({
                                                                    ...prev,
                                                                    gatewayId: nextGatewayId,
                                                                    brandId: inferredBrandId || Number(prev.brandId) || 0,
                                                                }));
                                                                clearPaymentError('gatewayId');
                                                                if (inferredBrandId) clearPaymentError('brandId');
                                                            }}
                                                        >
                                                            <SelectTrigger className={fieldClass(selectTriggerClass, !!paymentErrors.gatewayId)}>
                                                                <SelectValue placeholder="Select Gateway" />
                                                            </SelectTrigger>
                                                            <SelectContent className="max-h-72">
                                                                {(filteredGateways || []).length > 0 ? (
                                                                    (filteredGateways || []).map((g) => (
                                                                        <SelectItem key={g.gatewayId} value={String(g.gatewayId)}>
                                                                            {g.gatewayName || g.name || `Gateway ${g.gatewayId}`}
                                                                        </SelectItem>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-3 py-2 text-xs text-slate-500">No gateways found for this brand</div>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                        {paymentErrors.gatewayId ? <p className="mt-1 text-xs text-red-600">{paymentErrors.gatewayId}</p> : null}
                                                    </div>

                                                    <div>
                                                        <label className={labelClass}>Amount</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className={fieldClass(inputClass, !!paymentErrors.amount)}
                                                            value={paymentDraft.amount ?? ''}
                                                            onChange={handlePaymentField('amount')}
                                                        />
                                                        {paymentErrors.amount ? <p className="mt-1 text-xs text-red-600">{paymentErrors.amount}</p> : null}
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Payment Date</label>
                                                        <input
                                                            type="date"
                                                            className={fieldClass(inputClass, !!paymentErrors.paymentDate)}
                                                            value={dateForInput(paymentDraft.paymentDate)}
                                                            onChange={(e) => {
                                                                setPaymentDraft((p) => ({ ...p, paymentDate: e.target.value }));
                                                                clearPaymentError('paymentDate');
                                                            }}
                                                        />
                                                        {paymentErrors.paymentDate ? <p className="mt-1 text-xs text-red-600">{paymentErrors.paymentDate}</p> : null}
                                                    </div>

                                                    <div>
                                                        <label className={labelClass}>Transaction ID</label>
                                                        <input className={fieldClass(inputClass, !!paymentErrors.transactionId)} value={paymentDraft.transactionId || ''} onChange={handlePaymentField('transactionId')} />
                                                        {paymentErrors.transactionId ? <p className="mt-1 text-xs text-red-600">{paymentErrors.transactionId}</p> : null}
                                                    </div>

                                                    <div>
                                                        <label className={labelClass}>Auth Code</label>
                                                        <input className={fieldClass(inputClass, !!paymentErrors.authCode)} value={paymentDraft.authCode || ''} onChange={handlePaymentField('authCode')} />
                                                        {paymentErrors.authCode ? <p className="mt-1 text-xs text-red-600">{paymentErrors.authCode}</p> : null}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Payment-type specific fields (keeps CreateOrderPage feel) */}
                                            {paymentActiveTab === 'card' && (
                                                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                                    <div className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Card Details</div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className={labelClass}>Card Type</label>
                                                            {cardTypes.length > 0 ? (
                                                                <Select
                                                                    value={paymentDraft.cardType || ''}
                                                                    onValueChange={(value) => {
                                                                        setPaymentDraft((prev) => ({ ...prev, cardType: value }));
                                                                        clearPaymentError('cardType');
                                                                    }}
                                                                >
                                                                    <SelectTrigger className={fieldClass(selectTriggerClass, !!paymentErrors.cardType)}>
                                                                        <SelectValue placeholder="Select Card Type" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="max-h-72">
                                                                        {cardTypes.map((type) => (
                                                                            <SelectItem key={type.id || type.name} value={type.name}>
                                                                                {type.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <input className={fieldClass(inputClass, !!paymentErrors.cardType)} value={paymentDraft.cardType || ''} onChange={handlePaymentField('cardType')} />
                                                            )}
                                                            {paymentErrors.cardType ? <p className="mt-1 text-xs text-red-600">{paymentErrors.cardType}</p> : null}
                                                        </div>
                                                        <div>
                                                            <label className={labelClass}>Name On Card</label>
                                                            <input className={fieldClass(inputClass, !!paymentErrors.nameOnCard)} value={paymentDraft.nameOnCard || ''} onChange={handlePaymentField('nameOnCard')} />
                                                            {paymentErrors.nameOnCard ? <p className="mt-1 text-xs text-red-600">{paymentErrors.nameOnCard}</p> : null}
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className={labelClass}>Card Number</label>
                                                            <input
                                                                className={fieldClass(inputClass, !!paymentErrors.cardNumber)}
                                                                value={formattedCardNumber}
                                                                onChange={handleCardNumberChange}
                                                                placeholder="1234 5678 9012 3456"
                                                                inputMode="numeric"
                                                                autoComplete="cc-number"
                                                                maxLength={19}
                                                            />
                                                            {paymentErrors.cardNumber ? <p className="mt-1 text-xs text-red-600">{paymentErrors.cardNumber}</p> : null}
                                                        </div>
                                                        <div>
                                                            <label className={labelClass}>Card Expiry Date</label>
                                                            <input
                                                                className={fieldClass(inputClass, !!paymentErrors.cardExpiryDate)}
                                                                value={paymentDraft.cardExpiryDate || ''}
                                                                onChange={handleExpiryChange}
                                                                placeholder="MM/YY"
                                                                inputMode="numeric"
                                                                autoComplete="cc-exp"
                                                            />
                                                            {paymentErrors.cardExpiryDate ? <p className="mt-1 text-xs text-red-600">{paymentErrors.cardExpiryDate}</p> : null}
                                                        </div>
                                                        <div>
                                                            <label className={labelClass}>CVV</label>
                                                            <input
                                                                className={fieldClass(inputClass, !!paymentErrors.cvv)}
                                                                value={paymentDraft.cvv || ''}
                                                                onChange={handleCvvChange}
                                                                placeholder="123"
                                                                inputMode="numeric"
                                                                autoComplete="cc-csc"
                                                            />
                                                            {paymentErrors.cvv ? <p className="mt-1 text-xs text-red-600">{paymentErrors.cvv}</p> : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {paymentActiveTab === 'bank' && (
                                                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                                    <div className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank Transfer Details</div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div className="md:col-span-2">
                                                            <label className={labelClass}>Account Holder Name</label>
                                                            <input className={fieldClass(inputClass, !!paymentErrors.nameOnCard)} value={paymentDraft.nameOnCard || ''} onChange={handlePaymentField('nameOnCard')} />
                                                            {paymentErrors.nameOnCard ? <p className="mt-1 text-xs text-red-600">{paymentErrors.nameOnCard}</p> : null}
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className={labelClass}>Account Number</label>
                                                            <input
                                                                className={fieldClass(inputClass, !!paymentErrors.cardNumber)}
                                                                value={formattedBankAccountNumber}
                                                                onChange={handleBankAccountNumberChange}
                                                                placeholder="Account number"
                                                                inputMode="numeric"
                                                            />
                                                            {paymentErrors.cardNumber ? <p className="mt-1 text-xs text-red-600">{paymentErrors.cardNumber}</p> : null}
                                                        </div>
                                                        <div>
                                                            <label className={labelClass}>Routing / IFSC</label>
                                                            <input
                                                                className={fieldClass(inputClass, !!paymentErrors.chequeRoutingNo)}
                                                                value={String(paymentDraft.chequeRoutingNo ?? '')}
                                                                onChange={handleBankRoutingIfscChange}
                                                                placeholder="Routing / IFSC"
                                                            />
                                                            {paymentErrors.chequeRoutingNo ? <p className="mt-1 text-xs text-red-600">{paymentErrors.chequeRoutingNo}</p> : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {paymentActiveTab === 'cheque' && (
                                                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cheque Details</span>
                                                        <div className="inline-flex items-center gap-2">
                                                            <span className={`text-xs font-semibold ${paymentDraft.isChequeCleared ? 'text-emerald-600' : 'text-gray-500'}`}>
                                                                {paymentDraft.isChequeCleared ? 'Cheque Cleared' : 'Not Cleared'}
                                                            </span>
                                                            <IosToggle
                                                                checked={!!paymentDraft.isChequeCleared}
                                                                onCheckedChange={(nextChecked) => {
                                                                    setPaymentDraft((prev) => ({ ...prev, isChequeCleared: !!nextChecked }));
                                                                    clearPaymentError('isChequeCleared');
                                                                }}
                                                                title={paymentDraft.isChequeCleared ? 'Cheque Cleared' : 'Not Cleared'}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div className="md:col-span-2">
                                                            <label className={labelClass}>Name On Card</label>
                                                            <input className={fieldClass(inputClass, !!paymentErrors.nameOnCard)} value={paymentDraft.nameOnCard || ''} onChange={handlePaymentField('nameOnCard')} />
                                                            {paymentErrors.nameOnCard ? <p className="mt-1 text-xs text-red-600">{paymentErrors.nameOnCard}</p> : null}
                                                        </div>
                                                        <div>
                                                            <label className={labelClass}>Routing No</label>
                                                            <input className={fieldClass(inputClass, !!paymentErrors.chequeRoutingNo)} value={String(paymentDraft.chequeRoutingNo ?? '')} onChange={handleChequeRoutingChange} inputMode="numeric" />
                                                            {paymentErrors.chequeRoutingNo ? <p className="mt-1 text-xs text-red-600">{paymentErrors.chequeRoutingNo}</p> : null}
                                                        </div>
                                                        <div>
                                                            <label className={labelClass}>Cheque No</label>
                                                            <input className={fieldClass(inputClass, !!paymentErrors.chequeNo)} value={String(paymentDraft.chequeNo ?? '')} onChange={handleChequeNoChange} inputMode="numeric" />
                                                            {paymentErrors.chequeNo ? <p className="mt-1 text-xs text-red-600">{paymentErrors.chequeNo}</p> : null}
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className={labelClass}>Cheque Tracking No</label>
                                                            <input className={fieldClass(inputClass, !!paymentErrors.chequeTrackingNo)} value={paymentDraft.chequeTrackingNo || ''} onChange={handlePaymentField('chequeTrackingNo')} />
                                                            {paymentErrors.chequeTrackingNo ? <p className="mt-1 text-xs text-red-600">{paymentErrors.chequeTrackingNo}</p> : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {(paymentActiveTab === 'zelle' || paymentActiveTab === 'paypal') && (
                                                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                                    <div className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                        {paymentActiveTab === 'paypal' ? 'PayPal Payment' : 'Zelle Payment'}
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div className="md:col-span-2">
                                                            <label className={labelClass}>Zelle ID</label>
                                                            <input className={fieldClass(inputClass, !!paymentErrors.zelleId)} value={paymentDraft.zelleId || ''} onChange={handlePaymentField('zelleId')} />
                                                            {paymentErrors.zelleId ? <p className="mt-1 text-xs text-red-600">{paymentErrors.zelleId}</p> : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    )}
                                </div>

                                <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-900">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={closePaymentModal}
                                        disabled={paymentSaving}
                                        className="h-10 px-6 border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                                    >
                                        Cancel
                                    </Button>
                                    <LiquidGlassButton
                                        type="button"
                                        onClick={savePayment}
                                        disabled={paymentSaving || paymentLoading}
                                        className="!h-10 !px-6 text-center"
                                    >
                                        {paymentSaving ? 'Saving...' : paymentModalMode === 'edit' ? 'Update Payment' : 'Add Payment'}
                                    </LiquidGlassButton>
                                </div>
                            </div>
                        </div>
                    </ModalPortal>
                )}

                <ShareSaleModal
                    open={shareSaleModalOpen}
                    onClose={closeShareSaleModal}
                    paymentOptions={shareSaleModalPaymentOptions}
                    selectedPaymentId={Number(shareSaleModalPayment?.paymentId) || 0}
                    onPaymentChange={handleShareSaleModalPaymentChange}
                    isPaymentChanging={shareSaleModalPaymentChanging}
                    salesPersonLabel={String(shareSaleModalResolvedSalesPerson?.name || '').trim() || '-'}
                    salesPersonAmount={shareSaleModalRemaining}
                    orderTotal={shareSaleModalPaymentTotal}
                    splitTotal={shareSaleModalSplitTotal}
                    remainingAmount={shareSaleModalRemaining}
                    isExceeded={shareSaleModalExceeded}
                    rows={shareSaleModalRows}
                    salesPersonSplitTypeId={shareSaleModalSalesPersonTypeId}
                    onSalesPersonSplitTypeChange={(value) => setShareSaleModalSalesPersonTypeId(value ? Number(value) : 0)}
                    fixedShareWithId={Number(shareSaleModalResolvedSalesPerson?.id) || 0}
                    salesPersons={shareSaleUsers}
                    onUserSearch={fetchShareSaleUsers}
                    salesAgentRoleIds={salesAgentRoleIds}
                    salesShareTypeOptions={shareSaleTypeOptions}
                    labelClass={labelClass}
                    selectTriggerCompactClass={selectTriggerClass}
                    inputCompactClass={inputClass}
                    formatMoney2={formatMoney2}
                    getSalesPersonLabel={(u) => getUserFullName(u?.userId)}
                    splitReceiptRows={shareSaleModalReceiptRows}
                    onAddShareSaleRow={addShareSaleModalRow}
                    onRemoveShareSaleRow={removeShareSaleModalRow}
                    onUpdateShareSaleRow={updateShareSaleModalRow}
                    onSave={handleSaveShareSaleRows}
                    isSaving={shareSaleSaving || shareSaleModalPaymentChanging}
                    saveButtonLabel="Save"
                    saveMode={shareSaleSaveMethod}
                />

                {refundModalOpen && (
                    <ModalPortal>
                        <div className="orders-table-modal fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 truncate">Refund</h3>
                                    </div>
                                    <GlassCloseButton
                                        onClick={closeRefundModal}
                                        disabled={refundSaving}
                                    />
                                </div>

                                <div className="p-6 overflow-y-auto">
                                    {refundLoading ? (
                                        <div className="text-sm text-gray-600">Loading payment...</div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                                <div className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Refund Details</div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className={labelClass}>Payment ID</label>
                                                        <input
                                                            type="number"
                                                            className={`${inputClass} bg-slate-100 text-slate-600 cursor-not-allowed`}
                                                            value={refundDraft.paymentId ?? 0}
                                                            disabled
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Order ID</label>
                                                        <input
                                                            type="number"
                                                            className={`${inputClass} bg-slate-100 text-slate-600 cursor-not-allowed`}
                                                            value={refundDraft.orderId ?? 0}
                                                            disabled
                                                        />
                                                    </div>

                                                    <div className="md:col-span-2">
                                                        <label className={labelClass}>Amount</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className={inputClass}
                                                            value={refundDraft.amount ?? 0}
                                                            onChange={handleRefundField('amount')}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Refund Date</label>
                                                        <input
                                                            type="date"
                                                            className={inputClass}
                                                            value={dateForInput(refundDraft.paymentDate)}
                                                            onChange={handleRefundField('paymentDate')}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>Transaction ID</label>
                                                        <input className={inputClass} value={refundDraft.transactionId || ''} onChange={handleRefundField('transactionId')} />
                                                    </div>

                                                    <div>
                                                        <label className={labelClass}>Auth Code</label>
                                                        <input className={inputClass} value={refundDraft.authCode || ''} onChange={handleRefundField('authCode')} />
                                                    </div>

                                                    <div className="md:col-span-2">
                                                        <label className={labelClass}>Flags</label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 border border-gray-200 rounded-md px-3 py-2">
                                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                                <input type="radio" name="refund-flag" checked={!!refundDraft.isChargeBack} onChange={() => setRefundFlag('isChargeBack')} />
                                                                Chargeback
                                                            </label>
                                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                                <input type="radio" name="refund-flag" checked={!!refundDraft.isRetrieval} onChange={() => setRefundFlag('isRetrieval')} />
                                                                Retrieval
                                                            </label>
                                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                                <input type="radio" name="refund-flag" checked={!!refundDraft.isAlert} onChange={() => setRefundFlag('isAlert')} />
                                                                Alert
                                                            </label>
                                                                                                                        {/* The radios are exclusive, so "None" is the only way back to no
                                                                flag once one has been picked. */}
                                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                                <input
                                                                    type="radio"
                                                                    name="refund-flag"
                                                                    checked={!refundDraft.isChargeBack && !refundDraft.isRetrieval && !refundDraft.isAlert}
                                                                    onChange={() => setRefundFlag(null)}
                                                                />
                                                                None
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-900">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={closeRefundModal}
                                        disabled={refundSaving}
                                        className="h-10 px-6 border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                                    >
                                        Cancel
                                    </Button>
                                    <LiquidGlassButton
                                        type="button"
                                        onClick={saveRefund}
                                        disabled={refundSaving || refundLoading}
                                        className="!h-10 !px-6 text-center"
                                    >
                                        {refundSaving ? 'Saving...' : 'Save Refund'}
                                    </LiquidGlassButton>
                                </div>
                            </div>
                        </div>
                    </ModalPortal>
                )}

                <DeleteConfirmModal
                    open={voidConfirmOpen}
                    title="Void Payment"
                    description="Are you sure you want to void this payment?"
                    itemName={voidContext?.paymentId ? `Payment #${voidContext.paymentId}` : undefined}
                    confirmText="Void"
                    loadingText="Voiding..."
                    loading={paymentSaving}
                    onCancel={closeVoidConfirm}
                    onConfirm={confirmVoidPayment}
                />

                <DeleteConfirmModal
                    open={deleteOrderConfirmOpen}
                    title="Delete Order"
                    description="Are you sure you want to delete this order?"
                    itemName={deleteOrderContext?.orderId ? `Order #${deleteOrderContext.orderId}` : undefined}
                    confirmText="Delete"
                    loadingText="Deleting..."
                    loading={deleteOrderSaving}
                    onCancel={closeDeleteOrderConfirm}
                    onConfirm={confirmDeleteOrder}
                />

                <DeleteConfirmModal
                    open={deletePaymentConfirmOpen}
                    title="Delete Payment"
                    description="Are you sure you want to delete this payment?"
                    itemName={deletePaymentContext?.paymentId ? `Payment #${deletePaymentContext.paymentId}` : undefined}
                    confirmText="Delete"
                    loadingText="Deleting..."
                    loading={deletePaymentSaving}
                    onCancel={closeDeletePaymentConfirm}
                    onConfirm={confirmDeletePayment}
                />

                {mailSuccessModal.open && (
                    <ModalPortal>
                        <div className="orders-table-modal fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="my-auto w-full max-w-md rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-emerald-100 dark:border-emerald-500/30 px-6 py-6 text-center animate-in zoom-in-95 duration-200">
                                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                                    <CheckCircle2 size={30} className="text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Success</h3>
                                <p className="mt-1 text-sm text-gray-600">{mailSuccessModal.message || 'Send mail successfully'}</p>
                                <div className="mt-5">
                                    <LiquidGlassButton
                                        type="button"
                                        onClick={() => setMailSuccessModal({ open: false, message: '' })}
                                        className="!h-9 !px-5 text-center"
                                    >
                                        OK
                                    </LiquidGlassButton>
                                </div>
                            </div>
                        </div>
                    </ModalPortal>
                )}

            </TableCard>
        </div>
    );
};

export { OrdersTable };
