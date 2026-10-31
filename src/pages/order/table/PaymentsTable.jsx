import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Clock3, Download, Loader2, TriangleAlert, Upload } from 'lucide-react';
import { format } from 'date-fns';
import CommonTable from '@/components/common/CommonTable';
import { paymentService } from '@/services';
import { getApiErrorMessage } from '@/lib/apiError';
import { isCardPayment } from '@/lib/paymentMethod';
import { toAbsoluteUrl } from '@/utils/Assets';
import { usePageCrudPermissions } from '@/hooks/usePageCrudPermissions';
import usePagePermissionCodes from '@/hooks/usePagePermissionCodes';
import { useSearchFieldFetchGuard } from '@/hooks/useSearchFieldFetchGuard';
import { TableCard, PageHeader } from '@/components/common/page-card';
import { Button } from '@/components/ui/button';
import PaymentsToolbar from './PaymentsToolbar';
import './PaymentsTable.css';
import { toast } from 'sonner';

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
    label = parts.join(' • ');
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
    meta: { headerClassName: 'text-left', cellClassName: 'text-left' },
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
        <div className="payments-method flex flex-col gap-0.5">
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
    meta: { headerClassName: 'text-left', cellClassName: 'text-left' },
    cell: ({ row }) => (
      <div className="payments-brand flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-gray-900">{row.original.brandName || '-'}</span>
        {isCardPayment(row.original.paymentType) && row.original.gatewayName && (
          <span className="text-xs text-gray-600">{row.original.gatewayName}</span>
        )}
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
    meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums whitespace-nowrap' },
    cell: ({ row }) => (
      <span className="text-sm font-semibold text-gray-900">{formatCurrency(row.original.amount)}</span>
    ),
  },
  {
    id: 'paymentDate',
    header: 'Date',
    enableSorting: false,
    meta: { headerClassName: 'text-left w-80', cellClassName: 'text-left' },
    cell: ({ row }) => {
      const p = row.original;
      if (!p.paymentDate && !p.createdAt) return <span className="text-xs text-gray-500 ">-</span>;
      return (
        <div className="payments-date">
            {p.paymentDate && (
              <div className="payments-date__row">
                <span className="payments-date__icon bg-green-100 text-green-600"><CreditCard size={13} aria-hidden="true" /></span>
                <span className="font-medium text-green-700">Payment</span>
                <time dateTime={p.paymentDate}>{formatDateTime(p.paymentDate)}</time>
              </div>
            )}
            {p.createdAt && (
              <div className="payments-date__row">
                <span className="payments-date__icon bg-violet-50 text-violet-500"><Clock3 size={13} aria-hidden="true" /></span>
                <span className="font-medium text-violet-600">Created</span>
                <time dateTime={p.createdAt}>{formatDateTime(p.createdAt)}</time>
              </div>
            )}
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
  const fetchSeqRef = useRef(0);
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
    const seq = ++fetchSeqRef.current;
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

      if (seq !== fetchSeqRef.current) return;
      setPayments(result?.data || []);
      setTotalCount(result?.totalCount ?? result?.total ?? 0);
    } catch (error) {
      if (seq !== fetchSeqRef.current) return;
      console.error('Failed to fetch payments:', error);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  }, [searchText, searchField, paymentStatus, fromDate, toDate, pageNumber, pageSize, sorting]);

  useEffect(() => {
    const next = searchTerm.trim();
    if (next === searchText) return undefined;
    const timer = window.setTimeout(() => {
      setPageNumber(1);
      setSearchText(next);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchTerm, searchText]);

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
          isCardPayment(p.paymentType) ? p.gatewayName || '' : '',
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
        <div className="payments-header-actions">
          <div className="payments-header-buttons">
            <Button
              type="button"
              variant="outline"
              className="payments-action-button"
              onClick={() => window.open(toAbsoluteUrl(REFUND_DEMO_FILE_PATH), '_blank', 'noopener,noreferrer')}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Demo Refund File
            </Button>
            <Button
              type="button"
              onClick={handleUploadRefundClick}
              disabled={uploadingRefund}
              className="payments-action-button payments-upload-button"
              aria-busy={uploadingRefund || undefined}
            >
              {uploadingRefund ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              {uploadingRefund ? 'Uploading...' : 'Upload Refund'}
            </Button>
            <input
              ref={refundFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleRefundFileSelected}
            />
          </div>

          <p className="payments-upload-note">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Note: Refund ID is mandatory in the uploaded file.</span>
          </p>
        </div>
      </PageHeader>

      <TableCard className="payments-list-card">

        {/* Toolbar */}
        <PaymentsToolbar
          searchInput={searchTerm}
          searchField={searchField}
          searchFields={PAYMENT_SEARCH_FIELDS}
          searchPlaceholder={getPaymentSearchPlaceholder(searchField)}
          fromDate={fromDate}
          toDate={toDate}
          paymentStatus={paymentStatus}
          onPaymentStatusChange={handlePaymentStatusChange}
          onSearchFieldChange={handleSearchFieldChange}
          onSearchChange={handleSearchChange}
          onDateRangeChange={handleDateRangeChange}
          onDateClear={handleDateClear}
          onRefresh={fetchPayments}
          loading={loading}
          onDownload={handleDownload}
          downloadDisabled={downloading}
          onClearSearch={handleClearSearch}
          total={totalCount}
          shown={payments.length}
        />

        {/* Table */}
        <div className="grid min-w-0 grid-cols-1">
          <CommonTable
            containerClassName="payments-table-container"
            tableClassName="payments-data-table"
            rowKey="paymentId"
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


