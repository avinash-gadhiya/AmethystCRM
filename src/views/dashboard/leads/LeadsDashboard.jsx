import { useCallback, useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import { BarChart3, TrendingUp, Users } from 'lucide-react';

import DashboardMetricCard from 'components/dashboard/DashboardMetricCard';
import DashboardPanel from 'components/dashboard/DashboardPanel';
import DashboardRangeToolbar from 'components/dashboard/DashboardRangeToolbar';
import { Alert, Badge, Card, Col, Form, Row, Spinner, Table } from 'components/ui/Bootstrap';
import dashboardService from 'services/dashboardService';
import { getMonthToDateRange, isValidDateRange } from 'utils/dateUtils';
import { asArray, currency, integer, numberValue, textValue } from '../dashboardData';

const CHART_COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f97316', '#06b6d4', '#a855f7', '#ec4899', '#f59e0b'];

export default function LeadsDashboard() {
  const initialRange = useMemo(() => getMonthToDateRange(), []);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const [group, setGroup] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ group: [], people: [], users: [] });

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

  const groups = useMemo(
    () => [...new Set(data.group.map((item) => textValue(item, ['groupName', 'group', 'name'], '')).filter(Boolean))],
    [data.group]
  );
  const filteredGroups = group ? data.group.filter((item) => textValue(item, ['groupName', 'group', 'name'], '') === group) : data.group;
  const totalLeads = [...filteredGroups, ...data.people].reduce(
    (sum, item) => sum + numberValue(item, ['leadCount', 'totalLeads', 'leads', 'count']),
    0
  );

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

  const applyRange = (event) => {
    event.preventDefault();
    if (!isValidDateRange(draftRange)) {
      setError('Select a valid date range.');
      return;
    }
    setRange(draftRange);
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1 fw-bold">Leads Dashboard</h3>
        <p className="text-muted mb-0">
          Group-wise leads for {range.fromDate} to {range.toDate}
        </p>
      </div>

      <DashboardRangeToolbar
        range={draftRange}
        onRangeChange={setDraftRange}
        onApply={applyRange}
        onRefresh={() => setRefreshKey((value) => value + 1)}
        loading={loading}
      >
        <Col sm={6} lg={3} xl={2}>
          <Form.Label htmlFor="lead-group">Group</Form.Label>
          <Form.Select id="lead-group" value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="">All groups</option>
            {groups.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Form.Select>
        </Col>
      </DashboardRangeToolbar>

      {error && (
        <Alert variant="warning" className="mb-4">
          {error}
        </Alert>
      )}

      <Row className="g-3 mb-4">
        <Col md={4}>
          <DashboardMetricCard
            icon={Users}
            label="Total leads"
            value={integer.format(totalLeads)}
            detail={`${groups.length} active groups`}
            tone="primary"
          />
        </Col>
        <Col md={4}>
          <DashboardMetricCard
            icon={BarChart3}
            label="Sales people"
            value={data.people.length}
            detail="Included in this date range"
            tone="success"
          />
        </Col>
        <Col md={4}>
          <DashboardMetricCard
            icon={TrendingUp}
            label="Financial rows"
            value={data.users.length}
            detail="User-wise summary records"
            tone="warning"
          />
        </Col>
      </Row>

      <div className="mb-4">
        <DashboardPanel
          title="Group Wise Leads"
          loading={loading}
          empty={!chart.series.length}
          emptyMessage="No lead activity found for this date range."
        >
          <Chart type="line" height={330} width="100%" {...chart} />
        </DashboardPanel>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-transparent d-flex align-items-center justify-content-between py-3">
          <div>
            <h5 className="mb-1 fw-semibold">User-wise Financial Summary</h5>
            <span className="small text-muted">Leads and sales per agent</span>
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
      </Card>
    </div>
  );
}
