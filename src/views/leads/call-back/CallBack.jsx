import { useCallback, useState } from 'react';
import { Clock3, History, RefreshCw } from 'lucide-react';
import { Button, Modal, Spinner } from 'react-bootstrap';

import leadService from '@/services/leadService';
import {
  CallbackEditor,
  DateCell,
  ErrorState,
  LeadDataTable,
  badge,
  formatDate,
  formatPhone,
  getMessage,
  pagination,
  useNow,
  usePagedData
} from '../leadpage/leadShared';

export default function CallBack({ permissions, dispositions, users }) {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState({ sortProperty: 'assignDate', isDescending: true });
  const [editor, setEditor] = useState(null),
    [historyLead, setHistoryLead] = useState(null),
    [history, setHistory] = useState([]),
    [historyLoading, setHistoryLoading] = useState(false),
    [historyError, setHistoryError] = useState('');
  const now = useNow();
  const loader = useCallback(
    (signal) =>
      leadService.getCallbacks(
        { PageNumber: page, PageSize: pageSize, SortProperty: sort.sortProperty, IsDescending: sort.isDescending },
        signal
      ),
    [page, pageSize, sort]
  );
  const state = usePagedData(loader, [loader]);
  const openHistory = async (row) => {
    setHistoryLead(row);
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      setHistory(await leadService.getCallbackHistory(row.leadId));
    } catch (error) {
      console.error(error);
      setHistoryError(getMessage(error, 'Unable to load callback history.'));
    } finally {
      setHistoryLoading(false);
    }
  };
  const columns = [
    { id: 'serial', header: '#' },
    {
      id: 'name',
      header: 'Customer Name',
      cell: (row) => (
        <div>
          <strong>{row.name || row.customerName || '-'}</strong>
          <small className="d-block text-muted">
            {row.email || '-'} · {formatPhone(row.phone)}
          </small>
        </div>
      )
    },
    {
      id: 'assignDate',
      header: 'Assign Date',
      sortable: true,
      cell: (row) => <DateCell value={row.assignDate} timeZone={row.timeZone} now={now} />
    },
    { id: 'disposition', header: 'Disposition', cell: (row) => badge(row.dispositionName, 'primary') },
    { accessor: 'assignedToName', header: 'Assigned To' },
    { accessor: 'createdByName', header: 'Created By' },
    {
      id: 'comments',
      header: 'Comments',
      cell: (row) => (
        <div className="lead-clamp" title={row.completionNotes}>
          {row.completionNotes || '-'}
        </div>
      )
    },
    {
      id: 'action',
      header: 'Action',
      sticky: 'right',
      cell: (row) => (
        <div className="lead-actions">
          <Button size="sm" variant="outline-secondary" onClick={() => openHistory(row)} title="History">
            <History size={15} />
          </Button>
          {permissions.canUpdate && (
            <>
              <Button size="sm" variant="outline-primary" onClick={() => setEditor({ mode: 'reschedule', row })}>
                <Clock3 size={15} /> <span>Reschedule</span>
              </Button>
              <Button size="sm" onClick={() => setEditor({ mode: 'edit', row })}>
                Edit
              </Button>
            </>
          )}
        </div>
      )
    }
  ];
  return (
    <>
      <div className="lead-summary-bar">
        <div className="lead-summary-overview">
          <div className="lead-metrics" aria-label="Callback summary">
            <div className="lead-metric lead-metric-total">
              <span className="lead-metric-dot" />
              <div>
                <strong>{state.totalCount}</strong>
                <span>Total callbacks</span>
              </div>
            </div>
            <div className="lead-metric lead-metric-available">
              <span className="lead-metric-dot" />
              <div>
                <strong>{state.data.length}</strong>
                <span>Showing now</span>
              </div>
            </div>
          </div>
        </div>
        <div className="lead-summary-actions">
          <div className="lead-auto-copy">
            <strong>Follow-up schedule</strong>
            <small>Scheduled customer follow-ups</small>
          </div>
          <button
            type="button"
            className="lead-round-refresh"
            onClick={state.refresh}
            disabled={state.loading}
            aria-label="Refresh callbacks"
            title="Refresh callbacks"
          >
            <RefreshCw size={18} className={state.loading ? 'spin' : ''} />
          </button>
        </div>
      </div>
      <ErrorState message={state.error} onRetry={state.refresh} />
      <LeadDataTable
        columns={columns}
        data={state.data}
        loading={state.loading}
        rowKey="callbackId"
        sort={{
          ...sort,
          onSort: (key) => setSort((old) => ({ sortProperty: key, isDescending: old.sortProperty === key ? !old.isDescending : false }))
        }}
        pagination={pagination(page, pageSize, state.totalCount, setPage, setPageSize)}
        emptyState={{ title: 'No callbacks scheduled' }}
      />
      <CallbackEditor
        show={Boolean(editor)}
        mode={editor?.mode}
        source={editor?.row}
        dispositions={dispositions}
        users={users}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          state.refresh();
        }}
      />
      <Modal show={Boolean(historyLead)} onHide={() => setHistoryLead(null)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Callback History · Lead #{historyLead?.leadId}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {historyLoading ? (
            <div className="text-center py-5">
              <Spinner className="me-2" />
              Loading history…
            </div>
          ) : historyError ? (
            <ErrorState message={historyError} />
          ) : history.length === 0 ? (
            <div className="text-center text-muted py-5">No callback history found.</div>
          ) : (
            <div className="callback-timeline">
              {history.map((item, index) => (
                <div className="callback-history" key={item.callbackId || index}>
                  <strong>{formatDate(item.assignDate)}</strong>
                  <span>
                    {item.dispositionName || 'No disposition'} · {item.assignedToName || 'Unassigned'}
                  </span>
                  <small>{item.completionNotes || 'No notes'}</small>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}
