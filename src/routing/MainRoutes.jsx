import { lazy, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import permissionService from 'services/permissionService';

import AdminLayout from 'layouts/AdminLayout';
import GuestLayout from 'layouts/GuestLayout';
import { ProtectedRoute, GuestRoute, RootRedirect } from 'auth/ProtectedRoute';
import RouteErrorPage from './RouteErrorPage';

const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const DashboardSales = lazy(() => import('../pages/dashboard/DashSales/index'));
const DailySalesReportPage = lazy(() => import('../pages/reports/daily-sales/DailySalesReportPage'));
const LeadsDashboard = lazy(() => import('../pages/dashboard/leads'));
const ServiceDashboard = lazy(() => import('../pages/dashboard/service'));
const CRMModuleView = lazy(() => import('../pages/crm/CRMModuleView'));
const AttendanceReport = lazy(() => import('../pages/attendance/AttendanceReport'));
const TicketsPage = lazy(() => import('../pages/tickets/TicketsPage'));
const CustomersPage = lazy(() => import('../pages/customer/CustomersPage'));
const ReportCenter = lazy(() => import('../pages/reports/ReportCenter'));
const PerformanceDashboardPage = lazy(() => import('../pages/performance/PerformanceDashboardPage'));
const GatewayPage = lazy(() => import('../pages/gateway/GatewayPage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));
const RolesPage = lazy(() => import('../pages/settings/role/RolesPage'));
const UsersPage = lazy(() => import('../pages/settings/user'));
const BlockedIpPage = lazy(() => import('../pages/settings/ip/BlockedIpPage'));
const CountryPage = lazy(() => import('../pages/settings/country/CountryPage'));
const SettingPage = lazy(() => import('../pages/settings/setting/SettingPage'));
const BrandListPage = lazy(() => import('../pages/settings/brand/BrandListPage'));
const BrandDetailsPage = lazy(() => import('../pages/settings/brand/BrandDetailsPage'));
const BrandEmailPage = lazy(() => import('../pages/settings/brand/BrandEmailPage'));
const BrandTemplatePage = lazy(() => import('../pages/settings/brand/BrandTemplatePage'));
const GroupPage = lazy(() => import('../pages/settings/group/GroupPage'));
const GroupEmailPage = lazy(() => import('../pages/settings/group-email/GroupEmailPage'));
const PagesPage = lazy(() => import('../pages/settings/pages/PagesPage'));
const MenusPage = lazy(() => import('../pages/settings/menu/MenusPage'));
const TemplatePage = lazy(() => import('../pages/settings/template/TemplatePage'));
const LocationPage = lazy(() => import('../pages/settings/location/LocationPage'));
const SalesTargetPage = lazy(() => import('../pages/settings/sales-target/SalesTargetPage'));
const MyProfilePage = lazy(() => import('../pages/profile/MyProfilePage'));
const OrdersPage = lazy(() => import('../pages/order/OrdersPage').then((module) => ({ default: module.OrdersPage })));
const CreateOrderPage = lazy(() =>
  import('../pages/order/CreateOrderPage').then((module) => ({ default: module.CreateOrderPage }))
);
const ProductsPage = lazy(() => import('../pages/order/ProductsPage').then((module) => ({ default: module.ProductsPage })));
const PaymentsPage = lazy(() => import('../pages/order/PaymentsPage').then((module) => ({ default: module.PaymentsPage })));
const LeadsPage = lazy(() => import('../pages/leads/leadpage/LeadsPage'));

const isConfiguredPagePath = (pathname, names) => {
  const normalizePath = (value) => String(value || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
  const normalizedPath = normalizePath(pathname);
  return permissionService.getPermissionMenus().some((menu) =>
    (menu?.menuPermissionPageDTOs || []).some((page) => {
      const name = String(page?.pageName || page?.pageDisplayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return names.includes(name) && normalizePath(page.pageUrl) === normalizedPath;
    })
  );
};
const isConfiguredLocationPath = (path) => isConfiguredPagePath(path, ['location', 'locations']);
const isConfiguredBrandTemplatePath = (path) => isConfiguredPagePath(path, ['brandtemplate', 'brandtemplates']);
const isConfiguredGroupEmailPath = (path) => isConfiguredPagePath(path, ['groupemail', 'groupemails']);
const isConfiguredDashboardPath = (path) =>
  ['/dashboard', '/dashboards'].includes(String(path || '').toLowerCase().replace(/\/+$/, '')) || isConfiguredPagePath(path, ['dashboard', 'dashboards']);

const AuthenticatedDynamicRoute = () => {
  const location = useLocation();
  const [, setNavigationVersion] = useState(0);

  useEffect(() => {
    const handleInvalidation = () => setNavigationVersion((version) => version + 1);
    const unsubscribe = permissionService.subscribe(handleInvalidation);
    window.addEventListener('app:routes-invalidated', handleInvalidation);
    return () => { unsubscribe(); window.removeEventListener('app:routes-invalidated', handleInvalidation); };
  }, []);

  if (isConfiguredDashboardPath(location.pathname)) return <DashboardPage />;
  if (isConfiguredLocationPath(location.pathname)) return <LocationPage />;
  if (isConfiguredBrandTemplatePath(location.pathname)) return <BrandTemplatePage />;
  if (isConfiguredGroupEmailPath(location.pathname)) return <GroupEmailPage />;
  return <CRMModuleView />;
};

const BrandEmailSettingsRoute = () => {
  const location = useLocation();
  return new URLSearchParams(location.search).get('brandId') ? <BrandDetailsPage /> : <BrandEmailPage />;
};

const GatewaySettingsRoute = () => {
  const params = new URLSearchParams(window.location.search);
  const brandId = params.get('brandId');
  if (brandId) {
    return <BrandDetailsPage />;
  }
  return <GatewayPage />;
};

const Typography = lazy(() => import('../pages/ui-elements/basic/BasicTypography'));
const Color = lazy(() => import('../pages/ui-elements/basic/BasicColor'));

const FeatherIcon = lazy(() => import('../pages/ui-elements/icons/Feather'));
const FontAwesome = lazy(() => import('../pages/ui-elements/icons/FontAwesome'));
const MaterialIcon = lazy(() => import('../pages/ui-elements/icons/Material'));

const Login = lazy(() => import('../auth/pages/login'));
const Register = lazy(() => import('../auth/pages/register'));

const Sample = lazy(() => import('../pages/sample'));

const MainRoutes = {
  path: '/',
  errorElement: <RouteErrorPage />,
  children: [
    {
      index: true,
      element: <RootRedirect />
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AdminLayout />,
          children: [
            {
              path: '/dashboard',
              element: <DashboardPage />
            },
            {
              path: '/Dashboard',
              element: <DashboardPage />
            },
            {
              path: '/dashboards',
              element: <DashboardPage />
            },
            {
              path: '/Dashboards',
              element: <DashboardPage />
            },
            {
              path: '/dashboard/sales',
              element: <DashboardSales />
            },
            {
              path: '/Dashboard/DailyLocationWiseSales',
              element: <DailySalesReportPage />
            },
            {
              path: '/Dashboard/Leads',
              element: <LeadsDashboard />
            },
            {
              path: '/Dashboard/LeadsDashboard',
              element: <LeadsDashboard />
            },
            {
              path: '/Dashboard/Service-Dashboard',
              element: <ServiceDashboard />
            },
            {
              path: '/Dashboard/ServiceDashboard',
              element: <ServiceDashboard />
            },
            {
              path: '/Dashboard/ServiceManagerDashboard',
              element: <ServiceDashboard />
            },
            {
              path: '/dashboard/dailylocationwisesales',
              element: <DailySalesReportPage />
            },
            {
              path: '/DailyLocationWiseSales',
              element: <DailySalesReportPage />
            },
            {
              path: '/dailylocationwisesales',
              element: <DailySalesReportPage />
            },
            {
              path: '/Performance/DailySalesReport',
              element: <DailySalesReportPage />
            },
            {
              path: '/performance/dailysalesreport',
              element: <DailySalesReportPage />
            },
            // Specific CRM Module Routes
            {
              path: '/ApiExplorer',
              element: <CRMModuleView moduleName="AttendanceReport" />
            },
            {
              path: '/NewLeads',
              element: <LeadsPage />
            },
            {
              path: '/Customers',
              element: <CustomersPage />
            },
            {
              path: '/Tickets',
              element: <TicketsPage />
            },
            {
              path: '/Users',
              element: <UsersPage />
            },
            {
              path: '/users',
              element: <UsersPage />
            },
            {
              path: '/User',
              element: <UsersPage />
            },
            {
              path: '/user',
              element: <UsersPage />
            },
            {
              path: '/LeadScheduler',
              element: <CRMModuleView moduleName="Lead Scheduler" />
            },
            {
              path: '/MyProfile',
              element: <MyProfilePage />
            },
            {
              path: '/myprofile',
              element: <MyProfilePage />
            },
            {
              path: '/Lead-Access',
              element: <UsersPage />
            },
            {
              path: '/lead-access',
              element: <UsersPage />
            },
            {
              path: '/LeadsReports',
              element: <CRMModuleView moduleName="Leads Reports" />
            },
            {
              path: '/Leads',
              element: <LeadsPage />
            },
            // Products routes (handles both standalone and nested under Orders)
            {
              path: '/Orders/Products',
              element: <ProductsPage />
            },
            {
              path: '/Orders/products',
              element: <ProductsPage />
            },
            {
              path: '/orders/products',
              element: <ProductsPage />
            },
            {
              path: '/orders/Products',
              element: <ProductsPage />
            },
            {
              path: '/Order/Products',
              element: <ProductsPage />
            },
            {
              path: '/Order/products',
              element: <ProductsPage />
            },
            {
              path: '/order/products',
              element: <ProductsPage />
            },
            {
              path: '/order/Products',
              element: <ProductsPage />
            },
            {
              path: '/Orders/Product',
              element: <ProductsPage />
            },
            {
              path: '/orders/product',
              element: <ProductsPage />
            },
            {
              path: '/Order/Product',
              element: <ProductsPage />
            },
            {
              path: '/order/product',
              element: <ProductsPage />
            },
            {
              path: '/Products',
              element: <ProductsPage />
            },
            {
              path: '/products',
              element: <ProductsPage />
            },
            {
              path: '/Product',
              element: <ProductsPage />
            },
            {
              path: '/product',
              element: <ProductsPage />
            },
            {
              path: '/Products/*',
              element: <ProductsPage />
            },
            {
              path: '/Product/*',
              element: <ProductsPage />
            },
            // Payments routes
            {
              path: '/Orders/Payments',
              element: <PaymentsPage />
            },
            {
              path: '/orders/payments',
              element: <PaymentsPage />
            },
            {
              path: '/Payments',
              element: <PaymentsPage />
            },
            {
              path: '/payments',
              element: <PaymentsPage />
            },
            // Orders routes
            {
              path: '/Orders/CreateOrder',
              element: <CreateOrderPage />
            },
            {
              path: '/orders/createorder',
              element: <CreateOrderPage />
            },
            {
              path: '/Order/CreateOrder',
              element: <CreateOrderPage />
            },
            {
              path: '/Orders',
              element: <OrdersPage />
            },
            {
              path: '/orders',
              element: <OrdersPage />
            },
            {
              path: '/Order',
              element: <OrdersPage />
            },
            {
              path: '/order',
              element: <OrdersPage />
            },
            {
              path: '/Gateways',
              element: <GatewayPage />
            },
            {
              path: '/Dashboard/Gateways',
              element: <GatewayPage />
            },
            {
              path: '/Dashboard/Gateway',
              element: <GatewayPage />
            },
            {
              path: '/settings/gateway',
              element: <GatewaySettingsRoute />
            },
            {
              path: '/Settings/Gateway',
              element: <GatewaySettingsRoute />
            },
            {
              path: '/GatewayTransactionDashboard',
              element: <GatewayPage />
            },
            {
              path: '/Gateway/*',
              element: <GatewayPage />
            },
            {
              path: '/GatewayPaymentType/*',
              element: <GatewayPage />
            },
            {
              path: '/GatewayTransaction/*',
              element: <GatewayPage />
            },
            // Settings & Setting Values
            {
              path: '/settings',
              element: <SettingsPage />
            },
            {
              path: '/Settings',
              element: <SettingsPage />
            },
            {
              path: '/setting',
              element: <SettingsPage />
            },
            {
              path: '/Setting',
              element: <SettingsPage />
            },
            {
              path: '/settings/settings',
              element: <SettingsPage />
            },
            {
              path: '/settings/setting',
              element: <SettingsPage />
            },
            {
              path: '/Settings/Settings',
              element: <SettingsPage />
            },
            {
              path: '/Settings/Setting',
              element: <SettingsPage />
            },
            {
              path: '/settings/roles',
              element: <RolesPage />
            },
            {
              path: '/settings/role',
              element: <RolesPage />
            },
            {
              path: '/Settings/Roles',
              element: <RolesPage />
            },
            {
              path: '/Settings/Role',
              element: <RolesPage />
            },
            {
              path: '/roles',
              element: <RolesPage />
            },
            {
              path: '/Roles',
              element: <RolesPage />
            },
            {
              path: '/role',
              element: <RolesPage />
            },
            {
              path: '/Role',
              element: <RolesPage />
            },
            {
              path: '/Role/*',
              element: <RolesPage />
            },
            {
              path: '/Roles/*',
              element: <RolesPage />
            },
            // Settings & Setting Values Configuration Management
            {
              path: '/settings/settings',
              element: <SettingPage />
            },
            {
              path: '/settings/setting',
              element: <SettingPage />
            },
            {
              path: '/Settings/Settings',
              element: <SettingPage />
            },
            {
              path: '/Settings/Setting',
              element: <SettingPage />
            },
            {
              path: '/settings/values',
              element: <SettingPage />
            },
            {
              path: '/settings/settingvalue',
              element: <SettingPage />
            },
            {
              path: '/settings/settingvalues',
              element: <SettingPage />
            },
            {
              path: '/Settings/Values',
              element: <SettingPage />
            },
            {
              path: '/Settings/SettingValue',
              element: <SettingPage />
            },
            {
              path: '/Setting',
              element: <SettingPage />
            },
            {
              path: '/setting',
              element: <SettingPage />
            },
            {
              path: '/SettingValue',
              element: <SettingPage />
            },
            {
              path: '/settingvalue',
              element: <SettingPage />
            },
            {
              path: '/settings/users',
              element: <UsersPage />
            },
            {
              path: '/settings/user',
              element: <UsersPage />
            },
            {
              path: '/Settings/Users',
              element: <UsersPage />
            },
            {
              path: '/Settings/User',
              element: <UsersPage />
            },
            // Blocked IP Addresses
            {
              path: '/settings/ip',
              element: <BlockedIpPage />
            },
            {
              path: '/settings/blockip',
              element: <BlockedIpPage />
            },
            {
              path: '/settings/blocked-ip',
              element: <BlockedIpPage />
            },
            {
              path: '/settings/blocked-ips',
              element: <BlockedIpPage />
            },
            {
              path: '/Settings/Ip',
              element: <BlockedIpPage />
            },
            {
              path: '/Settings/BlockIp',
              element: <BlockedIpPage />
            },
            {
              path: '/BlockIp',
              element: <BlockedIpPage />
            },
            {
              path: '/blockip',
              element: <BlockedIpPage />
            },
            // Countries & States
            {
              path: '/settings/country',
              element: <CountryPage />
            },
            {
              path: '/settings/countries',
              element: <CountryPage />
            },
            {
              path: '/settings/state',
              element: <CountryPage />
            },
            {
              path: '/settings/states',
              element: <CountryPage />
            },
            {
              path: '/Settings/Country',
              element: <CountryPage />
            },
            {
              path: '/Settings/Countries',
              element: <CountryPage />
            },
            {
              path: '/Settings/State',
              element: <CountryPage />
            },
            {
              path: '/Settings/States',
              element: <CountryPage />
            },
            {
              path: '/Country',
              element: <CountryPage />
            },
            {
              path: '/country',
              element: <CountryPage />
            },
            {
              path: '/State',
              element: <CountryPage />
            },
            {
              path: '/state',
              element: <CountryPage />
            },
            // Brand Management & Details Routes
            {
              path: '/settings/brand',
              element: <BrandListPage />
            },
            {
              path: '/settings/brands',
              element: <BrandListPage />
            },
            {
              path: '/Settings/Brand',
              element: <BrandListPage />
            },
            {
              path: '/Settings/Brands',
              element: <BrandListPage />
            },
            {
              path: '/Brand',
              element: <BrandListPage />
            },
            {
              path: '/brand',
              element: <BrandListPage />
            },
            {
              path: '/settings/branddetails',
              element: <BrandDetailsPage />
            },
            {
              path: '/Settings/BrandDetails',
              element: <BrandDetailsPage />
            },
            {
              path: '/settings/brandemail',
              element: <BrandEmailSettingsRoute />
            },
            {
              path: '/settings/brand-emails',
              element: <BrandEmailSettingsRoute />
            },
            {
              path: '/settings/brand-emails/*',
              element: <BrandEmailSettingsRoute />
            },
            {
              path: '/settings/email',
              element: <BrandEmailSettingsRoute />
            },
            {
              path: '/Settings/BrandEmail',
              element: <BrandEmailSettingsRoute />
            },
            {
              path: '/settings/brandtemplate',
              element: <BrandTemplatePage />
            },
            {
              path: '/settings/brandtemplates',
              element: <BrandTemplatePage />
            },
            {
              path: '/Settings/BrandTemplate',
              element: <BrandTemplatePage />
            },
            {
              path: '/Settings/BrandTemplates',
              element: <BrandTemplatePage />
            },
            {
              path: '/settings/brand-template',
              element: <BrandTemplatePage />
            },
            {
              path: '/settings/brand-templates',
              element: <BrandTemplatePage />
            },
            {
              path: '/BrandTemplate',
              element: <BrandTemplatePage />
            },
            // Template Management Routes (/Template API)
            {
              path: '/settings/template',
              element: <TemplatePage />
            },
            {
              path: '/settings/templates',
              element: <TemplatePage />
            },
            {
              path: '/Settings/Template',
              element: <TemplatePage />
            },
            {
              path: '/Settings/Templates',
              element: <TemplatePage />
            },
            {
              path: '/Templates',
              element: <TemplatePage />
            },
            {
              path: '/templates',
              element: <TemplatePage />
            },
            {
              path: '/Template',
              element: <TemplatePage />
            },
            {
              path: '/template',
              element: <TemplatePage />
            },
            // Group & Group Email Routes
            {
              path: '/settings/group',
              element: <GroupPage />
            },
            {
              path: '/settings/groups',
              element: <GroupPage />
            },
            {
              path: '/Settings/Group',
              element: <GroupPage />
            },
            {
              path: '/Settings/Groups',
              element: <GroupPage />
            },
            {
              path: '/Group',
              element: <GroupPage />
            },
            {
              path: '/group',
              element: <GroupPage />
            },
            // Group Email Management Routes (/GroupEmail API)
            {
              path: '/settings/group-email',
              element: <GroupEmailPage />
            },
            {
              path: '/settings/groupemail',
              element: <GroupEmailPage />
            },
            {
              path: '/settings/group-emails',
              element: <GroupEmailPage />
            },
            {
              path: '/Settings/Group-Email',
              element: <GroupEmailPage />
            },
            {
              path: '/Settings/GroupEmail',
              element: <GroupEmailPage />
            },
            {
              path: '/Settings/GroupEmails',
              element: <GroupEmailPage />
            },
            {
              path: '/group-email',
              element: <GroupEmailPage />
            },
            {
              path: '/groupemail',
              element: <GroupEmailPage />
            },
            {
              path: '/Group-Email',
              element: <GroupEmailPage />
            },
            {
              path: '/GroupEmail',
              element: <GroupEmailPage />
            },
            {
              path: '/group-emails',
              element: <GroupEmailPage />
            },
            {
              path: '/GroupEmails',
              element: <GroupEmailPage />
            },
            // Pages Management Routes
            {
              path: '/settings/pages',
              element: <PagesPage />
            },
            {
              path: '/settings/page',
              element: <PagesPage />
            },
            {
              path: '/Settings/Pages',
              element: <PagesPage />
            },
            {
              path: '/Settings/Page',
              element: <PagesPage />
            },
            {
              path: '/Pages',
              element: <PagesPage />
            },
            {
              path: '/pages',
              element: <PagesPage />
            },
            {
              path: '/Page',
              element: <PagesPage />
            },
            {
              path: '/page',
              element: <PagesPage />
            },
            // Menus Management Routes
            {
              path: '/settings/menus',
              element: <MenusPage />
            },
            {
              path: '/settings/menu',
              element: <MenusPage />
            },
            {
              path: '/Settings/Menus',
              element: <MenusPage />
            },
            {
              path: '/Settings/Menu',
              element: <MenusPage />
            },
            {
              path: '/Menus',
              element: <MenusPage />
            },
            {
              path: '/menus',
              element: <MenusPage />
            },
            {
              path: '/Menu',
              element: <MenusPage />
            },
            {
              path: '/menu',
              element: <MenusPage />
            },
            // Location Management Routes
            {
              path: '/settings/location',
              element: <LocationPage />
            },
            {
              path: '/settings/locations',
              element: <LocationPage />
            },
            {
              path: '/Settings/Location',
              element: <LocationPage />
            },
            {
              path: '/Settings/Locations',
              element: <LocationPage />
            },
            {
              path: '/Locations',
              element: <LocationPage />
            },
            {
              path: '/locations',
              element: <LocationPage />
            },
            {
              path: '/Location',
              element: <LocationPage />
            },
            {
              path: '/location',
              element: <LocationPage />
            },
            // Sales Target Management Routes (/User API)
            {
              path: '/settings/sales-target',
              element: <SalesTargetPage />
            },
            {
              path: '/settings/sales-targets',
              element: <SalesTargetPage />
            },
            {
              path: '/settings/salestarget',
              element: <SalesTargetPage />
            },
            {
              path: '/SalesTarget',
              element: <SalesTargetPage />
            },
            {
              path: '/Setting/*',
              element: <SettingsPage />
            },
            {
              path: '/SettingValue',
              element: <SettingsPage />
            },
            {
              path: '/SettingValue/*',
              element: <SettingsPage />
            },
            // CRM Module Prefix Wildcards
            {
              path: '/Performance/Dashboard',
              element: <PerformanceDashboardPage />
            },
            {
              path: '/Performance/*',
              element: <ReportCenter />
            },
            {
              path: '/Dashboard/*',
              element: <CRMModuleView />
            },
            {
              path: '/Leads/*',
              element: <LeadsPage />
            },
            {
              path: '/LeadsReports/*',
              element: <ReportCenter />
            },
            {
              path: '/Orders/*',
              element: <OrdersPage />
            },
            {
              path: '/Reports/*',
              element: <ReportCenter />
            },
            {
              path: '/BKLeads/*',
              element: <CRMModuleView />
            },
            {
              path: '/Attendance/*',
              element: <AttendanceReport />
            },
            {
              path: '/settings/*',
              element: <SettingsPage />
            },
            {
              path: '/SystemLogs/*',
              element: <CRMModuleView />
            },
            // UI kit elements
            {
              path: '/typography',
              element: <Typography />
            },
            {
              path: '/color',
              element: <Color />
            },
            {
              path: '/icons/Feather',
              element: <FeatherIcon />
            },
            {
              path: '/icons/font-awesome-5',
              element: <FontAwesome />
            },
            {
              path: '/icons/material',
              element: <MaterialIcon />
            },
            {
              path: '/sample-page',
              element: <Sample />
            },
            // Authenticated Catch-All inside AdminLayout
            {
              path: '*',
              element: <AuthenticatedDynamicRoute />
            }
          ]
        }
      ]
    },
    {
      element: <GuestRoute />,
      children: [
        {
          element: <GuestLayout />,
          children: [
            {
              path: '/login',
              element: <Login />
            },
            {
              path: '/register',
              element: <Register />
            }
          ]
        }
      ]
    },
    {
      path: '*',
      element: <RootRedirect />
    }
  ]
};

export default MainRoutes;
