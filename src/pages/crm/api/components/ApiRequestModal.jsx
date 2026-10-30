import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';

import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner } from 'components/ui/Bootstrap';
import { apiClient } from 'services/core/apiClient';
import { ApiPayloadView } from './ApiDataViewer';
import { getOperationContract, getOperationQuery } from '@/lib/apiOperationQuery';
import { buildOperationBody } from '@/lib/apiOperationBody';

const METHOD_TONES = { GET: 'success', POST: 'primary', PUT: 'warning', DELETE: 'danger' };

const createDefaultQuery = (operation) => {
  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
  return JSON.stringify(
    getOperationQuery(operation.method, operation.path, {
      PageNumber: 1,
      PageSize: 10,
      IsDescending: true,
      FromDate: fromDate.toISOString(),
      ToDate: today.toISOString()
    }),
    null,
    2
  );
};

const parseJson = (value, label) => {
  if (!value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
};

export default function ApiRequestModal({ operation, show, onHide }) {
  const parameterNames = useMemo(() => [...operation.path.matchAll(/{([^}]+)}/g)].map((match) => match[1]), [operation.path]);
  const [pathValues, setPathValues] = useState({});
  const [queryText, setQueryText] = useState(() => (operation.method === 'GET' ? createDefaultQuery(operation) : '{}'));
  const [bodyText, setBodyText] = useState('{}');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);
  const [responseView, setResponseView] = useState('table');
  const isMutation = operation.method !== 'GET' || /\/(SendMail|SendPandaDocMail)$/.test(operation.path);
  const contract = getOperationContract(operation.method, operation.path);
  const acceptsBody = !!contract?.contentType;
  const isMultipart = contract?.contentType === 'multipart/form-data';
  const [uploadFiles, setUploadFiles] = useState([]);

  const execute = async () => {
    setError('');
    setResponse(null);
    try {
      if (isMutation && !confirmed) throw new Error('Review and confirm this request before executing it.');
      let path = operation.path;
      parameterNames.forEach((name) => {
        const value = String(pathValues[name] ?? '').trim();
        if (!value) throw new Error(`${name} is required.`);
        path = path.replace(`{${name}}`, encodeURIComponent(value));
      });
      const params = parseJson(queryText, 'Query parameters');
      const unknown = Object.keys(params || {}).filter((key) => contract && !contract.query.includes(key));
      if (unknown.length) throw new Error(`Unsupported query parameters: ${unknown.join(', ')}. Use: ${contract.query.join(', ') || 'none'}.`);
      const data = buildOperationBody(operation.method, operation.path, acceptsBody ? parseJson(bodyText, 'Request body') : undefined, uploadFiles);
      setLoading(true);
      const payload = await apiClient.request(path, { method: operation.method, params, data });
      setResponse(payload);
    } catch (requestError) {
      setError(requestError.message || 'API request failed.');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (loading) return;
    setError('');
    setResponse(null);
    setConfirmed(false);
    onHide();
  };

  return (
    <Modal show={show} onHide={close} size="xl">
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <Badge bg={METHOD_TONES[operation.method]}>{operation.method}</Badge>
          <code className="small text-slate-800 dark:text-slate-200">/api{operation.path}</code>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="max-h-[75vh] overflow-y-auto">
        {isMutation && <Alert variant="warning">This operation can change CRM data. Review every value before executing it.</Alert>}
        {parameterNames.length > 0 && (
          <Row className="g-3 mb-3">
            {parameterNames.map((name) => (
              <Col md={6} key={name}>
                <Form.Label>{name}</Form.Label>
                <Form.Control
                  value={pathValues[name] || ''}
                  onChange={(event) => setPathValues((current) => ({ ...current, [name]: event.target.value }))}
                  placeholder={`Enter ${name}`}
                />
              </Col>
            ))}
          </Row>
        )}
        <Form.Group>
          <Form.Label>Query parameters (JSON)</Form.Label>
          <Form.Control
            as="textarea"
            rows={5}
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            spellCheck="false"
          />
          <Form.Text>Supported parameters: {contract?.query.join(', ') || 'none'}</Form.Text>
        </Form.Group>
        {acceptsBody && (!isMultipart || contract.formFields?.some((name) => name !== contract.fileField?.name)) && (
          <Form.Group>
            <Form.Label>{isMultipart ? 'Form fields (JSON)' : 'Request body (JSON)'}</Form.Label>
            <Form.Control
              as="textarea"
              rows={9}
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              spellCheck="false"
            />
          </Form.Group>
        )}
        {isMultipart && <Form.Group><Form.Label>{contract.fileField?.multiple ? 'Files' : 'File'}</Form.Label><Form.Control type="file" multiple={contract.fileField?.multiple} onChange={(event) => setUploadFiles(Array.from(event.target.files || []))} /></Form.Group>}
        {isMutation && (
          <Form.Check
            id="confirm-api-mutation"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            label="I reviewed this request and understand that it can modify CRM data."
          />
        )}
        {error && (
          <Alert variant="danger" className="mt-3 mb-0">
            {error}
          </Alert>
        )}
        {response !== null && (
          <div className="mt-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="small fw-semibold text-success">API response</span>
              <Button size="sm" variant="outline-secondary" onClick={() => setResponseView((view) => (view === 'table' ? 'json' : 'table'))}>
                {responseView === 'table' ? 'Raw JSON' : 'Table view'}
              </Button>
            </div>
            {responseView === 'table' ? (
              <ApiPayloadView payload={response} />
            ) : (
              <pre className="rounded bg-dark text-light p-3 small overflow-auto mb-0" style={{ maxHeight: 320 }}>
                {JSON.stringify(response, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={close} disabled={loading}>
          Close
        </Button>
        <Button
          variant={operation.method === 'DELETE' ? 'danger' : 'primary'}
          onClick={execute}
          disabled={loading || (isMutation && !confirmed)}
          className="d-inline-flex align-items-center gap-2"
        >
          {loading && <Spinner size="sm" />}
          Execute {operation.method}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

ApiRequestModal.propTypes = {
  operation: PropTypes.shape({ method: PropTypes.string.isRequired, path: PropTypes.string.isRequired }).isRequired,
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired
};
