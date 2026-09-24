import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'react-apexcharts';
import { Banknote, CircleDollarSign, ExternalLink, MapPin, TicketCheck, TrendingUp, Users } from 'lucide-react';

import DashboardDateFilter from 'components/dashboard/DashboardDateFilter';
import DashboardMetricCard from 'components/dashboard/DashboardMetricCard';
import DashboardPanel from 'components/dashboard/DashboardPanel';
import { Alert, Badge, Button, Card, Col, Row, Spinner, Table } from 'components/ui/Bootstrap';
import authService from 'services/authService';
import dashboardService from 'services/dashboardService';
import { getMonthToDateRange, isValidDateRange } from 'utils/dateUtils';

const API_COUNT = 8;
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return [value.items, value.rows, value.users, value.data, value.result].find(Array.isArray) || [];
};

const numberFrom = (item, keys) => {
  for (const key of keys) {
    const value = Number(item?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
};

const textFrom = (item, keys, fallback = '-') => {
  for (const key of keys) {
    const value = String(item?.[key] ?? '').trim();
    if (value) return value;
  }
  return fallback;
};

export default function DashSales() {
  const initialRange = useMemo(() => getMonthToDateRange(), []);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [dashboardData, setDashboardData] = useState({});

  const currentUser = authService.getUser();
  const roleName = String(currentUser?.role || '').toLowerCase();
  const isAdmin = ['admin', 'developer', 'sales manager'].some((role) => roleName.includes(role));
  const scopedUserId = isAdmin ? undefined : currentUser?.userId;

  const loadDashboard = useCallback(
    async (signal) => {
      setLoading(true);
      setErrors([]);
      try {
        const result = await dashboardService.loadDashboard({ ...range, userId: scopedUserId, signal });
        setDashboardData(result.data);
        setErrors(result.errors);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setDashboardData({});
          setErrors([{ name: 'dashboard', message: error.message || 'Dashboard request failed' }]);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [range, scopedUserId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard, refreshKey]);

  const userRows = toArray(dashboardData.userSummary?.data);
  const dayRows = toArray(dashboardData.dayWiseSales?.data);
  const locationRows = toArray(dashboardData.locationSales?.data).map((item) => ({
    locationName: textFrom(item, ['locationName', 'name', 'location'], 'Unknown'),
    totalSales: numberFrom(item?.monthlyTotalSalesDTO || item, ['totalSales', 'monthlyTotalSales', 'sales']),
    totalLeads: numberFrom(item?.monthlyTotalSalesDTO || item, ['totalLeads', 'leadCount', 'leads']),
    rpl: numberFrom(item?.monthlyTotalSalesDTO || item, ['rpl', 'RPL'])
  }));
  const monthlyRows = toArray(dashboardData.monthlyFinancial?.data);
  const dailyLocationRows = toArray(dashboardData.dailyLocationSales?.data);
  const groupRows = toArray(dashboardData.groupLeads?.data);
  const salesPersonRows = toArray(dashboardData.salesPersonLeads?.data);
  const serviceRows = toArray(dashboardData.serviceManager?.data);

  const summary = useMemo(
    () =>
      userRows.reduce(
        (total, item) => ({
          sales: total.sales + numberFrom(item, ['totalSales']),
          salesCount: total.salesCount + numberFrom(item, ['totalSalesCount', 'salesCount']),
          refunds: total.refunds + numberFrom(item, ['totalRefunds']),
          voids: total.voids + numberFrom(item, ['totalVoids']),
          net: total.net + numberFrom(item, ['netAmount'])
        }),
        { sales: 0, salesCount: 0, refunds: 0, voids: 0, net: 0 }
      ),
    [userRows]
  );

  const totalLeads = dayRows.reduce((total, item) => total + numberFrom(item, ['totalLeads', 'leadCount']), 0);
  const serviceTotal = dashboardData.serviceManager?.totalCount || serviceRows.length;

  const dayChart = useMemo(
    () => ({
      options: {
        chart: { toolbar: { show: false } },
        dataLabels: { enabled: false },
        stroke: { width: [0, 3], curve: 'smooth' },
        colors: ['#6366f1', '#f59e0b'],
        xaxis: { categories: dayRows.map((item) => textFrom(item, ['day', 'date'], 'Day')) },
        yaxis: [{ title: { text: 'Sales' } }, { opposite: true, title: { text: 'RPL' } }],
        tooltip: { shared: true, intersect: false },
        legend: { position: 'top' }
      },
      series: [
        { name: 'Total Sales', type: 'column', data: dayRows.map((item) => numberFrom(item, ['totalSales'])) },
        { name: 'RPL', type: 'line', data: dayRows.map((item) => numberFrom(item, ['rpl', 'RPL'])) }
      ]
    }),
    [dayRows]
  );

  const locationChart = useMemo(
    () => ({
      options: {
        labels: locationRows.map((item) => item.locationName),
        legend: { position: 'bottom' },
        dataLabels: { formatter: (value) => `${Math.round(value)}%` },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6']
      },
      series: locationRows.map((item) => item.totalSales)
    }),
    [locationRows]
  );

  const financialChart = useMemo(() => {
    const rows = monthlyRows.length > 0 ? monthlyRows : dailyLocationRows;
    return {
      options: {
        chart: { toolbar: { show: false } },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3 },
        colors: ['#10b981'],
        xaxis: { categories: rows.map((item) => textFrom(item, ['monthName', 'month', 'date', 'day', 'locationName'], 'Period')) },
        yaxis: { labels: { formatter: (value) => compactNumber.format(value) } },
        tooltip: { y: { formatter: (value) => currency.format(value) } }
      },
      series: [{ name: 'Financial Sales', data: rows.map((item) => numberFrom(item, ['totalSales', 'sales', 'amount', 'netAmount', 'monthlyTotalSales'])) }]
    };
  }, [dailyLocationRows, monthlyRows]);

  const dailyLocationChart = useMemo(
    () => ({
      options: {
        chart: { toolbar: { show: false } },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2.5 },
        colors: ['#4f46e5'],
        xaxis: {
          categories: dailyLocationRows.map((item) => textFrom(item, ['date', 'day'], 'Date')),
          tickAmount: Math.min(dailyLocationRows.length, 14)
        },
        yaxis: { labels: { formatter: (value) => compactNumber.format(value) } },
        tooltip: { y: { formatter: (value) => currency.format(value) } }
      },
      series: [{ name: 'Daily Total Sales', data: dailyLocationRows.map((item) => numberFrom(item, ['totalSales', 'sales'])) }]
    }),
    [dailyLocationRows]
  );

  const leadRows = useMemo(() => {
    const normalizedGroups = groupRows.map((item, index) => ({
      id: `group-${index}`,
      source: 'Group',
      name: textFrom(item, ['groupName', 'group', 'name'], 'Unknown group'),
      leads: numberFrom(item, ['leadCount', 'totalLeads', 'leads']),
      converted: numberFrom(item, ['convertedLeads', 'converted', 'salesCount'])
    }));
    const normalizedPeople = salesPersonRows.map((item, index) => ({
      id: `person-${index}`,
      source: 'Sales Person',
      name: textFrom(item, ['userName', 'fullName', 'salesPersonName', 'name'], 'Unknown user'),
      leads: numberFrom(item, ['leadCount', 'totalLeads', 'leads']),
      converted: numberFrom(item, ['convertedLeads', 'converted', 'salesCount'])
    }));
    return [...normalizedGroups, ...normalizedPeople].sort((left, right) => right.leads - left.leads).slice(0, 10);
  }, [groupRows, salesPersonRows]);

  const applyRange = (event) => {
    event.preventDefault();
    if (!isValidDateRange(draftRange)) {
      setErrors([{ name: 'date', message: 'Select a valid date range.' }]);
      return;
    }
    setRange(draftRange);
  };

  return (
    <div>
      <DashboardDateFilter
        value={draftRange}
        onChange={setDraftRange}
        onApply={applyRange}
        onRefresh={() => setRefreshKey((value) => value + 1)}
        loading={loading}
        connectedCount={Math.max(0, API_COUNT - errors.length)}
        totalCount={API_COUNT}
      />

      {errors.length > 0 && (
        <Alert variant="warning" className="mb-4">
          Some sections could not load: {errors.map((error) => error.message).join(' · ')}
        </Alert>
      )}

      <Row className="g-3 mb-4">
        <Col sm={6} xl={3}><DashboardMetricCard icon={CircleDollarSign} label="Total Sales" value={currency.format(summary.sales)} detail={`${summary.salesCount} transactions`} tone="primary" /></Col>
        <Col sm={6} xl={3}><DashboardMetricCard icon={Banknote} label="Net Amount" value={currency.format(summary.net)} detail={`${currency.format(summary.refunds)} refunds`} tone="success" /></Col>
        <Col sm={6} xl={3}><DashboardMetricCard icon={Users} label="Total Leads" value={compactNumber.format(totalLeads)} detail={`${salesPersonRows.length} sales people`} tone="warning" /></Col>
        <Col sm={6} xl={3}><DashboardMetricCard icon={TicketCheck} label="Service Tickets" value={compactNumber.format(serviceTotal)} detail={`${serviceRows.length} records loaded`} tone="danger" /></Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col xl={8}>
          <DashboardPanel title="Day Wise Sales & RPL" loading={loading} empty={!dayRows.length} emptyMessage="No day-wise sales data found.">
            <Chart type="line" width="100%" height={330} {...dayChart} />
          </DashboardPanel>
        </Col>
        <Col xl={4}>
          <DashboardPanel title="Location Wise Sales" loading={loading} empty={!locationRows.some((item) => item.totalSales > 0)} emptyMessage="No location sales data found.">
            <Chart type="donut" width="100%" height={330} {...locationChart} />
          </DashboardPanel>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col xl={6}>
          <DashboardPanel title="Monthly Financial Data" loading={loading} empty={!financialChart.series[0].data.length} emptyMessage="No financial data found.">
            <Chart type="area" width="100%" height={300} {...financialChart} />
          </DashboardPanel>
        </Col>
        <Col xl={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-transparent py-3"><h5 className="mb-0 fw-semibold">Group & Sales Person Leads</h5></Card.Header>
            <div className="table-responsive">
              <Table className="align-middle mb-0">
                <thead className="table-light"><tr><th>Type</th><th>Name</th><th className="text-end">Leads</th><th className="text-end">Converted</th></tr></thead>
                <tbody>
                  {loading && <tr><td colSpan={4} className="text-center py-5"><Spinner size="sm" className="me-2" />Loading...</td></tr>}
                  {!loading && leadRows.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-5">No lead data found.</td></tr>}
                  {!loading && leadRows.map((item) => (
                    <tr key={item.id}>
                      <td><Badge bg="secondary">{item.source}</Badge></td>
                      <td className="fw-semibold">{item.name}</td>
                      <td className="text-end">{item.leads}</td>
                      <td className="text-end">{item.converted}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-transparent d-flex flex-wrap align-items-center justify-content-between gap-3 py-3">
          <div className="d-flex align-items-center gap-2">
            <span className="d-inline-flex align-items-center justify-content-center rounded-3 bg-indigo-50 text-indigo-600 p-2"><MapPin size={18} /></span>
            <div><h5 className="mb-1 fw-semibold">Daily Location Wise Sales</h5><span className="text-muted small">Live endpoint: /Dashboard/DailyLocationWiseSales</span></div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Badge bg="primary" className="px-3 py-2">{dailyLocationRows.length} days recorded</Badge>
            <Button as={Link} to="/Dashboard/DailyLocationWiseSales" size="sm" variant="outline-primary" className="d-inline-flex align-items-center gap-2">Full details <ExternalLink size={13} /></Button>
          </div>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center text-muted py-5"><Spinner size="sm" className="me-2" />Loading data...</div>
          ) : dailyLocationRows.length === 0 ? (
            <div className="text-center text-muted py-5">No daily location-wise sales data available.</div>
          ) : (
            <Row className="g-4">
              <Col lg={8}><Chart type="area" width="100%" height={280} {...dailyLocationChart} /></Col>
              <Col lg={4}>
                <h6 className="small fw-semibold text-muted text-uppercase mb-3">Recent daily entries</h6>
                <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                  {dailyLocationRows.slice(0, 10).map((row, index) => {
                    const salesValue = numberFrom(row, ['totalSales', 'sales']);
                    return (
                      <div key={`${row.date || 'day'}-${index}`} className="d-flex align-items-center justify-content-between rounded bg-light px-3 py-2 mb-2 small">
                        <span className="fw-semibold">{row.date || `Day ${index + 1}`}</span>
                        <span className={salesValue > 0 ? 'fw-semibold text-primary' : 'text-muted'}>{currency.format(salesValue)}</span>
                      </div>
                    );
                  })}
                </div>
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-transparent d-flex align-items-center justify-content-between py-3"><h5 className="mb-0 fw-semibold">User Wise Summary</h5><TrendingUp size={18} className="text-primary" /></Card.Header>
        <div className="table-responsive">
          <Table className="align-middle mb-0">
            <thead className="table-light"><tr><th>User</th><th className="text-end">Sales</th><th className="text-end">Transactions</th><th className="text-end">Refunds</th><th className="text-end">Voids</th><th className="text-end">Net Amount</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-5"><Spinner size="sm" className="me-2" />Loading...</td></tr>}
              {!loading && userRows.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-5">No user summary data found.</td></tr>}
              {!loading && userRows.map((item, index) => (
                <tr key={item.userId || index}>
                  <td><div className="fw-semibold">{textFrom(item, ['userName', 'fullName'], 'Unknown')}</div><div className="small text-muted">{item.email || ''}</div></td>
                  <td className="text-end fw-semibold">{currency.format(numberFrom(item, ['totalSales']))}</td>
                  <td className="text-end">{numberFrom(item, ['totalSalesCount', 'salesCount'])}</td>
                  <td className="text-end text-warning">{currency.format(numberFrom(item, ['totalRefunds']))}</td>
                  <td className="text-end text-danger">{currency.format(numberFrom(item, ['totalVoids']))}</td>
                  <td className="text-end fw-semibold text-success">{currency.format(numberFrom(item, ['netAmount']))}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
