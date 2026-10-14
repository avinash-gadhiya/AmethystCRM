import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';

import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner } from 'components/ui/Bootstrap';
import { apiClient } from 'services/core/apiClient';

const METHOD_TONES = { GET: 'success', POST: 'primary', PUT: 'warning', DELETE: 'danger' };

const createDefaultQuery = () => {
  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
  return JSON.stringify(
    {
      PageNumber: 1,
      PageSize: 10,
      IsDescending: true,
      FromDate: fromDate.toISOString(),
      ToDate: today.toISOString()
    },
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
  const [queryText, setQueryText] = useState(() => (operation.method === 'GET' ? createDefaultQuery() : '{}'));
  const [bodyText, setBodyText] = useState('{}');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);
  const isMutation = operation.method !== 'GET';

  const execute = async () => {
    setError('');
    setResponse(null);
    try {
      let path = operation.path;
      parameterNames.forEach((name) => {
        const value = String(pathValues[name] ?? '').trim();
        if (!value) throw new Error(`${name} is required.`);
        path = path.replace(`{${name}}`, encodeURIComponent(value));
      });
      const params = parseJson(queryText, 'Query parameters');
      const data = isMutation ? parseJson(bodyText, 'Request body') : undefined;
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
    <Modal show={show} onHide={close} size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <Badge bg={METHOD_TONES[operation.method]}>{operation.method}</Badge>
          <code className="small text-dark">/api{operation.path}</code>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
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
          <Form.Text>Example: {`{ "PageNumber": 1, "PageSize": 10 }`}</Form.Text>
        </Form.Group>
        {isMutation && (
          <Form.Group>
            <Form.Label>Request body (JSON)</Form.Label>
            <Form.Control
              as="textarea"
              rows={9}
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              spellCheck="false"
            />
          </Form.Group>
        )}
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
            <div className="small fw-semibold text-success mb-2">API response</div>
            <pre className="rounded bg-dark text-light p-3 small overflow-auto mb-0" style={{ maxHeight: 320 }}>
              {JSON.stringify(response, null, 2)}
            </pre>
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
