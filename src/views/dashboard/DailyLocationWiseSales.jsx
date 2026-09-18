import { useCallback, useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import {
  Calendar,
  CircleDollarSign,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  TrendingUp,
  Award
} from 'lucide-react';

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

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
});

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
});

export default function DailyLocationWiseSales() {
  const initialRange = useMemo(getInitialRange, []);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const currentUser = authService.getUser();

  const fetchDailySales = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getDailyLocationWiseSales(range.fromDate, range.toDate, signal);
      const items = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setSalesData(items);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to load daily location-wise sales data.');
        setSalesData([]);
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [range]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDailySales(controller.signal);
    return () => controller.abort();
  }, [fetchDailySales, refreshKey]);

  const handleApplyFilter = (e) => {
    e.preventDefault();
    if (draftRange.fromDate > draftRange.toDate) {
      setError('From Date cannot be later than To Date.');
      return;
    }
    setRange(draftRange);
    setCurrentPage(1);
  };

  // Metrics computation
  const metrics = useMemo(() => {
    let totalSalesSum = 0;
    let daysWithSales = 0;
    let peakSale = { date: '-', totalSales: 0 };
    const locationSet = new Set();

    salesData.forEach((row) => {
      const val = Number(row?.totalSales) || 0;
      totalSalesSum += val;
      if (val > 0) daysWithSales += 1;
      if (val > peakSale.totalSales) {
        peakSale = { date: row?.date || '-', totalSales: val };
      }

      if (Array.isArray(row?.locationSales)) {
        row.locationSales.forEach((loc) => {
          const locName = loc?.locationName || loc?.location || loc?.name;
          if (locName) locationSet.add(locName);
        });
      }
    });

    return {
      totalSalesSum,
      daysTracked: salesData.length,
      daysWithSales,
      peakSale,
      locationCount: locationSet.size
    };
  }, [salesData]);

  // Chart config
  const chartConfig = useMemo(() => {
    const categories = salesData.map((d) => d.date || '-');
    const values = salesData.map((d) => Number(d.totalSales) || 0);

    return {
      options: {
        chart: {
          type: 'area',
          toolbar: { show: false },
          zoom: { enabled: false },
          fontFamily: 'inherit'
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2.5 },
        colors: ['#4f46e5'],
        fill: {
          type: 'solid',
          opacity: 0.1
        },
        xaxis: {
          categories,
          labels: {
            rotate: -45,
            rotateAlways: categories.length > 20,
            style: { fontSize: '11px', colors: '#64748b' }
          },
          tickAmount: Math.min(categories.length, 15)
        },
        yaxis: {
          labels: {
            formatter: (v) => compactNumber.format(v),
            style: { fontSize: '11px', colors: '#64748b' }
          }
        },
        tooltip: {
          y: { formatter: (v) => currency.format(v) }
        },
        grid: {
          borderColor: 'rgba(226, 232, 240, 0.8)',
          strokeDashArray: 4
        }
      },
      series: [
        {
          name: 'Daily Total Sales',
          data: values
        }
      ]
    };
  }, [salesData]);

  // Filtered rows for table
  const filteredData = useMemo(() => {
    if (!searchTerm) return salesData;
    const term = searchTerm.toLowerCase();
    return salesData.filter((row) => {
      const dateMatch = String(row?.date || '').toLowerCase().includes(term);
      const salesMatch = String(row?.totalSales || '').includes(term);
      const locMatch = Array.isArray(row?.locationSales)
        ? row.locationSales.some((loc) =>
            String(loc?.locationName || loc?.location || '').toLowerCase().includes(term)
          )
        : false;
      return dateMatch || salesMatch || locMatch;
    });
  }, [salesData, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const displayedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="card shadow-sm border-0">
        <div className="card-header d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 bg-transparent py-3">
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 d-inline-flex align-items-center">
                <MapPin size={20} />
              </span>
              <div>
                <h5 className="mb-0 fw-bold text-gray-800">Daily Location Wise Sales</h5>
                <small className="text-muted">
                  API: <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">/Dashboard/DailyLocationWiseSales</code>
                </small>
              </div>
            </div>
          </div>

          {/* Date Filter Form */}
          <form onSubmit={handleApplyFilter} className="d-flex flex-wrap align-items-center gap-2">
            <div className="d-flex align-items-center gap-1 bg-light rounded px-2 py-1 border">
              <Calendar size={14} className="text-muted" />
              <input
                type="date"
                className="form-control form-control-sm border-0 bg-transparent p-0"
                style={{ width: '130px', fontSize: '12px' }}
                value={draftRange.fromDate}
                onChange={(e) => setDraftRange((p) => ({ ...p, fromDate: e.target.value }))}
                aria-label="From date"
              />
            </div>
            <span className="text-muted small">to</span>
            <div className="d-flex align-items-center gap-1 bg-light rounded px-2 py-1 border">
              <Calendar size={14} className="text-muted" />
              <input
                type="date"
                className="form-control form-control-sm border-0 bg-transparent p-0"
                style={{ width: '130px', fontSize: '12px' }}
                value={draftRange.toDate}
                onChange={(e) => setDraftRange((p) => ({ ...p, toDate: e.target.value }))}
                aria-label="To date"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
              disabled={loading}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Filter size={13} />}
              Filter
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              title="Refresh live data"
            >
              <RefreshCw size={13} />
            </button>
          </form>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger py-2 px-3 mb-0 small" role="alert">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm p-3 h-100">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '48px', height: '48px', background: 'rgba(79, 70, 229, 0.12)', color: '#4f46e5' }}
              >
                <CircleDollarSign size={22} />
              </div>
              <div>
                <span className="text-muted small fw-medium d-block">Period Total Sales</span>
                <h4 className="mb-0 fw-bold text-gray-800">{currency.format(metrics.totalSalesSum)}</h4>
                <small className="text-muted">{metrics.daysWithSales} active sales days</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm p-3 h-100">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '48px', height: '48px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}
              >
                <TrendingUp size={22} />
              </div>
              <div>
                <span className="text-muted small fw-medium d-block">Days Tracked</span>
                <h4 className="mb-0 fw-bold text-gray-800">{metrics.daysTracked} Days</h4>
                <small className="text-success">{range.fromDate} ~ {range.toDate}</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm p-3 h-100">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '48px', height: '48px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}
              >
                <Award size={22} />
              </div>
              <div>
                <span className="text-muted small fw-medium d-block">Peak Day Sales</span>
                <h4 className="mb-0 fw-bold text-gray-800">{currency.format(metrics.peakSale.totalSales)}</h4>
                <small className="text-muted">Date: {metrics.peakSale.date}</small>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm p-3 h-100">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '48px', height: '48px', background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9' }}
              >
                <MapPin size={22} />
              </div>
              <div>
                <span className="text-muted small fw-medium d-block">Locations Active</span>
                <h4 className="mb-0 fw-bold text-gray-800">
                  {metrics.locationCount > 0 ? metrics.locationCount : 'All Locations'}
                </h4>
                <small className="text-muted">Filtered by date range</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Sales Trend Chart */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-transparent py-3 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <TrendingUp size={16} className="text-indigo-600" />
            <h6 className="mb-0 fw-bold text-gray-800">Daily Sales Timeline</h6>
          </div>
          <span className="badge bg-indigo-50 text-indigo-600 border border-indigo-200">
            {salesData.length} Data Points
          </span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <Loader2 size={24} className="animate-spin text-indigo-600 mb-2" />
              <p className="text-muted small mb-0">Loading daily sales timeline from API...</p>
            </div>
          ) : salesData.length > 0 ? (
            <Chart type="area" width="100%" height={320} {...chartConfig} />
          ) : (
            <div className="text-center py-5 text-muted small">
              No sales data returned for the selected date range.
            </div>
          )}
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-transparent py-3 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
          <div>
            <h6 className="mb-0 fw-bold text-gray-800">Daily Records Breakdown</h6>
            <small className="text-muted">Live entries from DailyLocationWiseSales</small>
          </div>

          {/* Search box */}
          <div className="position-relative" style={{ maxWidth: '260px' }}>
            <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-muted" />
            <input
              type="text"
              className="form-control form-control-sm ps-4 bg-light"
              placeholder="Search by date, sales..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
            <thead className="table-light">
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Date</th>
                <th>Total Sales</th>
                <th>Location Details</th>
                <th className="text-end">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-5">
                    <Loader2 size={20} className="animate-spin text-indigo-600 mb-2" />
                    <p className="text-muted small mb-0">Connecting to API...</p>
                  </td>
                </tr>
              ) : displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    No matching sales records found.
                  </td>
                </tr>
              ) : (
                displayedRows.map((item, idx) => {
                  const val = Number(item?.totalSales) || 0;
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const locations = Array.isArray(item?.locationSales) ? item.locationSales : [];

                  return (
                    <tr key={`${item?.date}-${idx}`}>
                      <td className="text-muted">{rowNum}</td>
                      <td>
                        <span className="fw-semibold text-gray-800">{item?.date || '-'}</span>
                      </td>
                      <td>
                        <span className={`fw-bold ${val > 0 ? 'text-indigo-600' : 'text-muted'}`}>
                          {currency.format(val)}
                        </span>
                      </td>
                      <td>
                        {locations.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1">
                            {locations.map((loc, lIdx) => (
                              <span
                                key={lIdx}
                                className="badge bg-light text-dark border px-2 py-1"
                                style={{ fontSize: '0.75rem' }}
                              >
                                {loc?.locationName || loc?.location || 'Location'}:{' '}
                                <strong>{currency.format(Number(loc?.sales || loc?.totalSales) || 0)}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted small">Standard Location</span>
                        )}
                      </td>
                      <td className="text-end">
                        {val > 0 ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                            Active
                          </span>
                        ) : (
                          <span className="badge bg-light text-muted border px-2 py-1">
                            Zero Sales
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredData.length > pageSize && (
          <div className="card-footer bg-transparent py-2 d-flex align-items-center justify-content-between">
            <small className="text-muted">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} records
            </small>
            <div className="d-flex gap-1">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-2 py-1"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="btn btn-light btn-sm disabled px-2 py-1">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-2 py-1"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
