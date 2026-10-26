import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import authService from 'services/authService';
import permissionService from 'services/permissionService';
import Loader from 'components/loaders/Loader';
import useAuthSession from '@/hooks/useAuthSession';

const getAuthenticatedHome = () => permissionService.getFirstAvailablePath() || '/MyProfile';

/**
 * ProtectedRoute allows access only if a valid token is found in localStorage.
 * Otherwise, it redirects to /login.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const session = useAuthSession();
  const isAuth = authService.isAuthenticated();
  const [permissions, setPermissions] = useState(() => ({
    session,
    navigation: permissionService.getNavigation(),
    checking: isAuth && !permissionService.hasLoadedPermissions(),
    error: permissionService.getPermissionError()
  }));

  useEffect(() => {
    if (!isAuth) return undefined;
    let active = true;
    const update = (navigation = permissionService.getNavigation()) => {
      if (active) setPermissions({
        session, navigation,
        checking: !permissionService.hasLoadedPermissions(),
        error: permissionService.getPermissionError()
      });
    };
    const refresh = (force = false) => {
      update();
      permissionService.fetchPermissions(undefined, { force }).then((navigation) => {
        if (active) setPermissions({ session, navigation, checking: false, error: permissionService.getPermissionError() });
      }).catch(() => {
        if (active) setPermissions({ session, navigation: permissionService.getNavigation(), checking: false, error: 'Unable to load your permissions. Please retry.' });
      });
    };
    const unsubscribe = permissionService.subscribe(update);
    const onInvalidation = () => refresh(true);
    window.addEventListener('app:routes-invalidated', onInvalidation);
    refresh();

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('app:routes-invalidated', onInvalidation);
    };
  }, [isAuth, session]);

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isProfile = ['/myprofile', '/profile'].includes(location.pathname.toLowerCase().replace(/\/+$/, ''));
  // Never render the previous account's layout or page while the new session
  // is being resolved. Profile remains available even without module grants.
  if (permissions.session !== session || (permissions.checking && !isProfile)) return <Loader />;

  if (permissions.error && !isProfile) {
    return <div role="alert" className="mx-auto mt-12 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-sm">
      <h1 className="mb-2 text-lg font-semibold">Unable to load permissions</h1>
      <p className="mb-4 text-sm text-slate-600">{permissions.error}</p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button type="button" className="rounded-lg bg-indigo-600 px-4 py-2 text-white" onClick={() => {
          permissionService.clearCache();
          window.dispatchEvent(new Event('app:routes-invalidated'));
        }}>Retry</button>
        <Link to="/MyProfile">My Profile</Link>
        <button type="button" onClick={() => authService.logout()}>Sign out</button>
      </div>
    </div>;
  }

  if (!permissionService.hasPath(location.pathname, permissions.navigation)) {
    const redirectPath = permissionService.getFirstAvailablePath(permissions.navigation) || '/MyProfile';
    return <Navigate to={redirectPath} replace state={{ accessDeniedFrom: location.pathname }} />;
  }

  return <Outlet key={session} />;
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
  useAuthSession();
  const isAuth = authService.isAuthenticated();
  return <Navigate to={isAuth ? getAuthenticatedHome() : '/login'} replace />;
}

export default ProtectedRoute;
