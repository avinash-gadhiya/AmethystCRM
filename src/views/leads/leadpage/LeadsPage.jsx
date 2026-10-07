import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Card, Spinner } from 'react-bootstrap';
import { toast } from 'sonner';

import leadService from '@/services/leadService';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import Leads from '../all-leads/Leads';
import CallBack from '../call-back/CallBack';
import MyLeads from '../my-leads/MyLeads';
import NewLeads from '../new-leads/NewLeads';
import Voicemails from '../voicemails/Voicemails';
import { currentUser, getMessage, hasPermissionCode } from './leadShared';
import './LeadsPage.css';

const TABS = [
  { id: 'new', label: 'New Leads', short: 'New', route: '/NewLeads', aliases: ['/NewLeads', 'New Leads', 'NewLeads'] },
  { id: 'my', label: 'My Leads', short: 'Mine', route: '/Leads/MyLeads', aliases: ['/Leads/MyLeads', 'My Leads', 'MyLeads'] },
  {
    id: 'callback',
    label: 'Call Back',
    short: 'Callbacks',
    route: '/Leads/CallBack',
    aliases: ['/Leads/CallBack', 'Call Back', 'Callback']
  },
  {
    id: 'voicemail',
    label: 'Voicemails',
    short: 'Voicemail',
    route: '/Leads/voicemail',
    aliases: ['/Leads/voicemail', 'Voicemails', 'Voicemail']
  },
  { id: 'leads', label: 'Leads', short: 'All', route: '/Leads?tab=leads', aliases: ['/Leads', 'Leads'] }
];

export default function LeadsPage() {
  const location = useLocation(),
    navigate = useNavigate();
  const [lookups, setLookups] = useState({ dispositions: [], users: [], groups: [], locations: [], vendors: [] }),
    [lookupsLoading, setLookupsLoading] = useState(true);
  const permissions = useMemo(
    () => Object.fromEntries(TABS.map((tab) => [tab.id, resolveConfiguredPagePermissions(tab.route, tab.aliases)])),
    []
  );
  const queryTab = new URLSearchParams(location.search).get('tab')?.toLowerCase();
  const activeId =
    location.pathname.toLowerCase() === '/newleads'
      ? 'new'
      : location.pathname.toLowerCase().includes('/myleads')
        ? 'my'
        : location.pathname.toLowerCase().includes('/callback')
          ? 'callback'
          : location.pathname.toLowerCase().includes('/voicemail')
            ? 'voicemail'
            : queryTab && TABS.some((tab) => tab.id === queryTab)
              ? queryTab
              : 'new';
  const visibleTabs = TABS.filter((tab) => permissions[tab.id].canView);
  useEffect(() => {
    const bareLeads = location.pathname.toLowerCase() === '/leads' && !queryTab;
    const allowed = visibleTabs.some((tab) => tab.id === activeId);
    if ((bareLeads || !allowed) && visibleTabs.length) navigate(visibleTabs[0].route, { replace: true });
  }, [activeId, location.pathname, navigate, queryTab, visibleTabs]);
  useEffect(() => {
    const controller = new AbortController();
    setLookupsLoading(true);
    Promise.all([
      leadService.getOptions('Dispositions', controller.signal),
      leadService.getSalesUsers(),
      leadService.getLookup('/Group', ['groupId', 'GroupId', 'id'], ['groupName', 'GroupName', 'name'], controller.signal),
      leadService.getLookup('/Location', ['locationId', 'LocationId', 'id'], ['name', 'locationName', 'LocationName'], controller.signal),
      leadService.getOptions('vendors', controller.signal)
    ])
      .then(([dispositions, users, groups, locations, vendors]) => setLookups({ dispositions, users, groups, locations, vendors }))
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error(error);
          toast.error(getMessage(error, 'Some lead filters could not be loaded.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLookupsLoading(false);
      });
    return () => controller.abort();
  }, []);
  const activePermissions = permissions[activeId];
  const claimPermission =
    hasPermissionCode('Claim_New_Leads') ||
    activePermissions.canUpdate ||
    String(currentUser().role || '')
      .toLowerCase()
      .match(/admin|developer/);
  const combinedPermissions = { ...activePermissions, canClaim: Boolean(claimPermission) };
  const myLeadPermissions = { ...combinedPermissions, canAdd: permissions.callback.canAdd };
  if (!visibleTabs.length)
    return (
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-5">
          <AlertCircle size={38} className="text-danger mb-3" />
          <h4>Access denied</h4>
          <p className="text-muted mb-0">You do not have view permission for any Lead page.</p>
        </Card.Body>
      </Card>
    );
  return (
    <section className="lead-page">
      <Card className="lead-shell">
        <div className="lead-tabs" role="tablist" aria-label="Lead sections">
          {visibleTabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeId === tab.id}
              key={tab.id}
              className={activeId === tab.id ? 'active' : ''}
              onClick={() => navigate(tab.route)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const currentIndex = visibleTabs.findIndex((item) => item.id === tab.id);
                const nextIndex =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? visibleTabs.length - 1
                      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
                navigate(visibleTabs[nextIndex].route);
              }}
            >
              <span className="lead-tab-full">{tab.label}</span>
              <span className="lead-tab-short">{tab.short}</span>
            </button>
          ))}
        </div>
        <Card.Body>
          {lookupsLoading && (
            <div className="lead-lookup-loading">
              <Spinner size="sm" />
              <span>Loading permissions and lead options…</span>
            </div>
          )}
          {activePermissions.canView ? (
            <>
              {activeId === 'new' && <NewLeads permissions={combinedPermissions} onClaimed={() => navigate('/Leads/MyLeads')} />}
              {activeId === 'my' && <MyLeads permissions={myLeadPermissions} dispositions={lookups.dispositions} users={lookups.users} />}
              {activeId === 'callback' && (
                <CallBack permissions={combinedPermissions} dispositions={lookups.dispositions} users={lookups.users} />
              )}
              {activeId === 'voicemail' && <Voicemails permissions={combinedPermissions} lookups={lookups} />}
              {activeId === 'leads' && <Leads permissions={combinedPermissions} lookups={lookups} />}
            </>
          ) : (
            <div className="text-center py-5">
              <AlertCircle size={32} className="text-danger mb-2" />
              <h5>Access denied</h5>
              <p className="text-muted">You do not have permission to view this page.</p>
            </div>
          )}
        </Card.Body>
      </Card>
    </section>
  );
}
