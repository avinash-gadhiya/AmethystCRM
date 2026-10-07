import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Sliders,
  Plus,
  Search,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  Tags,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  Layers,
  CheckCircle2,
  XCircle,
  Hash,
  Key
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

import settingService from '@/services/settingService';
import authService from '@/services/authService';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import { getApiErrorMessage } from '@/lib/apiError';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import IosToggle from '@/components/common/IosToggle';
import SettingModal from '@/components/settings/SettingModal';
import SettingValueModal from '@/components/settings/SettingValueModal';

// ---------------------------------------------------------------------------
// Resolve CRUD permissions for the Settings page (Fail-closed principle)
// ---------------------------------------------------------------------------
const resolvePermissions = () => {
  return resolveConfiguredPagePermissions('setting', ['/settings/settings', '/settings/setting']);

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
              url.includes('/setting') ||
              url.includes('setting') ||
              name.includes('setting')
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
      console.warn('Error reading permission menus for settings:', e);
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
        if (code.includes('setting')) {
          if (code.includes('view') || code.includes('read')) canView = true;
          if (code.includes('add') || code.includes('create')) canAdd = true;
          if (code.includes('edit') || code.includes('update')) canEdit = true;
          if (code.includes('delete') || code.includes('remove')) canDelete = true;
        }
      }
      if (
        grantedCodes.has('setting') ||
        grantedCodes.has('settings') ||
        grantedCodes.has('settings_all')
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

const SettingPage = () => {
  // Permissions
  const permissions = useMemo(() => resolvePermissions(), []);

  // Settings State
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting: default SortProperty: "settingId", IsDescending: true
  const [sortProperty, setSortProperty] = useState('settingId');
  const [isDescending, setIsDescending] = useState(true);
  const [searchText, setSearchText] = useState('');

  // Row Expansion State
  const [expandedSettingIds, setExpandedSettingIds] = useState(new Set());

  // Optimistic toggles in progress tracking
  const [togglingSettings, setTogglingSettings] = useState({});
  const [togglingValues, setTogglingValues] = useState({});

  // Modals State
  const [settingModalOpen, setSettingModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);

  const [valueModalOpen, setValueModalOpen] = useState(false);
  const [targetParentSetting, setTargetParentSetting] = useState(null);
  const [editingValue, setEditingValue] = useState(null);

  // Delete Confirmation State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteContext, setDeleteContext] = useState(null); // { type: 'setting' | 'value', item, parentSetting }
  const [isDeleting, setIsDeleting] = useState(false);

  // Stale request sequencing
  const requestSeqRef = useRef(0);

  // Load Settings list (PageSize: 10000, loads all without normal table pagination)
  const fetchSettings = useCallback(async () => {
    if (!permissions.canView) {
      setLoading(false);
      return;
    }

    const currentSeq = ++requestSeqRef.current;
    try {
      setLoading(true);
      const res = await settingService.getSettings({
        Text: searchText.trim(),
        PageNumber: 1,
        PageSize: 10000,
        SortProperty: sortProperty,
        IsDescending: isDescending
      });

      // Prevent stale async response overwrite
      if (currentSeq !== requestSeqRef.current) return;

      const list = res.data || [];
      setSettings(list);
      setTotalCount(res.totalCount || list.length);
    } catch (error) {
      if (currentSeq !== requestSeqRef.current) return;
      console.error('Failed to fetch settings:', error);
      toast.error(getApiErrorMessage(error, 'Failed to fetch settings'));
      setSettings([]);
      setTotalCount(0);
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [permissions.canView, searchText, sortProperty, isDescending]);

  // Strict Mode mount protection
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      fetchSettings();
      return;
    }
    fetchSettings();
  }, [fetchSettings]);

  // Toggle row expansion
  const toggleSettingExpand = (settingId) => {
    const id = Number(settingId);
    setExpandedSettingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Expand all / Collapse all helper
  const handleToggleExpandAll = () => {
    if (expandedSettingIds.size === settings.length) {
      setExpandedSettingIds(new Set());
    } else {
      setExpandedSettingIds(new Set(settings.map((s) => s.settingId)));
    }
  };

  // Column sorting toggle
  const handleToggleSort = (property) => {
    if (sortProperty === property) {
      setIsDescending(!isDescending);
    } else {
      setSortProperty(property);
      setIsDescending(true);
    }
  };

  // ---------------------------------------------------------------------------
  // Optimistic Toggle for Setting Active Status (PUT /api/Setting)
  // ---------------------------------------------------------------------------
  const handleToggleSettingActive = async (setting, nextChecked) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to edit settings.');
      return;
    }

    const sId = setting.settingId;
    if (togglingSettings[sId]) return;

    const previousStatus = Boolean(setting.isActive);
    const newStatus = typeof nextChecked === 'boolean' ? nextChecked : !previousStatus;

    // 1. Optimistic UI update using map loop
    setSettings((prev) =>
      prev.map((s) => (s.settingId === sId ? { ...s, isActive: newStatus } : s))
    );
    setTogglingSettings((prev) => ({ ...prev, [sId]: true }));

    try {
      const response = await settingService.updateSetting({
        settingId: Number(sId),
        settingName: setting.settingName,
        settingKey: setting.settingKey,
        isActive: newStatus,
        settingValueDTOs: Array.isArray(setting.settingValueDTOs)
          ? setting.settingValueDTOs.map((v) => ({
              settingValueId: Number(v.settingValueId || 0),
              settingId: Number(v.settingId || sId),
              settingValueText: String(v.settingValueText || '').trim(),
              isActive: Boolean(v.isActive)
            }))
          : []
      });

      // Synchronize with API response or re-fetch in loop to reflect verified server output
      const apiSetting = response?.data;
      if (apiSetting && typeof apiSetting === 'object') {
        setSettings((prev) =>
          prev.map((s) =>
            s.settingId === sId
              ? {
                  ...s,
                  isActive: Boolean(apiSetting.isActive ?? newStatus),
                  settingName: apiSetting.settingName ?? s.settingName,
                  settingKey: apiSetting.settingKey ?? s.settingKey
                }
              : s
          )
        );
      }

      toast.success(
        `Setting "${setting.settingName}" marked as ${newStatus ? 'Active' : 'Inactive'}`
      );
      // Silently refresh in background to ensure accurate state
      fetchSettings();
    } catch (err) {
      console.error('Failed to toggle setting status:', err);
      // Revert optimistic update using map loop
      setSettings((prev) =>
        prev.map((s) => (s.settingId === sId ? { ...s, isActive: previousStatus } : s))
      );
      toast.error(getApiErrorMessage(err, 'Failed to update setting status'));
    } finally {
      setTogglingSettings((prev) => ({ ...prev, [sId]: false }));
    }
  };

  // ---------------------------------------------------------------------------
  // Optimistic Toggle for Setting Value Active Status (PUT /api/SettingValue)
  // ---------------------------------------------------------------------------
  const handleToggleValueActive = async (value, parentSetting, nextChecked) => {
    if (!permissions.canEdit) {
      toast.error('You do not have permission to edit setting values.');
      return;
    }

    const vId = value.settingValueId;
    const pId = parentSetting.settingId;
    if (togglingValues[vId]) return;

    const previousStatus = Boolean(value.isActive);
    const newStatus = typeof nextChecked === 'boolean' ? nextChecked : !previousStatus;

    // 1. Optimistic UI update using map loop
    setSettings((prev) =>
      prev.map((s) => {
        if (s.settingId !== pId) return s;
        return {
          ...s,
          settingValueDTOs: (s.settingValueDTOs || []).map((v) =>
            v.settingValueId === vId ? { ...v, isActive: newStatus } : v
          )
        };
      })
    );
    setTogglingValues((prev) => ({ ...prev, [vId]: true }));

    try {
      await settingService.updateSettingValue({
        settingValueId: Number(vId),
        settingId: Number(pId),
        settingValueText: String(value.settingValueText || '').trim(),
        isActive: Boolean(newStatus)
      });
      toast.success(
        `Value "${value.settingValueText}" marked as ${newStatus ? 'Active' : 'Inactive'}`
      );
      // Silently refresh in background
      fetchSettings();
    } catch (err) {
      console.error('Failed to toggle setting value status:', err);
      // Revert optimistic update using map loop
      setSettings((prev) =>
        prev.map((s) => {
          if (s.settingId !== pId) return s;
          return {
            ...s,
            settingValueDTOs: (s.settingValueDTOs || []).map((v) =>
              v.settingValueId === vId ? { ...v, isActive: previousStatus } : v
            )
          };
        })
      );
      toast.error(getApiErrorMessage(err, 'Failed to update setting value status'));
    } finally {
      setTogglingValues((prev) => ({ ...prev, [vId]: false }));
    }
  };

  // ---------------------------------------------------------------------------
  // Delete Dialog Handlers
  // ---------------------------------------------------------------------------
  const openDeleteSetting = (setting) => {
    setDeleteContext({
      type: 'setting',
      item: setting,
      id: setting.settingId,
      name: setting.settingName
    });
    setDeleteModalOpen(true);
  };

  const openDeleteValue = (value, parentSetting) => {
    setDeleteContext({
      type: 'value',
      item: value,
      parentSetting,
      id: value.settingValueId,
      name: value.settingValueText
    });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteContext) return;
    setIsDeleting(true);

    try {
      if (deleteContext.type === 'setting') {
        const sId = deleteContext.id;
        await settingService.deleteSetting(sId);
        toast.success(`Setting "${deleteContext.name}" deleted successfully`);

        // Collapse setting if it was expanded
        setExpandedSettingIds((prev) => {
          const next = new Set(prev);
          next.delete(sId);
          return next;
        });

        // Refresh settings list after delete
        fetchSettings();
      } else if (deleteContext.type === 'value') {
        const vId = deleteContext.id;
        await settingService.deleteSettingValue(vId);
        toast.success(`Value "${deleteContext.name}" deleted successfully`);

        // Refresh settings list after delete
        fetchSettings();
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
    <div className="settings-management-page px-5 lg:px-10 py-5">
      <Toaster richColors position="top-right" />

      <div className="flex flex-col gap-5 lg:gap-7.5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
              Settings
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Manage system configuration keys and their associated dynamic values.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {permissions.canAdd && (
              <LiquidGlassButton
                variant="primary"
                size="md"
                onClick={() => {
                  setEditingSetting(null);
                  setSettingModalOpen(true);
                }}
                className="gap-2"
              >
                <Plus size={16} />
                <span>Add Setting</span>
              </LiquidGlassButton>
            )}
          </div>
        </div>

        {/* Permission Denied Banner */}
        {!permissions.canView && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
            <Lock size={32} className="mx-auto text-red-500 mb-2" />
            <h3 className="text-base font-semibold text-red-600 dark:text-red-400">
              Access Restricted
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              You do not have permission to view the Settings configuration section.
            </p>
          </div>
        )}

        {permissions.canView && (
          <>
            {/* Toolbar Card */}
            <div className="bg-white/80 dark:bg-[#1d1733]/80 backdrop-blur-md rounded-2xl p-4 border border-gray-200/80 dark:border-white/10 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <input
                  type="text"
                  placeholder="Search settings by name or key..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-9.5 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                />
                {searchText && (
                  <button
                    onClick={() => setSearchText('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    title="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Toolbar Right Side */}
              <div className="flex items-center gap-2.5 flex-wrap justify-end">
                {/* Count Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                  <Sliders size={13} />
                  <span>
                    Loaded {settings.length} {settings.length === 1 ? 'setting' : 'settings'}
                  </span>
                  {totalCount > settings.length && (
                    <span className="text-gray-500 dark:text-gray-400">
                      (Total {totalCount})
                    </span>
                  )}
                </div>

                {/* Expand / Collapse All Toggle */}
                {settings.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleExpandAll}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-all"
                  >
                    {expandedSettingIds.size === settings.length
                      ? 'Collapse All'
                      : 'Expand All'}
                  </button>
                )}

                {/* Refresh Button */}
                <TableRefreshButton
                  onRefresh={fetchSettings}
                  loading={loading}
                  title="Refresh Settings"
                />
              </div>
            </div>

            {/* Main Table Container */}
            <div className="bg-white/80 dark:bg-[#1d1733]/80 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] text-xs font-semibold text-gray-600 dark:text-gray-300">
                      <th className="py-3.5 px-4 w-12 text-center"></th>
                      <th
                        onClick={() => handleToggleSort('settingName')}
                        className="py-3.5 px-4 cursor-pointer select-none hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        Setting Name {renderSortIcon('settingName')}
                      </th>
                      <th
                        onClick={() => handleToggleSort('settingKey')}
                        className="py-3.5 px-4 cursor-pointer select-none hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        Setting Key {renderSortIcon('settingKey')}
                      </th>
                      <th className="py-3.5 px-4 text-center w-36">Status</th>
                      <th className="py-3.5 px-4 text-right w-44">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {loading && settings.length === 0 ? (
                      // Skeleton Loading
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="animate-pulse">
                          <td className="py-4 px-4 text-center">
                            <div className="w-5 h-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-48 mb-2" />
                            <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-24" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-32" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-6 w-14 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <div className="w-8 h-8 bg-gray-200 dark:bg-white/10 rounded-lg" />
                              <div className="w-8 h-8 bg-gray-200 dark:bg-white/10 rounded-lg" />
                              <div className="w-8 h-8 bg-gray-200 dark:bg-white/10 rounded-lg" />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : settings.length === 0 ? (
                      // Empty State
                      <tr>
                        <td colSpan={5} className="py-12 text-center">
                          <div className="max-w-sm mx-auto flex flex-col items-center">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                              <Sliders size={24} />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                              No Settings Found
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {searchText
                                ? `No configuration settings matched "${searchText}". Try adjusting your search query.`
                                : 'No configuration settings have been added yet. Click "Add Setting" to get started.'}
                            </p>
                            {searchText && (
                              <button
                                onClick={() => setSearchText('')}
                                className="mt-3 text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                              >
                                Clear search query
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      // Render Setting Rows with Nested Child Values
                      settings.map((setting) => {
                        const sId = setting.settingId;
                        const isExpanded = expandedSettingIds.has(sId);
                        const childValues = setting.settingValueDTOs || [];
                        const isTogglingSetting = Boolean(togglingSettings[sId]);

                        return (
                          <React.Fragment key={sId}>
                            {/* Main Setting Row */}
                            <tr
                              onClick={() => toggleSettingExpand(sId)}
                              className={`group cursor-pointer transition-colors duration-150 ${
                                isExpanded
                                  ? 'bg-purple-50/40 dark:bg-purple-950/20'
                                  : 'hover:bg-gray-50/80 dark:hover:bg-white/[0.02]'
                              }`}
                            >
                              {/* Expand/Collapse Chevron */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSettingExpand(sId);
                                  }}
                                  className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-100/50 dark:hover:bg-white/10 transition-all"
                                  title={isExpanded ? 'Collapse values' : 'Expand values'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={17} className="text-purple-600 dark:text-purple-400" />
                                  ) : (
                                    <ChevronRight size={17} />
                                  )}
                                </button>
                              </td>

                              {/* Setting Name */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {setting.settingName}
                                  </span>
                                  {/* Child values count badge */}
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                    <Tags size={10} />
                                    <span>{childValues.length}</span>
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                                  ID: #{sId}
                                </div>
                              </td>

                              {/* Setting Key */}
                              <td className="py-3.5 px-4">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-mono text-purple-700 dark:text-purple-300">
                                  <Key size={12} className="opacity-70" />
                                  <span>{setting.settingKey}</span>
                                </div>
                              </td>

                              {/* Setting Status Toggle */}
                              <td
                                className="py-3.5 px-4 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {permissions.canEdit ? (
                                  <div className="inline-flex items-center justify-center scale-90">
                                    <IosToggle
                                      checked={Boolean(setting.isActive)}
                                      onCheckedChange={(nextChecked) => handleToggleSettingActive(setting, nextChecked)}
                                      disabled={isTogglingSetting}
                                      loading={isTogglingSetting}
                                      title={setting.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                                    />
                                  </div>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                      setting.isActive
                                        ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                        : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                                    }`}
                                  >
                                    {setting.isActive ? (
                                      <CheckCircle2 size={12} />
                                    ) : (
                                      <XCircle size={12} />
                                    )}
                                    <span>{setting.isActive ? 'Active' : 'Inactive'}</span>
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td
                                className="py-3.5 px-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Add Value Action */}
                                  {permissions.canAdd && (
                                    <ActionIconButton
                                      label="Add Value"
                                      tooltip="Add Value"
                                      className="text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                                      onClick={() => {
                                        setTargetParentSetting(setting);
                                        setEditingValue(null);
                                        setValueModalOpen(true);
                                      }}
                                    >
                                      <Plus size={15} />
                                    </ActionIconButton>
                                  )}

                                  {/* Edit Setting */}
                                  {permissions.canEdit && (
                                    <ActionIconButton
                                      label="Edit Setting"
                                      tooltip="Edit Setting"
                                      className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                      onClick={() => {
                                        setEditingSetting(setting);
                                        setSettingModalOpen(true);
                                      }}
                                    >
                                      <Pencil size={15} />
                                    </ActionIconButton>
                                  )}

                                  {/* Delete Setting */}
                                  {permissions.canDelete && (
                                    <ActionIconButton
                                      label="Delete Setting"
                                      tooltip="Delete Setting"
                                      variant="delete"
                                      onClick={() => openDeleteSetting(setting)}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Nested Child Setting Values Sub-Table */}
                            {isExpanded && (
                              <tr className="bg-purple-50/20 dark:bg-purple-950/10 border-b border-gray-200/70 dark:border-white/5">
                                <td colSpan={5} className="p-0">
                                  <div className="pl-14 pr-6 py-4 border-l-4 border-purple-500/70 bg-gradient-to-r from-purple-50/40 via-transparent to-transparent dark:from-purple-900/10">
                                    {/* Nested Header */}
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <Tags size={15} className="text-purple-600 dark:text-purple-400" />
                                        <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                                          Child Values for "{setting.settingName}"
                                        </h4>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          ({childValues.length} {childValues.length === 1 ? 'item' : 'items'})
                                        </span>
                                      </div>

                                      {permissions.canAdd && (
                                        <LiquidGlassButton
                                          variant="primary"
                                          size="xs"
                                          onClick={() => {
                                            setTargetParentSetting(setting);
                                            setEditingValue(null);
                                            setValueModalOpen(true);
                                          }}
                                          className="gap-1.5"
                                        >
                                          <Plus size={13} />
                                          <span>Add Value</span>
                                        </LiquidGlassButton>
                                      )}
                                    </div>

                                    {/* Nested Values Content */}
                                    {childValues.length === 0 ? (
                                      <div className="py-4 text-center rounded-xl bg-white/50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400">
                                        No values defined for this setting. Click "Add Value" to define dynamic options.
                                      </div>
                                    ) : (
                                      <div className="overflow-hidden rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/90 dark:bg-[#1a152e]/90 shadow-sm">
                                        <table className="w-full text-left text-xs">
                                          <thead>
                                            <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] font-semibold text-gray-600 dark:text-gray-300">
                                              <th className="py-2.5 px-3.5 w-16">ID</th>
                                              <th className="py-2.5 px-3.5">Setting Value Text</th>
                                              <th className="py-2.5 px-3.5 text-center w-32">Status</th>
                                              <th className="py-2.5 px-3.5 text-right w-28">Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {childValues.map((val) => {
                                              const vId = val.settingValueId;
                                              const isTogglingVal = Boolean(togglingValues[vId]);

                                              return (
                                                <tr
                                                  key={vId}
                                                  className="hover:bg-purple-50/30 dark:hover:bg-white/[0.02] transition-colors"
                                                >
                                                  <td className="py-2.5 px-3.5 font-mono text-gray-400 dark:text-gray-500">
                                                    #{vId}
                                                  </td>
                                                  <td className="py-2.5 px-3.5 font-medium text-gray-900 dark:text-white">
                                                    {val.settingValueText}
                                                  </td>
                                                  <td className="py-2.5 px-3.5 text-center">
                                                    {permissions.canEdit ? (
                                                      <div className="inline-flex items-center justify-center scale-90">
                                                        <IosToggle
                                                          checked={Boolean(val.isActive)}
                                                          onCheckedChange={(nextChecked) => handleToggleValueActive(val, setting, nextChecked)}
                                                          disabled={isTogglingVal}
                                                          loading={isTogglingVal}
                                                          title={val.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                                                        />
                                                      </div>
                                                    ) : (
                                                      <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                          val.isActive
                                                            ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                                            : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                                                        }`}
                                                      >
                                                        <span>{val.isActive ? 'Active' : 'Inactive'}</span>
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="py-2.5 px-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                      {permissions.canEdit && (
                                                        <ActionIconButton
                                                          label="Edit Value"
                                                          icon="pencil"
                                                          tooltip="Edit Value"
                                                          variant="edit"
                                                          onClick={() => {
                                                            setTargetParentSetting(setting);
                                                            setEditingValue(val);
                                                            setValueModalOpen(true);
                                                          }}
                                                        />
                                                      )}
                                                      {permissions.canDelete && (
                                                        <ActionIconButton
                                                          icon="trash"
                                                          tooltip="Delete Value"
                                                          variant="delete"
                                                          onClick={() => openDeleteValue(val, setting)}
                                                        />
                                                      )}
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Setting Modal (Add/Edit Setting) */}
      <SettingModal
        open={settingModalOpen}
        setting={editingSetting}
        onClose={() => {
          setSettingModalOpen(false);
          setEditingSetting(null);
        }}
        onSuccess={() => {
          fetchSettings();
        }}
      />

      {/* Setting Value Modal (Add/Edit Value) */}
      <SettingValueModal
        open={valueModalOpen}
        parentSetting={targetParentSetting}
        value={editingValue}
        onClose={() => {
          setValueModalOpen(false);
          setTargetParentSetting(null);
          setEditingValue(null);
        }}
        onSuccess={() => {
          fetchSettings();
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteModalOpen(false);
            setDeleteContext(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title={
          deleteContext?.type === 'setting'
            ? 'Delete Setting'
            : 'Delete Setting Value'
        }
        message={
          deleteContext?.type === 'setting' ? (
            <span>
              Are you sure you want to permanently delete setting{' '}
              <strong className="text-gray-900 dark:text-white">
                "{deleteContext.name}"
              </strong>{' '}
              <span className="font-mono text-purple-600 dark:text-purple-400">
                (ID: #{deleteContext.id})
              </span>
              ? All child values will also be deleted. This action cannot be undone.
            </span>
          ) : (
            <span>
              Are you sure you want to permanently delete value{' '}
              <strong className="text-gray-900 dark:text-white">
                "{deleteContext?.name}"
              </strong>{' '}
              <span className="font-mono text-blue-600 dark:text-blue-400">
                (ID: #{deleteContext?.id})
              </span>{' '}
              from setting "{deleteContext?.parentSetting?.settingName}"?
            </span>
          )
        }
        confirmText="Delete Permanently"
      />
    </div>
  );
};

export default SettingPage;
