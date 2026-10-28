import apiClient from './core/apiClient';

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const dailySalesReportService = {
  async getPerformanceReport({ fromDate, toDate }, signal) {
    if (!fromDate || !toDate || fromDate > toDate) throw new Error('Choose a valid report date range.');
    const payload = await apiClient.get(
      '/Report/GetUserPerformanceReport',
      {
        fromDate: fromDate.includes('T') ? fromDate : `${fromDate}T00:00:00`,
        toDate: toDate.includes('T') ? toDate : `${toDate}T23:59:59`
      },
      signal
    );
    const data = payload?.data ?? payload;
    if (!data || !Array.isArray(data.userSalePayments) || !Array.isArray(data.userLeads)) {
      throw new Error('The sales report returned an unexpected response. Please try again.');
    }

    return {
      userSalePayments: Array.isArray(data.userSalePayments) ? data.userSalePayments : [],
      userLeads: Array.isArray(data.userLeads) ? data.userLeads : []
    };
  },

  async getLocations(signal) {
    const payload = await apiClient.get('/Location/LocationDropdown', undefined, signal);
    return unwrapList(payload)
      .map((location) => ({
        locationId: Number(location?.locationId ?? location?.id ?? 0),
        name: String(location?.name ?? location?.locationName ?? '').trim()
      }))
      .filter((location) => location.locationId > 0);
  },

  async getUsers(signal) {
    const payload = await apiClient.get(
      '/User',
      {
        Text: '',
        PageNumber: 1,
        PageSize: 5000,
        SortProperty: 'userId',
        IsDescending: false
      },
      signal
    );
    return unwrapList(payload);
  },

  async getDashboardData(filters, signal) {
    const [report, locations, users] = await Promise.all([
      this.getPerformanceReport(filters, signal),
      this.getLocations(signal),
      this.getUsers(signal)
    ]);

    return { report, locations, users };
  }
};

export default dailySalesReportService;
