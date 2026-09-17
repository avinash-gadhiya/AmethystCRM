import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'components/ui/Bootstrap';
import { CreditCard, History, Link2, Pencil, Plus, RefreshCw, Search, Server, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import gatewayService from 'services/gatewayService';

const PAGE_SIZES = [10, 25, 50];
const GATEWAY_TYPES = [
  { value: 0, label: 'Unknown' },
  { value: 1, label: 'Authorize.Net' },
  { value: 2, label: 'NMI' },
  { value: 3, label: 'Nuvei' }
];
const STATUS_OPTIONS = [
  [0, 'Unknown'],
  [1, 'Pending'],
  [2, 'Authorized'],
  [3, 'Settled'],
  [4, 'Declined'],
  [5, 'Voided'],
  [6, 'Refunded'],
  [7, 'Chargeback'],
  [8, 'Error']
];
const SECTIONS = [
  { id: 'gateways', label: 'Gateways', icon: Server, endpoint: '/Gateway' },
  { id: 'paymentTypes', label: 'Payment Types', icon: Link2, endpoint: '/GatewayPaymentType' },
  { id: 'transactions', label: 'Transactions', icon: CreditCard, endpoint: '/GatewayTransaction' },
  { id: 'syncLogs', label: 'Sync Logs', icon: History, endpoint: '/GatewayTransaction/SyncLog' }
];

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

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const formatMoney = (value, currency = 'USD') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  try {
    return amount.toLocaleString(undefined, { style: 'currency', currency: currency || 'USD' });
  } catch {
    return `${amount.toLocaleString()} ${currency || ''}`.trim();
  }
};

const statusVariant = (status) => {
  const value = String(status || '').toLowerCase();
  if (/(settle|success|capture|paid|complete)/.test(value)) return 'success';
  if (/(pending|author|running|process)/.test(value)) return 'warning';
  if (/(declin|fail|error|charge)/.test(value)) return 'danger';
  if (/(refund|void|cancel)/.test(value)) return 'info';
  return 'secondary';
};

const getGatewayType = (value) => GATEWAY_TYPES.find((item) => item.value === Number(value))?.label || `Type ${value}`;
const getNormalizedStatus = (row) =>
  row?.transactionStatus || STATUS_OPTIONS.find(([value]) => value === Number(row?.normalizedStatus))?.[1] || 'Unknown';

const Pagination = ({ page, pageSize, total, setPage, setPageSize }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <Card.Footer className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3">
      <span className="small text-muted">
        Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="d-flex align-items-center gap-2">
        <Form.Select
          size="sm"
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}
          style={{ width: 85 }}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size}>{size}</option>
          ))}
        </Form.Select>
        <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <span className="small text-nowrap">{page} / {totalPages}</span>
        <Button size="sm" variant="outline-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </Card.Footer>
  );
};

export default function GatewayPage() {
  const location = useLocation();
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
  const [brandId, setBrandId] = useState('');
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
    setGatewayForm(
      gateway
        ? { ...EMPTY_GATEWAY, ...gateway, apiSecretKey: '', brandId: gateway.brandId || '' }
        : { ...EMPTY_GATEWAY }
    );
    setShowGatewayEditor(true);
  };

  const saveGateway = async (event) => {
    event.preventDefault();
    setError('');
    if (!gatewayForm.gatewayName.trim() || Number(gatewayForm.brandId) <= 0) {
      setError('Gateway name and Brand ID are required.');
      return;
    }
    if ((gatewayForm.apiLoginId || gatewayForm.apiSecretKey) && !(gatewayForm.apiLoginId && gatewayForm.apiSecretKey)) {
      setError('API Login ID and API Secret Key must be entered together.');
      return;
    }

    const payload = {
      gatewayId: Number(gatewayForm.gatewayId) || 0,
      gatewayName: gatewayForm.gatewayName.trim(),
      brandId: Number(gatewayForm.brandId),
      brandName: gatewayForm.brandName || '',
      gatewayType: Number(gatewayForm.gatewayType) || 0,
      apiBaseUrl: gatewayForm.apiBaseUrl.trim() || null,
      isActive: Boolean(gatewayForm.isActive),
      isSandbox: Boolean(gatewayForm.isSandbox),
      hasCredentials: Boolean(gatewayForm.hasCredentials),
      lastSyncedAtUtc: gatewayForm.lastSyncedAtUtc || null
    };
    if (gatewayForm.apiLoginId && gatewayForm.apiSecretKey) {
      payload.apiLoginId = gatewayForm.apiLoginId.trim();
      payload.apiSecretKey = gatewayForm.apiSecretKey;
      payload.merchantSiteId = gatewayForm.merchantSiteId.trim();
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
    const paymentTypeIds = Array.isArray(mapping?.paymentTypeIds)
      ? mapping.paymentTypeIds.join(', ')
      : mapping?.paymentTypeId || '';
    setMappingForm(mapping ? { ...EMPTY_MAPPING, ...mapping, paymentTypeIds } : { ...EMPTY_MAPPING });
    setShowMappingEditor(true);
  };

  const saveMapping = async (event) => {
    event.preventDefault();
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

  const columns = useMemo(() => {
    if (activeSection === 'gateways') return ['Gateway', 'Brand', 'Type', 'API / Credentials', 'Status', 'Actions'];
    if (activeSection === 'paymentTypes') return ['Gateway', 'Brand', 'Payment Types', 'Status', 'Actions'];
    if (activeSection === 'transactions') return ['Transaction', 'Gateway', 'Customer', 'Card', 'Amount', 'Status', 'Date'];
    return ['Gateway', 'Covered Range', 'Run', 'Status', 'Records', 'Error'];
  }, [activeSection]);

  return (
    <div>
      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
          <div>
            <h5 className="mb-1 fw-semibold">Gateway Management</h5>
            <span className="small text-muted">Configure gateways, payment mappings, transactions and synchronization</span>
          </div>
          <Badge bg="light" text="dark" className="border px-3 py-2">
            {section.endpoint}
          </Badge>
        </Card.Header>
        <Card.Body>
          <div className="d-flex flex-wrap gap-2">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <Button key={id} size="sm" variant={activeSection === id ? 'primary' : 'outline-primary'} onClick={() => switchSection(id)}>
                <Icon size={15} className="me-2" />
                {label}
              </Button>
            ))}
          </div>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-transparent py-3">
          <Row className="g-2 align-items-end">
            <Col md={4} xl={3}>
              <Form onSubmit={applySearch}>
                <InputGroup>
                  <InputGroup.Text><Search size={16} /></InputGroup.Text>
                  <Form.Control placeholder={`Search ${section.label.toLowerCase()}`} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
                  <Button type="submit" variant="outline-secondary">Search</Button>
                </InputGroup>
              </Form>
            </Col>
            {(activeSection === 'transactions' || activeSection === 'syncLogs') && (
              <>
                <Col sm={4} xl={2}>
                  <Form.Control type="number" min="1" placeholder="Brand ID" value={brandId} onChange={(event) => { setBrandId(event.target.value); setPage(1); }} />
                </Col>
                <Col sm={4} xl={2}>
                  <Form.Select value={gatewayId} onChange={(event) => { setGatewayId(event.target.value); setPage(1); }}>
                    <option value="">All gateways</option>
                    {gatewayOptions.map((gateway) => <option key={gateway.gatewayId} value={gateway.gatewayId}>{gateway.gatewayName || `Gateway ${gateway.gatewayId}`}</option>)}
                  </Form.Select>
                </Col>
              </>
            )}
            {activeSection === 'transactions' && (
              <>
                <Col sm={4} xl={2}><Form.Control type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} /></Col>
                <Col sm={4} xl={2}><Form.Control type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} /></Col>
                <Col sm={4} xl={2}>
                  <Form.Select value={normalizedStatus} onChange={(event) => { setNormalizedStatus(event.target.value); setPage(1); }}>
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Form.Select>
                </Col>
                <Col sm={4} xl={2}><Form.Control placeholder="Card last 4" value={cardLast4} maxLength={4} onChange={(event) => { setCardLast4(event.target.value.replace(/\D/g, '')); setPage(1); }} /></Col>
                <Col sm={8} xl={3}><Form.Control placeholder="Transaction reference" value={transactionRef} onChange={(event) => { setTransactionRef(event.target.value); setPage(1); }} /></Col>
              </>
            )}
            <Col className="d-flex justify-content-end gap-2">
              <Button variant="outline-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={16} /></Button>
              {activeSection === 'gateways' && <Button onClick={() => openGatewayEditor()}><Plus size={16} className="me-2" />Add Gateway</Button>}
              {activeSection === 'paymentTypes' && <Button onClick={() => openMappingEditor()}><Plus size={16} className="me-2" />Add Mapping</Button>}
              {(activeSection === 'transactions' || activeSection === 'syncLogs') && <Button onClick={() => setShowSync(true)}><RefreshCw size={16} className="me-2" />Sync</Button>}
            </Col>
          </Row>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="table-light"><tr>{columns.map((column) => <th key={column} className="text-nowrap px-3 py-3">{column}</th>)}</tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={columns.length} className="text-center py-5"><Spinner size="sm" className="me-2" />Loading {section.label.toLowerCase()}...</td></tr>
                ) : !rows.length ? (
                  <tr><td colSpan={columns.length} className="text-center text-muted py-5">No {section.label.toLowerCase()} found.</td></tr>
                ) : activeSection === 'gateways' ? rows.map((gateway) => (
                  <tr key={gateway.gatewayId}>
                    <td className="px-3"><div className="fw-semibold">{gateway.gatewayName || '-'}</div><small className="text-muted">ID {gateway.gatewayId}</small></td>
                    <td className="px-3">{gateway.brandName || gateway.brandId || '-'}</td>
                    <td className="px-3">{getGatewayType(gateway.gatewayType)}{gateway.isSandbox && <Badge bg="warning" text="dark" className="ms-2">Sandbox</Badge>}</td>
                    <td className="px-3"><div>{gateway.apiBaseUrl || '-'}</div><small className="text-muted">{gateway.hasCredentials ? 'Credentials configured' : 'No credentials'}</small></td>
                    <td className="px-3"><Badge bg={gateway.isActive ? 'success' : 'secondary'}>{gateway.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-3 text-nowrap"><Button size="sm" variant="outline-primary" className="me-2" onClick={() => openGatewayEditor(gateway)}><Pencil size={14} /></Button><Button size="sm" variant="outline-danger" onClick={() => removeGateway(gateway)}><Trash2 size={14} /></Button></td>
                  </tr>
                )) : activeSection === 'paymentTypes' ? rows.map((mapping, index) => (
                  <tr key={mapping.gatewayPaymentTypeId || `${mapping.gatewayId}-${index}`}>
                    <td className="px-3"><div className="fw-semibold">{mapping.gatewayName || `Gateway ${mapping.gatewayId}`}</div><small className="text-muted">ID {mapping.gatewayId}</small></td>
                    <td className="px-3">{mapping.brandName || mapping.brandId || '-'}</td>
                    <td className="px-3">{mapping.paymentTypeName || (Array.isArray(mapping.paymentTypeIds) ? mapping.paymentTypeIds.join(', ') : mapping.paymentTypeId) || '-'}</td>
                    <td className="px-3"><Badge bg={mapping.isActive !== false ? 'success' : 'secondary'}>{mapping.isActive !== false ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-3 text-nowrap"><Button size="sm" variant="outline-primary" className="me-2" onClick={() => openMappingEditor(mapping)}><Pencil size={14} /></Button><Button size="sm" variant="outline-danger" onClick={() => removeMapping(mapping)}><Trash2 size={14} /></Button></td>
                  </tr>
                )) : activeSection === 'transactions' ? rows.map((transaction, index) => {
                  const customerName = transaction.customerName || [transaction.customerFirstName, transaction.customerLastName].filter(Boolean).join(' ');
                  const status = getNormalizedStatus(transaction);
                  return (
                    <tr key={transaction.gatewayTransactionId || index}>
                      <td className="px-3"><div className="fw-semibold">{transaction.gatewayTransactionRef || '-'}</div><small className="text-muted">Order {transaction.orderId || '-'}</small></td>
                      <td className="px-3"><div>{transaction.gatewayName || `Gateway ${transaction.gatewayId}`}</div><small className="text-muted">Brand {transaction.brandId || '-'}</small></td>
                      <td className="px-3">{customerName || '-'}</td>
                      <td className="px-3">{transaction.cardLast4 ? `•••• ${transaction.cardLast4}` : '-'}</td>
                      <td className="px-3">{formatMoney(transaction.amount, transaction.currency)}</td>
                      <td className="px-3"><Badge bg={statusVariant(status)}>{status}</Badge></td>
                      <td className="px-3 text-nowrap">{formatDateTime(transaction.transactionDateUtc)}</td>
                    </tr>
                  );
                }) : rows.map((log, index) => (
                  <tr key={log.gatewaySyncLogId || index}>
                    <td className="px-3"><div className="fw-semibold">{log.gatewayName || `Gateway ${log.gatewayId}`}</div><small className="text-muted">Brand {log.brandName || log.brandId || '-'}</small></td>
                    <td className="px-3 text-nowrap">{formatDateTime(log.fromDateUtc)}<br /><small className="text-muted">to {formatDateTime(log.toDateUtc)}</small></td>
                    <td className="px-3 text-nowrap">{formatDateTime(log.startedAtUtc)}<br /><small className="text-muted">Completed {formatDateTime(log.completedAtUtc)}</small></td>
                    <td className="px-3"><Badge bg={statusVariant(log.status)}>{log.status || 'Unknown'}</Badge></td>
                    <td className="px-3"><div>{Number(log.fetchedCount) || 0} fetched</div><small className="text-muted">{Number(log.insertedCount) || 0} new · {Number(log.updatedCount) || 0} updated</small></td>
                    <td className="px-3 text-danger" title={log.errorMessage || ''}>{log.errorMessage || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
        <Pagination page={page} pageSize={pageSize} total={totalCount} setPage={setPage} setPageSize={setPageSize} />
      </Card>

      <Modal show={showGatewayEditor} onHide={() => !saving && setShowGatewayEditor(false)} size="lg" centered>
        <Form onSubmit={saveGateway}>
          <Modal.Header closeButton><Modal.Title>{gatewayForm.gatewayId ? 'Edit Gateway' : 'Add Gateway'}</Modal.Title></Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={8}><Form.Label>Gateway name</Form.Label><Form.Control required value={gatewayForm.gatewayName} onChange={(event) => setGatewayForm((current) => ({ ...current, gatewayName: event.target.value }))} /></Col>
              <Col md={4}><Form.Label>Brand ID</Form.Label><Form.Control required type="number" min="1" value={gatewayForm.brandId} onChange={(event) => setGatewayForm((current) => ({ ...current, brandId: event.target.value }))} /></Col>
              <Col md={6}><Form.Label>Gateway type</Form.Label><Form.Select value={gatewayForm.gatewayType} onChange={(event) => setGatewayForm((current) => ({ ...current, gatewayType: event.target.value }))}>{GATEWAY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</Form.Select></Col>
              <Col md={6}><Form.Label>API base URL</Form.Label><Form.Control type="url" value={gatewayForm.apiBaseUrl || ''} onChange={(event) => setGatewayForm((current) => ({ ...current, apiBaseUrl: event.target.value }))} /></Col>
              <Col md={6}><Form.Label>API Login ID</Form.Label><Form.Control autoComplete="off" value={gatewayForm.apiLoginId || ''} onChange={(event) => setGatewayForm((current) => ({ ...current, apiLoginId: event.target.value }))} /></Col>
              <Col md={6}><Form.Label>API Secret Key</Form.Label><Form.Control type="password" autoComplete="new-password" placeholder={gatewayForm.hasCredentials ? 'Leave blank to keep existing secret' : ''} value={gatewayForm.apiSecretKey || ''} onChange={(event) => setGatewayForm((current) => ({ ...current, apiSecretKey: event.target.value }))} /></Col>
              <Col md={6}><Form.Label>Merchant Site ID</Form.Label><Form.Control value={gatewayForm.merchantSiteId || ''} onChange={(event) => setGatewayForm((current) => ({ ...current, merchantSiteId: event.target.value }))} /></Col>
              <Col md={6} className="d-flex align-items-end gap-4 pb-2"><Form.Check label="Active" checked={gatewayForm.isActive} onChange={(event) => setGatewayForm((current) => ({ ...current, isActive: event.target.checked }))} /><Form.Check label="Sandbox" checked={gatewayForm.isSandbox} onChange={(event) => setGatewayForm((current) => ({ ...current, isSandbox: event.target.checked }))} /></Col>
            </Row>
          </Modal.Body>
          <Modal.Footer><Button variant="outline-secondary" onClick={() => setShowGatewayEditor(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Gateway'}</Button></Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showMappingEditor} onHide={() => !saving && setShowMappingEditor(false)} centered>
        <Form onSubmit={saveMapping}>
          <Modal.Header closeButton><Modal.Title>{mappingForm.gatewayPaymentTypeId ? 'Edit Payment Mapping' : 'Add Payment Mapping'}</Modal.Title></Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col xs={12}><Form.Label>Gateway</Form.Label><Form.Select required value={mappingForm.gatewayId} onChange={(event) => setMappingForm((current) => ({ ...current, gatewayId: event.target.value }))}><option value="">Select gateway</option>{gatewayOptions.map((gateway) => <option key={gateway.gatewayId} value={gateway.gatewayId}>{gateway.gatewayName || `Gateway ${gateway.gatewayId}`}</option>)}</Form.Select></Col>
              <Col xs={12}><Form.Label>Payment Type IDs</Form.Label><Form.Control required placeholder="Example: 1, 2, 3" value={mappingForm.paymentTypeIds} onChange={(event) => setMappingForm((current) => ({ ...current, paymentTypeIds: event.target.value }))} /><Form.Text>Enter one or more IDs separated by commas.</Form.Text></Col>
              <Col xs={12}><Form.Label>Payment type name</Form.Label><Form.Control value={mappingForm.paymentTypeName || ''} onChange={(event) => setMappingForm((current) => ({ ...current, paymentTypeName: event.target.value }))} /></Col>
              <Col xs={12}><Form.Check label="Active" checked={mappingForm.isActive} onChange={(event) => setMappingForm((current) => ({ ...current, isActive: event.target.checked }))} /></Col>
            </Row>
          </Modal.Body>
          <Modal.Footer><Button variant="outline-secondary" onClick={() => setShowMappingEditor(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Mapping'}</Button></Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showSync} onHide={() => !saving && setShowSync(false)} centered>
        <Form onSubmit={runSync}>
          <Modal.Header closeButton><Modal.Title>Sync Gateway Transactions</Modal.Title></Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col xs={12}><Form.Label>Brand ID</Form.Label><Form.Control required type="number" min="1" value={syncForm.brandId} onChange={(event) => setSyncForm((current) => ({ ...current, brandId: event.target.value }))} /></Col>
              <Col xs={12}><Form.Label>Gateway IDs</Form.Label><Form.Control placeholder="Leave empty to sync every gateway; or enter 1, 2" value={syncForm.gatewayIds} onChange={(event) => setSyncForm((current) => ({ ...current, gatewayIds: event.target.value }))} /></Col>
              <Col sm={6}><Form.Label>From date</Form.Label><Form.Control type="date" value={syncForm.fromDate} onChange={(event) => setSyncForm((current) => ({ ...current, fromDate: event.target.value }))} /></Col>
              <Col sm={6}><Form.Label>To date</Form.Label><Form.Control type="date" value={syncForm.toDate} onChange={(event) => setSyncForm((current) => ({ ...current, toDate: event.target.value }))} /></Col>
            </Row>
          </Modal.Body>
          <Modal.Footer><Button variant="outline-secondary" onClick={() => setShowSync(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}><RefreshCw size={16} className="me-2" />{saving ? 'Syncing...' : 'Start Sync'}</Button></Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
