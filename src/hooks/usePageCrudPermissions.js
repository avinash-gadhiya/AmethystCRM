import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import permissionService from '@/services/permissionService';

const DEFAULT_PERMS = {
  loading: true,
  canView: false,
  canAdd: false,
  canUpdate: false,
  canDelete: false,
};

export const usePageCrudPermissions = (options = {}) => {
  const location = useLocation();
  const candidatePaths = useMemo(() => {
    const explicitPath = (options.path || '').toString().trim();
    const includeLocationFallback = options.includeLocationFallback === true;

    const list = [
      explicitPath,
      (!explicitPath || includeLocationFallback) ? location.pathname : '',
    ]
      .map((value) => (value || '').toString().trim())
      .filter(Boolean);

    return Array.from(new Set(list));
  }, [location.pathname, options.includeLocationFallback, options.path]);

  // Depend on the path list by value: the memo above re-creates the array on
  // every navigation, and re-running on identical paths flips `loading` back on
  // and makes permission-gated UI flash.
  const candidateKey = candidatePaths.join('|');

  const [state, setState] = useState(DEFAULT_PERMS);

  useEffect(() => {
    let cancelled = false;

    setState((prev) => ({ ...prev, loading: true }));

    const run = async () => {
      try {
        let resolved = null;

        for (const path of candidatePaths) {
          const perms = await permissionService.getCrudPermissionsForPath(path);
          const hasAny = !!(perms?.canView || perms?.canAdd || perms?.canUpdate || perms?.canDelete);

          if (hasAny) {
            resolved = perms;
            break;
          }

          if (typeof permissionService.canAccessPathExact === 'function') {
            const canAccessExact = await permissionService.canAccessPathExact(path);
            if (canAccessExact) {
              resolved = perms;
              break;
            }
          }

          if (!resolved) {
            resolved = perms;
          }
        }

        if (!cancelled) {
          setState({ ...(resolved || DEFAULT_PERMS), loading: false });
        }
      } catch (error) {
        console.error('Failed to resolve CRUD permissions for paths:', candidatePaths, error);
        if (!cancelled) {
          // Fail closed for UI gating (don't expose actions when permissions
          // cannot be resolved).
          setState({ ...DEFAULT_PERMS, loading: false });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey]);

  return state;
};

export default usePageCrudPermissions;


