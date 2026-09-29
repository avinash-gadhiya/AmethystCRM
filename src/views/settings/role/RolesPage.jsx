import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Trash2, Plus, Search, X, ShieldCheck } from 'lucide-react';
import { toast, Toaster } from 'sonner';

import roleService from '@/services/roleService';
import { getApiErrorMessage } from '@/lib/apiError';

import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import IosToggle from '@/components/common/IosToggle';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import PermissionModal from '@/components/common/PermissionModal';

const RolesPage = () => {
  const normalizeRoleName = (value) =>
    (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(1000);
  const [sortProperty] = useState('roleId');
  const [isDescending] = useState(true);

  // Role Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    roleId: 0,
    roleName: '',
    roleDescription: '',
    isSystemRole: false,
    isActive: true
  });
  const [savingRole, setSavingRole] = useState(false);

  // Permissions Modal State
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionModalRole, setPermissionModalRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [permissionModalSaving, setPermissionModalSaving] = useState(false);

  // Self-Role Protection State
  const [selfRoleWarningOpen, setSelfRoleWarningOpen] = useState(false);

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteContext, setDeleteContext] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Read current role from localStorage key 'roleName'
  const loggedInRoleName =
    typeof window !== 'undefined'
      ? localStorage.getItem('roleName') ||
        (() => {
          try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return user?.role || user?.roleName || null;
          } catch {
            return null;
          }
        })()
      : null;

  const isEditingLoggedInRole =
    Boolean(editingRole) &&
    Boolean(loggedInRoleName) &&
    normalizeRoleName(editingRole.roleName) === normalizeRoleName(loggedInRoleName);

  const openSelfRoleWarning = () => setSelfRoleWarningOpen(true);

  const openDeleteModal = (role) => {
    setDeleteContext(role);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteConfirmOpen(false);
    setDeleteContext(null);
  };

  // Fetch roles from API: GET ${VITE_APP_API_URL}/Role
  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const result = await roleService.getRoles({
        Text: searchText,
        PageNumber: pageNumber,
        PageSize: pageSize,
        SortProperty: sortProperty,
        IsDescending: isDescending
      });

      setRoles(result.data || []);
      setTotalCount(result.totalCount || 0);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      toast.error(getApiErrorMessage(error, 'Failed to fetch roles'));
    } finally {
      setLoading(false);
    }
  }, [searchText, pageNumber, pageSize, sortProperty, isDescending]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Open Create Role Modal
  const handleCreate = () => {
    setEditingRole(null);
    setFormData({
      roleId: 0,
      roleName: '',
      roleDescription: '',
      isSystemRole: false,
      isActive: true
    });
    setShowModal(true);
  };

  // Open Edit Role Modal
  const handleEdit = (role) => {
    setEditingRole(role);
    setFormData({
      roleId: role.roleId,
      roleName: role.roleName || '',
      roleDescription: role.roleDescription || '',
      isSystemRole: Boolean(role.isSystemRole),
      isActive: role.isActive !== false
    });
    setShowModal(true);
  };

  // Open Permission Modal: GET ${VITE_APP_API_URL}/Permission?roleId={roleId}
  const handleOpenPermissionModal = async (role) => {
    if (!role?.roleId) return;
    setPermissionModalRole(role);
    setPermissionModalOpen(true);
    setPermissionModalSaving(false);
    setPermissions([]);
    setLoadingPermissions(true);
    try {
      const permissionsData = await roleService.getPermissions(role.roleId);
      // Read the tree from: response.data.data[0].permissionMenuDTOs
      const menus = permissionsData?.[0]?.permissionMenuDTOs || [];
      const normalizedMenus = menus.map((menu) => {
        const pages = (menu.menuPermissionPageDTOs || []).map((page) => {
          const perms = page.menuPagePermissionDTOs || [];
          const allPermsGranted =
            perms.length > 0
              ? perms.every((p) => Boolean(p.hasPermission))
              : Boolean(page.hasPermission);
          return { ...page, hasPermission: allPermsGranted };
        });
        const allPagesGranted =
          pages.length > 0
            ? pages.every((p) => Boolean(p.hasPermission))
            : Boolean(menu.hasPermission);
        return { ...menu, hasPermission: allPagesGranted, menuPermissionPageDTOs: pages };
      });
      setPermissions(normalizedMenus);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      toast.error(getApiErrorMessage(error, 'Failed to fetch permissions'));
      setPermissions([]);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleClosePermissionModal = () => {
    if (permissionModalSaving) return;
    setPermissionModalOpen(false);
    setPermissionModalRole(null);
    setPermissions([]);
  };

  // Save permissions: POST ${VITE_APP_API_URL}/Permission
  const handleSavePermissions = async () => {
    if (!permissionModalRole?.roleId) return;
    try {
      setPermissionModalSaving(true);
      const assignPermissionDTOs = [];
      permissions.forEach((menu) => {
        (menu.menuPermissionPageDTOs || []).forEach((page) => {
          (page.menuPagePermissionDTOs || []).forEach((permission) => {
            if (!permission.pagePermissionId) return;
            assignPermissionDTOs.push({
              rolePermissionId: permission.rolePermissionId || 0,
              roleId: permissionModalRole.roleId,
              pagePermissionId: permission.pagePermissionId,
              isGranted: Boolean(permission.hasPermission)
            });
          });
        });
      });

      if (assignPermissionDTOs.length > 0) {
        await roleService.assignPermissions({
          roleId: permissionModalRole.roleId,
          assignPermissionDTOs
        });
      }
      toast.success('Permissions updated successfully');
      handleClosePermissionModal();
    } catch (error) {
      console.error('Failed to save permissions:', error);
      toast.error(getApiErrorMessage(error, 'Failed to save permissions'));
    } finally {
      setPermissionModalSaving(false);
    }
  };

  // Confirm Delete: DELETE ${VITE_APP_API_URL}/Role/{roleId} (with ?id= retry)
  const handleConfirmDelete = async () => {
    if (!deleteContext?.roleId) return;
    setIsDeleting(true);
    try {
      await roleService.deleteRole(deleteContext.roleId);
      toast.success('Role deleted successfully');
      closeDeleteModal();
      fetchRoles();
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error(getApiErrorMessage(error, 'Failed to delete role'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Submit Create or Update Role
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingRole && isEditingLoggedInRole && !formData.isActive) {
      openSelfRoleWarning();
      return;
    }

    setSavingRole(true);
    try {
      if (editingRole) {
        // PUT ${VITE_APP_API_URL}/Role
        await roleService.updateRole(formData);
        toast.success('Role updated successfully');
      } else {
        // POST ${VITE_APP_API_URL}/Role
        await roleService.createRole(formData);
        toast.success('Role created successfully');
      }

      setShowModal(false);
      fetchRoles();
    } catch (error) {
      console.error('Failed to save role:', error);
      toast.error(getApiErrorMessage(error, 'Failed to save role'));
    } finally {
      setSavingRole(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="roles-page px-5 lg:px-10 py-5">
      <Toaster richColors position="top-right" />

      <div className="flex flex-col gap-5 lg:gap-7.5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">Roles</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Manage system and custom roles
            </p>
          </div>
          <div className="w-full sm:w-auto flex justify-start sm:justify-end">
            <LiquidGlassButton
              type="button"
              onClick={handleCreate}
              className="w-full sm:w-auto text-center"
            >
              <Plus className="w-4 h-4 liquid-glass-btn__icon" />
              Create Role
            </LiquidGlassButton>
          </div>
        </div>

        {/* Search Summary Card */}
        <div className="card p-5 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h3 className="font-medium text-sm text-gray-700 dark:text-white">
              Showing {roles.length} of {totalCount} Roles
            </h3>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 flex-1 min-w-0 sm:flex-none sm:w-64 bg-white dark:bg-[#0f1322] border-gray-300 dark:border-white/10 relative">
                <Search size={18} className="text-gray-500 dark:text-gray-300 shrink-0" />
                <input
                  type="text"
                  placeholder="Search Roles"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setPageNumber(1);
                  }}
                  className="w-full outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pr-5"
                  style={{ fontSize: '14px' }}
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
                    <X size={16} className="text-gray-500 dark:text-gray-300" />
                  </button>
                )}
              </div>
              <TableRefreshButton onClick={fetchRoles} className="shrink-0" />
            </div>
          </div>
        </div>

        {/* Role List (Card Grid) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
          {loading && roles.length === 0 ? (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="card relative overflow-hidden p-5 min-h-[170px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] rounded-xl animate-pulse"
                >
                  <div className="flex flex-col justify-between gap-3 h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                      <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : roles.length === 0 ? (
            <div className="card p-10 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-xl sm:col-span-2 xl:col-span-3">
              No roles found
            </div>
          ) : (
            roles.map((role) => (
              <div
                key={role.roleId}
                className="card relative overflow-hidden p-5 h-full min-h-[170px] border border-gray-300 dark:border-white/10 bg-white dark:bg-[#17132a] rounded-xl shadow-sm dark:shadow-none transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/20 dark:hover:bg-[#1d1733]"
              >
                {/* Decorative pale curved shape in upper-right corner */}
                <div className="pointer-events-none absolute right-0 top-0 h-20 w-44 rounded-bl-[32px] bg-purple-100/70 dark:bg-purple-950/40" />

                <div className="relative flex h-full flex-col justify-between gap-3">
                  {/* Top content */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-300 font-semibold">
                        Role
                      </div>
                      <div className="mt-1 text-base font-semibold text-gray-900 dark:text-white truncate">
                        {role.roleName}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-200 line-clamp-2 min-h-[32px]">
                        {role.roleDescription || 'No description'}
                      </div>
                    </div>

                    {/* Top-Right Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <ActionIconButton
                        label="View / Edit"
                        onClick={() => handleEdit(role)}
                        className="w-9 h-9 border-gray-200 bg-white/90 hover:bg-white shadow-sm"
                        stopPropagation={false}
                      >
                        <Eye className="w-5 h-5 text-gray-600" />
                      </ActionIconButton>

                      <ActionIconButton
                        label="Permissions"
                        onClick={() => handleOpenPermissionModal(role)}
                        className="w-9 h-9 border-gray-200 bg-white/90 hover:bg-white shadow-sm"
                        stopPropagation={false}
                      >
                        <ShieldCheck className="w-5 h-5 text-purple-600" />
                      </ActionIconButton>

                      <ActionIconButton
                        variant="delete"
                        label="Delete"
                        onClick={() => openDeleteModal(role)}
                        className="w-9 h-9 border-gray-200 bg-white/90 hover:bg-white shadow-sm"
                        stopPropagation={false}
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </ActionIconButton>
                    </div>
                  </div>

                  {/* Bottom Badges */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <span className="rounded-full border border-gray-200 dark:border-slate-500/70 bg-white dark:bg-slate-800/70 text-gray-700 dark:text-slate-100 font-medium px-2 py-0.5 font-mono">
                      ID #{role.roleId}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        role.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-white/5 dark:text-gray-300 dark:border-white/10'
                      }`}
                    >
                      {role.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {role.isSystemRole && (
                      <span className="rounded-full border border-gray-200 dark:border-slate-500/70 bg-white dark:bg-slate-800/70 text-gray-700 dark:text-slate-100 font-medium px-2 py-0.5">
                        System
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* Create / Edit Modal                                       */}
      {/* ========================================================= */}
      {showModal &&
        createPortal(
          <div className="settings-modal roles-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="roles-modal-surface bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingRole ? 'Edit Role' : 'Create New Role'}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">
                    {editingRole ? 'Update role details and permissions.' : 'Create a role to manage access.'}
                  </p>
                </div>
                <GlassCloseButton onClick={() => setShowModal(false)} />
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 space-y-6 overflow-y-auto dark:bg-[#17132a]">
                  <div className="flex flex-col gap-4">
                    {/* Role Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                        Role Name *
                      </label>
                      <input
                        type="text"
                        name="roleName"
                        value={formData.roleName}
                        onChange={handleInputChange}
                        required
                        disabled={Boolean(editingRole)}
                        placeholder="Enter role name"
                        className="flex w-full rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      {editingRole && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Role name cannot be changed after the role is created.
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                        Description
                      </label>
                      <textarea
                        name="roleDescription"
                        value={formData.roleDescription}
                        onChange={handleInputChange}
                        placeholder="Short description for this role"
                        rows={3}
                        className="flex w-full rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                      />
                    </div>

                    {/* System Role & Status Panels */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3 bg-gray-50/50 dark:bg-white/5">
                        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
                          System Role
                        </label>
                        <div className="flex items-center gap-3">
                          <IosToggle
                            checked={Boolean(formData.isSystemRole)}
                            onCheckedChange={(nextChecked) =>
                              setFormData((prev) => ({ ...prev, isSystemRole: Boolean(nextChecked) }))
                            }
                            title={formData.isSystemRole ? 'On' : 'Off'}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-200">
                            {formData.isSystemRole ? 'On' : 'Off'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3 bg-gray-50/50 dark:bg-white/5">
                        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
                          Status
                        </label>
                        <div className="flex items-center gap-3">
                          <IosToggle
                            checked={Boolean(formData.isActive)}
                            onCheckedChange={(nextChecked) => {
                              if (editingRole && isEditingLoggedInRole && formData.isActive && !nextChecked) {
                                openSelfRoleWarning();
                                return;
                              }
                              setFormData((prev) => ({ ...prev, isActive: Boolean(nextChecked) }));
                            }}
                            title={formData.isActive ? 'Active' : 'Inactive'}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-200">
                            {formData.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/10 sticky bottom-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={savingRole}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-gray-300 dark:border-white/15 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <LiquidGlassButton type="submit" disabled={savingRole} className="sm:ml-auto text-center">
                    {savingRole ? (
                      'Saving...'
                    ) : editingRole ? (
                      'Update Role'
                    ) : (
                      'Create Role'
                    )}
                  </LiquidGlassButton>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================= */}
      {/* Permission Modal                                          */}
      {/* ========================================================= */}
      <PermissionModal
        open={permissionModalOpen}
        title="Role Permissions"
        subtitle={
          permissionModalRole?.roleName
            ? `Managing permissions for "${permissionModalRole.roleName}"`
            : 'Manage role permissions'
        }
        permissions={permissions}
        loading={loadingPermissions}
        saving={permissionModalSaving}
        onPermissionsChange={setPermissions}
        onClose={handleClosePermissionModal}
        onSave={handleSavePermissions}
      />

      {/* ========================================================= */}
      {/* Self Role Protection Modal                                */}
      {/* ========================================================= */}
      {selfRoleWarningOpen &&
        createPortal(
          <div className="settings-modal roles-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="roles-modal-surface bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#1d1733] backdrop-blur">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Action not allowed</h3>
                <GlassCloseButton onClick={() => setSelfRoleWarningOpen(false)} />
              </div>

              <div className="p-6">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  You cannot deactivate your own role.
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This prevents locking yourself out of the system.
                </p>

                <div className="mt-6 flex items-center justify-end">
                  <LiquidGlassButton onClick={() => setSelfRoleWarningOpen(false)} className="text-center">
                    OK
                  </LiquidGlassButton>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================= */}
      {/* Delete Confirmation Modal                                 */}
      {/* ========================================================= */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        title="Delete Role"
        description="Are you sure you want to delete"
        itemName={deleteContext?.roleName || 'this role'}
        details={
          deleteContext
            ? [
                { label: 'Role ID', value: deleteContext.roleId },
                { label: 'Role Name', value: deleteContext.roleName }
              ]
            : []
        }
        loading={isDeleting}
        onCancel={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export { RolesPage };
export default RolesPage;
