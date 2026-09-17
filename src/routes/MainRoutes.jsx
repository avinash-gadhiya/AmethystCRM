import { lazy } from 'react';

import AdminLayout from 'layouts/AdminLayout';
import GuestLayout from 'layouts/GuestLayout';
import { ProtectedRoute, GuestRoute, RootRedirect } from 'components/AuthGuard';

const DashboardSales = lazy(() => import('../views/dashboard/DashSales/index'));
const CRMModuleView = lazy(() => import('../views/crm/CRMModuleView'));
const AttendanceReport = lazy(() => import('../views/attendance/AttendanceReport'));
const TicketsPage = lazy(() => import('../views/tickets/TicketsPage'));
const CustomersPage = lazy(() => import('../views/customers/CustomersPage'));
const ReportCenter = lazy(() => import('../views/reports/ReportCenter'));
const GatewayPage = lazy(() => import('../views/gateway/GatewayPage'));
const SettingsPage = lazy(() => import('../views/settings/SettingsPage'));
const UsersPage = lazy(() => import('../views/users/UsersPage'));
const MyProfilePage = lazy(() => import('../views/users/MyProfilePage'));
const OrdersPage = lazy(() => import('../views/orders/OrdersPage'));
const ProductsPage = lazy(() => import('../views/products/ProductsPage'));

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
              path: '/dashboard/sales',
              element: <DashboardSales />
            },
            {
              path: '/Dashboards',
              element: <DashboardSales />
            },
            // Specific CRM Module Routes
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
              element: <GatewayPage />
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
              element: <SettingsPage />
            },
            {
              path: '/settings/role',
              element: <SettingsPage />
            },
            {
              path: '/Settings/Roles',
              element: <SettingsPage />
            },
            {
              path: '/Settings/Role',
              element: <SettingsPage />
            },
            {
              path: '/roles',
              element: <SettingsPage />
            },
            {
              path: '/Roles',
              element: <SettingsPage />
            },
            {
              path: '/role',
              element: <SettingsPage />
            },
            {
              path: '/Role',
              element: <SettingsPage />
            },
            {
              path: '/Role/*',
              element: <SettingsPage />
            },
            {
              path: '/Roles/*',
              element: <SettingsPage />
            },
            {
              path: '/settings/values',
              element: <SettingsPage />
            },
            {
              path: '/settings/settingvalue',
              element: <SettingsPage />
            },
            {
              path: '/settings/settingvalues',
              element: <SettingsPage />
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
              element: <CRMModuleView />
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
              element: <CRMModuleView />
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
