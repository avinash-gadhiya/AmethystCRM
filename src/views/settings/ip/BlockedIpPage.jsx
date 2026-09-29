import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  X,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
  Globe
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

import blockIpService from '@/services/blockIpService';
import authService from '@/services/authService';
import { getApiErrorMessage } from '@/lib/apiError';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import BlockIpModal from '@/components/blocked-ip/BlockIpModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ---------------------------------------------------------------------------
// Resolve CRUD permissions for the Blocked IP page (Fail-closed principle)
// ---------------------------------------------------------------------------
const resolvePermissions = () => {
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

    // Super admin and developer roles have full administrative privileges
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

    // Check cached permission menus for the page permissions
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
              url.includes('/ip') ||
              url.includes('blockip') ||
              name.includes('block') ||
              name.includes('ip')
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
      console.warn('Error reading permission menus:', e);
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
        if (code.includes('ip') || code.includes('block')) {
          if (code.includes('view') || code.includes('read')) canView = true;
          if (code.includes('add') || code.includes('create')) canAdd = true;
          if (code.includes('edit') || code.includes('update')) canEdit = true;
          if (code.includes('delete') || code.includes('remove')) canDelete = true;
        }
      }
      if (
        grantedCodes.has('blockip') ||
        grantedCodes.has('ip') ||
        grantedCodes.has('settings')
      ) {
        canView = true;
        canAdd = true;
        canEdit = true;
        canDelete = true;
      }
    } else {
      // Fail closed when no permissions can be determined
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

const BlockedIpPage = () => {
  // Permissions
  const permissions = useMemo(() => resolvePermissions(), []);

  // Data & Pagination state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Search & Filter state
  const [searchText, setSearchText] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('id');
  const [isDescending, setIsDescending] = useState(true);

  // Modals state
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch list of blocked IPs from API
  const fetchBlockedIps = useCallback(async () => {
    if (!permissions.canView) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await blockIpService.getBlockedIps({
        Text: searchText.trim(),
        PageNumber: pageNumber,
        PageSize: pageSize,
        SortProperty: sortProperty,
        IsDescending: isDescending
      });

      setItems(res.data || []);
      setTotalCount(res.totalCount || 0);
    } catch (error) {
      console.error('Failed to fetch blocked IPs:', error);
      toast.error(getApiErrorMessage(error, 'Failed to fetch blocked IP addresses'));
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [permissions.canView, searchText, pageNumber, pageSize, sortProperty, isDescending]);

  // Prevent duplicate requests during React Strict Mode mounting
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      fetchBlockedIps();
      return;
    }
    fetchBlockedIps();
  }, [fetchBlockedIps]);

  // Handle Sort toggle
  const handleToggleSort = (property) => {
    if (sortProperty === property) {
      setIsDescending(!isDescending);
    } else {
      setSortProperty(property);
      setIsDescending(true);
    }
    setPageNumber(1);
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await blockIpService.deleteBlockedIp(deleteTarget.id);
      toast.success(`IP address "${deleteTarget.ip}" removed from blocklist`);
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchBlockedIps();
    } catch (err) {
      console.error('Failed to delete blocked IP:', err);
      toast.error(getApiErrorMessage(err, 'Failed to remove blocked IP'));
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
    <div className="blocked-ip-page px-5 lg:px-10 py-5">
      <Toaster richColors position="top-right" />

      <div className="flex flex-col gap-5 lg:gap-7.5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
              Blocked IP Addresses
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Manage and restrict unauthorized IPv4 addresses from accessing the application.
            </p>
          </div>
          {permissions.canAdd && (
            <div className="w-full sm:w-auto flex justify-start sm:justify-end">
              <LiquidGlassButton
                type="button"
                onClick={() => {
                  setEditingRecord(null);
                  setEditorModalOpen(true);
                }}
                className="w-full sm:w-auto text-center"
              >
                <Plus className="w-4 h-4 liquid-glass-btn__icon" />
                Block New IP
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
                You do not have permission to view the Blocked IP Addresses section. Please contact
                your system administrator if you believe this is an error.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Search & Toolbar Card */}
            <div className="card p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                  Showing {items.length} of {totalCount} Blocked IPs
                </h3>

                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Search field */}
                  <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
                    <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search by IP address..."
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
                  <TableRefreshButton onClick={fetchBlockedIps} className="shrink-0" />
                </div>
              </div>
            </div>

            {/* Paginated Table Container */}
            <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      <th className="py-3.5 px-4 text-center w-14">#</th>
                      <th
                        onClick={() => handleToggleSort('ip')}
                        className="py-3.5 px-4 min-w-[220px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                      >
                        IP Address {renderSortIcon('ip')}
                      </th>
                      <th
                        onClick={() => handleToggleSort('id')}
                        className="py-3.5 px-4 min-w-[120px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                      >
                        Record ID {renderSortIcon('id')}
                      </th>
                      <th className="py-3.5 px-4 text-right min-w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                    {/* Loading State Skeleton */}
                    {loading && (
                      <>
                        {Array.from({ length: pageSize > 6 ? 6 : pageSize }).map((_, i) => (
                          <tr key={`skel-ip-${i}`} className="animate-pulse">
                            <td className="py-4 px-4 text-center">
                              <div className="h-4 w-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                            </td>
                            <td className="py-4 px-4">
                              <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-44" />
                            </td>
                            <td className="py-4 px-4">
                              <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-16" />
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="h-7 w-16 bg-gray-200 dark:bg-white/10 rounded-lg ml-auto" />
                            </td>
                          </tr>
                        ))}
                      </>
                    )}

                    {/* Empty State */}
                    {!loading && items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-16 px-4 text-center">
                          <div className="max-w-sm mx-auto flex flex-col items-center">
                            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                              <ShieldAlert size={28} className="opacity-80" />
                            </div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                              No blocked IP addresses found
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                              {searchText
                                ? 'No IP records match your search criteria. Try a different query.'
                                : 'The blocklist is currently empty. Use "Block New IP" to add an address.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Data Rows */}
                    {!loading &&
                      items.map((row, idx) => {
                        const serialNumber = (pageNumber - 1) * pageSize + idx + 1;
                        const ipValue = row.ip || row.ipAddress || row.blockedIp || '—';
                        const idValue = row.id ?? row.blockIpId ?? idx + 1;

                        return (
                          <tr
                            key={idValue}
                            className="hover:bg-purple-50/30 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            {/* Serial Number */}
                            <td className="py-4 px-4 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
                              #{serialNumber}
                            </td>

                            {/* IP Address */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                                  <Globe size={14} />
                                </div>
                                <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white tracking-wide">
                                  {ipValue}
                                </span>
                              </div>
                            </td>

                            {/* Record ID */}
                            <td className="py-4 px-4 text-xs font-mono text-gray-500 dark:text-gray-400">
                              #{idValue}
                            </td>

                            {/* Actions (Edit & Delete based on permissions) */}
                            <td className="py-4 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {permissions.canEdit && (
                                  <ActionIconButton
                                    label="Edit Blocked IP"
                                    onClick={() => {
                                      setEditingRecord(row);
                                      setEditorModalOpen(true);
                                    }}
                                    className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  >
                                    <Pencil size={15} />
                                  </ActionIconButton>
                                )}

                                {permissions.canDelete && (
                                  <ActionIconButton
                                    label="Delete Blocked IP"
                                    variant="delete"
                                    onClick={() => {
                                      setDeleteTarget(row);
                                      setDeleteModalOpen(true);
                                    }}
                                  />
                                )}

                                {!permissions.canEdit && !permissions.canDelete && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                                    No actions
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-gray-500 dark:text-gray-400">
                <div>
                  Showing <strong className="text-gray-800 dark:text-gray-200">{items.length}</strong> of{' '}
                  <strong className="text-gray-800 dark:text-gray-200">{totalCount}</strong> Records
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

                  {/* Page Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={pageNumber <= 1 || loading}
                      onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={14} className="inline mr-0.5" />
                      Prev
                    </button>
                    <span className="px-2 font-medium text-gray-800 dark:text-gray-200">
                      {pageNumber} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={pageNumber >= totalPages || loading}
                      onClick={() => setPageNumber((p) => p + 1)}
                      className="px-2.5 py-1 rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight size={14} className="inline ml-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================= */}
      {/* Create / Edit Modal                                       */}
      {/* ========================================================= */}
      <BlockIpModal
        open={editorModalOpen}
        record={editingRecord}
        onClose={() => {
          setEditorModalOpen(false);
          setEditingRecord(null);
        }}
        onSuccess={() => {
          fetchBlockedIps();
        }}
      />

      {/* ========================================================= */}
      {/* Delete Confirmation Modal                                 */}
      {/* ========================================================= */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Blocked IP"
        description="Are you sure you want to remove"
        itemName={deleteTarget ? deleteTarget.ip || 'this IP' : ''}
        details={
          deleteTarget
            ? [
                { label: 'Record ID', value: `#${deleteTarget.id}` },
                { label: 'IP Address', value: deleteTarget.ip || '—' }
              ]
            : []
        }
        loading={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default BlockedIpPage;
