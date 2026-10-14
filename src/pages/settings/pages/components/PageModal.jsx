import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import pageService from '@/services/pageService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const PageModal = ({ open, page = null, onClose, onSuccess, menus = [] }) => {
  const isEditing = Boolean(page && page.pageId);

  const [formData, setFormData] = useState({
    menuId: '',
    pageName: '',
    pageDisplayName: '',
    pageUrl: '',
    pageIcon: '',
    pageOrder: 0,
    parentPageId: 0,
    isActive: true
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Sync form state when modal opens or page changes
  useEffect(() => {
    if (open) {
      if (page) {
        setFormData({
          menuId: page.menuId || '',
          pageName: page.pageName || '',
          pageDisplayName: page.pageDisplayName || page.pageName || '',
          pageUrl: page.pageUrl || '',
          pageIcon: page.pageIcon || '',
          pageOrder: Number(page.pageOrder) || 0,
          parentPageId: Number(page.parentPageId) || 0,
          isActive: page.isActive !== false
        });
      } else {
        setFormData({
          menuId: menus[0]?.id || '',
          pageName: '',
          pageDisplayName: '',
          pageUrl: '',
          pageIcon: '',
          pageOrder: 0,
          parentPageId: 0,
          isActive: true
        });
      }
      setValidationErrors({});
    }
  }, [open, page, menus]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.pageName.trim()) {
      errors.pageName = 'Page Name is required.';
    }
    if (!formData.pageDisplayName.trim()) {
      errors.pageDisplayName = 'Display Name is required.';
    }
    if (!formData.pageUrl.trim()) {
      errors.pageUrl = 'Page URL is required.';
    }
    if (isNaN(Number(formData.pageOrder)) || Number(formData.pageOrder) < 0) {
      errors.pageOrder = 'Order must be a valid number greater than or equal to 0.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please resolve the highlighted errors before submitting.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        pageId: isEditing ? Number(page.pageId) : 0,
        menuId: Number(formData.menuId) || 0,
        pageName: formData.pageName.trim(),
        pageDisplayName: formData.pageDisplayName.trim(),
        pageUrl: formData.pageUrl.trim(),
        pageIcon: formData.pageIcon.trim(),
        pageOrder: Number(formData.pageOrder) || 0,
        parentPageId: Number(formData.parentPageId) || 0,
        isActive: Boolean(formData.isActive)
      };

      if (isEditing) {
        await pageService.updatePage(payload);
        toast.success(`Page "${payload.pageDisplayName}" updated successfully.`);
      } else {
        await pageService.createPage(payload);
        toast.success(`Page "${payload.pageDisplayName}" created successfully.`);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to save page:', err);
      toast.error(getApiErrorMessage(err, `Failed to ${isEditing ? 'update' : 'create'} page`));
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="page-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#17132a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/50 dark:border-purple-800/40">
              <FileText size={20} />
            </div>
            <div>
              <h3 id="page-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Page' : 'Add New Page'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditing
                  ? `Update configuration for page ID #${page.pageId}`
                  : 'Configure a new application page, route, and menu placement'}
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Form Body */}
        <form id="page-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Menu Dropdown */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Parent Menu Category
              </label>
              <select
                  value={formData.menuId}
                  onChange={(e) => handleChange('menuId', e.target.value)}
                  disabled={saving}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1d1733] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all cursor-pointer"
                >
                  <option value="">No Menu (Top-level / Standalone)</option>
                  {menus.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (#{m.id})
                    </option>
                  ))}
              </select>
            </div>

            {/* Page Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Page Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.pageName}
                onChange={(e) => handleChange('pageName', e.target.value)}
                placeholder="e.g. UserManagement"
                disabled={saving}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  validationErrors.pageName
                    ? 'border-red-500 ring-1 ring-red-500'
                    : 'border-gray-200 dark:border-white/10'
                } bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all`}
                autoFocus
              />
              {validationErrors.pageName && (
                <span className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.pageName}
                </span>
              )}
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.pageDisplayName}
                onChange={(e) => handleChange('pageDisplayName', e.target.value)}
                placeholder="e.g. Users"
                disabled={saving}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  validationErrors.pageDisplayName
                    ? 'border-red-500 ring-1 ring-red-500'
                    : 'border-gray-200 dark:border-white/10'
                } bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all`}
              />
              {validationErrors.pageDisplayName && (
                <span className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.pageDisplayName}
                </span>
              )}
            </div>

            {/* Page URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Page URL <span className="text-red-500">*</span>
              </label>
              <input
                  type="text"
                  value={formData.pageUrl}
                  onChange={(e) => handleChange('pageUrl', e.target.value)}
                  placeholder="e.g. /settings/users"
                  disabled={saving}
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${
                    validationErrors.pageUrl
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-gray-200 dark:border-white/10'
                  } bg-gray-50/50 dark:bg-white/5 text-sm font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all`}
              />
              {validationErrors.pageUrl && (
                <span className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.pageUrl}
                </span>
              )}
            </div>

            {/* Page Order */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Order <span className="text-red-500">*</span>
              </label>
              <input
                  type="number"
                  min="0"
                  value={formData.pageOrder}
                  onChange={(e) => handleChange('pageOrder', e.target.value)}
                  disabled={saving}
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${
                    validationErrors.pageOrder
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-gray-200 dark:border-white/10'
                  } bg-gray-50/50 dark:bg-white/5 text-sm font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all`}
              />
              {validationErrors.pageOrder && (
                <span className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.pageOrder}
                </span>
              )}
            </div>

            {/* Page Icon (Optional) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Page Icon <span className="text-xs font-normal text-gray-400">(optional)</span>
              </label>
              <input
                  type="text"
                  value={formData.pageIcon}
                  onChange={(e) => handleChange('pageIcon', e.target.value)}
                  placeholder="e.g. users, file-text, settings"
                  disabled={saving}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                />
            </div>

            {/* Status Toggle */}
            <div className="sm:col-span-2 flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/30 dark:bg-white/[0.02]">
              <div>
                <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Status
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.isActive ? 'Page is active and available in navigation' : 'Page is disabled and hidden'}
                </span>
              </div>
              <IosToggle
                checked={Boolean(formData.isActive)}
                onCheckedChange={(next) => handleChange('isActive', next)}
                disabled={saving}
                title={formData.isActive ? 'Active' : 'Inactive'}
              />
            </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <LiquidGlassButton
              type="submit"
              disabled={saving}
              className="min-w-[132px] justify-center text-sm"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Page' : 'Create Page'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default PageModal;
