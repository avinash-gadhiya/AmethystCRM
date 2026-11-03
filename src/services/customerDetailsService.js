import customerService from './customerService';
import orderService from './orderService';
import ticketService from './ticketService';

// The list can contain contact fields omitted by the detail projection.
export const mergeCustomerDetails = (summary, details) => {
  const customer = { ...summary, ...details };
  for (const key of [
    'name',
    'email',
    'phone',
    'phone2',
    'address',
    'city',
    'stateName',
    'countryName',
    'zipCode',
    'salesPersonName',
    'createdDate'
  ]) {
    if (details?.[key] == null || String(details[key]).trim() === '') customer[key] = summary?.[key];
  }
  if (!Number(details?.salesPerson)) customer.salesPerson = summary?.salesPerson;
  return customer;
};

const loadCustomerRows = async (loadPage, customerId, rowKey, signal) => {
  const rows = [];
  const seen = new Set();
  for (let page = 1; page <= 1000; page += 1) {
    signal?.throwIfAborted();
    const result = await loadPage({ CustomerId: customerId, PageNumber: page, PageSize: 100 }, signal);
    if (!Array.isArray(result?.data)) throw new Error('The API returned an invalid list. Please retry.');
    let added = 0;
    for (const row of result.data) {
      const id = Number(row[rowKey]);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      added += 1;
      // Reject unrelated records if a server ignores its customer filter.
      if (row.customerId == null || Number(row.customerId) === customerId) rows.push(row);
    }
    const total = result.raw ? (result.raw.totalCount ?? result.raw.data?.totalCount ?? result.raw.totalRecords) : result.totalCount;
    if (total != null && Number.isFinite(Number(total)) && seen.size >= Number(total)) return rows;
    if (total == null && result.data.length < 100) return rows;
    if (result.data.length === 0 || added === 0) throw new Error('The customer records could not be fully loaded. Please retry.');
  }
  throw new Error('The customer records could not be fully loaded. Please retry.');
};

export const getCustomerDetails = async (summary, signal) => {
  const customerId = Number(summary?.customerId);
  if (!Number.isInteger(customerId) || customerId <= 0) throw new Error('Customer ID is required.');
  signal?.throwIfAborted();
  let customer = summary;
  let customerError = '';
  try {
    customer = mergeCustomerDetails(summary, await customerService.getCustomerById(customerId, signal));
  } catch (error) {
    if (signal?.aborted) throw error;
    customerError = error?.message || 'Unable to load customer details.';
  }
  // CustomerDTO includes these collections. Only call the collection APIs when
  // the customer response omits them; an explicit [] means no related records.
  const [orders, tickets] = await Promise.allSettled([
    Array.isArray(customer.getOrderListDTOs)
      ? customer.getOrderListDTOs
      : loadCustomerRows((params, requestSignal) => orderService.getOrders(params, requestSignal), customerId, 'orderId', signal),
    Array.isArray(customer.getTicketListDTOs)
      ? customer.getTicketListDTOs
      : loadCustomerRows((params, requestSignal) => ticketService.getTickets(params, requestSignal), customerId, 'ticketId', signal)
  ]);
  signal?.throwIfAborted();
  return {
    customer,
    orders: orders.status === 'fulfilled' ? orders.value : [],
    tickets: tickets.status === 'fulfilled' ? tickets.value : [],
    errors: {
      customer: customerError,
      orders: orders.status === 'rejected' ? orders.reason?.message || 'Unable to load orders.' : '',
      tickets: tickets.status === 'rejected' ? tickets.reason?.message || 'Unable to load tickets.' : ''
    }
  };
};
