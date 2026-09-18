import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'react-apexcharts';
import { Banknote, CircleDollarSign, ExternalLink, Loader2, MapPin, RefreshCw, TicketCheck, TrendingUp, Users } from 'lucide-react';

import authService from 'services/authService';
import dashboardService from 'services/dashboardService';

const toInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitialRange = () => {
  const today = new Date();
  return {
    fromDate: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    toDate: toInputDate(today)
  };
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const candidates = [value.items, value.rows, value.users, value.data, value.result];
  return candidates.find(Array.isArray) || [];
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

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const TONE_CLASSES = {
  primary: { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-100' },
  success: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
  warning: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100' },
  danger:  { bg: 'bg-red-50',    icon: 'text-red-600',    border: 'border-red-100' },
};

const MetricCard = ({ icon: Icon, label, value, detail, tone }) => {
  const t = TONE_CLASSES[tone] || TONE_CLASSES.primary;
  return (
    <div className="card flex-row items-center gap-4 p-5">
      <div className={`w-12 h-12 rounded-2xl ${t.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className={t.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
        <div className="text-xl font-bold text-gray-800 truncate">{value}</div>
        <p className="text-xs text-gray-400 mb-0 truncate">{detail}</p>
      </div>
    </div>
  );
};

const EmptyChart = ({ loading, message }) => (
  <div className="flex items-center justify-center text-gray-400 text-sm" style={{ minHeight: 310 }}>
    {loading ? (
      <><Loader2 size={16} className="animate-spin mr-2" /> Loading data...</>
    ) : message}
  </div>
);

export default function DashSales() {
  const initialRange = useMemo(getInitialRange, []);
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

  const dayChart = useMemo(() => ({
    options: {
      chart: { toolbar: { show: false }, stacked: false },
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
  }), [dayRows]);

  const locationChart = useMemo(() => ({
    options: {
      labels: locationRows.map((item) => item.locationName),
      legend: { position: 'bottom' },
      dataLabels: { formatter: (value) => `${Math.round(value)}%` },
      colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6']
    },
    series: locationRows.map((item) => item.totalSales)
  }), [locationRows]);

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

  const dailyLocationChart = useMemo(() => {
    return {
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
      series: [
        {
          name: 'Daily Total Sales',
          data: dailyLocationRows.map((item) => numberFrom(item, ['totalSales', 'sales']))
        }
      ]
    };
  }, [dailyLocationRows]);

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
    return [...normalizedGroups, ...normalizedPeople].sort((l, r) => r.leads - l.leads).slice(0, 10);
  }, [groupRows, salesPersonRows]);

  const applyRange = (event) => {
    event.preventDefault();
    if (draftRange.fromDate > draftRange.toDate) {
      setErrors([{ name: 'date', message: 'From date cannot be later than to date.' }]);
      return;
    }
    setRange(draftRange);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar Card */}
      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h5 className="text-base font-semibold text-gray-800 mb-0.5">CRM Dashboard</h5>
            <p className="text-xs text-gray-400 mb-0">Live sales, leads, financial and service data</p>
          </div>
          <span className={`inline-flex items-center self-start sm:self-auto px-3 py-1.5 rounded-full text-xs font-semibold ${errors.length ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {loading ? 'Syncing APIs…' : `${8 - errors.length}/8 APIs connected`}
          </span>
        </div>
        <div className="card-body">
          <form onSubmit={applyRange}>
            <div className="flex flex-col sm:flex-row flex-wrap sm:items-end gap-3">
              <div className="w-full sm:w-auto flex-1 sm:flex-initial">
                <label className="block text-xs font-medium text-gray-500 mb-1">From date</label>
                <input
                  type="date"
                  className="form-control w-full"
                  value={draftRange.fromDate}
                  onChange={(e) => setDraftRange((c) => ({ ...c, fromDate: e.target.value }))}
                />
              </div>
              <div className="w-full sm:w-auto flex-1 sm:flex-initial">
                <label className="block text-xs font-medium text-gray-500 mb-1">To date</label>
                <input
                  type="date"
                  className="form-control w-full"
                  value={draftRange.toDate}
                  onChange={(e) => setDraftRange((c) => ({ ...c, toDate: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 pt-1 sm:pt-0">
                <button type="submit" className="btn btn-primary flex-1 sm:flex-initial" disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                  Apply
                </button>
                <button
                  type="button"
                  className="btn btn-secondary flex-1 sm:flex-initial"
                  disabled={loading}
                  onClick={() => setRefreshKey((v) => v + 1)}
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="alert alert-warning">
          Some sections could not load: {errors.map((e) => e.message).join(' · ')}
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard icon={CircleDollarSign} label="Total Sales" value={currency.format(summary.sales)} detail={`${summary.salesCount} transactions`} tone="primary" />
        <MetricCard icon={Banknote} label="Net Amount" value={currency.format(summary.net)} detail={`${currency.format(summary.refunds)} refunds`} tone="success" />
        <MetricCard icon={Users} label="Total Leads" value={compactNumber.format(totalLeads)} detail={`${salesPersonRows.length} sales people`} tone="warning" />
        <MetricCard icon={TicketCheck} label="Service Tickets" value={compactNumber.format(serviceTotal)} detail={`${serviceRows.length} records loaded`} tone="danger" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <div className="card-header"><h5 className="text-base font-semibold text-gray-800">Day Wise Sales & RPL</h5></div>
          <div className="card-body">
            {dayRows.length ? <Chart type="line" width="100%" height={330} {...dayChart} /> : <EmptyChart loading={loading} message="No day-wise sales data found." />}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h5 className="text-base font-semibold text-gray-800">Location Wise Sales</h5></div>
          <div className="card-body">
            {locationRows.some((item) => item.totalSales > 0)
              ? <Chart type="donut" width="100%" height={330} {...locationChart} />
              : <EmptyChart loading={loading} message="No location sales data found." />}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header"><h5 className="text-base font-semibold text-gray-800">Monthly Financial Data</h5></div>
          <div className="card-body">
            {financialChart.series[0].data.length
              ? <Chart type="area" width="100%" height={300} {...financialChart} />
              : <EmptyChart loading={loading} message="No financial data found." />}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h5 className="text-base font-semibold text-gray-800">Group & Sales Person Leads</h5></div>
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>Type</th><th>Name</th><th className="text-right">Leads</th><th className="text-right">Converted</th></tr></thead>
              <tbody>
                {!loading && leadRows.length === 0 && <tr><td colSpan={4} className="text-center text-gray-400 py-10">No lead data found.</td></tr>}
                {loading && <tr><td colSpan={4} className="text-center py-10"><Loader2 size={16} className="animate-spin inline mr-2" />Loading…</td></tr>}
                {!loading && leadRows.map((item) => (
                  <tr key={item.id}>
                    <td><span className="badge bg-secondary text-xs">{item.source}</span></td>
                    <td className="font-medium text-gray-800">{item.name}</td>
                    <td className="text-right">{item.leads}</td>
                    <td className="text-right">{item.converted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Daily Location Wise Sales Card */}
      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 inline-flex items-center">
              <MapPin size={18} />
            </span>
            <div>
              <h5 className="text-base font-semibold text-gray-800 mb-0.5">Daily Location Wise Sales</h5>
              <p className="text-xs text-gray-400 mb-0">
                Live endpoint: <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded text-xs">/Dashboard/DailyLocationWiseSales</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">
              {dailyLocationRows.length} Days Recorded
            </span>
            <Link
              to="/Dashboard/DailyLocationWiseSales"
              className="btn btn-outline-primary btn-sm flex items-center gap-1 text-xs"
            >
              Full Details <ExternalLink size={12} />
            </Link>
          </div>
        </div>
        <div className="card-body">
          {dailyLocationRows.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Chart type="area" width="100%" height={280} {...dailyLocationChart} />
              </div>
              <div className="border-t lg:border-t-0 lg:border-l pl-0 lg:pl-4">
                <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Daily Entries</h6>
                <div className="overflow-y-auto max-h-64 space-y-2 pr-1">
                  {dailyLocationRows.slice(0, 10).map((row, idx) => {
                    const salesVal = numberFrom(row, ['totalSales', 'sales']);
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-xs">
                        <span className="font-medium text-gray-700">{row.date || `Day ${idx + 1}`}</span>
                        <span className={`font-semibold ${salesVal > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                          {currency.format(salesVal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <EmptyChart loading={loading} message="No daily location-wise sales data available." />
          )}
        </div>
      </div>

      {/* User Wise Summary */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h5 className="text-base font-semibold text-gray-800">User Wise Summary</h5>
          <TrendingUp size={18} className="text-indigo-500" />
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th className="text-right">Sales</th>
                <th className="text-right">Transactions</th>
                <th className="text-right">Refunds</th>
                <th className="text-right">Voids</th>
                <th className="text-right">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-10"><Loader2 size={16} className="animate-spin inline mr-2" />Loading…</td></tr>}
              {!loading && userRows.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-10">No user summary data found.</td></tr>}
              {!loading && userRows.map((item, index) => (
                <tr key={item.userId || index}>
                  <td>
                    <div className="font-semibold text-gray-800">{textFrom(item, ['userName', 'fullName'], 'Unknown')}</div>
                    <div className="text-xs text-gray-400">{item.email || ''}</div>
                  </td>
                  <td className="text-right font-semibold text-gray-800">{currency.format(numberFrom(item, ['totalSales']))}</td>
                  <td className="text-right">{numberFrom(item, ['totalSalesCount', 'salesCount'])}</td>
                  <td className="text-right text-amber-500">{currency.format(numberFrom(item, ['totalRefunds']))}</td>
                  <td className="text-right text-red-500">{currency.format(numberFrom(item, ['totalVoids']))}</td>
                  <td className="text-right font-semibold text-emerald-600">{currency.format(numberFrom(item, ['netAmount']))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
