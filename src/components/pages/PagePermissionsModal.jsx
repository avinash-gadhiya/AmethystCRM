import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  KeyRound,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Hash,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

import pageService from '@/services/pageService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import ActionIconButton from '@/components/common/ActionIconButton';
import IosToggle from '@/components/common/IosToggle';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';

const PagePermissionsModal = ({
  open,
  page = null,
  onClose,
  canAdd = true,
  canUpdate = true,
  canDelete = true
}) => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPerm, setEditingPerm] = useState(null);
  const [statusUpdatingIds, setStatusUpdatingIds] = useState(new Set());

  // Form State
  const [formData, setFormData] = useState({
    permissionName: '',
    permissionCode: '',
    permissionDescription: '',
    permissionOrder: 0,
    isActive: true
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load permissions for current page
  const fetchPermissions = useCallback(async () => {
    if (!page?.pageId) return;
    setLoading(true);
    try {
      const data = await pageService.getPagePermissions(page.pageId);
      // Sort by order ascending then name
      const sorted = [...data].sort((a, b) => (a.permissionOrder - b.permissionOrder) || a.permissionName.localeCompare(b.permissionName));
      setPermissions(sorted);
    } catch (err) {
      console.error('Failed to load page permissions:', err);
      toast.error(getApiErrorMessage(err, 'Failed to load page permissions'));
    } finally {
      setLoading(false);
    }
  }, [page?.pageId]);

  useEffect(() => {
    if (open && page?.pageId) {
      fetchPermissions();
      resetForm();
    }
  }, [open, page?.pageId, fetchPermissions]);

  if (!open || !page) return null;

  const resetForm = () => {
    setEditingPerm(null);
    setFormData({
      permissionName: '',
      permissionCode: '',
      permissionDescription: '',
      permissionOrder: 0,
      isActive: true
    });
    setValidationErrors({});
  };

  const startEdit = (perm) => {
    setEditingPerm(perm);
    setFormData({
      permissionName: perm.permissionName || '',
      permissionCode: perm.permissionCode || '',
      permissionDescription: perm.permissionDescription || '',
      permissionOrder: Number(perm.permissionOrder) || 0,
      isActive: perm.isActive !== false
    });
    setValidationErrors({});
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.permissionName.trim()) {
      errors.permissionName = 'Permission Name is required.';
    }
    if (!formData.permissionCode.trim()) {
      errors.permissionCode = 'Permission Code is required.';
    }
    if (isNaN(Number(formData.permissionOrder)) || Number(formData.permissionOrder) < 0) {
      errors.permissionOrder = 'Order must be a valid number >= 0.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        pagePermissionId: editingPerm ? Number(editingPerm.pagePermissionId) : 0,
        pageId: Number(page.pageId),
        permissionName: formData.permissionName.trim(),
        permissionCode: formData.permissionCode.trim(),
        permissionDescription: formData.permissionDescription.trim(),
        permissionOrder: Number(formData.permissionOrder) || 0,
        isActive: Boolean(formData.isActive)
      };

      if (editingPerm) {
        await pageService.updatePagePermission(payload);
        toast.success(`Permission "${payload.permissionName}" updated successfully.`);
      } else {
        await pageService.createPagePermission(payload);
        toast.success(`Permission "${payload.permissionName}" created successfully.`);
      }

      resetForm();
      fetchPermissions();
    } catch (err) {
      console.error('Failed to save permission:', err);
      toast.error(getApiErrorMessage(err, `Failed to ${editingPerm ? 'update' : 'create'} permission`));
    } finally {
      setSaving(false);
    }
  };

  // Optimistic Toggle for Permission Status
  const handleToggleStatus = async (perm) => {
    if (!canUpdate || statusUpdatingIds.has(perm.pagePermissionId)) return;

    const previousStatus = perm.isActive;
    const newStatus = !previousStatus;

    // Optimistic UI update
    setPermissions((prev) =>
      prev.map((p) => (p.pagePermissionId === perm.pagePermissionId ? { ...p, isActive: newStatus } : p))
    );
    setStatusUpdatingIds((prev) => new Set(prev).add(perm.pagePermissionId));

    try {
      await pageService.updatePagePermission({
        pagePermissionId: perm.pagePermissionId,
        pageId: page.pageId,
        permissionName: perm.permissionName,
        permissionCode: perm.permissionCode,
        permissionDescription: perm.permissionDescription,
        permissionOrder: perm.permissionOrder,
        isActive: newStatus
      });
      toast.success(`Permission "${perm.permissionName}" status updated.`);
    } catch (err) {
      console.error('Failed to update permission status:', err);
      // Revert optimistic update
      setPermissions((prev) =>
        prev.map((p) => (p.pagePermissionId === perm.pagePermissionId ? { ...p, isActive: previousStatus } : p))
      );
      toast.error(getApiErrorMessage(err, 'Failed to update permission status'));
    } finally {
      setStatusUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(perm.pagePermissionId);
        return next;
      });
    }
  };

  // Delete Action
  const handleDeleteClick = (perm) => {
    setDeleteTarget(perm);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await pageService.deletePagePermission(deleteTarget.pagePermissionId);
      toast.success(`Permission "${deleteTarget.permissionName}" deleted.`);
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      if (editingPerm?.pagePermissionId === deleteTarget.pagePermissionId) {
        resetForm();
      }
      fetchPermissions();
    } catch (err) {
      console.error('Failed to delete permission:', err);
      toast.error(getApiErrorMessage(err, 'Failed to delete permission'));
    } finally {
      setDeleting(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-[#17132a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/50 dark:border-amber-800/40 shadow-xs">
              <KeyRound size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Page Permissions — {page.pageDisplayName || page.pageName}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                  Page ID: #{page.pageId}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configure fine-grained permission codes and access roles for route{' '}
                <span className="font-mono text-purple-600 dark:text-purple-400">{page.pageUrl}</span>
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving || deleting} />
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Permission Editor Form */}
          {(canAdd || (editingPerm && canUpdate)) && (
            <div className="p-4 rounded-xl border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/20 space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-900/30 pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-purple-600 dark:text-purple-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                    {editingPerm ? `Edit Permission #${editingPerm.pagePermissionId}` : 'Add New Permission'}
                  </h4>
                </div>
                {editingPerm && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw size={12} />
                    <span>Cancel Edit</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Permission Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.permissionName}
                      onChange={(e) => handleFormChange('permissionName', e.target.value)}
                      placeholder="e.g. View Users"
                      disabled={saving}
                      className={`w-full px-3 py-1.5 rounded-lg border ${
                        validationErrors.permissionName
                          ? 'border-red-500 ring-1 ring-red-500'
                          : 'border-gray-200 dark:border-white/10'
                      } bg-white dark:bg-[#17132a] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40`}
                    />
                  </div>

                  {/* Permission Code */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                      Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.permissionCode}
                      onChange={(e) => handleFormChange('permissionCode', e.target.value)}
                      placeholder="e.g. user_view"
                      disabled={saving}
                      className={`w-full px-3 py-1.5 rounded-lg border ${
                        validationErrors.permissionCode
                          ? 'border-red-500 ring-1 ring-red-500'
                          : 'border-gray-200 dark:border-white/10'
                      } bg-white dark:bg-[#17132a] text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40`}
                    />
                  </div>

                  {/* Order */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                      Order
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.permissionOrder}
                      onChange={(e) => handleFormChange('permissionOrder', e.target.value)}
                      disabled={saving}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>

                  {/* Active Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                      Status
                    </label>
                    <div className="flex items-center h-8">
                      <IosToggle
                        checked={Boolean(formData.isActive)}
                        onCheckedChange={(next) => handleFormChange('isActive', next)}
                        disabled={saving}
                        title={formData.isActive ? 'Active' : 'Inactive'}
                      />
                    </div>
                  </div>

                  {/* Description (Spans full width) */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                      Description <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.permissionDescription}
                      onChange={(e) => handleFormChange('permissionDescription', e.target.value)}
                      placeholder="e.g. Allows user to view the list of system users"
                      disabled={saving}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>

                  {/* Form Submit & Reset Buttons */}
                  <div className="sm:col-span-2 lg:col-span-1 flex items-end justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-3.5 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 rounded-lg shadow-sm transition-all"
                    >
                      {editingPerm ? 'Update Permission' : 'Add Permission'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Existing Permissions Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Defined Permissions ({permissions.length})
              </h4>
              <button
                type="button"
                onClick={fetchPermissions}
                disabled={loading}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                Refresh List
              </button>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden bg-white dark:bg-[#17132a] shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-[#1d1733] text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      <th className="py-2.5 px-3 text-center w-12">ID</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Name</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Code</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Description</th>
                      <th className="py-2.5 px-3 text-center w-16">Order</th>
                      <th className="py-2.5 px-3 text-center w-24">Active</th>
                      <th className="py-2.5 px-3 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                    {/* Loading State */}
                    {loading && (
                      <tr>
                        <td colSpan={7} className="py-10 px-4 text-center text-gray-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                            <span>Loading permissions...</span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Empty State */}
                    {!loading && permissions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-10 px-4 text-center text-gray-400 dark:text-gray-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <KeyRound size={28} className="opacity-40 text-amber-500" />
                            <span className="font-medium text-gray-600 dark:text-gray-300">
                              No permissions found for this page.
                            </span>
                            <span className="text-[11px]">
                              Add your first permission code using the form above.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Data Rows */}
                    {!loading &&
                      permissions.map((perm) => {
                        const isUpdatingStatus = statusUpdatingIds.has(perm.pagePermissionId);
                        const isCurrentlyEditing = editingPerm?.pagePermissionId === perm.pagePermissionId;

                        return (
                          <tr
                            key={perm.pagePermissionId}
                            className={`transition-colors ${
                              isCurrentlyEditing
                                ? 'bg-purple-100/40 dark:bg-purple-950/30'
                                : 'hover:bg-purple-50/20 dark:hover:bg-white/[0.02]'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center font-mono text-gray-400">
                              #{perm.pagePermissionId}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">
                              {perm.permissionName}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-purple-700 dark:text-purple-300">
                              <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-800/30 text-[11px]">
                                {perm.permissionCode}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={perm.permissionDescription}>
                              {perm.permissionDescription || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-gray-500">
                              {perm.permissionOrder}
                            </td>

                            {/* Active Toggle (Compact iOS Toggle) */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="inline-flex items-center justify-center scale-75 origin-center">
                                <IosToggle
                                  checked={Boolean(perm.isActive)}
                                  onCheckedChange={() => handleToggleStatus(perm)}
                                  disabled={!canUpdate || isUpdatingStatus}
                                  title={perm.isActive ? 'Active' : 'Inactive'}
                                />
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                {canUpdate && (
                                  <ActionIconButton
                                    label="Edit Permission"
                                    onClick={() => startEdit(perm)}
                                    className="text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 scale-90"
                                  >
                                    <Pencil size={13} />
                                  </ActionIconButton>
                                )}
                                {canDelete && (
                                  <ActionIconButton
                                    label="Delete Permission"
                                    variant="delete"
                                    onClick={() => handleDeleteClick(perm)}
                                    className="scale-90"
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
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] sticky bottom-0 z-20">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Total configured permissions: <strong>{permissions.length}</strong>
          </span>
          <LiquidGlassButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Close
          </LiquidGlassButton>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete Page Permission"
        itemName={deleteTarget ? `${deleteTarget.permissionName} (${deleteTarget.permissionCode})` : 'this permission'}
        itemId={deleteTarget?.pagePermissionId}
      />
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default PagePermissionsModal;
