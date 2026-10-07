import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Globe,
  Plus,
  Search,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  MapPin,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  Layers
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

import countryService from '@/services/countryService';
import authService from '@/services/authService';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import { getApiErrorMessage } from '@/lib/apiError';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import AnchorPagination from '@/components/common/AnchorPagination';
import CountryModal from '@/components/country/CountryModal';
import StateModal from '@/components/country/StateModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ---------------------------------------------------------------------------
// Resolve CRUD permissions for the Countries & States page (Fail-closed principle)
// ---------------------------------------------------------------------------
const resolvePermissions = () => {
  return resolveConfiguredPagePermissions('country', ['/settings/country']);

  try {
    const user = authService.getUser();
    if (!user) {
      return { canView: false, canAdd: false, canEdit: false, canDelete: false, resolved: true };
    }

    const roleName = String(user.role || user.roleName || '').toLowerCase();
    const isSuperAdmin =
      roleName.includes('admin') ||
      roleName.includes('developer') ||
      Number(user.roleId) === 1;

    // Super admin & developer have full administrative privileges
    if (isSuperAdmin) {
      return { canView: true, canAdd: true, canEdit: true, canDelete: true, resolved: true };
    }

    // Collect granted permission codes
    const grantedCodes = new Set();
    const userCodes = Array.isArray(user.permissionCodes)
      ? user.permissionCodes
      : typeof user.permissionCodes === 'string'
      ? user.permissionCodes.split(',')
      : [];
    userCodes.forEach((c) => grantedCodes.add(String(c).trim().toLowerCase()));

    try {
      const localCodes = JSON.parse(localStorage.getItem('permissionCodes') || '[]');
      if (Array.isArray(localCodes)) {
        localCodes.forEach((c) => grantedCodes.add(String(c).trim().toLowerCase()));
      }
    } catch {}

    // Check cached permission menus
    let pagePermissions = null;
    try {
      const cacheKeys = Object.keys(localStorage).filter(
        (k) => k.startsWith('crm_permission_menus:') || k === 'crm_permission_menus'
      );
      for (const k of cacheKeys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const menus = JSON.parse(raw);
        if (!Array.isArray(menus)) continue;
        for (const menu of menus) {
          const pages = menu.menuPermissionPageDTOs || [];
          for (const page of pages) {
            const url = String(page.pageUrl || '').toLowerCase();
            const name = String(page.pageName || page.pageDisplayName || '').toLowerCase();
            if (
              url.includes('/country') ||
              url.includes('country') ||
              url.includes('state') ||
              name.includes('country') ||
              name.includes('state')
            ) {
              pagePermissions = page.menuPagePermissionDTOs || page.pagePermissionDTOs || [];
              break;
            }
          }
          if (pagePermissions) break;
        }
        if (pagePermissions) break;
      }
    } catch (e) {
      console.warn('Error reading permission menus for country:', e);
    }

    let canView = false;
    let canAdd = false;
    let canEdit = false;
    let canDelete = false;

    if (pagePermissions && pagePermissions.length > 0) {
      pagePermissions.forEach((p) => {
        const pName = String(p.permissionName || p.name || '').toLowerCase();
        const pCode = String(p.permissionCode || '').toLowerCase();
        const isGranted = Boolean(p.hasPermission) || (pCode && grantedCodes.has(pCode));

        if (
          pName.includes('view') ||
          pName.includes('read') ||
          pCode.includes('view') ||
          pCode.includes('read')
        ) {
          if (isGranted) canView = true;
        }
        if (
          pName.includes('add') ||
          pName.includes('create') ||
          pCode.includes('add') ||
          pCode.includes('create')
        ) {
          if (isGranted) canAdd = true;
        }
        if (
          pName.includes('edit') ||
          pName.includes('update') ||
          pCode.includes('edit') ||
          pCode.includes('update')
        ) {
          if (isGranted) canEdit = true;
        }
        if (
          pName.includes('delete') ||
          pName.includes('remove') ||
          pCode.includes('delete') ||
          pCode.includes('remove')
        ) {
          if (isGranted) canDelete = true;
        }
      });
    } else if (grantedCodes.size > 0) {
      for (const code of grantedCodes) {
        if (code.includes('country') || code.includes('state')) {
          if (code.includes('view') || code.includes('read')) canView = true;
          if (code.includes('add') || code.includes('create')) canAdd = true;
          if (code.includes('edit') || code.includes('update')) canEdit = true;
          if (code.includes('delete') || code.includes('remove')) canDelete = true;
        }
      }
      if (
        grantedCodes.has('country') ||
        grantedCodes.has('countries') ||
        grantedCodes.has('settings')
      ) {
        canView = true;
        canAdd = true;
        canEdit = true;
        canDelete = true;
      }
    } else {
      canView = false;
      canAdd = false;
      canEdit = false;
      canDelete = false;
    }

    return { canView, canAdd, canEdit, canDelete, resolved: true };
  } catch (error) {
    // Fail closed
    return { canView: false, canAdd: false, canEdit: false, canDelete: false, resolved: true };
  }
};

const CountryPage = () => {
  // Permissions
  const permissions = useMemo(() => resolvePermissions(), []);

  // Countries Data & Pagination state
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting defaults: countryId descending
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('countryId');
  const [isDescending, setIsDescending] = useState(true);
  const [searchText, setSearchText] = useState('');

  // Expansion & States state
  const [expandedCountryIds, setExpandedCountryIds] = useState(new Set());
  const [statesByCountry, setStatesByCountry] = useState({});
  const [loadingStates, setLoadingStates] = useState({});

  // Modals state
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState(null);

  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [stateModalTargetCountry, setStateModalTargetCountry] = useState(null);
  const [editingState, setEditingState] = useState(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteContext, setDeleteContext] = useState(null); // { type: 'country' | 'state', item, countryId }
  const [isDeleting, setIsDeleting] = useState(false);

  // Stale request tracking
  const requestSeqRef = useRef(0);

  // Preload states for visible countries
  const preloadStatesForCountries = useCallback(async (countryList = []) => {
    if (!Array.isArray(countryList) || countryList.length === 0) return;

    countryList.forEach(async (c) => {
      const cId = Number(c.countryId);
      if (!cId) return;

      try {
        const loaded = await countryService.getStates({
          CountryId: cId,
          countryName: c.countryName
        });
        setStatesByCountry((prev) => ({
          ...prev,
          [cId]: loaded || []
        }));
      } catch (err) {
        console.warn(`Could not preload states for country #${cId}:`, err);
      }
    });
  }, []);

  // Fetch Countries list
  const fetchCountries = useCallback(async () => {
    if (!permissions.canView) {
      setLoading(false);
      return;
    }

    const currentSeq = ++requestSeqRef.current;
    try {
      setLoading(true);
      const res = await countryService.getCountries({
        Text: searchText.trim(),
        PageNumber: pageNumber,
        PageSize: pageSize,
        SortProperty: sortProperty,
        IsDescending: isDescending
      });

      // Prevent stale response overwrite
      if (currentSeq !== requestSeqRef.current) return;

      const list = res.data || [];
      setCountries(list);
      setTotalCount(res.totalCount || 0);

      // Preload states for the visible countries
      preloadStatesForCountries(list);
    } catch (error) {
      if (currentSeq !== requestSeqRef.current) return;
      console.error('Failed to fetch countries:', error);
      toast.error(getApiErrorMessage(error, 'Failed to fetch countries'));
      setCountries([]);
      setTotalCount(0);
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [
    permissions.canView,
    searchText,
    pageNumber,
    pageSize,
    sortProperty,
    isDescending,
    preloadStatesForCountries
  ]);

  // Strict Mode mount protection
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      fetchCountries();
      return;
    }
    fetchCountries();
  }, [fetchCountries]);

  // Toggle row expansion & fetch states if not preloaded
  const toggleCountryExpand = async (countryId) => {
    const id = Number(countryId);
    setExpandedCountryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    // If expanding and states not yet in memory, fetch
    if (!statesByCountry[id]) {
      setLoadingStates((prev) => ({ ...prev, [id]: true }));
      try {
        const targetCountry = countries.find((c) => Number(c.countryId) === id);
        const loaded = await countryService.getStates({
          CountryId: id,
          countryName: targetCountry?.countryName
        });
        setStatesByCountry((prev) => ({
          ...prev,
          [id]: loaded || []
        }));
      } catch (err) {
        console.error(`Failed to load states for country #${id}:`, err);
        toast.error(getApiErrorMessage(err, 'Failed to load states'));
      } finally {
        setLoadingStates((prev) => ({ ...prev, [id]: false }));
      }
    }
  };

  // Reload states for a specific country
  const reloadStatesForCountry = async (countryId) => {
    const id = Number(countryId);
    countryService.clearStateCache(id);
    setLoadingStates((prev) => ({ ...prev, [id]: true }));
    try {
      const targetCountry = countries.find((c) => Number(c.countryId) === id);
      const loaded = await countryService.getStates({
        CountryId: id,
        countryName: targetCountry?.countryName
      });
      setStatesByCountry((prev) => ({
        ...prev,
        [id]: loaded || []
      }));
    } catch (err) {
      console.error(`Failed to reload states for country #${id}:`, err);
      toast.error(getApiErrorMessage(err, 'Failed to reload states'));
    } finally {
      setLoadingStates((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Handle sorting toggle
  const handleToggleSort = (property) => {
    if (sortProperty === property) {
      setIsDescending(!isDescending);
    } else {
      setSortProperty(property);
      setIsDescending(true);
    }
    setPageNumber(1);
  };

  // Open Delete Confirm Modal
  const openDeleteCountry = (country) => {
    setDeleteContext({
      type: 'country',
      item: country,
      countryId: country.countryId
    });
    setDeleteModalOpen(true);
  };

  const openDeleteState = (state, country) => {
    setDeleteContext({
      type: 'state',
      item: state,
      countryId: country.countryId,
      countryName: country.countryName || state.countryName
    });
    setDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteContext) return;
    setIsDeleting(true);

    try {
      if (deleteContext.type === 'country') {
        const cId = deleteContext.item.countryId;
        await countryService.deleteCountry(cId);
        toast.success(`Country "${deleteContext.item.countryName}" deleted`);

        // Collapse the country after deletion if it was expanded
        setExpandedCountryIds((prev) => {
          const next = new Set(prev);
          next.delete(cId);
          return next;
        });

        // Clear cached states
        setStatesByCountry((prev) => {
          const next = { ...prev };
          delete next[cId];
          return next;
        });

        fetchCountries();
      } else if (deleteContext.type === 'state') {
        const sId = deleteContext.item.stateId;
        const cId = deleteContext.countryId;
        await countryService.deleteState(sId, cId);
        toast.success(`State "${deleteContext.item.stateName}" deleted`);
        reloadStatesForCountry(cId);
      }

      setDeleteModalOpen(false);
      setDeleteContext(null);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error(getApiErrorMessage(err, 'Failed to delete record'));
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Render Sort Icon
  const renderSortIcon = (property) => {
    if (sortProperty !== property) {
      return <ArrowUpDown size={13} className="text-gray-400 opacity-60 inline ml-1" />;
    }
    return isDescending ? (
      <ArrowDown size={13} className="text-purple-600 dark:text-purple-400 inline ml-1" />
    ) : (
      <ArrowUp size={13} className="text-purple-600 dark:text-purple-400 inline ml-1" />
    );
  };

  return (
    <div className="countries-page px-5 lg:px-10 py-5">
      <Toaster richColors position="top-right" />

      <div className="flex flex-col gap-5 lg:gap-7.5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
              Countries & States
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Manage system country entries and their associated states or provinces.
            </p>
          </div>
          {permissions.canAdd && (
            <div className="w-full sm:w-auto flex justify-start sm:justify-end">
              <LiquidGlassButton
                type="button"
                onClick={() => {
                  setEditingCountry(null);
                  setCountryModalOpen(true);
                }}
                className="w-full sm:w-auto text-center"
              >
                <Plus className="w-4 h-4 liquid-glass-btn__icon" />
                Add Country
              </LiquidGlassButton>
            </div>
          )}
        </div>

        {/* Permission Access Denied */}
        {!permissions.canView ? (
          <div className="card p-12 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs text-center">
            <div className="max-w-md mx-auto flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-3">
                <Lock size={26} />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                Access Denied
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                You do not have permission to view the Countries & States section.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Search & Toolbar Card */}
            <div className="card p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                  Showing {countries.length} of {totalCount} Countries
                </h3>

                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Search field */}
                  <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
                    <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search country name..."
                      value={searchText}
                      onChange={(e) => {
                        setSearchText(e.target.value);
                        setPageNumber(1);
                      }}
                      className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
                    />
                    {searchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchText('');
                          setPageNumber(1);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        aria-label="Clear search"
                      >
                        <X size={14} className="text-gray-500 dark:text-gray-300" />
                      </button>
                    )}
                  </div>

                  {/* Refresh Button */}
                  <TableRefreshButton onClick={fetchCountries} className="shrink-0" />
                </div>
              </div>
            </div>

            {/* Paginated Country Table Container */}
            <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      <th className="py-3.5 px-3 text-center w-12" aria-label="Expand" />
                      <th className="py-3.5 px-4 text-center w-14">#</th>
                      <th
                        onClick={() => handleToggleSort('countryName')}
                        className="py-3.5 px-4 min-w-[220px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                      >
                        Country Name {renderSortIcon('countryName')}
                      </th>
                      <th
                        onClick={() => handleToggleSort('countryId')}
                        className="py-3.5 px-4 min-w-[120px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                      >
                        Country ID {renderSortIcon('countryId')}
                      </th>
                      <th className="py-3.5 px-4 text-right min-w-[200px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                    {/* Loading State Skeleton */}
                    {loading && (
                      <>
                        {Array.from({ length: pageSize > 6 ? 6 : pageSize }).map((_, i) => (
                          <tr key={`skel-c-${i}`} className="animate-pulse">
                            <td className="py-4 px-3 text-center">
                              <div className="h-4 w-4 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="h-4 w-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                            </td>
                            <td className="py-4 px-4">
                              <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-40" />
                            </td>
                            <td className="py-4 px-4">
                              <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-16" />
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="h-7 w-28 bg-gray-200 dark:bg-white/10 rounded-lg ml-auto" />
                            </td>
                          </tr>
                        ))}
                      </>
                    )}

                    {/* Empty State */}
                    {!loading && countries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-16 px-4 text-center">
                          <div className="max-w-sm mx-auto flex flex-col items-center">
                            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                              <Globe size={28} className="opacity-80" />
                            </div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                              No countries found
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                              {searchText
                                ? 'No country matches your search. Try a different query.'
                                : 'No countries currently configured. Click "Add Country" to begin.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Country Data Rows */}
                    {!loading &&
                      countries.map((country, idx) => {
                        const serialNumber = (pageNumber - 1) * pageSize + idx + 1;
                        const isExpanded = expandedCountryIds.has(Number(country.countryId));
                        const countryStates = statesByCountry[Number(country.countryId)] || [];
                        const isStatesLoading = Boolean(loadingStates[Number(country.countryId)]);

                        return (
                          <React.Fragment key={country.countryId || idx}>
                            <tr
                              className={`transition-colors ${
                                isExpanded
                                  ? 'bg-purple-50/40 dark:bg-purple-950/20'
                                  : 'hover:bg-purple-50/20 dark:hover:bg-white/[0.02]'
                              }`}
                            >
                              {/* Expand/Collapse Button */}
                              <td className="py-4 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleCountryExpand(country.countryId)}
                                  className="p-1 rounded-md text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                  title={isExpanded ? 'Collapse states' : 'Expand states'}
                                  aria-label={isExpanded ? 'Collapse states' : 'Expand states'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={17} className="text-purple-600 dark:text-purple-400" />
                                  ) : (
                                    <ChevronRight size={17} />
                                  )}
                                </button>
                              </td>

                              {/* Serial Number */}
                              <td className="py-4 px-4 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
                                #{serialNumber}
                              </td>

                              {/* Country Name */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                    <Globe size={14} />
                                  </div>
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {country.countryName || '—'}
                                  </span>
                                  {countryStates.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                                      {countryStates.length} {countryStates.length === 1 ? 'state' : 'states'}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Country ID */}
                              <td className="py-4 px-4 text-xs font-mono text-gray-500 dark:text-gray-400">
                                #{country.countryId}
                              </td>

                              {/* Actions */}
                              <td className="py-4 px-4 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {/* Add State Action Button */}
                                  {permissions.canAdd && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStateModalTargetCountry(country);
                                        setEditingState(null);
                                        setStateModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 rounded-lg transition-colors border border-purple-200 dark:border-purple-800/40"
                                      title="Add State for this country"
                                    >
                                      <Plus size={13} />
                                      <span>Add State</span>
                                    </button>
                                  )}

                                  {/* Edit Country */}
                                  {permissions.canEdit && (
                                    <ActionIconButton
                                      label="Edit Country"
                                      onClick={() => {
                                        setEditingCountry(country);
                                        setCountryModalOpen(true);
                                      }}
                                      className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                    >
                                      <Pencil size={15} />
                                    </ActionIconButton>
                                  )}

                                  {/* Delete Country */}
                                  {permissions.canDelete && (
                                    <ActionIconButton
                                      label="Delete Country"
                                      variant="delete"
                                      onClick={() => openDeleteCountry(country)}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Nested States Panel (Expanded Row) */}
                            {isExpanded && (
                              <tr className="bg-purple-50/20 dark:bg-[#120f22]/70 border-b border-gray-200 dark:border-white/10">
                                <td colSpan={5} className="py-4 px-6 sm:px-10">
                                  <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-[#17132a]/80 p-4 space-y-3 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2.5">
                                      <div className="flex items-center gap-2">
                                        <MapPin size={15} className="text-purple-600 dark:text-purple-400" />
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                                          States / Provinces in {country.countryName}
                                        </h4>
                                      </div>

                                      {permissions.canAdd && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setStateModalTargetCountry(country);
                                            setEditingState(null);
                                            setStateModalOpen(true);
                                          }}
                                          className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                                        >
                                          <Plus size={12} />
                                          Add State
                                        </button>
                                      )}
                                    </div>

                                    {/* States Content */}
                                    {isStatesLoading ? (
                                      <div className="flex items-center gap-2 py-4 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin inline-block" />
                                        <span>Loading states...</span>
                                      </div>
                                    ) : countryStates.length === 0 ? (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
                                        No states available for this country.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                                        {countryStates.map((st) => (
                                          <div
                                            key={st.stateId}
                                            className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] hover:border-purple-300 dark:hover:border-purple-600/40 transition-colors"
                                          >
                                            <div className="min-w-0 pr-2">
                                              <span className="text-xs font-medium text-gray-900 dark:text-white truncate block">
                                                {st.stateName}
                                              </span>
                                              <span className="text-[10px] font-mono text-gray-400">
                                                #{st.stateId}
                                              </span>
                                            </div>

                                            <div className="inline-flex items-center gap-1 shrink-0">
                                              {permissions.canEdit && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setStateModalTargetCountry(country);
                                                    setEditingState(st);
                                                    setStateModalOpen(true);
                                                  }}
                                                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded"
                                                  title="Edit State"
                                                  aria-label="Edit State"
                                                >
                                                  <Pencil size={13} />
                                                </button>
                                              )}

                                              {permissions.canDelete && (
                                                <ActionIconButton
                                                  label="Delete State"
                                                  variant="delete"
                                                  onClick={() => openDeleteState(st, country)}
                                                  className="scale-90"
                                                />
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-gray-500 dark:text-gray-400">
                <div>
                  Showing <strong className="text-gray-800 dark:text-gray-200">{countries.length}</strong> of{' '}
                  <strong className="text-gray-800 dark:text-gray-200">{totalCount}</strong> Countries
                </div>

                <div className="flex items-center gap-4">
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-1.5">
                    <span>Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPageNumber(1);
                      }}
                      className="px-2 py-1 bg-white dark:bg-[#0f1322] border border-gray-300 dark:border-white/10 rounded-md text-gray-800 dark:text-gray-200 focus:outline-none"
                    >
                      {PAGE_SIZE_OPTIONS.map((sz) => (
                        <option key={sz} value={sz}>
                          {sz}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Anchor Pagination from CodePen jh3y */}
                  <AnchorPagination
                    currentPage={pageNumber}
                    totalPages={totalPages}
                    onPageChange={(p) => setPageNumber(p)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================= */}
      {/* Country Modal                                             */}
      {/* ========================================================= */}
      <CountryModal
        open={countryModalOpen}
        country={editingCountry}
        onClose={() => {
          setCountryModalOpen(false);
          setEditingCountry(null);
        }}
        onSuccess={() => {
          fetchCountries();
        }}
      />

      {/* ========================================================= */}
      {/* State Modal                                               */}
      {/* ========================================================= */}
      <StateModal
        open={stateModalOpen}
        country={stateModalTargetCountry}
        countries={countries}
        state={editingState}
        onClose={() => {
          setStateModalOpen(false);
          setStateModalTargetCountry(null);
          setEditingState(null);
        }}
        onSuccess={() => {
          if (stateModalTargetCountry?.countryId) {
            reloadStatesForCountry(stateModalTargetCountry.countryId);
          }
        }}
      />

      {/* ========================================================= */}
      {/* Delete Confirmation Modal                                 */}
      {/* ========================================================= */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title={deleteContext?.type === 'country' ? 'Delete Country' : 'Delete State'}
        description={`Are you sure you want to remove ${
          deleteContext?.type === 'country' ? 'country' : 'state'
        }`}
        itemName={
          deleteContext?.type === 'country'
            ? deleteContext?.item?.countryName
            : deleteContext?.item?.stateName
        }
        details={
          deleteContext?.type === 'country'
            ? [
                { label: 'Country ID', value: `#${deleteContext?.item?.countryId}` },
                { label: 'Country Name', value: deleteContext?.item?.countryName || '—' }
              ]
            : deleteContext?.type === 'state'
            ? [
                { label: 'State ID', value: `#${deleteContext?.item?.stateId}` },
                { label: 'State Name', value: deleteContext?.item?.stateName || '—' },
                { label: 'Country', value: deleteContext?.countryName || `Country #${deleteContext?.countryId}` }
              ]
            : []
        }
        loading={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteModalOpen(false);
          setDeleteContext(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default CountryPage;
