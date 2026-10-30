import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  FlaskConical,
  History,
  Link2,
  ListFilter,
  PauseCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  X
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import gatewayService from 'services/gatewayService';
import AnchorPagination from '@/components/common/AnchorPagination';
import LiquidGlassSurface from '@/components/common/LiquidGlassSurface';
import StatCardGrid from '@/components/common/StatCards';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import GatewayTable from './components/GatewayTable';
import GatewayEditors from './components/GatewayEditors';
import GatewayTabs from './components/GatewayTabs';
import { GatewayButton, GatewayInput, GatewaySelect } from './components/GatewayUI';
import { getGatewaySummary, PAGE_SIZES, STATUS_OPTIONS } from './gatewayUtils';
import './gateway.css';

const SECTIONS = [
  { id: 'gateways', label: 'Gateways', icon: Server },
  { id: 'paymentTypes', label: 'Payment types', icon: Link2 },
  { id: 'transactions', label: 'Transactions', icon: CreditCard },
  { id: 'syncLogs', label: 'Sync logs', icon: History }
];
const SUMMARY_ICONS = {
  server: Server,
  check: CheckCircle2,
  shield: ShieldCheck,
  sandbox: FlaskConical,
  link: Link2,
  pause: PauseCircle,
  card: CreditCard,
  clock: Clock3,
  alert: AlertTriangle,
  history: History,
  plus: Plus,
  refresh: RefreshCw
};

function GatewayPagination({ page, pageSize, total, setPage, setPageSize, loading }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-col justify-between gap-4 border-t border-slate-300/30 px-5 py-4 sm:flex-row sm:items-center dark:border-white/10">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span id="gateway-page-size-label">Rows</span>
          <div className="w-[76px]">
            <GatewaySelect
              placeholder="Rows per page"
              value={pageSize}
              onChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
              disabled={loading}
              options={PAGE_SIZES.map((size) => ({ value: size, label: String(size) }))}
            />
          </div>
        </div>
        <span>
          {total ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, total)} of {total.toLocaleString()}
        </span>
      </div>
      <AnchorPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />
    </div>
  );
}

const EMPTY_GATEWAY = {
  gatewayId: 0,
  gatewayName: '',
  brandId: '',
  brandName: '',
  gatewayType: 0,
  apiBaseUrl: '',
  isActive: true,
  isSandbox: false,
  hasCredentials: false,
  apiLoginId: '',
  apiSecretKey: '',
  merchantSiteId: '',
  lastSyncedAtUtc: null
};

const EMPTY_MAPPING = {
  gatewayPaymentTypeId: 0,
  gatewayId: '',
  brandId: '',
  gatewayName: '',
  paymentTypeIds: '',
  paymentTypeName: '',
  isActive: true
};

const getSectionFromPath = (pathname) => {
  const path = pathname.toLowerCase();
  if (path.includes('transaction')) return 'transactions';
  if (path.includes('paymenttype') || path.includes('payment-type')) return 'paymentTypes';
  return 'gateways';
};

export default function GatewayPage() {
  const location = useLocation();
  const permissions = useMemo(() => resolveConfiguredPagePermissions('gateway', ['/settings/gateway', '/gateways']), []);
  const [activeSection, setActiveSection] = useState(() => getSectionFromPath(location.pathname));
  const [rows, setRows] = useState([]);
  const [gatewayOptions, setGatewayOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [brandId, setBrandId] = useState(() => new URLSearchParams(location.search).get('brandId') || '');
  const [gatewayId, setGatewayId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [normalizedStatus, setNormalizedStatus] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [showGatewayEditor, setShowGatewayEditor] = useState(false);
  const [gatewayForm, setGatewayForm] = useState(EMPTY_GATEWAY);
  const [showMappingEditor, setShowMappingEditor] = useState(false);
  const [mappingForm, setMappingForm] = useState(EMPTY_MAPPING);
  const [showSync, setShowSync] = useState(false);
  const [syncForm, setSyncForm] = useState({ brandId: '', gatewayIds: '', fromDate: '', toDate: '' });
  const [saving, setSaving] = useState(false);

  const section = SECTIONS.find((item) => item.id === activeSection) || SECTIONS[0];

  useEffect(() => {
    setActiveSection(getSectionFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const queryBrandId = new URLSearchParams(location.search).get('brandId');
    if (queryBrandId !== null) {
      setBrandId(queryBrandId);
      setPage(1);
    }
  }, [location.search]);

  useEffect(() => {
    const controller = new AbortController();
    gatewayService
      .getGatewayDropdown({ PageNumber: 1, PageSize: 1000 }, controller.signal)
      .then((response) => setGatewayOptions(response.data))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setGatewayOptions([]);
      });
    return () => controller.abort();
  }, [refreshKey]);

  const loadData = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const paging = {
          Text: searchText,
          BrandId: brandId,
          GatewayId: gatewayId,
          PageNumber: page,
          PageSize: pageSize,
          IsDescending: true
        };
        let response;
        if (activeSection === 'gateways') {
          response = await gatewayService.getGateways({ ...paging, SortProperty: 'gatewayId' }, signal);
        } else if (activeSection === 'paymentTypes') {
          response = await gatewayService.getGatewayPaymentTypes(paging, signal);
        } else if (activeSection === 'transactions') {
          response = await gatewayService.getTransactions(
            {
              ...paging,
              FromDate: fromDate,
              ToDate: toDate,
              NormalizedStatus: normalizedStatus,
              CardLast4: cardLast4,
              GatewayTransactionRef: transactionRef,
              SortProperty: 'transactionDateUtc'
            },
            signal
          );
        } else {
          response = await gatewayService.getSyncLogs({ ...paging, SortProperty: 'startedAtUtc' }, signal);
        }
        setRows(response.data);
        setTotalCount(response.totalCount);
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        setRows([]);
        setTotalCount(0);
        setError(requestError.message || 'Unable to load gateway data.');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [activeSection, brandId, cardLast4, fromDate, gatewayId, normalizedStatus, page, pageSize, searchText, toDate, transactionRef]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, refreshKey]);

  const switchSection = (nextSection) => {
    setActiveSection(nextSection);
    setRows([]);
    setPage(1);
    setSearchInput('');
    setSearchText('');
    setError('');
    setSuccess('');
  };

  const applySearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearchText(searchInput.trim());
  };

  const openGatewayEditor = (gateway = null) => {
    if (gateway ? !permissions.canUpdate : !permissions.canAdd) return;
    setGatewayForm(
      gateway
        ? {
            ...EMPTY_GATEWAY,
            ...gateway,
            gatewayName: gateway.gatewayName ?? '',
            apiBaseUrl: gateway.apiBaseUrl ?? '',
            apiLoginId: '',
            apiSecretKey: '',
            merchantSiteId: gateway.merchantSiteId ?? '',
            brandId: gateway.brandId || ''
          }
        : { ...EMPTY_GATEWAY }
    );
    setShowGatewayEditor(true);
  };

  const saveGateway = async (event) => {
    event.preventDefault();
    if (gatewayForm.gatewayId ? !permissions.canUpdate : !permissions.canAdd) return;
    setError('');
    const trimmedName = String(gatewayForm.gatewayName ?? '').trim();
    const trimmedLoginId = String(gatewayForm.apiLoginId ?? '').trim();
    const secretKey = String(gatewayForm.apiSecretKey ?? '');
    if (!trimmedName || Number(gatewayForm.brandId) <= 0) {
      setError('Gateway name and Brand ID are required.');
      return;
    }
    if ((trimmedLoginId || secretKey) && !(trimmedLoginId && secretKey)) {
      setError('API Login ID and API Secret Key must be entered together.');
      return;
    }

    const payload = {
      gatewayId: Number(gatewayForm.gatewayId) || 0,
      gatewayName: trimmedName,
      brandId: Number(gatewayForm.brandId),
      brandName: gatewayForm.brandName || '',
      gatewayType: Number(gatewayForm.gatewayType) || 0,
      apiBaseUrl: String(gatewayForm.apiBaseUrl ?? '').trim() || null,
      isActive: Boolean(gatewayForm.isActive),
      isSandbox: Boolean(gatewayForm.isSandbox),
      hasCredentials: Boolean(gatewayForm.hasCredentials),
      lastSyncedAtUtc: gatewayForm.lastSyncedAtUtc || null
    };
    if (trimmedLoginId && secretKey) {
      payload.apiLoginId = trimmedLoginId;
      payload.apiSecretKey = secretKey;
      payload.merchantSiteId = String(gatewayForm.merchantSiteId ?? '').trim();
      payload.hasCredentials = true;
    }

    setSaving(true);
    try {
      if (payload.gatewayId) await gatewayService.updateGateway(payload);
      else await gatewayService.createGateway(payload);
      setSuccess(`Gateway ${payload.gatewayId ? 'updated' : 'created'} successfully.`);
      setShowGatewayEditor(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save gateway.');
    } finally {
      setSaving(false);
    }
  };

  const removeGateway = async (gateway) => {
    if (!permissions.canDelete) return;
    if (!window.confirm(`Delete gateway “${gateway.gatewayName || gateway.gatewayId}”?`)) return;
    try {
      await gatewayService.deleteGateway(gateway.gatewayId);
      setSuccess('Gateway deleted successfully.');
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete gateway.');
    }
  };

  const openMappingEditor = (mapping = null) => {
    if (mapping ? !permissions.canUpdate : !permissions.canAdd) return;
    const paymentTypeIds = Array.isArray(mapping?.paymentTypeIds) ? mapping.paymentTypeIds.join(', ') : mapping?.paymentTypeId || '';
    setMappingForm(mapping ? { ...EMPTY_MAPPING, ...mapping, paymentTypeIds } : { ...EMPTY_MAPPING });
    setShowMappingEditor(true);
  };

  const saveMapping = async (event) => {
    event.preventDefault();
    if (mappingForm.gatewayPaymentTypeId ? !permissions.canUpdate : !permissions.canAdd) return;
    const paymentTypeIds = String(mappingForm.paymentTypeIds)
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (Number(mappingForm.gatewayId) <= 0 || !paymentTypeIds.length) {
      setError('Gateway ID and at least one Payment Type ID are required.');
      return;
    }
    const selectedGateway = gatewayOptions.find((gateway) => Number(gateway.gatewayId) === Number(mappingForm.gatewayId));
    const payload = {
      gatewayPaymentTypeId: Number(mappingForm.gatewayPaymentTypeId) || 0,
      gatewayId: Number(mappingForm.gatewayId),
      brandId: Number(mappingForm.brandId || selectedGateway?.brandId) || 0,
      gatewayName: mappingForm.gatewayName || selectedGateway?.gatewayName || '',
      paymentTypeIds,
      paymentTypeId: paymentTypeIds[0],
      paymentTypeName: mappingForm.paymentTypeName || '',
      isActive: Boolean(mappingForm.isActive)
    };
    setSaving(true);
    try {
      if (payload.gatewayPaymentTypeId) await gatewayService.updateGatewayPaymentType(payload);
      else await gatewayService.createGatewayPaymentType(payload);
      setSuccess(`Payment mapping ${payload.gatewayPaymentTypeId ? 'updated' : 'created'} successfully.`);
      setShowMappingEditor(false);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save payment mapping.');
    } finally {
      setSaving(false);
    }
  };

  const removeMapping = async (mapping) => {
    if (!permissions.canDelete) return;
    if (!window.confirm('Delete this gateway payment type mapping?')) return;
    try {
      await gatewayService.deleteGatewayPaymentType(mapping);
      setSuccess('Payment mapping deleted successfully.');
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to delete payment mapping.');
    }
  };

  const runSync = async (event) => {
    event.preventDefault();
    if (!permissions.canUpdate) return;
    if (Number(syncForm.brandId) <= 0) {
      setError('Brand ID is required to sync transactions.');
      return;
    }
    if (syncForm.fromDate && syncForm.toDate && syncForm.fromDate > syncForm.toDate) {
      setError('From date cannot be later than to date.');
      return;
    }
    setSaving(true);
    try {
      const response = await gatewayService.syncTransactions({
        ...syncForm,
        gatewayIds: syncForm.gatewayIds
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value) && value > 0)
      });
      setSuccess(response?.message || 'Gateway transactions synced successfully.');
      setShowSync(false);
      setActiveSection('syncLogs');
      setPage(1);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message || 'Unable to sync gateway transactions.');
    } finally {
      setSaving(false);
    }
  };

  const [showFilters, setShowFilters] = useState(true);
  const columns = useMemo(() => {
    if (activeSection === 'gateways') return ['Gateway', 'Brand', 'Provider', 'Connection', 'Status', 'Actions'];
    if (activeSection === 'paymentTypes') return ['Gateway', 'Brand', 'Payment types', 'Status', 'Actions'];
    if (activeSection === 'transactions') return ['Transaction', 'Gateway', 'Customer', 'Card', 'Amount', 'Status', 'Date'];
    return ['Gateway', 'Covered range', 'Run', 'Status', 'Records', 'Error'];
  }, [activeSection]);
  const hasExtendedFilters = activeSection === 'transactions' || activeSection === 'syncLogs';
  const filterCount = [
    brandId,
    gatewayId,
    ...(activeSection === 'transactions' ? [fromDate, toDate, normalizedStatus, cardLast4, transactionRef] : [])
  ].filter(Boolean).length;
  const filtered = Boolean(searchText || filterCount);
  const summaryCards = getGatewaySummary(activeSection, rows, totalCount).map((item) => ({
    ...item,
    value: Number(item.value).toLocaleString(),
    icon: SUMMARY_ICONS[item.icon],
    glass: true
  }));
  const resetFilters = () => {
    setSearchInput('');
    setSearchText('');
    setBrandId('');
    setGatewayId('');
    setFromDate('');
    setToDate('');
    setNormalizedStatus('');
    setCardLast4('');
    setTransactionRef('');
    setPage(1);
  };
  const primaryAction =
    permissions.canAdd && activeSection === 'gateways' ? (
      <GatewayButton
        variant="primary"
        icon={Plus}
        onClick={() => {
          setError('');
          openGatewayEditor();
        }}
      >
        Add gateway
      </GatewayButton>
    ) : permissions.canAdd && activeSection === 'paymentTypes' ? (
      <GatewayButton
        variant="primary"
        icon={Plus}
        onClick={() => {
          setError('');
          openMappingEditor();
        }}
      >
        Add mapping
      </GatewayButton>
    ) : permissions.canUpdate && hasExtendedFilters ? (
      <GatewayButton
        variant="primary"
        icon={RefreshCw}
        onClick={() => {
          setError('');
          setShowSync(true);
        }}
      >
        Sync transactions
      </GatewayButton>
    ) : null;

  return (
    <div className="dashboard-glass gateway-dashboard min-h-full min-w-0 w-full space-y-5 p-3 sm:p-5 lg:p-6">
      <LiquidGlassSurface as="header" className="flex flex-col gap-6 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <span className="daily-sales-glass__icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
              <CreditCard size={24} aria-hidden="true" />
            </span>
            <div>
              <h1 className="mb-0 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">Gateway dashboard</h1>
              <p className="mb-0 mt-1 text-xs text-slate-500 dark:text-slate-400">Payments & connections</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GatewayButton
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              icon={RefreshCw}
              className={loading ? 'gateway-button--busy' : ''}
            >
              Refresh
            </GatewayButton>
            {primaryAction}
          </div>
        </div>
        <GatewayTabs items={SECTIONS} value={activeSection} onChange={switchSection} />
      </LiquidGlassSurface>

      {error && !(showGatewayEditor || showMappingEditor || showSync) && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-300/40 bg-rose-50/60 p-4 text-sm text-rose-700 dark:bg-rose-950/20 dark:text-rose-300"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <GatewayButton variant="icon" aria-label="Dismiss error" onClick={() => setError('')}>
            <X size={15} />
          </GatewayButton>
        </div>
      )}
      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-50/60 p-4 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{success}</span>
          <GatewayButton variant="icon" aria-label="Dismiss confirmation" onClick={() => setSuccess('')}>
            <X size={15} />
          </GatewayButton>
        </div>
      )}

      <StatCardGrid className="gateway-summary" items={summaryCards} loading={loading} columns={4} />

      <LiquidGlassSurface as="section" allowOverflow className="relative z-20 rounded-2xl p-4 sm:p-5" aria-label="Search and filters">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form role="search" onSubmit={applySearch} className="flex min-w-0 flex-1 gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
              <input
                className="gateway-input !pl-10"
                aria-label={'Search ' + section.label.toLowerCase()}
                placeholder={'Search ' + section.label.toLowerCase()}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <GatewayButton type="submit">Search</GatewayButton>
          </form>
          <div className="flex items-center gap-2">
            {filtered && (
              <GatewayButton icon={RotateCcw} onClick={resetFilters}>
                Reset
              </GatewayButton>
            )}
            {hasExtendedFilters && (
              <GatewayButton
                icon={ListFilter}
                aria-expanded={showFilters}
                aria-controls="gateway-filters"
                onClick={() => setShowFilters((value) => !value)}
              >
                Filters{filterCount > 0 && <span className="gateway-tab-count">{filterCount}</span>}
              </GatewayButton>
            )}
          </div>
        </div>
        {hasExtendedFilters && showFilters && (
          <div
            id="gateway-filters"
            className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-300/30 pt-4 min-[430px]:grid-cols-2 lg:grid-cols-4 dark:border-white/10"
          >
            <GatewayInput
              label="Brand ID"
              type="number"
              min="1"
              placeholder="All brands"
              value={brandId}
              onChange={(event) => {
                setBrandId(event.target.value);
                setPage(1);
              }}
            />
            <GatewaySelect
              label="Gateway"
              value={gatewayId}
              onChange={(value) => {
                setGatewayId(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All gateways' },
                ...gatewayOptions.map((gateway) => ({ value: gateway.gatewayId, label: gateway.gatewayName }))
              ]}
            />
            {activeSection === 'transactions' && (
              <>
                <GatewaySelect
                  label="Status"
                  value={normalizedStatus}
                  onChange={(value) => {
                    setNormalizedStatus(value);
                    setPage(1);
                  }}
                  options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS.map(([value, label]) => ({ value, label }))]}
                />
                <GatewayInput
                  label="Card last 4"
                  inputMode="numeric"
                  placeholder="0000"
                  maxLength={4}
                  value={cardLast4}
                  onChange={(event) => {
                    setCardLast4(event.target.value.replace(/\D/g, ''));
                    setPage(1);
                  }}
                />
                <GatewayInput
                  label="From date"
                  type="date"
                  max={toDate || undefined}
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setPage(1);
                  }}
                />
                <GatewayInput
                  label="To date"
                  type="date"
                  min={fromDate || undefined}
                  value={toDate}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setPage(1);
                  }}
                />
                <GatewayInput
                  label="Transaction reference"
                  className="min-[430px]:col-span-2"
                  placeholder="Enter a reference"
                  value={transactionRef}
                  onChange={(event) => {
                    setTransactionRef(event.target.value);
                    setPage(1);
                  }}
                />
              </>
            )}
          </div>
        )}
      </LiquidGlassSurface>

      <LiquidGlassSurface as="section" id="gateway-records" aria-labelledby="gateway-records-title" className="rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <h2 id="gateway-records-title" className="mb-0 text-sm font-semibold text-slate-900 dark:text-white">
              {section.label}
            </h2>
            <span className="gateway-tab-count text-violet-700 dark:text-violet-300">{totalCount.toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400" role="status">
            {loading ? 'Loading records...' : 'Page ' + page + ' of ' + Math.max(1, Math.ceil(totalCount / pageSize))}
          </span>
        </div>
        <GatewayTable
          section={section}
          columns={columns}
          rows={rows}
          loading={loading}
          permissions={permissions}
          onEditGateway={(row) => {
            setError('');
            openGatewayEditor(row);
          }}
          onDeleteGateway={removeGateway}
          onEditMapping={(row) => {
            setError('');
            openMappingEditor(row);
          }}
          onDeleteMapping={removeMapping}
          filtered={filtered}
          onReset={resetFilters}
          emptyAction={primaryAction}
        />
        <GatewayPagination
          page={page}
          pageSize={pageSize}
          total={totalCount}
          setPage={setPage}
          setPageSize={setPageSize}
          loading={loading}
        />
      </LiquidGlassSurface>

      <GatewayEditors
        gateway={{
          open: showGatewayEditor,
          close: () => setShowGatewayEditor(false),
          save: saveGateway,
          form: gatewayForm,
          setForm: setGatewayForm
        }}
        mapping={{
          open: showMappingEditor,
          close: () => setShowMappingEditor(false),
          save: saveMapping,
          form: mappingForm,
          setForm: setMappingForm
        }}
        sync={{ open: showSync, close: () => setShowSync(false), save: runSync, form: syncForm, setForm: setSyncForm }}
        gatewayOptions={gatewayOptions}
        saving={saving}
        error={error}
      />
    </div>
  );
}
