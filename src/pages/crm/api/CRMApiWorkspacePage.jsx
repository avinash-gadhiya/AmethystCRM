import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Code2, Database, Layers, Search, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import ApiDataViewer from './components/ApiDataViewer';
import ApiOperationCard from './components/ApiOperationCard';
import ApiRequestModal from './components/ApiRequestModal';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner } from 'components/ui/Bootstrap';
import { humanizeKey, unwrapApiPayload } from '@/lib/apiData';
import { CRM_API_MODULES, getApiModule } from 'services/catalog/crmApiCatalog';
import { apiClient } from 'services/core/apiClient';

const PATH_MODULES = {
  newleads: 'Lead',
  leads: 'Lead',
  bkleads: 'BlueCoreContact',
  leadscheduler: 'LeadScheduler',
  leadsreports: 'LeadReport',
  payments: 'Payment',
  systemlogs: 'Login',
  apiexplorer: 'AttendanceReport'
};

const defaultParams = () => {
  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    PageNumber: 1,
    PageSize: 5,
    SortProperty: '',
    IsDescending: true,
    FromDate: fromDate.toISOString(),
    ToDate: today.toISOString()
  };
};

const payloadCount = (payload) => {
  const { rows, summary } = unwrapApiPayload(payload);
  return rows.length || (summary ? 1 : 0);
};

const endpointLabel = (module, entry) => {
  const segments = entry.path.split('/').filter(Boolean);
  return segments.length > 1 ? humanizeKey(segments[segments.length - 1]) : `All ${humanizeKey(module.name)}`;
};

const resolveInitialModule = (moduleName, pathname) => {
  const routeKey = pathname.split('/').filter(Boolean)[0]?.toLowerCase() || '';
  const moduleKey = String(moduleName || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  return getApiModule(PATH_MODULES[moduleKey] || moduleName || PATH_MODULES[routeKey] || routeKey);
};

export default function CRMApiWorkspacePage({ moduleName }) {
  const location = useLocation();
  const initialModule = useMemo(() => resolveInitialModule(moduleName, location.pathname), [moduleName, location.pathname]);
  const [selectedModuleId, setSelectedModuleId] = useState(initialModule.id);
  const [activeEndpointId, setActiveEndpointId] = useState('');
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [busyIds, setBusyIds] = useState([]);
  const [results, setResults] = useState({});
  const [testingAll, setTestingAll] = useState(false);
  const [notice, setNotice] = useState('');
  const [activeOperation, setActiveOperation] = useState(null);

  const selectedModule = CRM_API_MODULES.find((item) => item.id === selectedModuleId) || initialModule;
  const dataEndpoints = useMemo(() => selectedModule.operations.filter((item) => item.safeRead), [selectedModule]);
  const activeEndpoint = dataEndpoints.find((item) => item.id === activeEndpointId) || dataEndpoints[0];
  const visibleOperations = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return selectedModule.operations.filter((item) => !query || `${item.method} ${item.path}`.toLowerCase().includes(query));
  }, [searchText, selectedModule]);

  const selectModule = (id) => {
    setSelectedModuleId(id);
    setActiveEndpointId('');
    setSearchText('');
    setNotice('');
  };

  const runRead = async (entry) => {
    if (!entry.safeRead) return;
    setBusyIds((current) => [...current, entry.id]);
    try {
      const payload = await apiClient.get(entry.path, defaultParams());
      setResults((current) => ({ ...current, [entry.id]: { ok: true, count: payloadCount(payload) } }));
    } catch (error) {
      setResults((current) => ({ ...current, [entry.id]: { ok: false, count: 0, message: error.message || 'Request failed' } }));
    } finally {
      setBusyIds((current) => current.filter((id) => id !== entry.id));
    }
  };

  const testModuleReads = async () => {
    setTestingAll(true);
    setNotice('');
    const nextResults = {};
    const queue = [...dataEndpoints];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const entry = queue.shift();
        try {
          const payload = await apiClient.get(entry.path, defaultParams());
          nextResults[entry.id] = { ok: true, count: payloadCount(payload) };
        } catch (error) {
          nextResults[entry.id] = { ok: false, count: 0, message: error.message || 'Request failed' };
        }
      }
    });
    await Promise.all(workers);
    setResults((current) => ({ ...current, ...nextResults }));
    const connected = Object.values(nextResults).filter((item) => item.ok).length;
    setNotice(`${connected}/${dataEndpoints.length} read endpoints responded for ${humanizeKey(selectedModule.name)}.`);
    setTestingAll(false);
  };

  const moduleResults = selectedModule.operations.map((item) => results[item.id]).filter(Boolean);
  const connectedCount = moduleResults.filter((item) => item.ok).length;

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <Card.Body className="d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3 min-w-0">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300 flex-shrink-0">
              <Database size={20} />
            </span>
            <div className="min-w-0">
              <h5 className="mb-0 fw-semibold">{humanizeKey(selectedModule.name)}</h5>
              <span className="text-muted small">Live data from the CRM API</span>
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-end gap-3">
            <div className="d-flex gap-2">
              <Badge bg="primary" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                <Layers size={13} /> {dataEndpoints.length} data views
              </Badge>
              <Badge bg="success" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                <ShieldCheck size={13} /> {selectedModule.operations.length} operations
              </Badge>
            </div>
            <div style={{ minWidth: 220 }}>
              <Form.Label htmlFor="crm-api-module">Module</Form.Label>
              <Form.Select id="crm-api-module" value={selectedModule.id} onChange={(event) => selectModule(event.target.value)}>
                {CRM_API_MODULES.map((item) => (
                  <option value={item.id} key={item.id}>
                    {humanizeKey(item.name)}
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          {dataEndpoints.length > 0 ? (
            <>
              {dataEndpoints.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Data views">
                  {dataEndpoints.map((entry) => {
                    const active = entry.id === activeEndpoint?.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveEndpointId(entry.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          active
                            ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                            : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-purple-300 hover:text-purple-700'
                        }`}
                      >
                        {endpointLabel(selectedModule, entry)}
                      </button>
                    );
                  })}
                </div>
              )}
              {activeEndpoint && (
                <ApiDataViewer key={activeEndpoint.id} operation={activeEndpoint} title={endpointLabel(selectedModule, activeEndpoint)} />
              )}
            </>
          ) : (
            <Alert variant="info" className="mb-0">
              {humanizeKey(selectedModule.name)} has no list endpoints that can be loaded without parameters. Use the developer tools below to
              call an operation with an ID or request body.
            </Alert>
          )}
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <button
          type="button"
          onClick={() => setShowDeveloper((value) => !value)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-transparent border-0 text-left"
          aria-expanded={showDeveloper}
        >
          <span className="d-flex align-items-center gap-2">
            <Code2 size={16} className="text-purple-600" />
            <span className="fw-semibold">Developer tools</span>
            <span className="small text-muted">All {selectedModule.operations.length} operations · run, test or configure requests</span>
          </span>
          {showDeveloper ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showDeveloper && (
          <Card.Body className="border-top">
            <Row className="g-3 align-items-end mb-3">
              <Col md={7} lg={8}>
                <Form.Label htmlFor="crm-api-search">Find operation</Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <Search size={15} />
                  </InputGroup.Text>
                  <Form.Control
                    id="crm-api-search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="GET, POST or endpoint path"
                  />
                </InputGroup>
              </Col>
              <Col md={5} lg={4}>
                <Button
                  className="w-100 d-inline-flex align-items-center justify-content-center gap-2"
                  disabled={testingAll || dataEndpoints.length === 0}
                  onClick={testModuleReads}
                >
                  {testingAll ? <Spinner size="sm" /> : <Activity size={15} />}Test read endpoints
                  {moduleResults.length > 0 && ` (${connectedCount}/${dataEndpoints.length})`}
                </Button>
              </Col>
            </Row>
            {notice && (
              <Alert variant="info" className="mb-3">
                {notice}
              </Alert>
            )}
            <Row className="g-3">
              {visibleOperations.map((entry) => (
                <Col md={6} xl={4} key={entry.id}>
                  <ApiOperationCard
                    operation={entry}
                    busy={busyIds.includes(entry.id)}
                    result={results[entry.id]}
                    onRun={runRead}
                    onOpen={setActiveOperation}
                  />
                </Col>
              ))}
            </Row>
            {visibleOperations.length === 0 && (
              <Alert variant="info" className="mt-3 mb-0">
                No operations match your search.
              </Alert>
            )}
          </Card.Body>
        )}
      </Card>

      {activeOperation && (
        <ApiRequestModal key={activeOperation.id} operation={activeOperation} show onHide={() => setActiveOperation(null)} />
      )}
    </div>
  );
}

CRMApiWorkspacePage.propTypes = { moduleName: PropTypes.string };
