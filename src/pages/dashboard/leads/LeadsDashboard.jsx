import '@/styles/liquid-glass-surfaces.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import { BarChart3, RefreshCw, TrendingUp, Users } from 'lucide-react';

import DashboardPanel from '../components/DashboardPanel';
import DashboardRangeToolbar from '../components/DashboardRangeToolbar';
import StatCardGrid from '@/components/common/StatCards';
import LiquidGlassSurface from '@/components/common/LiquidGlassSurface';
import LiquidMembraneSelect from '@/components/common/liquid-membrane/LiquidMembraneSelect';
import { Alert, Badge, Card, Spinner, Table } from 'components/ui/Bootstrap';
import dashboardService from 'services/dashboardService';
import groupService from '@/services/groupService';
import { getMonthToDateRange, isValidDateRange } from 'utils/dateUtils';
import { asArray, currency, integer, numberValue, textValue } from '../dashboardData';

const CHART_COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f97316', '#06b6d4', '#a855f7', '#ec4899', '#f59e0b'];

export default function LeadsDashboard() {
  const initialRange = useMemo(() => getMonthToDateRange(), []);
  const [range, setRange] = useState(initialRange);
  const [group, setGroup] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ group: [], people: [], users: [] });
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState('');
  const [groupRetryKey, setGroupRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setGroupsLoading(true);
    setGroupsError('');
    // Options must not depend on lead activity in the selected date range.
    groupService
      .getGroupDropdownOptions(controller.signal, true)
      .then((options) => {
        if (controller.signal.aborted) return;
        const names = [...new Set(options.map((option) => option.name))].sort((left, right) => left.localeCompare(right));
        setGroups(names);
        setGroup((current) => (names.includes(current) ? current : ''));
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setGroupsError(requestError?.message || 'Unable to load groups.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey, groupRetryKey]);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      const requests = await Promise.allSettled([
        dashboardService.getGroupWiseLeads(range.fromDate, range.toDate, group, signal),
        dashboardService.getSalesPersonWiseLeads(range.fromDate, range.toDate, undefined, signal),
        dashboardService.getUserWiseSummary(range.fromDate, range.toDate, undefined, signal)
      ]);
      if (signal.aborted) return;

      const failures = requests.filter((request) => request.status === 'rejected');
      setData({
        group: requests[0].status === 'fulfilled' ? asArray(requests[0].value.data) : [],
        people: requests[1].status === 'fulfilled' ? asArray(requests[1].value.data) : [],
        users: requests[2].status === 'fulfilled' ? asArray(requests[2].value.data) : []
      });
      setError(failures.map((request) => request.reason?.message || 'An API request failed.').join(' '));
      setLoading(false);
    },
    [group, range]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  const filteredGroups = group ? data.group.filter((item) => textValue(item, ['groupName', 'group', 'name'], '') === group) : data.group;
  const leadSummaryRows = group || data.group.length > 0 ? filteredGroups : data.people;
  const totalLeads = leadSummaryRows.reduce((sum, item) => sum + numberValue(item, ['leadCount', 'totalLeads', 'leads', 'count']), 0);

  const chart = useMemo(() => {
    const buckets = [...new Set(filteredGroups.map((item) => textValue(item, ['hour', 'time', 'period', 'label'], 'Total')))];
    const names = [...new Set(filteredGroups.map((item) => textValue(item, ['groupName', 'group', 'name'], 'All groups')))];
    return {
      options: {
        chart: { toolbar: { show: false }, zoom: { enabled: false } },
        colors: CHART_COLORS,
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2.5 },
        markers: { size: 3 },
        legend: { position: 'bottom' },
        xaxis: { categories: buckets },
        yaxis: { min: 0, forceNiceScale: true, title: { text: 'Leads' } },
        tooltip: { shared: true, intersect: false }
      },
      series: names.map((name) => ({
        name,
        data: buckets.map((bucket) => {
          const row = filteredGroups.find(
            (item) =>
              textValue(item, ['groupName', 'group', 'name'], 'All groups') === name &&
              textValue(item, ['hour', 'time', 'period', 'label'], 'Total') === bucket
          );
          return numberValue(row, ['leadCount', 'totalLeads', 'leads', 'count']);
        })
      }))
    };
  }, [filteredGroups]);

  const statCards = [
    { label: 'Total leads', value: integer.format(totalLeads), icon: Users, tone: 'indigo' },
    { label: 'Salespeople', value: data.people.length, icon: BarChart3, tone: 'emerald' },
    { label: 'Users', value: data.users.length, icon: TrendingUp, tone: 'amber' }
  ];

  const changeRange = (nextRange) => {
    if (!isValidDateRange(nextRange)) {
      setError('Select a valid date range.');
      return;
    }
    setError('');
    setRange(nextRange);
  };

  const formatRangeDate = (value) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="dashboard-glass p-3 sm:p-4">
      <LiquidGlassSurface className="mb-4 flex flex-col justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4">
          <div className="daily-sales-glass__icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <Users className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">Leads Dashboard</h1>
            <p className="mb-0 mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              {formatRangeDate(range.fromDate)} - {formatRangeDate(range.toDate)}
              {group && <span> | {group}</span>}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </LiquidGlassSurface>

      <DashboardRangeToolbar range={range} onRangeChange={changeRange} showActions={false}>
        <div className="min-w-0">
          <label htmlFor="lead-group" className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Group
          </label>
          <LiquidMembraneSelect
            id="lead-group"
            label="Group"
            value={group}
            onValueChange={setGroup}
            disabled={groupsLoading}
            options={[
              { value: '', label: groupsLoading ? 'Loading groups...' : 'All groups' },
              ...groups.map((name) => ({ value: name, label: name }))
            ]}
          />
          {groupsError && (
            <div className="mt-2 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-300" role="alert">
              <span>{groupsError}</span>
              <button type="button" className="shrink-0 font-semibold underline" onClick={() => setGroupRetryKey((value) => value + 1)}>
                Retry groups
              </button>
            </div>
          )}
          {!groupsLoading && !groupsError && groups.length === 0 && <p className="mt-2 text-xs text-slate-500">No groups available.</p>}
        </div>
      </DashboardRangeToolbar>

      {error && (
        <Alert variant="warning" className="mb-4">
          {error}
        </Alert>
      )}

      <StatCardGrid className="mb-4" items={statCards.map((card) => ({ ...card, glass: true }))} loading={loading} columns={3} />

      <div className="mb-4">
        <DashboardPanel
          glass
          title="Leads by group"
          loading={loading}
          empty={!chart.series.length}
          emptyMessage="No lead activity found for this date range."
        >
          <Chart type="line" height={330} width="100%" {...chart} />
        </DashboardPanel>
      </div>

      <LiquidGlassSurface as={Card} className="border-0 shadow-sm">
        <Card.Header className="bg-transparent d-flex align-items-center justify-content-between py-3">
          <div>
            <h5 className="mb-0 fw-semibold">Financial summary</h5>
          </div>
          <Badge bg="primary">{data.users.length} users</Badge>
        </Card.Header>
        <div className="table-responsive">
          <Table className="align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>User</th>
                <th className="text-end">Leads</th>
                <th className="text-end">Sales</th>
                <th className="text-end">Refunds</th>
                <th className="text-end">Net amount</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-5">
                    <Spinner size="sm" className="me-2" />
                    Loading summary...
                  </td>
                </tr>
              )}
              {!loading && data.users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-5">
                    No financial summary available.
                  </td>
                </tr>
              )}
              {!loading &&
                data.users.map((item, index) => (
                  <tr key={item.userId || item.id || index}>
                    <td>
                      <div className="fw-semibold">{textValue(item, ['userName', 'fullName', 'name'], 'Unknown user')}</div>
                      <div className="small text-muted">{textValue(item, ['email'], '')}</div>
                    </td>
                    <td className="text-end">{integer.format(numberValue(item, ['leadCount', 'totalLeads', 'leads']))}</td>
                    <td className="text-end fw-semibold">{currency.format(numberValue(item, ['totalSales', 'sales', 'amount']))}</td>
                    <td className="text-end text-warning">{currency.format(numberValue(item, ['totalRefunds', 'refunds']))}</td>
                    <td className="text-end fw-semibold text-success">{currency.format(numberValue(item, ['netAmount', 'net']))}</td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      </LiquidGlassSurface>
    </div>
  );
}
