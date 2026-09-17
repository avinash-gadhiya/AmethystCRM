export function SalesCustomerSatisfactionChartData(labels, series) {
  const defaultLabels = ['extremely Satisfied', 'Satisfied', 'Poor', 'Very Poor'];
  const defaultSeries = [66, 50, 40, 30];

  return {
    height: 260,
    options: {
      chart: {
        background: 'transparent'
      },
      labels: labels && labels.length > 0 ? labels : defaultLabels,
      legend: {
        show: true,
        offsetY: 50
      },
      dataLabels: {
        enabled: true,
        dropShadow: {
          enabled: false
        }
      },
      theme: {
        mode: 'light',
        monochrome: {
          enabled: true,
          color: '#7267EF'
        }
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: {
              height: 320
            },
            legend: {
              position: 'bottom',
              offsetY: 0
            }
          }
        }
      ]
    },
    series: series && series.length > 0 ? series : defaultSeries
  };
}
