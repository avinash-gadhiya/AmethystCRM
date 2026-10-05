import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  X,
  Pencil,
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
import CommonTable from '@/components/common/CommonTable';
import BlockIpModal from '@/components/blocked-ip/BlockIpModal';

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

  // CommonTable columns definition
  const columns = useMemo(
    () => [
      {
        id: 'serial',
        header: '#',
        align: 'center',
        width: 'w-14'
      },
      {
        id: 'ip',
        accessor: 'ip',
        header: 'IP Address',
        sortable: true,
        sortKey: 'ip',
        className: 'min-w-[220px]',
        cell: (row) => {
          const ipValue = row.ip || row.ipAddress || row.blockedIp || '—';
          return (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Globe size={14} />
              </div>
              <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white tracking-wide">
                {ipValue}
              </span>
            </div>
          );
        }
      },
      {
        id: 'id',
        accessor: 'id',
        header: 'Record ID',
        sortable: true,
        sortKey: 'id',
        className: 'min-w-[120px] font-mono text-xs text-gray-500 dark:text-gray-400',
        cell: (row, idx) => `#${row.id ?? row.blockIpId ?? idx + 1}`
      },
      {
        id: 'actions',
        header: 'Actions',
        align: 'right',
        sticky: 'right',
        className: 'min-w-[120px]',
        cell: (row) => (
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
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">No actions</span>
            )}
          </div>
        )
      }
    ],
    [permissions]
  );

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

            {/* CommonTable with CodePen AnchorPagination */}
            <CommonTable
              columns={columns}
              data={items}
              loading={loading}
              sort={{
                sortProperty,
                isDescending,
                onSort: handleToggleSort
              }}
              pagination={{
                pageNumber,
                pageSize,
                totalCount,
                totalPages,
                onPageChange: (p) => setPageNumber(p),
                onPageSizeChange: (sz) => {
                  setPageSize(sz);
                  setPageNumber(1);
                },
                itemName: 'Records'
              }}
              emptyState={{
                icon: <ShieldAlert size={28} className="opacity-80" />,
                title: 'No blocked IP addresses found',
                description: searchText
                  ? 'No IP records match your search criteria. Try a different query.'
                  : 'The blocklist is currently empty. Use "Block New IP" to add an address.'
              }}
            />
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
