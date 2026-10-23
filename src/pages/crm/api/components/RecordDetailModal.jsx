import PropTypes from 'prop-types';
import { useState } from 'react';
import { Braces, List } from 'lucide-react';

import { Button, Modal } from 'components/ui/Bootstrap';
import { formatApiValue, humanizeKey } from '@/lib/apiData';

const isComplex = (value) => value !== null && typeof value === 'object';

export function FieldGrid({ record }) {
  const entries = Object.entries(record || {});
  if (entries.length === 0) return <div className="text-sm text-gray-500 py-4 text-center">No fields returned.</div>;

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-0">
      {entries.map(([key, value]) => (
        <div key={key} className={`min-w-0 ${isComplex(value) ? 'sm:col-span-2' : ''}`}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{humanizeKey(key)}</dt>
          <dd className="mb-0 mt-0.5 text-sm text-gray-900 dark:text-gray-100 break-words">
            {isComplex(value) ? (
              <pre className="rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-2 text-xs overflow-auto mb-0 max-h-48">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              formatApiValue(value, key)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

FieldGrid.propTypes = { record: PropTypes.object };

export default function RecordDetailModal({ record, title, onHide }) {
  const [raw, setRaw] = useState(false);

  return (
    <Modal show={Boolean(record)} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{title || 'Record details'}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="max-h-[70vh] overflow-y-auto">
        {raw ? (
          <pre className="rounded-lg bg-gray-900 text-gray-100 p-3 text-xs overflow-auto mb-0">{JSON.stringify(record, null, 2)}</pre>
        ) : (
          <FieldGrid record={record} />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={() => setRaw((value) => !value)} className="d-inline-flex align-items-center gap-2">
          {raw ? <List size={14} /> : <Braces size={14} />}
          {raw ? 'Formatted view' : 'Raw JSON'}
        </Button>
        <Button onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

RecordDetailModal.propTypes = { record: PropTypes.object, title: PropTypes.string, onHide: PropTypes.func.isRequired };
