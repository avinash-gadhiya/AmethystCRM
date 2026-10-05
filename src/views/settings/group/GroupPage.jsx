import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Layers,
  Mail,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

import groupService from '@/services/groupService';
import { getApiErrorMessage } from '@/lib/apiError';
import { resolveGroupPermissions } from '@/utils/groupPermissions';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import AnchorPagination from '@/components/common/AnchorPagination';
import IosToggle from '@/components/common/IosToggle';

import GroupModal from '@/components/group/GroupModal';
import GroupEmailModal from '@/components/group/GroupEmailModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const GroupPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state synchronized with URL query parameter
  const rawTab = (searchParams.get('tab') || '').toLowerCase();
  const activeTab = rawTab === 'groupemail' ? 'groupEmail' : 'group';

  const handleSelectTab = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tabKey === 'groupEmail') {
      nextParams.set('tab', 'groupEmail');
    } else {
      nextParams.delete('tab');
    }
    setSearchParams(nextParams);
  };

  // Permissions (Fail-closed)
  const groupPerms = useMemo(() => resolveGroupPermissions('group'), []);
  const emailPerms = useMemo(() => resolveGroupPermissions('groupemail'), []);

  // Shared Group Dropdown Options
  const [groupOptions, setGroupOptions] = useState([]);

  const loadGroupDropdownOptions = useCallback(async () => {
    try {
      const opts = await groupService.getGroupDropdownOptions();
      setGroupOptions(opts);
    } catch (err) {
      console.warn('Failed to load group options:', err);
    }
  }, []);

  useEffect(() => {
    loadGroupDropdownOptions();
  }, [loadGroupDropdownOptions]);

  // =========================================================================
  // TAB 1: Groups State & Logic
  // =========================================================================
  const [groups, setGroups] = useState([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupTotal, setGroupTotal] = useState(0);

  const [groupSearch, setGroupSearch] = useState('');
  const [groupPage, setGroupPage] = useState(1);
  const [groupPageSize, setGroupPageSize] = useState(10);
  const [groupSortProp, setGroupSortProp] = useState('groupId');
  const [groupSortDesc, setGroupSortDesc] = useState(true);

  const [groupUpdatingStatusIds, setGroupUpdatingStatusIds] = useState(new Set());
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  const fetchGroups = useCallback(async () => {
    if (!groupPerms.canView) {
      setGroups([]);
      setGroupTotal(0);
      setGroupLoading(false);
      return;
    }

    try {
      setGroupLoading(true);
      const res = await groupService.getGroups({
        Text: groupSearch.trim(),
        PageNumber: groupPage,
        PageSize: groupPageSize,
        SortProperty: groupSortProp,
        IsDescending: groupSortDesc
      });
      setGroups(res.data || []);
      setGroupTotal(res.totalCount || 0);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      toast.error(getApiErrorMessage(err, 'Failed to fetch groups'));
      setGroups([]);
      setGroupTotal(0);
    } finally {
      setGroupLoading(false);
    }
  }, [groupPerms.canView, groupSearch, groupPage, groupPageSize, groupSortProp, groupSortDesc]);

  // Handle Group Status Toggle (Optimistic Update)
  const handleToggleGroupStatus = async (item) => {
    if (!groupPerms.canUpdate) {
      toast.error('You do not have permission to modify group status.');
      return;
    }

    const previousStatus = item.isActive;
    const newStatus = !previousStatus;
    const id = item.groupId;

    // Optimistically update
    setGroups((prev) =>
      prev.map((g) => (g.groupId === id ? { ...g, isActive: newStatus } : g))
    );
    setGroupUpdatingStatusIds((prev) => new Set(prev).add(id));

    try {
      await groupService.updateGroup({
        groupId: id,
        groupName: item.groupName,
        isActive: newStatus
      });
      toast.success(`Group "${item.groupName}" is now ${newStatus ? 'active' : 'inactive'}.`);
      loadGroupDropdownOptions();
    } catch (err) {
      console.error('Failed to update group status:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update group status'));
      // Revert optimistic update
      setGroups((prev) =>
        prev.map((g) => (g.groupId === id ? { ...g, isActive: previousStatus } : g))
      );
    } finally {
      setGroupUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // =========================================================================
  // TAB 2: Group Emails State & Logic
  // =========================================================================
  const [groupEmails, setGroupEmails] = useState([]);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailTotal, setEmailTotal] = useState(0);

  const [emailSearch, setEmailSearch] = useState('');
  const [emailPage, setEmailPage] = useState(1);
  const [emailPageSize, setEmailPageSize] = useState(10);
  const [emailSortProp, setEmailSortProp] = useState('groupEmailId');
  const [emailSortDesc, setEmailSortDesc] = useState(true);

  const [emailUpdatingStatusIds, setEmailUpdatingStatusIds] = useState(new Set());
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);

  const fetchGroupEmails = useCallback(async () => {
    if (!emailPerms.canView) {
      setGroupEmails([]);
      setEmailTotal(0);
      setEmailLoading(false);
      return;
    }

    try {
      setEmailLoading(true);
      const res = await groupService.getGroupEmails({
        Text: emailSearch.trim(),
        PageNumber: emailPage,
        PageSize: emailPageSize,
        SortProperty: emailSortProp,
        IsDescending: emailSortDesc
      });
      setGroupEmails(res.data || []);
      setEmailTotal(res.totalCount || 0);
    } catch (err) {
      console.error('Failed to fetch group emails:', err);
      toast.error(getApiErrorMessage(err, 'Failed to fetch group emails'));
      setGroupEmails([]);
      setEmailTotal(0);
    } finally {
      setEmailLoading(false);
    }
  }, [emailPerms.canView, emailSearch, emailPage, emailPageSize, emailSortProp, emailSortDesc]);

  // Handle Group Email Status Toggle (Optimistic Update)
  const handleToggleEmailStatus = async (item) => {
    if (!emailPerms.canUpdate) {
      toast.error('You do not have permission to modify group email status.');
      return;
    }

    const previousStatus = item.isActive;
    const newStatus = !previousStatus;
    const id = item.groupEmailId;

    // Optimistically update
    setGroupEmails((prev) =>
      prev.map((e) => (e.groupEmailId === id ? { ...e, isActive: newStatus } : e))
    );
    setEmailUpdatingStatusIds((prev) => new Set(prev).add(id));

    try {
      await groupService.updateGroupEmail({
        groupEmailId: id,
        email: item.email,
        nameOnEmail: item.nameOnEmail,
        location: item.location,
        groupId: item.groupId,
        groupName: item.groupName,
        isActive: newStatus
      });
      toast.success(`Group email "${item.email}" is now ${newStatus ? 'active' : 'inactive'}.`);
    } catch (err) {
      console.error('Failed to update group email status:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update group email status'));
      // Revert optimistic update
      setGroupEmails((prev) =>
        prev.map((e) => (e.groupEmailId === id ? { ...e, isActive: previousStatus } : e))
      );
    } finally {
      setEmailUpdatingStatusIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Mount effect & tab switch fetch
  const isGroupMounted = useRef(false);
  useEffect(() => {
    if (activeTab === 'group') {
      if (!isGroupMounted.current) {
        isGroupMounted.current = true;
      }
      fetchGroups();
    }
  }, [activeTab, fetchGroups]);

  const isEmailMounted = useRef(false);
  useEffect(() => {
    if (activeTab === 'groupEmail') {
      if (!isEmailMounted.current) {
        isEmailMounted.current = true;
      }
      fetchGroupEmails();
    }
  }, [activeTab, fetchGroupEmails]);

  // =========================================================================
  // Unified Delete Confirmation State & Handlers
  // =========================================================================
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteTarget.type === 'group') {
        await groupService.deleteGroup(deleteTarget.id);
        toast.success(`Group "${deleteTarget.name}" deleted successfully.`);
        fetchGroups();
        loadGroupDropdownOptions();
      } else if (deleteTarget.type === 'groupEmail') {
        await groupService.deleteGroupEmail(deleteTarget.id);
        toast.success(`Group email "${deleteTarget.email}" deleted successfully.`);
        fetchGroupEmails();
      }
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete item:', err);
      toast.error(
        getApiErrorMessage(
          err,
          deleteTarget.type === 'group' ? 'Failed to delete group' : 'Failed to delete group email'
        )
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper sort icon
  const renderSortIndicator = (currentProp, targetProp, isDesc) => {
    if (currentProp !== targetProp) {
      return <ArrowUpDown size={12} className="text-gray-400 opacity-60 inline ml-1" />;
    }
    return isDesc ? (
      <ArrowDown size={12} className="text-purple-600 dark:text-purple-400 inline ml-1 font-bold" />
    ) : (
      <ArrowUp size={12} className="text-purple-600 dark:text-purple-400 inline ml-1 font-bold" />
    );
  };

  // Pagination calculation
  const groupTotalPages = Math.max(1, Math.ceil(groupTotal / groupPageSize));
  const emailTotalPages = Math.max(1, Math.ceil(emailTotal / emailPageSize));

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30">
              {activeTab === 'groupEmail' ? <Mail size={22} /> : <Layers size={22} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {activeTab === 'groupEmail' ? 'Group Emails' : 'Groups'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {activeTab === 'groupEmail'
                  ? 'Manage organizational group email assignments and location routing.'
                  : 'Manage operational groups and organizational units.'}
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div>
          {activeTab === 'group' && groupPerms.canAdd && (
            <LiquidGlassButton
              onClick={() => {
                setEditingGroup(null);
                setGroupModalOpen(true);
              }}
              className="flex items-center gap-2 text-sm shadow-md"
            >
              <Plus size={16} />
              <span>Add Group</span>
            </LiquidGlassButton>
          )}

          {activeTab === 'groupEmail' && emailPerms.canAdd && (
            <LiquidGlassButton
              onClick={() => {
                setEditingEmail(null);
                setEmailModalOpen(true);
              }}
              className="flex items-center gap-2 text-sm shadow-md"
            >
              <Plus size={16} />
              <span>Add Group Email</span>
            </LiquidGlassButton>
          )}
        </div>
      </div>

      {/* Shared Glass-style Tab Track */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-px" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'group'}
          onClick={() => handleSelectTab('group')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
            activeTab === 'group'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-semibold'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300'
          }`}
        >
          <Layers size={16} />
          <span>Group</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'groupEmail'}
          onClick={() => handleSelectTab('groupEmail')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
            activeTab === 'groupEmail'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-semibold'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300'
          }`}
        >
          <Mail size={16} />
          <span>Group Email</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Group Table                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'group' && (
        <div className="space-y-4">
          {!groupPerms.canView ? (
            <div className="card p-12 text-center bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs">
              <div className="max-w-md mx-auto flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                  <ShieldAlert size={32} />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Access Restricted
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You do not have permission to view the Groups section. Please contact your system
                  administrator.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Frosted / Glass Toolbar */}
              <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                    Showing {groups.length} of {groupTotal} Groups
                  </h3>

                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Search Field */}
                    <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
                      <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search Group"
                        value={groupSearch}
                        onChange={(e) => {
                          setGroupSearch(e.target.value);
                          setGroupPage(1);
                        }}
                        className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
                      />
                      {groupSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setGroupSearch('');
                            setGroupPage(1);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                          aria-label="Clear search"
                        >
                          <X size={14} className="text-gray-500 dark:text-gray-300" />
                        </button>
                      )}
                    </div>

                    {/* Refresh Button */}
                    <TableRefreshButton onClick={fetchGroups} className="shrink-0" />
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        <th className="py-3.5 px-4 text-center w-16">Serial number</th>
                        <th
                          onClick={() => {
                            if (groupSortProp === 'groupName') setGroupSortDesc(!groupSortDesc);
                            else {
                              setGroupSortProp('groupName');
                              setGroupSortDesc(true);
                            }
                            setGroupPage(1);
                          }}
                          className="py-3.5 px-4 min-w-[240px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                        >
                          Name {renderSortIndicator(groupSortProp, 'groupName', groupSortDesc)}
                        </th>
                        <th
                          onClick={() => {
                            if (groupSortProp === 'groupId') setGroupSortDesc(!groupSortDesc);
                            else {
                              setGroupSortProp('groupId');
                              setGroupSortDesc(true);
                            }
                            setGroupPage(1);
                          }}
                          className="py-3.5 px-4 w-28 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                        >
                          ID {renderSortIndicator(groupSortProp, 'groupId', groupSortDesc)}
                        </th>
                        <th
                          onClick={() => {
                            if (groupSortProp === 'isActive') setGroupSortDesc(!groupSortDesc);
                            else {
                              setGroupSortProp('isActive');
                              setGroupSortDesc(true);
                            }
                            setGroupPage(1);
                          }}
                          className="py-3.5 px-4 text-center w-32 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                        >
                          Is Active {renderSortIndicator(groupSortProp, 'isActive', groupSortDesc)}
                        </th>
                        <th className="py-3.5 px-4 text-right min-w-[120px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                      {/* Loading Skeleton */}
                      {groupLoading && (
                        <>
                          {Array.from({ length: groupPageSize > 5 ? 5 : groupPageSize }).map((_, i) => (
                            <tr key={`skel-g-${i}`} className="animate-pulse">
                              <td className="py-4 px-4 text-center">
                                <div className="h-4 w-6 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                              </td>
                              <td className="py-4 px-4">
                                <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-44" />
                              </td>
                              <td className="py-4 px-4">
                                <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-16" />
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="h-6 w-14 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                              </td>
                              <td className="py-4 px-4 text-right">
                                <div className="h-7 w-16 bg-gray-200 dark:bg-white/10 rounded ml-auto" />
                              </td>
                            </tr>
                          ))}
                        </>
                      )}

                      {/* Empty State */}
                      {!groupLoading && groups.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-16 px-4 text-center">
                            <div className="max-w-sm mx-auto flex flex-col items-center">
                              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                                <Layers size={28} className="opacity-80" />
                              </div>
                              <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                                No groups found
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                {groupSearch
                                  ? 'No groups found. Try adjusting your search criteria.'
                                  : 'Get started by creating your first organizational group.'}
                              </p>
                              {groupPerms.canAdd && !groupSearch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingGroup(null);
                                    setGroupModalOpen(true);
                                  }}
                                  className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                                >
                                  Create Group
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Data Rows */}
                      {!groupLoading &&
                        groups.map((item, index) => {
                          const rowNumber = (groupPage - 1) * groupPageSize + index + 1;
                          const isStatusUpdating = groupUpdatingStatusIds.has(item.groupId);

                          return (
                            <tr
                              key={item.groupId}
                              className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors"
                            >
                              <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                                {rowNumber}
                              </td>

                              <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">
                                {item.groupName}
                              </td>

                              <td className="py-3.5 px-4 text-xs font-mono text-gray-500 dark:text-gray-400">
                                #{item.groupId}
                              </td>

                              {/* iOS-Style Toggle */}
                              <td className="py-3.5 px-4 text-center">
                                <IosToggle
                                  checked={item.isActive}
                                  disabled={!groupPerms.canUpdate}
                                  loading={isStatusUpdating}
                                  onCheckedChange={() => handleToggleGroupStatus(item)}
                                  title={item.isActive ? 'Active' : 'Inactive'}
                                />
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {groupPerms.canUpdate && (
                                    <ActionIconButton
                                      icon={Pencil}
                                      variant="edit"
                                      tooltip="Edit Group"
                                      onClick={() => {
                                        setEditingGroup(item);
                                        setGroupModalOpen(true);
                                      }}
                                    />
                                  )}
                                  {groupPerms.canDelete && (
                                    <ActionIconButton
                                      icon={Trash2}
                                      variant="delete"
                                      tooltip="Delete Group"
                                      onClick={() => {
                                        setDeleteTarget({
                                          type: 'group',
                                          id: item.groupId,
                                          name: item.groupName
                                        });
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
                {!groupLoading && groupTotal > 0 && (
                  <div className="px-4 py-3.5 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-3">
                      <span>
                        Showing {(groupPage - 1) * groupPageSize + 1} to{' '}
                        {Math.min(groupPage * groupPageSize, groupTotal)} of {groupTotal} records
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span>Rows:</span>
                        <select
                          value={groupPageSize}
                          onChange={(e) => {
                            setGroupPageSize(Number(e.target.value));
                            setGroupPage(1);
                          }}
                          className="bg-transparent border border-gray-300 dark:border-white/10 rounded-md px-2 py-1 text-xs text-gray-900 dark:text-white outline-none focus:border-purple-500"
                        >
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size} className="dark:bg-[#17132a]">
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <AnchorPagination
                      currentPage={groupPage}
                      totalPages={groupTotalPages}
                      onPageChange={(p) => setGroupPage(p)}
                      disabled={groupLoading}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Group Email Table                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'groupEmail' && (
        <div className="space-y-4">
          {!emailPerms.canView ? (
            <div className="card p-12 text-center bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs">
              <div className="max-w-md mx-auto flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                  <ShieldAlert size={32} />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Access Restricted
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You do not have permission to view the Group Emails section. Please contact your system
                  administrator.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Frosted / Glass Toolbar */}
              <div className="card p-4 sm:p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 className="font-medium text-sm text-gray-700 dark:text-white">
                    Showing {groupEmails.length} of {emailTotal} Group Emails
                  </h3>

                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Search Field */}
                    <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-72 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
                      <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search Group Email"
                        value={emailSearch}
                        onChange={(e) => {
                          setEmailSearch(e.target.value);
                          setEmailPage(1);
                        }}
                        className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5 text-sm"
                      />
                      {emailSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailSearch('');
                            setEmailPage(1);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                          aria-label="Clear search"
                        >
                          <X size={14} className="text-gray-500 dark:text-gray-300" />
                        </button>
                      )}
                    </div>

                    {/* Refresh Button */}
                    <TableRefreshButton onClick={fetchGroupEmails} className="shrink-0" />
                  </div>
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        <th className="py-3.5 px-4 text-center w-16">Serial number</th>
                        <th
                          onClick={() => {
                            if (emailSortProp === 'email') setEmailSortDesc(!emailSortDesc);
                            else {
                              setEmailSortProp('email');
                              setEmailSortDesc(true);
                            }
                            setEmailPage(1);
                          }}
                          className="py-3.5 px-4 min-w-[200px] cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                        >
                          Email {renderSortIndicator(emailSortProp, 'email', emailSortDesc)}
                        </th>
                        <th className="py-3.5 px-4 min-w-[180px]">Name On Email</th>
                        <th className="py-3.5 px-4 min-w-[140px]">Location</th>
                        <th className="py-3.5 px-4 min-w-[140px]">Group</th>
                        <th
                          onClick={() => {
                            if (emailSortProp === 'isActive') setEmailSortDesc(!emailSortDesc);
                            else {
                              setEmailSortProp('isActive');
                              setEmailSortDesc(true);
                            }
                            setEmailPage(1);
                          }}
                          className="py-3.5 px-4 text-center w-32 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors select-none"
                        >
                          Is Active {renderSortIndicator(emailSortProp, 'isActive', emailSortDesc)}
                        </th>
                        <th className="py-3.5 px-4 text-right min-w-[120px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                      {/* Loading Skeleton */}
                      {emailLoading && (
                        <>
                          {Array.from({ length: emailPageSize > 5 ? 5 : emailPageSize }).map((_, i) => (
                            <tr key={`skel-e-${i}`} className="animate-pulse">
                              <td className="py-4 px-4 text-center">
                                <div className="h-4 w-6 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                              </td>
                              <td className="py-4 px-4">
                                <div className="h-5 bg-gray-200 dark:bg-white/10 rounded w-44" />
                              </td>
                              <td className="py-4 px-4">
                                <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-32" />
                              </td>
                              <td className="py-4 px-4">
                                <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-24" />
                              </td>
                              <td className="py-4 px-4">
                                <div className="h-5 bg-gray-200 dark:bg-white/10 rounded-full w-20" />
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="h-6 w-14 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                              </td>
                              <td className="py-4 px-4 text-right">
                                <div className="h-7 w-16 bg-gray-200 dark:bg-white/10 rounded ml-auto" />
                              </td>
                            </tr>
                          ))}
                        </>
                      )}

                      {/* Empty State */}
                      {!emailLoading && groupEmails.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-16 px-4 text-center">
                            <div className="max-w-sm mx-auto flex flex-col items-center">
                              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                                <Mail size={28} className="opacity-80" />
                              </div>
                              <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                                No group emails found
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                {emailSearch
                                  ? 'No group emails found. Try adjusting your search criteria.'
                                  : 'Get started by creating your first group email configuration.'}
                              </p>
                              {emailPerms.canAdd && !emailSearch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEmail(null);
                                    setEmailModalOpen(true);
                                  }}
                                  className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
                                >
                                  Create Group Email
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Data Rows */}
                      {!emailLoading &&
                        groupEmails.map((item, index) => {
                          const rowNumber = (emailPage - 1) * emailPageSize + index + 1;
                          const isStatusUpdating = emailUpdatingStatusIds.has(item.groupEmailId);

                          return (
                            <tr
                              key={item.groupEmailId}
                              className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors"
                            >
                              <td className="py-3.5 px-4 text-center text-xs text-gray-400 font-mono">
                                {rowNumber}
                              </td>

                              <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-white">
                                <div className="flex items-center gap-1.5">
                                  <span>{item.email}</span>
                                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-500">
                                    #{item.groupEmailId}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                                {item.nameOnEmail || <span className="text-gray-400 italic">None</span>}
                              </td>

                              <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                                {item.location}
                              </td>

                              {/* Violet Pill for Group */}
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/40">
                                  {item.groupName || `Group #${item.groupId}`}
                                </span>
                              </td>

                              {/* iOS-Style Toggle */}
                              <td className="py-3.5 px-4 text-center">
                                <IosToggle
                                  checked={item.isActive}
                                  disabled={!emailPerms.canUpdate}
                                  loading={isStatusUpdating}
                                  onCheckedChange={() => handleToggleEmailStatus(item)}
                                  title={item.isActive ? 'Active' : 'Inactive'}
                                />
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {emailPerms.canUpdate && (
                                    <ActionIconButton
                                      icon={Pencil}
                                      variant="edit"
                                      tooltip="Edit Group Email"
                                      onClick={() => {
                                        setEditingEmail(item);
                                        setEmailModalOpen(true);
                                      }}
                                    />
                                  )}
                                  {emailPerms.canDelete && (
                                    <ActionIconButton
                                      icon={Trash2}
                                      variant="delete"
                                      tooltip="Delete Group Email"
                                      onClick={() => {
                                        setDeleteTarget({
                                          type: 'groupEmail',
                                          id: item.groupEmailId,
                                          email: item.email,
                                          groupName: item.groupName
                                        });
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
                {!emailLoading && emailTotal > 0 && (
                  <div className="px-4 py-3.5 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-3">
                      <span>
                        Showing {(emailPage - 1) * emailPageSize + 1} to{' '}
                        {Math.min(emailPage * emailPageSize, emailTotal)} of {emailTotal} records
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span>Rows:</span>
                        <select
                          value={emailPageSize}
                          onChange={(e) => {
                            setEmailPageSize(Number(e.target.value));
                            setEmailPage(1);
                          }}
                          className="bg-transparent border border-gray-300 dark:border-white/10 rounded-md px-2 py-1 text-xs text-gray-900 dark:text-white outline-none focus:border-purple-500"
                        >
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size} className="dark:bg-[#17132a]">
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <AnchorPagination
                      currentPage={emailPage}
                      totalPages={emailTotalPages}
                      onPageChange={(p) => setEmailPage(p)}
                      disabled={emailLoading}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modals                                                                    */}
      {/* ========================================================================= */}

      {/* Add / Edit Group Modal */}
      <GroupModal
        isOpen={groupModalOpen}
        onClose={() => {
          setGroupModalOpen(false);
          setEditingGroup(null);
        }}
        group={editingGroup}
        onSaved={() => {
          setGroupModalOpen(false);
          setEditingGroup(null);
          fetchGroups();
          loadGroupDropdownOptions();
        }}
      />

      {/* Add / Edit Group Email Modal */}
      <GroupEmailModal
        isOpen={emailModalOpen}
        onClose={() => {
          setEmailModalOpen(false);
          setEditingEmail(null);
        }}
        groupEmail={editingEmail}
        groupOptions={groupOptions}
        onRefreshGroups={loadGroupDropdownOptions}
        onSaved={() => {
          setEmailModalOpen(false);
          setEditingEmail(null);
          fetchGroupEmails();
        }}
      />

      {/* Shared Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title={deleteTarget?.type === 'group' ? 'Delete Group' : 'Delete Group Email'}
        message={
          deleteTarget?.type === 'group' ? (
            <span>
              Are you sure you want to delete group{' '}
              <strong className="text-gray-900 dark:text-white">
                &quot;{deleteTarget.name}&quot;
              </strong>{' '}
              (Group ID: {deleteTarget.id})? This action cannot be undone and may affect associated group emails.
            </span>
          ) : deleteTarget?.type === 'groupEmail' ? (
            <span>
              Are you sure you want to delete group email{' '}
              <strong className="text-gray-900 dark:text-white">
                &quot;{deleteTarget.email}&quot;
              </strong>{' '}
              associated with group{' '}
              <strong className="text-gray-900 dark:text-white">
                &quot;{deleteTarget.groupName}&quot;
              </strong>?
            </span>
          ) : (
            'Are you sure you want to delete this record?'
          )
        }
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default GroupPage;
