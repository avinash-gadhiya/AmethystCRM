import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Mail,
  Plus,
  Search,
  X,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

import groupEmailService from '@/services/groupEmailService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveGroupEmailPermissions } from '@/utils/groupEmailPermissions';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import AnchorPagination from '@/components/common/AnchorPagination';
import IosToggle from '@/components/common/IosToggle';

import GroupEmailModal from '@/components/group-email/GroupEmailModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const GroupEmailPage = () => {
  // Fail-closed permission resolution
  const perms = useMemo(() => resolveGroupEmailPermissions('group-email'), []);

  // Group Email List State
  const [groupEmails, setGroupEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Group options for dropdown
  const [groupOptions, setGroupOptions] = useState([]);

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty, setSortProperty] = useState('groupEmailId');
  const [isDescending, setIsDescending] = useState(true);

  // Status updating tracking (Set of groupEmailIds)
  const [updatingStatusIds, setUpdatingStatusIds] = useState(new Set());

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Search Debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load Group dropdown options only if user has view, add, or update access
  const loadGroupOptions = useCallback(async (forceFresh = false) => {
    if (!perms.canView && !perms.canAdd && !perms.canUpdate) return;
    try {
      const opts = await groupEmailService.getGroupDropdownOptions(undefined, forceFresh);
      setGroupOptions(opts);
    } catch (err) {
      console.warn('Failed to load group dropdown options:', err);
    }
  }, [perms.canView, perms.canAdd, perms.canUpdate]);

  useEffect(() => {
    loadGroupOptions();
  }, [loadGroupOptions]);

  // Monotonically increasing request ID prevents stale responses from overwriting newer results
  const latestRequestRef = useRef(0);

  const fetchGroupEmails = useCallback(
    async (forceFresh = false) => {
      if (!perms.canView) {
        setGroupEmails([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      const requestId = ++latestRequestRef.current;

      try {
        setLoading(true);
        const res = await groupEmailService.getGroupEmails(
          {
            Text: debouncedSearch,
            PageNumber: currentPage,
            PageSize: pageSize,
            SortProperty: sortProperty,
            IsDescending: isDescending
          },
          undefined,
          forceFresh
        );

        if (requestId !== latestRequestRef.current) return;
        setGroupEmails(res.data);
        setTotalCount(res.totalCount);
      } catch (err) {
        if (requestId !== latestRequestRef.current) return;
        const msg = getApiErrorMessage(err, 'Failed to fetch group emails.');
        toast.error(msg);
        setGroupEmails([]);
        setTotalCount(0);
      } finally {
        if (requestId === latestRequestRef.current) setLoading(false);
      }
    },
    [perms.canView, debouncedSearch, currentPage, pageSize, sortProperty, isDescending]
  );

  useEffect(() => {
    fetchGroupEmails();
    return () => {
      latestRequestRef.current += 1;
    };
  }, [fetchGroupEmails]);

  // Handle Refresh Action
  const handleRefresh = () => {
    groupEmailService.clearCache();
    fetchGroupEmails(true);
    loadGroupOptions(true);
  };

  // Handle Column Sorting
  const handleSort = (prop) => {
    if (sortProperty === prop) {
      setIsDescending(!isDescending);
    } else {
      setSortProperty(prop);
      setIsDescending(true);
    }
    setCurrentPage(1);
  };

  const renderSortIndicator = (prop) => {
    if (sortProperty !== prop) {
      return <ArrowUpDown size={13} className="inline-block ml-1 opacity-40" />;
    }
    return isDescending ? (
      <ArrowDown size={13} className="inline-block ml-1 text-purple-600 dark:text-purple-400 font-bold" />
    ) : (
      <ArrowUp size={13} className="inline-block ml-1 text-purple-600 dark:text-purple-400 font-bold" />
    );
  };

  // Optimistic Status Toggle
  const handleToggleStatus = async (item) => {
    if (!perms.canUpdate || updatingStatusIds.has(item.groupEmailId)) return;

    const previousStatus = item.isActive;
    const nextStatus = !previousStatus;

    // Optimistic UI update
    setGroupEmails((prev) =>
      prev.map((g) => (g.groupEmailId === item.groupEmailId ? { ...g, isActive: nextStatus } : g))
    );

    setUpdatingStatusIds((prev) => new Set(prev).add(item.groupEmailId));

    try {
      // Complete PUT /GroupEmail payload preserving all fields
      await groupEmailService.updateGroupEmail({
        groupEmailId: item.groupEmailId,
        email: item.email,
        nameOnEmail: item.nameOnEmail,
        location: item.location,
        groupId: item.groupId,
        groupName: item.groupName,
        isActive: nextStatus
      });

      toast.success('Group email status updated');
      await fetchGroupEmails(true);
    } catch (err) {
      // Revert optimistic update
      setGroupEmails((prev) =>
        prev.map((g) => (g.groupEmailId === item.groupEmailId ? { ...g, isActive: previousStatus } : g))
      );
      const msg = getApiErrorMessage(err, 'Failed to update group email status.');
      toast.error(msg);
    } finally {
      setUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(item.groupEmailId);
        return next;
      });
    }
  };

  // Delete Handler with page clamping
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !perms.canDelete) return;

    try {
      setDeleting(true);
      await groupEmailService.deleteGroupEmail(deleteTarget.groupEmailId);
      toast.success('Group email deleted successfully');
      setDeleteModalOpen(false);
      setDeleteTarget(null);

      // Clamp current page if deleting final item on last page
      if (groupEmails.length === 1 && currentPage > 1) {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else {
        fetchGroupEmails(true);
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to delete group email.');
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 4. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30 flex items-center justify-center shrink-0">
            <Mail size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Group Emails
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Manage group email identities
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        {perms.canAdd && (
          <LiquidGlassButton
            onClick={() => {
              setEditingEmail(null);
              setModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 text-sm shadow-md w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Group Email</span>
          </LiquidGlassButton>
        )}
      </div>

      {!perms.canView ? (
        <div className="card p-12 text-center bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs">
          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <ShieldAlert size={32} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Access Restricted
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You do not have permission to view the Group Email section. Please contact your system administrator.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 5. Frosted / Glass Toolbar */}
          <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Left / Top on mobile: Result Count & Mobile Refresh */}
              <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                  {groupEmails.length} of {totalCount} Group Emails
                </h3>
                {/* Mobile Refresh Button */}
                <div className="sm:hidden">
                  <TableRefreshButton onClick={handleRefresh} />
                </div>
              </div>

              {/* Right / Bottom on mobile: Search & Desktop Refresh */}
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {/* Search Box */}
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative focus-within:border-purple-500 transition-colors">
                  <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Group Email"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setDebouncedSearch('');
                        setCurrentPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-300 transition-colors"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Desktop Refresh Button */}
                <div className="hidden sm:block">
                  <TableRefreshButton onClick={handleRefresh} className="shrink-0" />
                </div>
              </div>
            </div>
          </div>

          {/* 6. Table UI Container Card */}
          <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    {/* 1. Email */}
                    <th
                      onClick={() => handleSort('email')}
                      className="py-3.5 px-4 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Email {renderSortIndicator('email')}
                    </th>

                    {/* 2. Name On Email */}
                    <th
                      onClick={() => handleSort('nameOnEmail')}
                      className="py-3.5 px-4 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Name On Email {renderSortIndicator('nameOnEmail')}
                    </th>

                    {/* 3. Location */}
                    <th
                      onClick={() => handleSort('location')}
                      className="py-3.5 px-4 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Location {renderSortIndicator('location')}
                    </th>

                    {/* 4. Group */}
                    <th
                      onClick={() => handleSort('groupName')}
                      className="py-3.5 px-4 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                    >
                      Group {renderSortIndicator('groupName')}
                    </th>

                    {/* 5. Status */}
                    <th className="py-3.5 px-4 text-center w-36 select-none">
                      Status
                    </th>

                    {/* 6. Actions */}
                    <th className="py-3.5 px-4 text-center w-28 sticky right-0 bg-gray-50/95 dark:bg-[#1d1733]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] z-10">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                  {/* Loading State */}
                  {loading && (
                    <>
                      {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
                        <tr key={`skel-email-${i}`} className="animate-pulse">
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-44" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-36" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-28" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-6 w-20 bg-gray-200 dark:bg-white/10 rounded-full" />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="h-6 w-20 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                          </td>
                          <td className="py-4 px-4 text-center sticky right-0 bg-white dark:bg-[#17132a]">
                            <div className="h-7 w-20 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Empty State */}
                  {!loading && groupEmails.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 px-4 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                            <Mail size={28} className="opacity-80" />
                          </div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                            No group emails found. Try adjusting your search criteria.
                          </p>
                          {perms.canAdd && !searchTerm && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEmail(null);
                                setModalOpen(true);
                              }}
                              className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                            >
                              Add Group Email
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data Rows */}
                  {!loading &&
                    groupEmails.map((item) => {
                      const isUpdating = updatingStatusIds.has(item.groupEmailId);

                      return (
                        <tr
                          key={item.groupEmailId}
                          className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group"
                        >
                          {/* 1. Email: readable dark text, '-' when empty */}
                          <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-white">
                            {item.email || '-'}
                          </td>

                          {/* 2. Name On Email: '-' when empty */}
                          <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300">
                            {item.nameOnEmail || '-'}
                          </td>

                          {/* 3. Location: '-' when empty */}
                          <td className="py-3.5 px-4 text-gray-600 dark:text-gray-400">
                            {item.location || '-'}
                          </td>

                          {/* 4. Group: Compact violet pill/chip */}
                          <td className="py-3.5 px-4">
                            {item.groupName ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                                {item.groupName}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* 5. Status: Reusable iOS-style toggle with Active / Inactive label */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <IosToggle
                                checked={item.isActive}
                                disabled={!perms.canUpdate || isUpdating}
                                loading={isUpdating}
                                onCheckedChange={() => handleToggleStatus(item)}
                                title={item.isActive ? 'Active' : 'Inactive'}
                              />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[50px] text-left">
                                {item.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </td>

                          {/* 6. Actions: Sticky right column */}
                          <td className="py-3.5 px-4 text-center sticky right-0 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] group-hover:bg-purple-50/50 dark:group-hover:bg-[#1f1938]/90 transition-colors z-10">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Violet edit icon button: Edit Group Email */}
                              {perms.canUpdate && (
                                <ActionIconButton
                                  icon={Edit}
                                  variant="edit"
                                  tooltip="Edit Group Email"
                                  onClick={() => {
                                    setEditingEmail(item);
                                    setModalOpen(true);
                                  }}
                                />
                              )}

                              {/* Red delete icon button: Delete Group Email */}
                              {perms.canDelete && (
                                <ActionIconButton
                                  icon={Trash2}
                                  variant="delete"
                                  tooltip="Delete Group Email"
                                  onClick={() => {
                                    setDeleteTarget(item);
                                    setDeleteModalOpen(true);
                                  }}
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

            {/* Pagination Footer */}
            <div className="border-t border-gray-200 dark:border-white/10 px-4 sm:px-6 py-3.5 bg-gray-50/50 dark:bg-[#1d1733]/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-gray-600 dark:text-gray-400">
                Showing{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {startIndex}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {endIndex}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {totalCount}
                </span>{' '}
                Group Emails
              </div>

              <div className="flex items-center gap-3">
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white dark:bg-[#0f1322] border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Page Navigation Buttons */}
                <AnchorPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(p) => setCurrentPage(p)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* 7. Group Email Modal (Add / Edit) */}
      <GroupEmailModal
        open={modalOpen}
        groupEmail={editingEmail}
        groupOptions={groupOptions}
        onRefreshGroups={() => loadGroupOptions(true)}
        onClose={() => {
          setModalOpen(false);
          setEditingEmail(null);
        }}
        onSuccess={() => fetchGroupEmails(true)}
        canAdd={perms.canAdd}
        canUpdate={perms.canUpdate}
      />

      {/* 9. Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Group Email"
        description="Are you sure you want to delete"
        itemName={deleteTarget?.email}
        details={
          deleteTarget
            ? [
                { label: 'Group Name', value: deleteTarget.groupName || '-' },
                { label: 'Email', value: deleteTarget.email || '-' },
                { label: 'Location', value: deleteTarget.location || '-' }
              ]
            : []
        }
        confirmText="Delete"
        loadingText="Deleting..."
        cancelText="Cancel"
        loading={deleting}
        onCancel={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default GroupEmailPage;
