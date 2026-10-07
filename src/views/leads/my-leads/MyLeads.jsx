import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, RefreshCw } from 'lucide-react';
import { Badge, Button, Form, Spinner } from 'react-bootstrap';
import { toast } from 'sonner';

import leadService from '@/services/leadService';
import {
  CallbackEditor,
  DateCell,
  ErrorState,
  LeadDataTable,
  formatPhone,
  getMessage,
  pagination,
  useNow,
  usePagedData
} from '../leadpage/leadShared';

export default function MyLeads({ permissions, dispositions, users }) {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState({ sortProperty: 'leadId', isDescending: true });
  const [drafts, setDrafts] = useState({}),
    [saving, setSaving] = useState(0),
    [transferring, setTransferring] = useState(0),
    [callbackLead, setCallbackLead] = useState(null);
  const now = useNow();
  const loader = useCallback(
    (signal) =>
      leadService.getMyLeads(
        { PageNumber: page, PageSize: pageSize, SortProperty: sort.sortProperty, IsDescending: sort.isDescending },
        signal
      ),
    [page, pageSize, sort]
  );
  const state = usePagedData(loader, [loader]);
  useEffect(() => {
    setDrafts((old) =>
      Object.fromEntries(
        state.data.map((lead) => [
          lead.leadId,
          old[lead.leadId] || { dispositionId: lead.dispositionId || '', comments: lead.comments || '' }
        ])
      )
    );
  }, [state.data]);
  const save = async (lead) => {
    if (!permissions.canUpdate || saving) return;
    const draft = drafts[lead.leadId] || {};
    if (!Number(draft.dispositionId)) {
      toast.error('Disposition is required.');
      return;
    }
    if (!draft.comments?.trim()) {
      toast.error('Comment is required.');
      return;
    }
    setSaving(lead.leadId);
    try {
      await leadService.updateLead(lead.leadId, draft.dispositionId, draft.comments);
      toast.success('Lead updated successfully');
      state.refresh();
    } catch (error) {
      console.error(error);
      toast.error(
        error?.status === 404 ? 'The backend disposition update endpoint is unavailable.' : getMessage(error, 'Unable to update lead.')
      );
    } finally {
      setSaving(0);
    }
  };
  const transfer = async (lead, userId) => {
    if (!permissions.canUpdate || !userId || transferring) return;
    setTransferring(lead.leadId);
    try {
      await leadService.transferLead(lead.leadId, Number(userId));
      toast.success('Lead transferred successfully');
      state.refresh();
    } catch (error) {
      console.error(error);
      toast.error(getMessage(error, 'Unable to transfer lead.'));
    } finally {
      setTransferring(0);
    }
  };
  const columns = [
    { id: 'serial', header: '#' },
    { accessor: 'leadId', header: 'Lead ID', sortable: true },
    {
      id: 'customer',
      header: 'Customer Name',
      cell: (lead) => (
        <div>
          <strong>{lead.customerName || '-'}</strong>
          {lead.isValid === false && (
            <Badge bg="danger" className="ms-2">
              Invalid
            </Badge>
          )}
          <small className="d-block text-muted">
            {lead.email || '-'} · {formatPhone(lead.phone)}
          </small>
          {(lead.timeZone || lead.country) && <small className="text-muted">{lead.timeZone || lead.country}</small>}
        </div>
      )
    },
    {
      accessor: 'description',
      header: 'Description',
      cell: (lead) => (
        <div className="lead-clamp" title={lead.description}>
          {lead.description || '-'}
        </div>
      )
    },
    {
      id: 'leadDate',
      header: 'Lead Date',
      sortable: true,
      sortKey: 'dateAdded',
      cell: (lead) => <DateCell value={lead.leadDate} timeZone={lead.timeZone} now={now} />
    },
    {
      id: 'assignDate',
      header: 'Assign Date',
      sortable: true,
      cell: (lead) => <DateCell value={lead.assignDate} timeZone={lead.timeZone} now={now} />
    },
    {
      id: 'comment',
      header: 'Comment',
      cell: (lead) => (
        <Form.Control
          as="textarea"
          rows={2}
          value={drafts[lead.leadId]?.comments ?? lead.comments}
          disabled={!permissions.canUpdate || saving === lead.leadId}
          onChange={(e) => setDrafts((old) => ({ ...old, [lead.leadId]: { ...old[lead.leadId], comments: e.target.value } }))}
          aria-label={`Comment for lead ${lead.leadId}`}
        />
      )
    },
    {
      id: 'disposition',
      header: 'Disposition',
      cell: (lead) => (
        <Form.Select
          size="sm"
          value={drafts[lead.leadId]?.dispositionId ?? lead.dispositionId}
          disabled={!permissions.canUpdate || saving === lead.leadId}
          onChange={(e) => setDrafts((old) => ({ ...old, [lead.leadId]: { ...old[lead.leadId], dispositionId: e.target.value } }))}
        >
          <option value="">Select</option>
          {dispositions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Form.Select>
      )
    },
    {
      id: 'action',
      header: 'Action',
      sticky: 'right',
      cell: (lead) => (
        <div className="lead-actions">
          {permissions.canUpdate && (
            <>
              <Button size="sm" onClick={() => save(lead)} disabled={Boolean(saving)}>
                {saving === lead.leadId ? <Spinner size="sm" /> : 'Save'}
              </Button>
              <Form.Select
                size="sm"
                aria-label={`Transfer lead ${lead.leadId}`}
                value=""
                disabled={Boolean(transferring)}
                onChange={(e) => transfer(lead, e.target.value)}
              >
                <option value="">Transfer…</option>
                {users.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.label} · {user.role || 'Sales'} · {user.location || 'N/A'}
                  </option>
                ))}
              </Form.Select>
            </>
          )}
          {permissions.canAdd && (
            <Button size="sm" variant="outline-primary" onClick={() => setCallbackLead(lead)} title="Create callback">
              <CalendarPlus size={15} />
            </Button>
          )}
        </div>
      )
    }
  ];
  return (
    <>
      <div className="lead-summary-bar">
        <div className="lead-summary-overview">
          <div className="lead-metrics" aria-label="My leads summary">
            <div className="lead-metric lead-metric-total">
              <span className="lead-metric-dot" />
              <div>
                <strong>{state.totalCount}</strong>
                <span>Total assigned</span>
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
            <strong>Follow-up queue</strong>
            <small>Assigned leads requiring follow-up</small>
          </div>
          <button
            type="button"
            className="lead-round-refresh"
            onClick={state.refresh}
            disabled={state.loading}
            aria-label="Refresh my leads"
            title="Refresh my leads"
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
        rowKey="leadId"
        sort={{
          ...sort,
          onSort: (key) => setSort((old) => ({ sortProperty: key, isDescending: old.sortProperty === key ? !old.isDescending : false }))
        }}
        pagination={pagination(page, pageSize, state.totalCount, setPage, setPageSize)}
        emptyState={{ title: 'No assigned leads' }}
      />
      <CallbackEditor
        show={Boolean(callbackLead)}
        mode="create"
        source={callbackLead}
        dispositions={dispositions}
        users={users}
        onClose={() => setCallbackLead(null)}
        onSaved={() => {
          setCallbackLead(null);
          state.refresh();
        }}
      />
    </>
  );
}
