import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';
import { Award, BarChart3, LineChart, MapPin } from 'lucide-react';

import { formatDailySalesCurrency, formatDailySalesDateRange, formatDailySalesPercentage } from '@/utils/dailySalesReportUtils';

const baseChartOptions = {
  chart: {
    background: 'transparent',
    fontFamily: 'Inter, sans-serif',
    toolbar: { show: false },
    animations: { speed: 350 }
  },
  dataLabels: { enabled: false },
  grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
  legend: { labels: { colors: '#64748b' } },
  tooltip: { theme: 'dark' },
  xaxis: {
    labels: { style: { colors: '#64748b', fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' } } }
};

function ChartCard({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="daily-sales-chart-card">
      <header className="daily-sales-chart-header">
        <span className="daily-sales-chart-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="daily-sales-chart-body">{children}</div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="daily-sales-chart-empty">
      <BarChart3 size={28} />
      <span>No report data for the active filters.</span>
    </div>
  );
}

export default function DailySalesReportCharts({ rows, locationGroups, summary, range, loading }) {
  const periodLabel = formatDailySalesDateRange(range);
  const locationNames = locationGroups.map((group) => group.locationName);
  const rankedAgents = [...rows].sort((left, right) => right.salesAmount - left.salesAmount).slice(0, 10);

  const periodOptions = {
    ...baseChartOptions,
    colors: ['#6366f1'],
    plotOptions: { bar: { borderRadius: 7, columnWidth: '42%' } },
    xaxis: { ...baseChartOptions.xaxis, categories: [periodLabel] },
    yaxis: {
      ...baseChartOptions.yaxis,
      labels: { ...baseChartOptions.yaxis.labels, formatter: (value) => formatDailySalesCurrency(value) }
    },
    tooltip: { ...baseChartOptions.tooltip, y: { formatter: formatDailySalesCurrency } }
  };

  const locationOptions = {
    ...baseChartOptions,
    colors: ['#8b5cf6'],
    plotOptions: { bar: { borderRadius: 5, columnWidth: '55%' } },
    xaxis: { ...baseChartOptions.xaxis, categories: locationNames },
    yaxis: {
      ...baseChartOptions.yaxis,
      labels: { ...baseChartOptions.yaxis.labels, formatter: (value) => formatDailySalesCurrency(value) }
    },
    tooltip: { ...baseChartOptions.tooltip, y: { formatter: formatDailySalesCurrency } }
  };

  const comparisonOptions = {
    ...baseChartOptions,
    colors: ['#0ea5e9', '#10b981'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '58%' } },
    xaxis: { ...baseChartOptions.xaxis, categories: locationNames },
    yaxis: { ...baseChartOptions.yaxis, min: 0, forceNiceScale: true },
    tooltip: { ...baseChartOptions.tooltip, y: { formatter: (value) => Math.round(value).toLocaleString() } }
  };

  return (
    <div className="daily-sales-visuals">
      <div className="daily-sales-chart-grid">
        <ChartCard
          icon={LineChart}
          title="Daily Sales"
          subtitle="The API returns selected-period totals, so no synthetic daily values are plotted."
        >
          {loading ? (
            <div className="daily-sales-chart-skeleton" />
          ) : rows.length ? (
            <Chart type="bar" height={290} options={periodOptions} series={[{ name: 'Sales', data: [summary.totalSales] }]} />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard icon={MapPin} title="Location Sales" subtitle="Sales amount by location for the selected period.">
          {loading ? (
            <div className="daily-sales-chart-skeleton" />
          ) : locationGroups.length ? (
            <Chart
              type="bar"
              height={290}
              options={locationOptions}
              series={[{ name: 'Sales', data: locationGroups.map((group) => group.totalSales) }]}
            />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard icon={BarChart3} title="Sales vs Leads" subtitle="Lead volume compared with closed sales by location.">
          {loading ? (
            <div className="daily-sales-chart-skeleton" />
          ) : locationGroups.length ? (
            <Chart
              type="bar"
              height={290}
              options={comparisonOptions}
              series={[
                { name: 'Leads', data: locationGroups.map((group) => group.totalLeads) },
                { name: 'Closed sales', data: locationGroups.map((group) => group.salesClosed) }
              ]}
            />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard icon={Award} title="Agent Performance Ranking" subtitle="Agents ranked by sales amount.">
          {loading ? (
            <div className="daily-sales-ranking-skeleton">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          ) : rankedAgents.length ? (
            <ol className="daily-sales-ranking-list">
              {rankedAgents.map((agent, index) => (
                <li key={agent.key} className={index < 3 ? `rank-top-${index + 1}` : ''}>
                  <span className="daily-sales-rank-number">{index + 1}</span>
                  <span className="daily-sales-rank-agent">
                    <strong>{agent.userName}</strong>
                    <small>{agent.locationName}</small>
                  </span>
                  <span className="daily-sales-rank-result">
                    <strong>{formatDailySalesCurrency(agent.salesAmount)}</strong>
                    <small>{formatDailySalesPercentage(agent.conversionRate)} conversion</small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

const rowShape = PropTypes.shape({
  key: PropTypes.string.isRequired,
  userName: PropTypes.string.isRequired,
  locationName: PropTypes.string.isRequired,
  salesAmount: PropTypes.number.isRequired,
  conversionRate: PropTypes.number.isRequired
});

DailySalesReportCharts.propTypes = {
  rows: PropTypes.arrayOf(rowShape).isRequired,
  locationGroups: PropTypes.arrayOf(
    PropTypes.shape({
      locationName: PropTypes.string.isRequired,
      totalSales: PropTypes.number.isRequired,
      totalLeads: PropTypes.number.isRequired,
      salesClosed: PropTypes.number.isRequired
    })
  ).isRequired,
  summary: PropTypes.shape({ totalSales: PropTypes.number.isRequired }).isRequired,
  range: PropTypes.shape({ fromDate: PropTypes.string.isRequired, toDate: PropTypes.string.isRequired }).isRequired,
  loading: PropTypes.bool.isRequired
};

ChartCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired
};
