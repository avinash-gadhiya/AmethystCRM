import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, UserRoundCheck } from 'lucide-react';
import { Badge, Button, Spinner } from 'react-bootstrap';
import { toast } from 'sonner';

import IosToggle from '@/components/common/IosToggle';
import leadService from '@/services/leadService';
import {
  DateCell,
  ErrorState,
  LeadDataTable,
  currentUser,
  getMessage,
  pagination,
  useNow,
  usePagedData,
  userName
} from '../leadpage/leadShared';

export default function NewLeads({ permissions, onClaimed }) {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ sortProperty: 'leadId', isDescending: true });
  const [claiming, setClaiming] = useState(0),
    [autoRefresh, setAutoRefresh] = useState(false),
    [countdown, setCountdown] = useState(3);
  const now = useNow();
  const loader = useCallback(
    (signal) =>
      leadService.getNewLeads(
        { PageNumber: page, PageSize: pageSize, SortProperty: sort.sortProperty, IsDescending: sort.isDescending },
        signal
      ),
    [page, pageSize, sort]
  );
  const state = usePagedData(loader, [loader]);
  useEffect(() => {
    if (!autoRefresh) {
      setCountdown(3);
      return undefined;
    }
    const timer = setInterval(
      () =>
        setCountdown((value) => {
          if (value <= 1) {
            state.refresh();
            return 3;
          }
          return value - 1;
        }),
      1000
    );
    return () => clearInterval(timer);
  }, [autoRefresh, state.refresh]);
  const claim = async (lead) => {
    if (!permissions.canClaim || claiming) return;
    setClaiming(lead.leadId);
    try {
      await leadService.claimLead(lead.leadId);
      toast.success(userName() ? `Lead claimed by ${userName()}` : 'Lead claimed');
      onClaimed();
    } catch (error) {
      console.error(error);
      toast.error(getMessage(error, 'Unable to claim this lead.'));
    } finally {
      setClaiming(0);
    }
  };
  const columns = [
    { id: 'serial', header: '#' },
    {
      id: 'date',
      header: 'Date',
      accessor: 'leadDate',
      sortable: true,
      sortKey: 'dateAdded',
      cell: (lead) => <DateCell value={lead.leadDate} timeZone={lead.timeZone} now={now} />
    },
    { id: 'claimed', header: 'Claim By', cell: (lead) => lead.assignedToName || '-' },
    { id: 'group', header: 'Group', cell: (lead) => badge(lead.groupName, 'info', 'dark') },
    {
      id: 'action',
      header: 'Action',
      sticky: 'right',
      cell: (lead) => {
        const mine =
          (lead.assignedTo && lead.assignedTo === Number(currentUser().userId)) ||
          (lead.assignedToName && lead.assignedToName.toLowerCase() === userName().toLowerCase());
        const claimed = (lead.assignedTo || lead.assignedToName) && !mine;
        if (claimed || mine) return <Badge bg="secondary">Claimed{mine ? ' by you' : ''}</Badge>;
        return permissions.canClaim ? (
          <Button size="sm" onClick={() => claim(lead)} disabled={Boolean(claiming)}>
            {claiming === lead.leadId ? <Spinner size="sm" /> : <UserRoundCheck size={15} />} <span className="ms-1">Claim</span>
          </Button>
        ) : (
          '-'
        );
      }
    }
  ];
  const availableCount = state.data.filter((lead) => !lead.assignedTo && !lead.assignedToName).length;
  const claimedCount = state.data.filter((lead) => lead.assignedTo || lead.assignedToName).length;
  return (
    <>
      <div className="lead-summary-bar">
        <div className="lead-summary-overview">
          <div className="lead-metrics" aria-label="New lead summary">
            <div className="lead-metric lead-metric-total">
              <span className="lead-metric-dot" />
              <div>
                <strong>{state.totalCount}</strong>
                <span>Total leads</span>
              </div>
            </div>
            <div className="lead-metric lead-metric-available">
              <span className="lead-metric-dot" />
              <div>
                <strong>{availableCount}</strong>
                <span>Available now</span>
              </div>
            </div>
            <div className="lead-metric lead-metric-claimed">
              <span className="lead-metric-dot" />
              <div>
                <strong>{claimedCount}</strong>
                <span>Claimed</span>
              </div>
            </div>
          </div>
        </div>
        <div className="lead-summary-actions">
          <div className="lead-auto-copy">
            <strong>Auto refresh</strong>
            <small>{autoRefresh ? `Next update in ${countdown}s` : 'Refresh manually'}</small>
          </div>
          <IosToggle
            className="lead-auto-refresh-toggle"
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
            title={autoRefresh ? `Refresh in ${countdown} seconds` : 'Enable automatic refresh'}
            aria-label={autoRefresh ? 'Disable automatic refresh' : 'Enable automatic refresh'}
          />
          <button
            type="button"
            className="lead-round-refresh"
            onClick={state.refresh}
            disabled={state.loading}
            aria-label="Refresh new leads"
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
        emptyState={{ title: 'No new leads', description: 'There are no unclaimed leads available right now.' }}
      />
    </>
  );
}
