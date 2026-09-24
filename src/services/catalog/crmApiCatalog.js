const operation = (method, path, options = {}) => ({
  id: `${method.toLowerCase()}-${path
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()}`,
  method,
  path,
  safeRead: method === 'GET' && !path.includes('{') && !/(SendMail|SendPandaDocMail|GetFullUrl)/i.test(path),
  ...options
});

const crud = (root, { deletePath = root, dropdown, extras = [] } = {}) => [
  operation('GET', root),
  operation('POST', root),
  operation('PUT', root),
  operation('DELETE', deletePath),
  ...(dropdown ? [operation('GET', `${root}/${dropdown}`)] : []),
  ...extras
];

const module = (name, operations) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, operations });

export const CRM_API_MODULES = [
  module('AttendanceReport', [operation('GET', '/AttendanceReport/Register'), operation('GET', '/AttendanceReport/DayWise')]),
  module('BlockIp', crud('/BlockIp')),
  module('BlueCoreContact', [
    operation('GET', '/BlueCoreContact'),
    operation('GET', '/BlueCoreContact/GetLeads'),
    operation('GET', '/BlueCoreContact/MyLead'),
    operation('PUT', '/BlueCoreContact/UpdateComment'),
    operation('PUT', '/BlueCoreContact/UpdateDisposition'),
    operation('PUT', '/BlueCoreContact/AssignLead/{id}'),
    operation('PUT', '/BlueCoreContact/TransferLead'),
    operation('DELETE', '/BlueCoreContact/{id}')
  ]),
  module('Brand', crud('/Brand', { dropdown: 'BrandDropDown' })),
  module('BrandEmail', crud('/BrandEmail')),
  module('BrandEmailTemplates', crud('/BrandEmailTemplates')),
  module('Callback', [
    operation('GET', '/Callback'),
    operation('POST', '/Callback'),
    operation('PUT', '/Callback'),
    operation('GET', '/Callback/CallBackHistory/{leadId}')
  ]),
  module('Chat', [operation('GET', '/Chat/history'), operation('POST', '/Chat')]),
  module('Country', crud('/Country', { deletePath: '/Country/{id}', dropdown: 'CountryDropdown' })),
  module('Customer', [
    operation('GET', '/Customer'),
    operation('POST', '/Customer'),
    operation('PUT', '/Customer'),
    operation('GET', '/Customer/search'),
    operation('POST', '/Customer/index/rebuild'),
    operation('PUT', '/Customer/CanDisableCustomer'),
    operation('DELETE', '/Customer/{customerId}'),
    operation('GET', '/Customer/{id}'),
    operation('GET', '/Customer/GetCustomerView')
  ]),
  module(
    'Dashboard',
    [
      'MonthlyFinancialData',
      'LocationWiseMonthlyTotalSales',
      'DayWiseSalesAndRPL',
      'UserWiseSummary',
      'DailyLocationWiseSales',
      'GroupWiseLeads',
      'SalesPersonWiseLeads',
      'ServiceManagerDashBoard'
    ].map((name) => operation('GET', `/Dashboard/${name}`))
  ),
  module('Gateway', crud('/Gateway', { dropdown: 'GatewayDropdown' })),
  module('GatewayPaymentType', crud('/GatewayPaymentType')),
  module('GatewayTransaction', [
    operation('POST', '/GatewayTransaction/Sync'),
    operation('GET', '/GatewayTransaction'),
    operation('GET', '/GatewayTransaction/SyncLog')
  ]),
  module('Group', crud('/Group', { dropdown: 'GroupDropdown' })),
  module('GroupEmail', crud('/GroupEmail')),
  module('Lead', [
    operation('GET', '/Lead'),
    operation('GET', '/Lead/GetLeads'),
    operation('GET', '/Lead/search'),
    operation('POST', '/Lead/index/rebuild'),
    operation('GET', '/Lead/MyLead'),
    operation('PUT', '/Lead/UpdateComment'),
    operation('PUT', '/Lead/UpdateDisposition'),
    operation('PUT', '/Lead/AssignLead/{id}'),
    operation('PUT', '/Lead/TransferLead'),
    operation('DELETE', '/Lead/{id}')
  ]),
  module(
    'LeadReport',
    ['Leads', 'ExportLeads', 'LeadsByDisposition', 'LeadsReport', 'LeadPickByUsers'].map((name) => operation('GET', `/LeadReport/${name}`))
  ),
  module('LeadScheduler', crud('/LeadScheduler', { deletePath: '/LeadScheduler/{id}' })),
  module('Location', crud('/Location', { dropdown: 'LocationDropdown' })),
  module('Login', [operation('POST', '/Login'), operation('GET', '/Login')]),
  module('Menu', crud('/Menu')),
  module(
    'Order',
    crud('/Order', {
      extras: [operation('GET', '/Order/GetCustomerOrders'), operation('GET', '/Order/GetOrderSummary'), operation('GET', '/Order/{id}')]
    })
  ),
  module('Page', crud('/Page')),
  module('PagePermission', crud('/PagePermission', { deletePath: '/PagePermission/{id}' })),
  module('Payment', [
    operation('PUT', '/Payment'),
    operation('GET', '/Payment'),
    operation('POST', '/Payment'),
    operation('DELETE', '/Payment/{id}'),
    operation('GET', '/Payment/{id}'),
    operation('GET', '/Payment/GetAllPayment'),
    operation('POST', '/Payment/UploadExcel'),
    operation('GET', '/Payment/SendMail', { safeRead: false }),
    operation('GET', '/Payment/SendPandaDocMail', { safeRead: false })
  ]),
  module('PaymentType', crud('/PaymentType', { deletePath: '/PaymentType/{id}' })),
  module('Permission', [operation('GET', '/Permission'), operation('POST', '/Permission')]),
  module('Product', crud('/Product', { dropdown: 'ProductDropdown' })),
  module(
    'Report',
    ['SalesReport', 'TicketStatusReport', 'ServiceReport', 'GetUserPerformanceReport', 'RenewalReport'].map((name) =>
      operation('GET', `/Report/${name}`)
    )
  ),
  module('Role', crud('/Role', { dropdown: 'RoleDropdown', extras: [operation('GET', '/Role/{id}')] })),
  module('Setting', crud('/Setting')),
  module('SettingValue', crud('/SettingValue', { deletePath: '/SettingValue/{id}', dropdown: 'SettingValueDropDown' })),
  module('SharePayment', crud('/SharePayment')),
  module('State', crud('/State', { deletePath: '/State/{id}', dropdown: 'StateDropdown' })),
  module('Template', crud('/Template')),
  module('Ticket', [
    operation('GET', '/Ticket'),
    operation('POST', '/Ticket'),
    operation('PUT', '/Ticket'),
    operation('GET', '/Ticket/{ticketId}'),
    operation('GET', '/Ticket/getTicketActivity/{ticketId}'),
    operation('GET', '/Ticket/GetFullUrl', { safeRead: false })
  ]),
  module('User', [
    operation('GET', '/User'),
    operation('POST', '/User'),
    operation('PUT', '/User'),
    operation('DELETE', '/User'),
    operation('GET', '/User/UserDropDown'),
    operation('PUT', '/User/LeadON'),
    operation('GET', '/User/GetLeadOn'),
    operation('GET', '/User/GetUserLeadOn'),
    operation('PUT', '/User/UserLeadON'),
    operation('PUT', '/User/ChangeProfile'),
    operation('PUT', '/User/ChangePassword'),
    operation('PUT', '/User/ReviseSalesTargets')
  ]),
  module('UserGroup', [operation('GET', '/UserGroup'), operation('PUT', '/UserGroup')]),
  module('UserPermission', [operation('GET', '/UserPermission'), operation('POST', '/UserPermission')])
];

export const CRM_API_OPERATIONS = CRM_API_MODULES.flatMap((item) => item.operations.map((entry) => ({ ...entry, module: item.name })));

export const getApiModule = (name) => {
  const normalized = String(name || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  return CRM_API_MODULES.find((item) => item.name.replace(/[^a-z0-9]/gi, '').toLowerCase() === normalized) || CRM_API_MODULES[0];
};

export default CRM_API_MODULES;
