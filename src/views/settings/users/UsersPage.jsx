import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Users, UserPlus, Search, X, ShieldCheck, Pencil, Copy, Check, Filter, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast, Toaster } from 'sonner';

import userService from '@/services/userService';
import authService from '@/services/authService';
import permissionService from '@/services/permissionService';
import { getApiErrorMessage } from '@/lib/apiError';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import IosToggle from '@/components/common/IosToggle';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import PermissionModal from '@/components/common/PermissionModal';
import AnchorPagination from '@/components/common/AnchorPagination';
import UserGroupsModal from '@/components/users/UserGroupsModal';
import UserEditorModal from '@/components/users/UserEditorModal';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ---------------------------------------------------------------------------
// Helper: Format Date or return 'Never'
// ---------------------------------------------------------------------------
const formatLastLogin = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime()) || date.getFullYear() <= 1970) {
    return 'Never';
  }
  try {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Never';
  }
};

// ---------------------------------------------------------------------------
// Helper: User Avatar initials
// ---------------------------------------------------------------------------
const getInitials = (user) => {
  const first = String(user?.firstName || user?.username || 'U')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '');
  const last = String(user?.lastName || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '');
  const f = first[0] || 'U';
  const l = last[0] || (first.length > 1 && !user?.lastName ? first[1] : '');
  return (f + l).toUpperCase();
};

// ---------------------------------------------------------------------------
// Password Cell with hover-reveal and copy to clipboard
// ---------------------------------------------------------------------------
const PasswordCell = ({ user }) => {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Backend intentionally exposed password fields
  const rawPassword = user.password || user.passwordHash || user.rawPassword || user.userPassword || '';

  const hasExposedPassword = typeof rawPassword === 'string' && rawPassword.trim().length > 0;

  if (!hasExposedPassword) {
    return <span className="text-gray-400 dark:text-gray-500 text-xs font-mono">N/A</span>;
  }

  const handleCopy = (e) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(rawPassword);
      setCopied(true);
      toast.success('Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy password');
    }
  };

  return (
    <div
      className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-700 dark:text-gray-200 group/pwd relative"
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      title="Hover to view, click copy to clipboard"
    >
      <span className="select-all px-2 py-0.5 rounded bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 tracking-wider">
        {revealed ? rawPassword : '••••••••'}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="opacity-0 group-hover/pwd:opacity-100 p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-opacity"
        title="Copy password"
        aria-label="Copy password to clipboard"
      >
        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Users Page
// ---------------------------------------------------------------------------
const UsersPage = () => {
  // Current user context for self-protection & permission check
  const currentUser = useMemo(() => {
    try {
      const u = authService.getUser();
      return u || {};
    } catch {
      return {};
    }
  }, []);

  const currentUserId = currentUser.userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null);

  const userAccess = useMemo(() => {
    const roleName = String(currentUser.role || currentUser.roleName || '').toLowerCase();
    const canManageAllUsers = roleName.includes('admin') || roleName.includes('developer') || Number(currentUser.roleId) === 1;

    if (canManageAllUsers) {
      return { canView: true, canAdd: true, canUpdate: true, canDelete: true };
    }

    return permissionService.getPageActionPermissions('/settings/users', currentUser.roleId);
  }, [currentUser]);

  const canCreateUser = userAccess.canAdd;
  const canUpdateUser = userAccess.canUpdate;
  const canDeleteUser = userAccess.canDelete;

  // State: Data & Pagination
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Server-side pagination defaults: { pageNumber: 1, pageSize: 10, sortProperty: 'userId', isDescending: true }
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortProperty] = useState('userId');
  const [isDescending] = useState(true);

  // Toolbar & Search state
  // Modes: 'all' | 'role' | 'location'
  const [searchMode, setSearchMode] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');

  // Dropdown reference data
  const [roles, setRoles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [statusToggling, setStatusToggling] = useState({});

  // Modals state
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [groupsModalOpen, setGroupsModalOpen] = useState(false);
  const [groupsModalUser, setGroupsModalUser] = useState(null);

  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionModalUser, setPermissionModalUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selfActionWarningOpen, setSelfActionWarningOpen] = useState(false);
  const [selfWarningMessage, setSelfWarningMessage] = useState('');

  // Fetch Lookups (Roles and Locations)
  useEffect(() => {
    let active = true;
    const fetchLookups = async () => {
      try {
        const [rolesList, locationsList] = await Promise.all([
          userService.getRoles().catch(() => []),
          userService.getLocations().catch(() => [])
        ]);
        if (active) {
          setRoles(rolesList || []);
          setLocations(locationsList || []);
        }
      } catch (err) {
        console.warn('Failed to load filter lookups:', err);
      }
    };
    fetchLookups();
    return () => {
      active = false;
    };
  }, []);

  // Fetch Users from API
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const params = {
        PageNumber: pageNumber,
        PageSize: pageSize,
        SortProperty: sortProperty,
        IsDescending: isDescending
      };

      if (searchMode === 'all' && searchText.trim()) {
        params.Text = searchText.trim();
      } else if (searchMode === 'role' && selectedRoleId) {
        params.RoleIds = selectedRoleId;
      } else if (searchMode === 'location' && selectedLocationId) {
        params.LocationId = selectedLocationId;
      }

      const res = await userService.getUsers(params);
      setUsers(res.data || []);
      setTotalCount(res.totalCount || 0);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error(getApiErrorMessage(error, 'Failed to fetch users'));
      setUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [pageNumber, pageSize, sortProperty, isDescending, searchMode, searchText, selectedRoleId, selectedLocationId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Search Mode change: must clear previous search/filter and reset page to 1
  const handleSearchModeChange = (newMode) => {
    if (newMode === searchMode) return;
    setSearchMode(newMode);
    setSearchText('');
    setSelectedRoleId('');
    setSelectedLocationId('');
    setPageNumber(1);
  };

  // Toggle user status (iOS Switch)
  const handleToggleStatus = async (user, nextStatus) => {
    if (!canUpdateUser) {
      toast.error('You do not have permission to update users.');
      return;
    }

    // Check self-user protection
    if (currentUserId && Number(user.userId) === Number(currentUserId) && !nextStatus) {
      setSelfWarningMessage('You cannot deactivate your own user account.');
      setSelfActionWarningOpen(true);
      return;
    }

    setStatusToggling((prev) => ({ ...prev, [user.userId]: true }));

    // Optimistic update
    setUsers((prev) => prev.map((u) => (u.userId === user.userId ? { ...u, isActive: nextStatus } : u)));

    try {
      await userService.toggleUserStatus(user, nextStatus);
      toast.success(`User "${user.username}" ${nextStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      // Revert optimistic update
      setUsers((prev) => prev.map((u) => (u.userId === user.userId ? { ...u, isActive: !nextStatus } : u)));
      toast.error(getApiErrorMessage(err, 'Failed to update user status'));
    } finally {
      setStatusToggling((prev) => ({ ...prev, [user.userId]: false }));
    }
  };

  // Delete User handler
  const handleOpenDelete = (user) => {
    if (!canDeleteUser) {
      toast.error('You do not have permission to delete users.');
      return;
    }

    if (currentUserId && Number(user.userId) === Number(currentUserId)) {
      setSelfWarningMessage('You cannot delete your own user account.');
      setSelfActionWarningOpen(true);
      return;
    }
    setDeleteTargetUser(user);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetUser || !canDeleteUser) return;
    setIsDeleting(true);
    try {
      await userService.deleteUser(deleteTargetUser.userId);
      toast.success(`User "${deleteTargetUser.username}" deleted successfully`);
      setDeleteModalOpen(false);
      setDeleteTargetUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error(getApiErrorMessage(err, 'Failed to delete user'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Permissions Modal handler
  const handleOpenPermissions = async (user) => {
    if (!canUpdateUser) {
      toast.error('You do not have permission to update users.');
      return;
    }

    setPermissionModalUser(user);
    setPermissionModalOpen(true);
    setPermissions([]);
    setLoadingPermissions(true);

    try {
      const data = await userService.getUserPermissions(user.userId);
      // Read tree from data[0].permissionMenuDTOs or data.permissionMenuDTOs or data
      const menus = data?.[0]?.permissionMenuDTOs || data?.permissionMenuDTOs || data || [];

      // Normalize permission tree states
      const normalizedMenus = (Array.isArray(menus) ? menus : []).map((menu) => {
        const pages = (menu.menuPermissionPageDTOs || []).map((page) => {
          const perms = page.menuPagePermissionDTOs || [];
          const allPermsGranted =
            perms.length > 0 ? perms.every((p) => Boolean(p.hasPermission ?? p.isGranted)) : Boolean(page.hasPermission ?? page.isGranted);
          return {
            ...page,
            hasPermission: allPermsGranted,
            menuPagePermissionDTOs: perms.map((p) => ({
              ...p,
              hasPermission: Boolean(p.hasPermission ?? p.isGranted)
            }))
          };
        });

        const allPagesGranted = pages.length > 0 ? pages.every((p) => Boolean(p.hasPermission)) : Boolean(menu.hasPermission);

        return {
          ...menu,
          hasPermission: allPagesGranted,
          menuPermissionPageDTOs: pages
        };
      });

      setPermissions(normalizedMenus);
    } catch (err) {
      console.error('Failed to fetch user permissions:', err);
      toast.error(getApiErrorMessage(err, 'Failed to fetch permissions'));
      setPermissions([]);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!permissionModalUser?.userId) return;

    setSavingPermissions(true);
    try {
      const assignPermissionDTOs = [];
      permissions.forEach((menu) => {
        (menu.menuPermissionPageDTOs || []).forEach((page) => {
          (page.menuPagePermissionDTOs || []).forEach((permission) => {
            if (!permission.pagePermissionId) return;
            assignPermissionDTOs.push({
              rolePermissionId: permission.rolePermissionId || 0,
              userId: permissionModalUser.userId,
              pagePermissionId: permission.pagePermissionId,
              isGranted: Boolean(permission.hasPermission)
            });
          });
        });
      });

      await userService.assignUserPermissions({
        userId: permissionModalUser.userId,
        assignPermissionDTOs
      });

      toast.success('User permissions updated successfully');
      setPermissionModalOpen(false);
      setPermissionModalUser(null);
    } catch (err) {
      console.error('Failed to save permissions:', err);
      toast.error(getApiErrorMessage(err, 'Failed to save permissions'));
    } finally {
      setSavingPermissions(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="users-page px-5 lg:px-10 py-5">
      <Toaster richColors position="top-right" />

      <div className="flex flex-col gap-5 lg:gap-7.5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">Users</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Manage system users and their permissions.</p>
          </div>
          {canCreateUser && (
            <div className="w-full sm:w-auto flex justify-start sm:justify-end">
              <LiquidGlassButton
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setEditorModalOpen(true);
                }}
                className="w-full sm:w-auto text-center"
              >
                <UserPlus className="w-4 h-4 liquid-glass-btn__icon" />
                Add New User
              </LiquidGlassButton>
            </div>
          )}
        </div>

        {/* Toolbar & Filters Card */}
        <div className="card p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left: Result count */}
            <h3 className="font-medium text-sm text-gray-700 dark:text-white">
              Showing {users.length} of {totalCount} Users
            </h3>

            {/* Right: Search mode selector & Dynamic filter control */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {/* Search Mode Pill Selector */}
              <div className="inline-flex rounded-lg border border-gray-300 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 p-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => handleSearchModeChange('all')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    searchMode === 'all'
                      ? 'bg-white dark:bg-[#1d1733] text-purple-700 dark:text-purple-300 shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchModeChange('role')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    searchMode === 'role'
                      ? 'bg-white dark:bg-[#1d1733] text-purple-700 dark:text-purple-300 shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Role
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchModeChange('location')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    searchMode === 'location'
                      ? 'bg-white dark:bg-[#1d1733] text-purple-700 dark:text-purple-300 shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Location
                </button>
              </div>

              {/* Dynamic Filter Controls */}
              {searchMode === 'all' && (
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-64 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
                  <Search size={16} className="text-gray-500 dark:text-gray-300 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Users"
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
              )}

              {searchMode === 'role' && (
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-56 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10">
                  <Filter size={14} className="text-gray-400 shrink-0" />
                  <select
                    value={selectedRoleId}
                    onChange={(e) => {
                      setSelectedRoleId(e.target.value);
                      setPageNumber(1);
                    }}
                    className="w-full outline-none bg-transparent text-sm text-gray-900 dark:text-white cursor-pointer"
                  >
                    <option value="">All Roles</option>
                    {roles.map((r) => {
                      const id = r.roleId ?? r.id;
                      const name = r.roleName ?? r.name ?? `Role #${id}`;
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {searchMode === 'location' && (
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 flex-1 min-w-0 sm:flex-none sm:w-56 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10">
                  <Filter size={14} className="text-gray-400 shrink-0" />
                  <select
                    value={selectedLocationId}
                    onChange={(e) => {
                      setSelectedLocationId(e.target.value);
                      setPageNumber(1);
                    }}
                    className="w-full outline-none bg-transparent text-sm text-gray-900 dark:text-white cursor-pointer"
                  >
                    <option value="">All Locations</option>
                    {locations.map((loc) => {
                      const id = loc.locationId ?? loc.id;
                      const name = loc.locationName ?? loc.name ?? `Location #${id}`;
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Refresh Button */}
              <TableRefreshButton onClick={fetchUsers} className="shrink-0" />
            </div>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <th className="py-3.5 px-3 text-center w-12 shrink-0">#</th>
                  <th className="py-3.5 px-3 min-w-[160px]">User Details</th>
                  <th className="py-3.5 px-3 min-w-[140px]">Email</th>
                  <th className="py-3.5 px-3 min-w-[100px]">Password</th>
                  <th className="py-3.5 px-3 min-w-[110px]">Role</th>
                  <th className="py-3.5 px-3 min-w-[90px]">Location</th>
                  <th className="py-3.5 px-3 min-w-[110px]">Groups</th>
                  <th className="py-3.5 px-3 text-center min-w-[80px]">Status</th>
                  <th className="py-3.5 px-3 min-w-[130px]">Last Login</th>
                  <th className="sticky right-0 z-20 bg-gray-50/95 dark:bg-[#1d1733]/95 backdrop-blur-xs py-3.5 px-4 text-right min-w-[150px] shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.06)] border-l border-gray-200/70 dark:border-white/10">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                {/* Loading Skeleton */}
                {loading && (
                  <>
                    {Array.from({ length: pageSize > 6 ? 6 : pageSize }).map((_, i) => (
                      <tr key={`skel-${i}`} className="animate-pulse">
                        <td className="py-3.5 px-3 text-center">
                          <div className="h-4 w-5 bg-gray-200 dark:bg-white/10 rounded mx-auto" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-white/10 shrink-0" />
                            <div className="space-y-1.5 flex-1">
                              <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-28" />
                              <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-20" />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-28" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-16" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-5 bg-gray-200 dark:bg-white/10 rounded-full w-20" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-5 bg-gray-200 dark:bg-white/10 rounded-full w-14" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-12" />
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="h-6 w-11 bg-gray-200 dark:bg-white/10 rounded-full mx-auto" />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-24" />
                        </td>
                        <td className="sticky right-0 z-10 bg-white/95 dark:bg-[#17132a]/95 py-3.5 px-4 text-right shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.06)] border-l border-gray-100 dark:border-white/5">
                          <div className="h-8 w-24 bg-gray-200 dark:bg-white/10 rounded-lg ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </>
                )}

                {/* Empty State */}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 px-4 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                          <Users size={28} className="opacity-80" />
                        </div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No users found</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          {searchText || selectedRoleId || selectedLocationId
                            ? 'No users match your search criteria. Try adjusting your filters.'
                            : 'No system users currently exist. Click "Add New User" to create one.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Data Rows */}
                {!loading &&
                  users.map((user, idx) => {
                    const serialNumber = (pageNumber - 1) * pageSize + idx + 1;
                    const cleanFirst = String(user.firstName || '').trim();
                    const cleanLast = String(user.lastName || '')
                      .trim()
                      .replace(/^\.+$/, '');
                    const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ') || user.username;

                    // Groups extraction
                    const rawGroupList = Array.isArray(user.groupName)
                      ? user.groupName
                      : typeof user.groupName === 'string' && user.groupName.trim()
                        ? user.groupName.split(',').map((g) => g.trim())
                        : Array.isArray(user.groups)
                          ? user.groups
                          : [];

                    const assignedGroups = rawGroupList.filter((g) => {
                      if (!g) return false;
                      const str = typeof g === 'object' ? g.groupName || g.name || '' : String(g);
                      return str.trim() !== '' && str.trim() !== '-';
                    });

                    return (
                      <tr key={user.userId || idx} className="group hover:bg-purple-50/30 dark:hover:bg-white/[0.02] transition-colors">
                        {/* 1. Serial Number */}
                        <td className="py-3.5 px-3 text-center text-xs font-medium text-gray-400 dark:text-gray-500">#{serialNumber}</td>

                        {/* 2. Username (First & Last prominent, @username below) */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-xs">
                              {getInitials(user)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[140px]" title={fullName}>
                                {fullName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]" title={`@${user.username}`}>
                                @{user.username}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Email */}
                        <td className="py-3.5 px-3 text-xs text-gray-700 dark:text-gray-300">
                          {user.email ? (
                            <span className="truncate block max-w-[150px]" title={user.email}>
                              {user.email}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </td>

                        {/* 4. Password (Masked with hover-reveal and copy) */}
                        <td className="py-3.5 px-3">
                          <PasswordCell user={user} />
                        </td>

                        {/* 5. Role */}
                        <td className="py-3.5 px-3">
                          {user.roleName || user.role ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-700/40 whitespace-nowrap">
                              {user.roleName || user.role}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs italic">Not assigned</span>
                          )}
                        </td>

                        {/* 6. Location */}
                        <td className="py-3.5 px-3">
                          {user.locationName || user.location ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-700/40 whitespace-nowrap">
                              {user.locationName || user.location}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs italic">Not assigned</span>
                          )}
                        </td>

                        {/* 7. Groups */}
                        <td className="py-3.5 px-3">
                          {assignedGroups.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[130px]">
                              {assignedGroups.map((g, gi) => {
                                const gName = typeof g === 'object' ? g.groupName || g.name : g;
                                return (
                                  <span
                                    key={gi}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 whitespace-nowrap"
                                    title={`Group: ${gName}`}
                                  >
                                    <Users size={11} className="opacity-60 shrink-0" />
                                    <span>{gName}</span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                          )}
                        </td>

                        {/* 8. Status (iOS Style Toggle) */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex items-center justify-center scale-90">
                            <IosToggle
                              checked={Boolean(user.isActive)}
                              onCheckedChange={(next) => handleToggleStatus(user, next)}
                              disabled={!canUpdateUser || Boolean(statusToggling[user.userId])}
                              title={user.isActive ? 'Active' : 'Inactive'}
                            />
                          </div>
                        </td>

                        {/* 9. Last Login */}
                        <td className="py-3.5 px-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formatLastLogin(user.lastLoginDate || user.lastLogin)}
                        </td>

                        {/* 10. Actions (Sticky Right Column: Manage groups, permissions, edit, delete) */}
                        <td className="sticky right-0 z-10 bg-white/95 dark:bg-[#17132a]/95 backdrop-blur-xs py-3 px-4 text-right shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.06)] border-l border-gray-100 dark:border-white/5 group-hover:bg-purple-50/95 dark:group-hover:bg-[#1f1938]/95 transition-colors">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {canUpdateUser && (
                              <>
                                {/* Manage Groups */}
                                <ActionIconButton
                                  label="Manage Groups"
                                  onClick={() => {
                                    setGroupsModalUser(user);
                                    setGroupsModalOpen(true);
                                  }}
                                  className="text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                >
                                  <Users size={15} />
                                </ActionIconButton>

                                {/* Manage Permissions */}
                                <ActionIconButton
                                  label="Manage Permissions"
                                  onClick={() => handleOpenPermissions(user)}
                                  className="text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                                >
                                  <ShieldCheck size={15} />
                                </ActionIconButton>

                                {/* Edit User */}
                                <ActionIconButton
                                  label="Edit User"
                                  onClick={() => {
                                    setEditingUser(user);
                                    setEditorModalOpen(true);
                                  }}
                                  className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                >
                                  <Pencil size={15} />
                                </ActionIconButton>
                              </>
                            )}

                            {/* Delete User */}
                            {canDeleteUser && (
                              <ActionIconButton label="Delete User" variant="delete" onClick={() => handleOpenDelete(user)} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Server-side Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-gray-500 dark:text-gray-400">
            <div>
              Showing <strong className="text-gray-800 dark:text-gray-200">{users.length}</strong> of{' '}
              <strong className="text-gray-800 dark:text-gray-200">{totalCount}</strong> Users
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
      </div>

      {/* ========================================================= */}
      {/* Add / Edit User Modal                                     */}
      {/* ========================================================= */}
      <UserEditorModal
        open={editorModalOpen}
        user={editingUser}
        roles={roles}
        locations={locations}
        currentUserId={currentUserId}
        onClose={() => {
          setEditorModalOpen(false);
          setEditingUser(null);
        }}
        onSuccess={() => {
          fetchUsers();
        }}
      />

      {/* ========================================================= */}
      {/* Manage Groups Modal                                       */}
      {/* ========================================================= */}
      <UserGroupsModal
        open={groupsModalOpen}
        user={groupsModalUser}
        onClose={() => {
          setGroupsModalOpen(false);
          setGroupsModalUser(null);
        }}
        onSuccess={() => {
          fetchUsers();
        }}
      />

      {/* ========================================================= */}
      {/* User Permissions Modal                                    */}
      {/* ========================================================= */}
      <PermissionModal
        open={permissionModalOpen}
        title="User Permissions"
        subtitle={
          permissionModalUser
            ? `Managing permissions for "${
                [permissionModalUser.firstName, permissionModalUser.lastName].filter(Boolean).join(' ') || permissionModalUser.username
              }"`
            : 'Manage user permissions'
        }
        permissions={permissions}
        loading={loadingPermissions}
        saving={savingPermissions}
        onPermissionsChange={setPermissions}
        onClose={() => {
          if (savingPermissions) return;
          setPermissionModalOpen(false);
          setPermissionModalUser(null);
          setPermissions([]);
        }}
        onSave={handleSavePermissions}
      />

      {/* ========================================================= */}
      {/* Delete User Confirmation Modal                            */}
      {/* ========================================================= */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete User"
        description="Are you sure you want to delete user"
        itemName={
          deleteTargetUser
            ? `${
                [deleteTargetUser.firstName, deleteTargetUser.lastName].filter(Boolean).join(' ') || deleteTargetUser.username
              } (@${deleteTargetUser.username})`
            : ''
        }
        details={
          deleteTargetUser
            ? [
                { label: 'User ID', value: `#${deleteTargetUser.userId}` },
                { label: 'Username', value: `@${deleteTargetUser.username}` },
                { label: 'Email', value: deleteTargetUser.email || '—' },
                {
                  label: 'Role',
                  value: deleteTargetUser.roleName || deleteTargetUser.role || 'Not assigned'
                }
              ]
            : []
        }
        loading={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteModalOpen(false);
          setDeleteTargetUser(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      {/* ========================================================= */}
      {/* Self-Action Protection Warning Modal                      */}
      {/* ========================================================= */}
      {selfActionWarningOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#1d1733] backdrop-blur">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Action not allowed</h3>
                <GlassCloseButton onClick={() => setSelfActionWarningOpen(false)} />
              </div>

              <div className="p-6">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {selfWarningMessage || 'You cannot perform this action on your own account.'}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This prevents locking yourself out of the system.</p>

                <div className="mt-6 flex items-center justify-end">
                  <LiquidGlassButton onClick={() => setSelfActionWarningOpen(false)} className="text-center">
                    OK
                  </LiquidGlassButton>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default UsersPage;
