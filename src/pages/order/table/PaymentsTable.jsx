import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Download, TriangleAlert, Upload } from 'lucide-react';
import { format } from 'date-fns';
import CommonTable from '@/components/common/CommonTable';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { paymentService } from '@/services';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePageCrudPermissions } from '@/hooks/usePageCrudPermissions';
import usePagePermissionCodes from '@/hooks/usePagePermissionCodes';
import { useSearchFieldFetchGuard } from '@/hooks/useSearchFieldFetchGuard';
import { TableCard, PageHeader } from '@/components/common/page-card';
import TableSearchField from '@/components/common/TableSearchField';
import { LiquidGlassDatePicker } from '@/components/common/LiquidGlassDatePicker';
import { Button } from '@/components/ui/button';
import LiquidGlassButton from '@/components/ui/LiquidGlassButton';
import GlassSegmentedControl from '@/components/common/GlassSegmentedControl';
import { toast } from 'sonner';

// Matches the frosted look of .tbl-glass-search so the toolbar controls all
// read as one row. It has to be Tailwind rather than a CSS class:
// SelectTrigger's own rounded-md / border-input come from the utilities
// layer, which outranks anything in @layer components.
const TOOLBAR_SELECT_TRIGGER_CLASS =
  'h-10 w-full rounded-xl border border-[rgba(210,218,240,0.65)] bg-white/75 px-3 text-sm text-gray-700 backdrop-blur '
  + 'hover:border-purple-300 focus:border-purple-400 data-[state=open]:border-purple-400 '
  + 'dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:border-white/20';

// Same look, plus the fixed width the quick-date preset select needs so it
// doesn't stretch with the rest of the filter row.
const TOOLBAR_QUICK_DATE_TRIGGER_CLASS =
  `${TOOLBAR_SELECT_TRIGGER_CLASS} sm:w-[160px] sm:shrink-0`;

const PAYMENT_STATUS_SEGMENTS = [
  { label: 'Sales', value: 'Sale' },
  { label: 'All', value: '' },
  { label: 'Refunds', value: 'Refund' },
];

const DOWNLOAD_PAGE_SIZE = 1000;
const REFUND_DEMO_FILE_PATH = '/media/PDF/PaymentUploadDemo.xlsx';

const PAYMENT_SEARCH_FIELDS = [
  { value: 'All Payments', label: 'All Payments', placeholder: 'Search payments...' },
  { value: 'PaymentId', label: 'Payment ID', placeholder: 'Search by payment ID' },
  { value: 'OrderId', label: 'Order ID', placeholder: 'Search by order ID' },
  { value: 'CustomerName', label: 'Customer Name', placeholder: 'Search by customer name' },
  { value: 'BrandGateway', label: 'Brand & Gateway', placeholder: 'Search by brand or gateway' },
  { value: 'PaymentType', label: 'Payment Type', placeholder: 'Search by payment type' },
  { value: 'TransactionNumber', label: 'Transaction Number', placeholder: 'Search by transaction number' },
];

const getPaymentSearchPlaceholder = (searchField) => {
  const found = PAYMENT_SEARCH_FIELDS.find((field) => field.value === searchField);
  return found?.placeholder || 'Search payments...';
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  try {
    const datePart = format(date, 'dd MMM yyyy hh:mm');
    const amPm = format(date, 'a');
    return `${datePart} ${String(amPm || '').toUpperCase()}`.trim();
  } catch {
    return '-';
  }
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value));
};

const maskCardToLast4 = (cardNumber) => {
  if (!cardNumber) return '-';
  const str = String(cardNumber).replace(/\s+/g, '');
  if (str.length <= 4) return str;
  return `**** **** **** ${str.slice(-4)}`;
};

const getStatusBadge = (payment) => {
  const saleTypeRaw = payment.saleType || '';
  const isRefund = String(saleTypeRaw).trim().toLowerCase() === 'refund';
  let label = saleTypeRaw || 'Done';
  if (isRefund) {
    const parts = ['Refund'];
    if (payment.isChargeBack) parts.push('Chargeback');
    if (payment.isAlert) parts.push('Alert');
    if (payment.isRetrieval) parts.push('Retrieval');
    label = parts.join(' â€¢ ');
  } else if (payment.isChargeBack) {
    label = 'Chargeback';
  } else if (payment.isVoid) {
    label = 'Void';
  } else if (payment.isRetrieval) {
    label = 'Retrieval';
  } else if (payment.isAlert) {
    label = 'Alert';
  }
  const normalized = String(label).trim().toLowerCase();
  const color = (() => {
    if (normalized.includes('refund')) return 'bg-rose-100 text-rose-700 ring-rose-200';
    if (normalized.includes('void') || normalized.includes('cancel')) return 'bg-slate-100 text-slate-700 ring-slate-200';
    if (normalized.includes('chargeback') || normalized.includes('dispute') || normalized.includes('reversal')) return 'bg-rose-100 text-rose-700 ring-rose-200';
    if (normalized.includes('retrieval')) return 'bg-violet-100 text-violet-700 ring-violet-200';
    if (normalized.includes('alert') || normalized.includes('review')) return 'bg-amber-100 text-amber-800 ring-amber-200';
    if (normalized.includes('sale') || normalized.includes('done') || normalized.includes('success') || normalized.includes('paid') || normalized.includes('completed') || normalized.includes('approved') || normalized.includes('captured') || normalized.includes('settled')) return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    if (normalized.includes('pending') || normalized.includes('process') || normalized.includes('hold')) return 'bg-amber-100 text-amber-800 ring-amber-200';
    if (normalized.includes('fail') || normalized.includes('declin') || normalized.includes('reject') || normalized.includes('error')) return 'bg-rose-100 text-rose-700 ring-rose-200';
    return 'bg-purple-100 text-purple-700 ring-purple-200';
  })();
  return { label, color };
};

const Toolbar = ({
  searchInput,
  searchField,
  searchPlaceholder,
  fromDate,
  toDate,
  paymentStatus,
  onPaymentStatusChange,
  onSearchFieldChange,
  onSearchChange,
  onDateRangeChange,
  onDateClear,
  onDownload,
  downloadDisabled,
  onClearSearch,
  total,
  shown,
}) => (
  /* Two strips that collapse into one line at 1600px. This toolbar carries the
     most controls of any table page - a Sale/All/Refund segment, a field
     select, search, the date cluster and two action buttons - so it needs more
     room than the others before a single row is honest:
       >=1600     count | segment | field | search | dates | actions
       ~1100-1599 count + actions / segment + field + search + dates
       640-1099   count + actions / segment + field + search / dates
       <640       fully stacked */
  <div className="tbl-glass-toolbar is-stacked min-[1600px]:!flex-row min-[1600px]:!flex-wrap min-[1600px]:!items-center min-[1600px]:!gap-2">
    <div className="flex items-start justify-between gap-2 min-[1600px]:contents">
      <span className="order-1 inline-flex min-w-0 shrink-0 items-center gap-2 rounded-full border border-purple-100/80 bg-white/70 px-3 py-1.5 text-xs text-gray-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-300">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" aria-hidden="true" />
        <span className="truncate whitespace-nowrap">
          <strong className="font-semibold text-gray-900 dark:text-white">{shown}</strong>
          {' of '}
          <strong className="font-semibold text-gray-900 dark:text-white">{total}</strong>
          {' Payments'}
        </span>
      </span>

      <div className="order-2 flex shrink-0 items-center gap-2 min-[1600px]:order-6">
        <TableRefreshButton
          className="shrink-0 dark:text-gray-200 dark:bg-gray-800"
          title="Refresh"
        />
        <Button
          variant="outline"
          size="icon"
          className="report-download-btn"
          title="Download payments"
          onClick={onDownload}
          disabled={downloadDisabled}
        >
          <Download className={`h-4 w-4 ${downloadDisabled ? 'animate-pulse' : ''}`} />
        </Button>
      </div>
    </div>

    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2.5 min-[1600px]:contents">
      {/* ml-auto sits on the first filter so the slack on a wide screen falls
          after the count, keeping filters/dates/actions together on the right. */}
      <GlassSegmentedControl
        className="order-3 shrink-0 min-[1600px]:order-2 min-[1600px]:ml-auto"
        ariaLabel="Payment type"
        options={PAYMENT_STATUS_SEGMENTS}
        value={paymentStatus}
        onChange={onPaymentStatusChange}
      />

      <div className="order-4 w-full shrink-0 sm:w-[150px] min-[1600px]:order-3">
        <Select value={searchField} onValueChange={onSearchFieldChange}>
          <SelectTrigger className={TOOLBAR_SELECT_TRIGGER_CLASS}>
            <SelectValue placeholder="All Payments" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} className="min-w-[var(--radix-select-trigger-width)]">
            {PAYMENT_SEARCH_FIELDS.map((field) => (
              <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Small basis so it packs onto the shared line rather than forcing a
          wrap; grow then hands it the slack, capped so it can't balloon. */}
      <TableSearchField
        className="order-5 w-full min-w-0 sm:grow sm:shrink sm:basis-32 sm:max-w-[420px] min-[1600px]:order-4"
        placeholder={searchPlaceholder}
        value={searchInput}
        onChange={onSearchChange}
        onClear={onClearSearch}
      />

      {/* No `stretch`: the picker's own default already fills the row on a phone
          and collapses to content width from 640 up, which keeps the range pill
          from becoming a half-metre-wide bar on a tablet. */}
      <LiquidGlassDatePicker
        key={`payments-date-${fromDate || ''}-${toDate || ''}`}
        initialFromDate={fromDate || ''}
        initialToDate={toDate || ''}
        showQuickDateDropdown={true}
        showDayStepButtons={true}
        // The toolbar already has a refresh button, so the picker's own reset is hidden.
        showClearButton={false}
        onChange={(from, to, isSingle) => {
          if (isSingle) onDateRangeChange(from, from);
          else onDateRangeChange(from, to);
        }}
        onClear={onDateClear}
        quickDateTriggerClassName={TOOLBAR_QUICK_DATE_TRIGGER_CLASS}
        className="order-6 shrink-0 min-[1600px]:order-5"
      />
    </div>
  </div>
);

const getColumns = () => [
  {
    id: 'paymentId',
    header: 'Payment ID',
    enableSorting: false,
    meta: { headerClassName: 'w-[110px] min-w-[110px] max-w-[110px] text-center', cellClassName: 'w-[110px] min-w-[110px] max-w-[110px] text-center' },
    cell: ({ row }) => (
      <span className="text-sm font-semibold text-gray-900">{row.original.paymentId ?? '-'}</span>
    ),
  },
  {
    id: 'paymentType',
    header: 'Payment Type',
    meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
    enableSorting: false,
    cell: ({ row }) => {
      const p = row.original;
      const paymentTypeText = p.paymentType || p.cardType || 'Payment';
      const normalizedType = String(paymentTypeText).trim().toLowerCase();
      let secondaryLabel = 'Card';
      let secondaryValue = maskCardToLast4(p.cardNumber);
      if (normalizedType.includes('zelle')) {
        secondaryLabel = 'Zelle ID';
        secondaryValue = p.zelleId || '-';
      } else if (normalizedType.includes('paypal')) {
        secondaryLabel = 'PayPal ID';
        secondaryValue = p.zelleId || '-';
      } else if (normalizedType.includes('cheque') || normalizedType.includes('check')) {
        secondaryLabel = 'Cheque No';
        secondaryValue = p.chequeNo != null && p.chequeNo !== 0 ? String(p.chequeNo) : '-';
      } else if (normalizedType.includes('bank') || normalizedType.includes('wire')) {
        secondaryLabel = 'Ref';
        secondaryValue = p.transactionId || '-';
      }
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-sm text-gray-900">{paymentTypeText}</span>
          <span className="text-xs text-gray-600">{secondaryLabel}: {secondaryValue}</span>
          <span className="text-xs text-gray-600">Trans: {p.transactionId || '-'}</span>
          {p.authCode && <span className="text-xs text-gray-500">Auth: {p.authCode}</span>}
        </div>
      );
    },
  },
  {
    id: 'brandGateway',
    header: 'Brand & Gateway',
    enableSorting: false,
    meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-gray-900">{row.original.brandName || '-'}</span>
        <span className="text-xs text-gray-600">{row.original.gatewayName || '-'}</span>
      </div>
    ),
  },
  {
    id: 'status',
    header: 'Payment Status',
    enableSorting: false,
    meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
    cell: ({ row }) => {
      const { label, color } = getStatusBadge(row.original);
      return (
        <div className="flex justify-center">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${color}`}>
            {label}
          </div>
        </div>
      );
    },
  },
  {
    id: 'amount',
    header: 'Amount',
    enableSorting: false,
    meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
    cell: ({ row }) => (
      <span className="text-sm font-semibold text-gray-900">{formatCurrency(row.original.amount)}</span>
    ),
  },
    {
    id: 'paymentDate',
    header: 'Date',
    enableSorting: false,
    meta: { headerClassName: 'text-center w-72', cellClassName: 'text-center' },
    cell: ({ row }) => {
      const p = row.original;
      if (!p.paymentDate && !p.createdAt) return <span className="text-xs text-gray-500 ">-</span>;
      return (
        <div className="rounded-lg border border-gray-200 p-3 shadow-sm bg-white ">
          <div className="flex flex-col gap-2">
            {p.paymentDate && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 flex-shrink-0">
                  <CreditCard size={14} className="text-green-600" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-green-600 flex">Payment</span>
                  <span className="text-xs text-slate-700 whitespace-nowrap">{formatDateTime(p.paymentDate)}</span>
                </div>
              </div>
            )}
            {p.paymentDate && p.createdAt && <div className="border-t border-gray-200" />}
            {p.createdAt && (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-50 flex-shrink-0">
                  <CreditCard size={14} className="text-violet-500" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-violet-500 flex">Created</span>
                  <span className="text-xs text-slate-700 whitespace-nowrap">{formatDateTime(p.createdAt)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    },
  },
];

const PaymentsTable = () => {
  const { loading: permissionsLoading } = usePageCrudPermissions();

  const { loading: codesLoading, has: hasCode } = usePagePermissionCodes({ path: '/Orders/Payments' });
  const canView = !codesLoading && hasCode('View_Payments');

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchField, setSearchField] = useState('All Payments');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [uploadingRefund, setUploadingRefund] = useState(false);
  // Newest payments first: the list is sorted by payment date descending.
  const [sorting, setSorting] = useState([{ id: 'paymentDate', desc: true }]);
  const refundFileInputRef = useRef(null);
  const columns = useMemo(() => getColumns(), []);

  // Selecting a search field alone is not a query yet - see the hook.
  const skipFetchOnSearchFieldChange = useSearchFieldFetchGuard(searchField, 'All Payments');

  const escapeCsvValue = (value) => {
    if (value == null) return '';
    const normalized = String(value).replace(/\r?\n|\r/g, ' ').trim();
    if (/[",]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
  };

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const sortProp = sorting.length > 0 ? sorting[0].id : 'paymentDate';
      const isDesc = sorting.length > 0 ? sorting[0].desc : true;
      // A typed search looks across all time: the date range would otherwise hide
      // the very payment being searched for.
      const isTextSearch = !!String(searchText || '').trim();

      const result = await paymentService.getPayments({
        Text: searchText,
        SearchField: searchField === 'All Payments' ? '' : searchField,
        PaymentStatus: paymentStatus || undefined,
        FromDate: isTextSearch ? '' : (fromDate || ''),
        ToDate: isTextSearch ? '' : (toDate || ''),
        PageNumber: pageNumber,
        PageSize: pageSize,
        SortProperty: sortProp,
        IsDescending: isDesc,
      });

      setPayments(result?.data || []);
      setTotalCount(result?.totalCount ?? result?.total ?? 0);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  }, [searchText, searchField, paymentStatus, fromDate, toDate, pageNumber, pageSize, sorting]);

  useEffect(() => {
    if (permissionsLoading || codesLoading) return;
    if (!canView) {
      setPayments([]);
      setTotalCount(0);
      return;
    }
    // Picking a search field on its own is not a query yet: wait for the Text.
    if (skipFetchOnSearchFieldChange(searchText)) return;
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading, codesLoading, canView, fetchPayments]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    setSearchText(e.target.value);
    setPageNumber(1);
  }, []);

  const handleSearchFieldChange = useCallback((value) => {
    setSearchField(value || 'All Payments');
    setPageNumber(1);
  }, []);

  const handlePaymentStatusChange = useCallback((value) => {
    setPaymentStatus(value || '');
    setPageNumber(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchText('');
    setPageNumber(1);
  }, []);

  const handleDateRangeChange = useCallback((from = '', to = '') => {
    setFromDate(from || '');
    setToDate(to || '');
    setPageNumber(1);
  }, []);

  const handleDateClear = useCallback(() => {
    setFromDate('');
    setToDate('');
    setPageNumber(1);
  }, []);

  const handlePageChange = (page) => setPageNumber(page);

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setPageNumber(1);
  };

  const handleSortingChange = (newSorting) => {
    setSorting(newSorting);
    setPageNumber(1);
  };

  const handleDownload = useCallback(async () => {
    if (downloading) return;

    setDownloading(true);
    try {
      const sortProp = sorting.length > 0 ? sorting[0].id : 'paymentDate';
      const isDesc = sorting.length > 0 ? sorting[0].desc : true;
      // Keep the export aligned with what the table is showing.
      const isTextSearch = !!String(searchText || '').trim();

      let page = 1;
      let expectedTotal = 0;
      const allRows = [];
      const seen = new Set();
      const maxPages = 500;

      while (page <= maxPages) {
        const result = await paymentService.getPayments({
          Text: searchText,
          SearchField: searchField === 'All Payments' ? '' : searchField,
          PaymentStatus: paymentStatus || undefined,
          FromDate: isTextSearch ? '' : (fromDate || ''),
          ToDate: isTextSearch ? '' : (toDate || ''),
          PageNumber: page,
          PageSize: DOWNLOAD_PAGE_SIZE,
          SortProperty: sortProp,
          IsDescending: isDesc,
        });

        const pageRows = Array.isArray(result?.data) ? result.data : [];
        expectedTotal = Math.max(expectedTotal, Number(result?.totalCount) || pageRows.length);

        let added = 0;
        for (const row of pageRows) {
          const paymentId = Number(row?.paymentId) || 0;
          const key = paymentId > 0 ? `id:${paymentId}` : `row:${JSON.stringify(row)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          allRows.push(row);
          added += 1;
        }

        const isLastPage = pageRows.length < DOWNLOAD_PAGE_SIZE;
        const reachedExpected = expectedTotal > 0 && allRows.length >= expectedTotal;
        const noProgress = page > 1 && added === 0;
        if (isLastPage || reachedExpected || noProgress) break;

        page += 1;
      }

      if (!allRows.length) {
        return;
      }

      const headers = [
        'Payment ID',
        'Order ID',
        'Customer Name',
        'Payment Type',
        'Transaction Number',
        'Auth Code',
        'Brand',
        'Gateway',
        'Status',
        'Amount',
        'Payment Date',
        'Created Date',
      ];

      const rows = allRows.map((p) => {
        const status = getStatusBadge(p).label;
        return [
          p.paymentId,
          p.orderId,
          p.customerName || '',
          p.paymentType || p.cardType || '',
          p.transactionId || '',
          p.authCode || '',
          p.brandName || '',
          p.gatewayName || '',
          status,
          Number(p.amount ?? 0).toFixed(2),
          formatDateTime(p.paymentDate),
          formatDateTime(p.createdAt),
        ].map(escapeCsvValue).join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [downloading, sorting, searchText, searchField, paymentStatus, fromDate, toDate]);

  const handleUploadRefundClick = useCallback(() => {
    if (uploadingRefund) return;
    refundFileInputRef.current?.click();
  }, [uploadingRefund]);

  const handleRefundFileSelected = useCallback(async (event) => {
    const file = event?.target?.files?.[0];
    event.target.value = '';
    if (!file) return;

    const name = String(file.name || '').toLowerCase();
    const isExcel =
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (!isExcel) {
      toast.error('Please select a valid Excel file (.xlsx or .xls).');
      return;
    }

    setUploadingRefund(true);
    try {
      await paymentService.uploadRefundExcel(file);
      toast.success('Refund file uploaded successfully.');
      fetchPayments();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to upload refund file'));
    } finally {
      setUploadingRefund(false);
    }
  }, [fetchPayments]);

  return (
    <div className="payments-table-page">
      <PageHeader title="Payments" description="View and manage all payment transactions.">
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Secondary action stays the outline Button so the primary one
                keeps its contrast - same pairing the modals use. */}
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(REFUND_DEMO_FILE_PATH, '_blank', 'noopener,noreferrer')}
            >
              Demo Refund File
            </Button>
            {/* LiquidGlassButton sets its own 14px/24px padding, so the size
                is forced back to the h-10 the outline Button next to it uses. */}
            <LiquidGlassButton
              type="button"
              onClick={handleUploadRefundClick}
              disabled={uploadingRefund}
              className="!h-10 !px-4 !py-2 !text-sm text-center"
            >
              <Upload className="w-4 h-4 liquid-glass-btn__icon" />
              {uploadingRefund ? 'Uploading...' : 'Upload Refund'}
            </LiquidGlassButton>
            <input
              ref={refundFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleRefundFileSelected}
            />
          </div>

          {/* The sheet is uploaded blind - there is no per-row feedback before
              it is sent - so the one hard requirement is stated up front. */}
          <p className="inline-flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Note: Refund ID is mandatory in the uploaded file.</span>
          </p>
        </div>
      </PageHeader>

      <TableCard>

        {/* Toolbar */}
        <Toolbar
          searchInput={searchTerm}
          searchField={searchField}
          searchPlaceholder={getPaymentSearchPlaceholder(searchField)}
          fromDate={fromDate}
          toDate={toDate}
          paymentStatus={paymentStatus}
          onPaymentStatusChange={handlePaymentStatusChange}
          onSearchFieldChange={handleSearchFieldChange}
          onSearchChange={handleSearchChange}
          onDateRangeChange={handleDateRangeChange}
          onDateClear={handleDateClear}
          onDownload={handleDownload}
          downloadDisabled={downloading}
          onClearSearch={handleClearSearch}
          total={totalCount}
          shown={payments.length}
        />

        {/* Table */}
        <div className="grid">
          <CommonTable
            columns={columns}
            data={payments}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            isLoading={loading}
            emptyMessage="No payments found. Try adjusting your search."
            pageNo={pageNumber}
            pageSize={pageSize}
            total={totalCount}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      </TableCard>
    </div>
  );
};

export { PaymentsTable };


