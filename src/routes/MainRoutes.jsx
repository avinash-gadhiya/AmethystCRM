import { lazy, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import AdminLayout from 'layouts/AdminLayout';
import GuestLayout from 'layouts/GuestLayout';
import { ProtectedRoute, GuestRoute, RootRedirect } from 'components/AuthGuard';

const DashboardPage = lazy(() => import('../views/dashboard/DashboardPage'));
const DashboardSales = lazy(() => import('../views/dashboard/DashSales/index'));
const DailyLocationWiseSales = lazy(() => import('../views/dashboard/DailyLocationWiseSales'));
const LeadsDashboard = lazy(() => import('../views/dashboard/leads'));
const ServiceDashboard = lazy(() => import('../views/dashboard/service'));
const CRMModuleView = lazy(() => import('../views/crm/CRMModuleView'));
const AttendanceReport = lazy(() => import('../views/attendance/AttendanceReport'));
const TicketsPage = lazy(() => import('../views/tickets/TicketsPage'));
const CustomersPage = lazy(() => import('../views/customers/CustomersPage'));
const ReportCenter = lazy(() => import('../views/reports/ReportCenter'));
const PerformanceDashboardPage = lazy(() => import('../views/performance/PerformanceDashboardPage'));
const GatewayPage = lazy(() => import('../views/gateway/GatewayPage'));
const SettingsPage = lazy(() => import('../views/settings/SettingsPage'));
const RolesPage = lazy(() => import('../views/settings/role/RolesPage'));
const UsersPage = lazy(() => import('../views/users/UsersPage'));
const BlockedIpPage = lazy(() => import('../views/settings/ip/BlockedIpPage'));
const CountryPage = lazy(() => import('../views/settings/country/CountryPage'));
const SettingPage = lazy(() => import('../views/settings/setting/SettingPage'));
const BrandListPage = lazy(() => import('../views/settings/brand/BrandListPage'));
const BrandDetailsPage = lazy(() => import('../views/settings/brand/BrandDetailsPage'));
const BrandEmailPage = lazy(() => import('../views/settings/brand/BrandEmailPage'));
const BrandTemplatePage = lazy(() => import('../views/settings/brand/BrandTemplatePage'));
const GroupPage = lazy(() => import('../views/settings/group/GroupPage'));
const GroupEmailPage = lazy(() => import('../views/settings/group-email/GroupEmailPage'));
const PagesPage = lazy(() => import('../views/settings/pages/PagesPage'));
const MenusPage = lazy(() => import('../views/settings/menus/MenusPage'));
const TemplatePage = lazy(() => import('../views/settings/template/TemplatePage'));
const LocationPage = lazy(() => import('../views/settings/location/LocationPage'));
const SalesTargetPage = lazy(() => import('../views/settings/sales-target/SalesTargetPage'));
const MyProfilePage = lazy(() => import('../views/users/MyProfilePage'));
const OrdersPage = lazy(() => import('../views/orders/OrdersPage'));
const ProductsPage = lazy(() => import('../views/products/ProductsPage'));

const isConfiguredLocationPath = (pathname) => {
  try {
    const normalizedPath = String(pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
    const cacheKeys = Object.keys(localStorage).filter(
      (key) => key.startsWith('crm_permission_menus:') || key === 'crm_permission_menus'
    );

    return cacheKeys.some((key) => {
      const menus = JSON.parse(localStorage.getItem(key) || '[]');
      return (Array.isArray(menus) ? menus : []).some((menu) =>
        (menu?.menuPermissionPageDTOs || []).some((page) => {
          const name = String(page?.pageName || page?.pageDisplayName || '').trim().toLowerCase();
          const url = String(page?.pageUrl || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
          return (name === 'location' || name === 'locations') && url === normalizedPath;
        })
      );
    });
  } catch {
    return false;
  }
};

const isConfiguredBrandTemplatePath = (pathname) => {
  try {
    const normalizedPath = String(pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
    const cacheKeys = Object.keys(localStorage).filter(
      (key) => key.startsWith('crm_permission_menus:') || key === 'crm_permission_menus'
    );

    return cacheKeys.some((key) => {
      const menus = JSON.parse(localStorage.getItem(key) || '[]');
      return (Array.isArray(menus) ? menus : []).some((menu) =>
        (menu?.menuPermissionPageDTOs || []).some((page) => {
          const name = String(page?.pageName || page?.pageDisplayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const url = String(page?.pageUrl || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
          return (name === 'brandtemplate' || name === 'brandtemplates') && url === normalizedPath;
        })
      );
    });
  } catch {
    return false;
  }
};

const isConfiguredGroupEmailPath = (pathname) => {
  try {
    const normalizedPath = String(pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
    const cacheKeys = Object.keys(localStorage).filter(
      (key) => key.startsWith('crm_permission_menus:') || key === 'crm_permission_menus'
    );

    return cacheKeys.some((key) => {
      const menus = JSON.parse(localStorage.getItem(key) || '[]');
      return (Array.isArray(menus) ? menus : []).some((menu) =>
        (menu?.menuPermissionPageDTOs || []).some((page) => {
          const name = String(page?.pageName || page?.pageDisplayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const url = String(page?.pageUrl || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
          return (name === 'groupemail' || name === 'groupemails') && url === normalizedPath;
        })
      );
    });
  } catch {
    return false;
  }
};

const isConfiguredDashboardPath = (pathname) => {
  try {
    const normalizedPath = String(pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
    if (normalizedPath === '/dashboard' || normalizedPath === '/dashboards') return true;
    const cacheKeys = Object.keys(localStorage).filter(
      (key) => key.startsWith('crm_permission_menus:') || key === 'crm_permission_menus'
    );

    return cacheKeys.some((key) => {
      const menus = JSON.parse(localStorage.getItem(key) || '[]');
      return (Array.isArray(menus) ? menus : []).some((menu) =>
        (menu?.menuPermissionPageDTOs || []).some((page) => {
          const name = String(page?.pageName || page?.pageDisplayName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const url = String(page?.pageUrl || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
          return (name === 'dashboard' || name === 'dashboards') && url === normalizedPath;
        })
      );
    });
  } catch {
    return false;
  }
};

const AuthenticatedDynamicRoute = () => {
  const location = useLocation();
  const [, setNavigationVersion] = useState(0);

  useEffect(() => {
    const handleInvalidation = () => setNavigationVersion((version) => version + 1);
    window.addEventListener('app:routes-invalidated', handleInvalidation);
    return () => window.removeEventListener('app:routes-invalidated', handleInvalidation);
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

const Typography = lazy(() => import('../views/ui-elements/basic/BasicTypography'));
const Color = lazy(() => import('../views/ui-elements/basic/BasicColor'));

const FeatherIcon = lazy(() => import('../views/ui-elements/icons/Feather'));
const FontAwesome = lazy(() => import('../views/ui-elements/icons/FontAwesome'));
const MaterialIcon = lazy(() => import('../views/ui-elements/icons/Material'));

const Login = lazy(() => import('../views/auth/login'));
const Register = lazy(() => import('../views/auth/register'));

const Sample = lazy(() => import('../views/sample'));

const MainRoutes = {
  path: '/',
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
              element: <DailyLocationWiseSales />
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
              element: <DailyLocationWiseSales />
            },
            {
              path: '/DailyLocationWiseSales',
              element: <DailyLocationWiseSales />
            },
            {
              path: '/dailylocationwisesales',
              element: <DailyLocationWiseSales />
            },
            {
              path: '/Performance/DailySalesReport',
              element: <DailyLocationWiseSales />
            },
            {
              path: '/performance/dailysalesreport',
              element: <DailyLocationWiseSales />
            },
            // Specific CRM Module Routes
            {
              path: '/ApiExplorer',
              element: <CRMModuleView moduleName="AttendanceReport" />
            },
            {
              path: '/NewLeads',
              element: <CRMModuleView moduleName="New Leads" />
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
              element: <CRMModuleView moduleName="Leads" />
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
              element: <CRMModuleView moduleName="Payments" />
            },
            {
              path: '/orders/payments',
              element: <CRMModuleView moduleName="Payments" />
            },
            {
              path: '/Payments',
              element: <CRMModuleView moduleName="Payments" />
            },
            {
              path: '/payments',
              element: <CRMModuleView moduleName="Payments" />
            },
            // Orders routes
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
              element: <CRMModuleView />
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
