import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import { Activity, Database, Search, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import ApiOperationCard from 'components/api/ApiOperationCard';
import ApiRequestModal from 'components/api/ApiRequestModal';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner } from 'components/ui/Bootstrap';
import { CRM_API_MODULES, CRM_API_OPERATIONS, getApiModule } from 'services/catalog/crmApiCatalog';
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
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data.length;
  for (const key of ['items', 'rows', 'users', 'result']) if (Array.isArray(data?.[key])) return data[key].length;
  return data ? 1 : 0;
};

export default function CRMApiWorkspacePage({ moduleName }) {
  const location = useLocation();
  const routeKey = location.pathname.split('/').filter(Boolean)[0]?.toLowerCase() || '';
  const moduleKey = String(moduleName || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  const initialModule = getApiModule(PATH_MODULES[moduleKey] || moduleName || PATH_MODULES[routeKey] || routeKey);
  const [selectedModuleId, setSelectedModuleId] = useState(initialModule.id);
  const [searchText, setSearchText] = useState('');
  const [busyIds, setBusyIds] = useState([]);
  const [results, setResults] = useState({});
  const [testingAll, setTestingAll] = useState(false);
  const [notice, setNotice] = useState('');
  const [activeOperation, setActiveOperation] = useState(null);

  const selectedModule = CRM_API_MODULES.find((item) => item.id === selectedModuleId) || initialModule;
  const visibleOperations = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return selectedModule.operations.filter((item) => !query || `${item.method} ${item.path}`.toLowerCase().includes(query));
  }, [searchText, selectedModule]);

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
    const reads = selectedModule.operations.filter((item) => item.safeRead);
    setTestingAll(true);
    setNotice('');
    const nextResults = {};
    const queue = [...reads];
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
    setNotice(`${connected}/${reads.length} safe read endpoints connected for ${selectedModule.name}.`);
    setTestingAll(false);
  };

  const connectedCount = Object.values(results).filter((item) => item.ok).length;

  return (
    <div>
      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-transparent d-flex flex-wrap align-items-center justify-content-between gap-3 py-3">
          <div>
            <h5 className="mb-1 fw-semibold">CRM API Workspace</h5>
            <span className="text-muted small">All Swagger modules connected through one authenticated API client</span>
          </div>
          <div className="d-flex gap-2">
            <Badge bg="primary" className="px-3 py-2">
              {CRM_API_MODULES.length} modules
            </Badge>
            <Badge bg="success" className="px-3 py-2">
              {CRM_API_OPERATIONS.length} operations
            </Badge>
          </div>
        </Card.Header>
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={5} lg={4}>
              <Form.Label>API module</Form.Label>
              <Form.Select
                value={selectedModuleId}
                onChange={(event) => {
                  setSelectedModuleId(event.target.value);
                  setSearchText('');
                  setNotice('');
                }}
              >
                {CRM_API_MODULES.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} ({item.operations.length})
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={7} lg={5}>
              <Form.Label>Find operation</Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <Search size={15} />
                </InputGroup.Text>
                <Form.Control
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="GET, POST or endpoint path"
                />
              </InputGroup>
            </Col>
            <Col lg={3}>
              <Button
                className="w-100 d-inline-flex align-items-center justify-content-center gap-2"
                disabled={testingAll}
                onClick={testModuleReads}
              >
                {testingAll ? <Spinner size="sm" /> : <Activity size={15} />}Test safe GETs
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {notice && (
        <Alert variant="info" className="mb-4">
          {notice}
        </Alert>
      )}
      <Row className="g-3 mb-4">
        <Col sm={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center gap-3">
              <Database className="text-primary" />
              <div>
                <div className="small text-muted">Selected module</div>
                <div className="fw-semibold">{selectedModule.name}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="small text-muted">Operations</div>
              <div className="fs-4 fw-bold">{selectedModule.operations.length}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="d-flex align-items-center gap-3">
              <ShieldCheck className="text-success" />
              <div>
                <div className="small text-muted">Verified reads</div>
                <div className="fs-4 fw-bold">{connectedCount}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

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
        <Alert variant="info" className="mt-3">
          No operations match your search.
        </Alert>
      )}
      {activeOperation && (
        <ApiRequestModal key={activeOperation.id} operation={activeOperation} show onHide={() => setActiveOperation(null)} />
      )}
    </div>
  );
}

CRMApiWorkspacePage.propTypes = { moduleName: PropTypes.string };
