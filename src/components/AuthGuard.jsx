import { Navigate, Outlet, useLocation } from 'react-router-dom';
import authService from 'services/authService';
import permissionService from 'services/permissionService';

const getAuthenticatedHome = () => permissionService.getFirstAvailablePath() || '/Dashboards';

/**
 * ProtectedRoute allows access only if a valid token is found in localStorage.
 * Otherwise, it redirects to /login.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const isAuth = authService.isAuthenticated();

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/**
 * GuestRoute allows access only to unauthenticated users (e.g., login, register).
 * If already logged in, it redirects to the dashboard.
 */
export function GuestRoute() {
  const isAuth = authService.isAuthenticated();

  if (isAuth) {
    return <Navigate to={getAuthenticatedHome()} replace />;
  }

  return <Outlet />;
}

/**
 * RootRedirect redirects / to /dashboard/sales if logged in, otherwise /login.
 */
export function RootRedirect() {
  const isAuth = authService.isAuthenticated();
  return <Navigate to={isAuth ? getAuthenticatedHome() : '/login'} replace />;
}

export default ProtectedRoute;
