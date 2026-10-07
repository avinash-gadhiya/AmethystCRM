import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import authService from 'services/authService';
import permissionService from 'services/permissionService';
import Loader from 'components/Loader/Loader';

const getAuthenticatedHome = () => permissionService.getFirstAvailablePath() || '/Dashboards';

/**
 * ProtectedRoute allows access only if a valid token is found in localStorage.
 * Otherwise, it redirects to /login.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const isAuth = authService.isAuthenticated();
  const currentUser = authService.getUser();
  const roleName = String(currentUser?.role || currentUser?.roleName || '')
    .trim()
    .toLowerCase();
  const canManagePermissions = Number(currentUser?.roleId) === 1 || roleName.includes('developer') || roleName.includes('admin');
  const [navigation, setNavigation] = useState(() => permissionService.getNavigation());
  const [checkingPermissions, setCheckingPermissions] = useState(isAuth && !canManagePermissions);

  useEffect(() => {
    if (!isAuth || canManagePermissions) {
      setCheckingPermissions(false);
      return undefined;
    }

    let active = true;
    setCheckingPermissions(true);

    const unsubscribe = permissionService.subscribe((updatedNavigation) => {
      if (active) setNavigation(updatedNavigation);
    });

    permissionService
      .fetchPermissions(undefined, { force: true })
      .then((updatedNavigation) => {
        if (active) setNavigation(updatedNavigation);
      })
      .finally(() => {
        if (active) setCheckingPermissions(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [canManagePermissions, isAuth, location.pathname]);

  const redirectPath = useMemo(() => {
    if (!isAuth || canManagePermissions || checkingPermissions) return '';
    if (permissionService.hasPath(location.pathname, navigation)) return '';

    const firstAvailablePath = permissionService.getFirstAvailablePath(navigation);
    return firstAvailablePath && firstAvailablePath.toLowerCase() !== location.pathname.toLowerCase() ? firstAvailablePath : '/MyProfile';
  }, [canManagePermissions, checkingPermissions, isAuth, location.pathname, navigation]);

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (checkingPermissions) return <Loader />;

  if (redirectPath) {
    return <Navigate to={redirectPath} replace state={{ accessDeniedFrom: location.pathname }} />;
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
