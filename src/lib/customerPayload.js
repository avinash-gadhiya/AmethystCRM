const id = (value) => (Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0);
const text = (value) => String(value ?? '').trim();
const digits = (value) => text(value).replace(/\D/g, '');

export const buildCustomerPayload = (customer, { isCreate = false, user = {}, now = new Date() } = {}) => {
  const customerId = isCreate ? 0 : id(customer.customerId);
  if (!isCreate && !customerId) throw new Error('Customer ID is required.');
  const userName = text(user.displayName) || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || text(user.userName);
  return {
    customerId,
    name: text(customer.name),
    email: text(customer.email),
    phone: digits(customer.phone),
    phone2: digits(customer.phone2),
    address: text(customer.address),
    city: text(customer.city),
    stateId: id(customer.stateId),
    stateName: text(customer.stateName),
    zipCode: text(customer.zipCode),
    countryId: id(customer.countryId),
    countryName: text(customer.countryName),
    isActive: customer.isActive === undefined ? true : customer.isActive !== false && String(customer.isActive).toLowerCase() !== 'false',
    createdBy: isCreate ? id(user.userId) || id(customer.createdBy) : id(customer.createdBy) || id(user.userId),
    createdByName: isCreate ? userName || text(customer.createdByName) : text(customer.createdByName) || userName,
    createdDate: isCreate ? now.toISOString() : customer.createdDate || now.toISOString(),
    salesPerson: id(customer.salesPerson),
    salesPersonName: text(customer.salesPersonName),
    leadId: id(customer.leadId),
    getOrderListDTOs: isCreate ? [] : Array.isArray(customer.getOrderListDTOs) ? customer.getOrderListDTOs : [],
    getTicketListDTOs: isCreate ? [] : Array.isArray(customer.getTicketListDTOs) ? customer.getTicketListDTOs : []
  };
};
