import PropTypes from 'prop-types';
import { Play, Settings2, ShieldCheck } from 'lucide-react';

import { Badge, Button, Card, Spinner } from 'components/ui/Bootstrap';

const METHOD_TONES = { GET: 'success', POST: 'primary', PUT: 'warning', DELETE: 'danger' };

export default function ApiOperationCard({ operation, busy, result, onRun, onOpen }) {
  return (
    <Card className="border shadow-none h-100">
      <Card.Body className="p-3">
        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
          <div className="d-flex align-items-center gap-2 min-w-0">
            <Badge bg={METHOD_TONES[operation.method]}>{operation.method}</Badge>
            <code className="small text-dark text-break">/api{operation.path}</code>
          </div>
          {operation.safeRead && <ShieldCheck size={16} className="text-success flex-shrink-0" aria-label="Safe read" />}
        </div>
        <div className="d-flex align-items-center justify-content-between gap-2">
          <span className="small text-muted">{operation.safeRead ? 'Read-only test available' : 'Connected for module forms'}</span>
          <div className="d-flex gap-1">
            {operation.safeRead && (
              <Button
                size="sm"
                variant="outline-primary"
                disabled={busy}
                onClick={() => onRun(operation)}
                className="d-inline-flex align-items-center gap-1"
              >
                {busy ? <Spinner size="sm" /> : <Play size={13} />} Test
              </Button>
            )}
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => onOpen(operation)}
              className="d-inline-flex align-items-center gap-1"
            >
              <Settings2 size={13} /> Configure
            </Button>
          </div>
        </div>
        {result && (
          <div className={`small mt-2 ${result.ok ? 'text-success' : 'text-danger'}`}>
            {result.ok ? `Connected · ${result.count} record${result.count === 1 ? '' : 's'}` : result.message}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

ApiOperationCard.propTypes = {
  operation: PropTypes.shape({ method: PropTypes.string.isRequired, path: PropTypes.string.isRequired, safeRead: PropTypes.bool })
    .isRequired,
  busy: PropTypes.bool,
  result: PropTypes.shape({ ok: PropTypes.bool, count: PropTypes.number, message: PropTypes.string }),
  onRun: PropTypes.func.isRequired,
  onOpen: PropTypes.func.isRequired
};
