import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import permissionService from '@/services/permissionService';

const normalize = (code) => (code || '').toString().trim().toLowerCase();

export const usePagePermissionCodes = (options = {}) => {
  const location = useLocation();
  const candidatePaths = useMemo(() => {
    const list = [location.pathname, options.path]
      .map((value) => (value || '').toString().trim())
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [location.pathname, options.path]);

  const [loading, setLoading] = useState(true);
  const [grantedCodes, setGrantedCodes] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        let resolvedSet = null;

        for (const path of candidatePaths) {
          const set = await permissionService.getGrantedPermissionCodesForPath(path);
          const codeSet = set instanceof Set ? set : new Set();

          if (codeSet.size > 0) {
            resolvedSet = codeSet;
            break;
          }

          if (typeof permissionService.canAccessPathExact === 'function') {
            const canAccessExact = await permissionService.canAccessPathExact(path);
            if (canAccessExact) {
              resolvedSet = codeSet;
              break;
            }
          }

          if (!resolvedSet) {
            resolvedSet = codeSet;
          }
        }

        if (!cancelled) {
          setGrantedCodes(resolvedSet || new Set());
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to resolve permission codes for paths:', candidatePaths, error);
        if (!cancelled) {
          setGrantedCodes(new Set());
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [candidatePaths]);

  const has = useMemo(() => {
    return (code) => {
      const c = normalize(code);
      if (!c) return false;
      return grantedCodes.has(c);
    };
  }, [grantedCodes]);

  return {
    loading,
    grantedCodes,
    has,
  };
};

export default usePagePermissionCodes;


