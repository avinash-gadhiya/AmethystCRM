import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Menu as MenuIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import menuService from '@/services/menuService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const MenuModal = ({ open, menu = null, onClose, onSuccess }) => {
  const isEditing = Boolean(menu && menu.menuId);

  const [formData, setFormData] = useState({
    menuName: '',
    menuDisplayName: '',
    menuIcon: '',
    menuOrder: 0,
    menuUrl: '',
    isActive: true
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Sync form state when modal opens or menu changes
  useEffect(() => {
    if (open) {
      if (menu) {
        setFormData({
          menuName: menu.menuName || '',
          menuDisplayName: menu.menuDisplayName || menu.menuName || '',
          menuIcon: menu.menuIcon || '',
          menuOrder: Number(menu.menuOrder) || 0,
          menuUrl: menu.menuUrl || '',
          isActive: menu.isActive !== false
        });
      } else {
        setFormData({
          menuName: '',
          menuDisplayName: '',
          menuIcon: '',
          menuOrder: 0,
          menuUrl: '',
          isActive: true
        });
      }
      setValidationErrors({});
    }
  }, [open, menu]);

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
    if (!formData.menuName.trim()) {
      errors.menuName = 'Menu name is required.';
    }
    if (!formData.menuDisplayName.trim()) {
      errors.menuDisplayName = 'Display name is required.';
    }
    if (!formData.menuUrl.trim()) {
      errors.menuUrl = 'Menu URL is required.';
    }
    if (formData.menuOrder === '' || isNaN(Number(formData.menuOrder)) || Number(formData.menuOrder) < 0) {
      errors.menuOrder = 'Valid order (>= 0) is required.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please correct the highlighted errors.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        menuId: isEditing ? Number(menu.menuId) : 0,
        menuName: formData.menuName.trim(),
        menuDisplayName: formData.menuDisplayName.trim(),
        menuIcon: formData.menuIcon.trim(),
        menuOrder: Number(formData.menuOrder) || 0,
        menuUrl: formData.menuUrl.trim(),
        isActive: Boolean(formData.isActive)
      };

      if (isEditing) {
        await menuService.updateMenu(payload);
        toast.success(`Menu "${payload.menuDisplayName}" updated successfully.`);
      } else {
        await menuService.createMenu(payload);
        toast.success(`Menu "${payload.menuDisplayName}" created successfully.`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg = getApiErrorMessage(err, `Failed to ${isEditing ? 'update' : 'create'} menu.`);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-modal-title"
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
              <MenuIcon size={20} />
            </div>
            <div>
              <h3 id="menu-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Menu' : 'Add New Menu'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditing
                  ? `Update configuration for menu ID #${menu.menuId}`
                  : 'Configure a new application menu, route, and navigation placement'}
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Form Body */}
        <form id="menu-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Menu Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Menu Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.menuName}
                  onChange={(e) => handleChange('menuName', e.target.value)}
                  placeholder="e.g. Lead Access, Settings, Operations"
                  disabled={saving}
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${
                    validationErrors.menuName
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-gray-200 dark:border-white/10'
                  } bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all`}
                  autoFocus
                />
                {validationErrors.menuName && (
                  <span className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {validationErrors.menuName}
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
                  value={formData.menuDisplayName}
                  onChange={(e) => handleChange('menuDisplayName', e.target.value)}
                  placeholder="e.g. Lead Access"
                  disabled={saving}
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${
                    validationErrors.menuDisplayName
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-gray-200 dark:border-white/10'
                  } bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all`}
                />
                {validationErrors.menuDisplayName && (
                  <span className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {validationErrors.menuDisplayName}
                  </span>
                )}
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.menuUrl}
                  onChange={(e) => handleChange('menuUrl', e.target.value)}
                  placeholder="e.g. /Lead-Access or #"
                  disabled={saving}
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${
                    validationErrors.menuUrl
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-gray-200 dark:border-white/10'
                  } bg-gray-50/50 dark:bg-white/5 text-sm font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all`}
                />
                {validationErrors.menuUrl && (
                  <span className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {validationErrors.menuUrl}
                  </span>
                )}
              </div>

              {/* Order */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Order <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.menuOrder}
                  onChange={(e) => handleChange('menuOrder', e.target.value)}
                  disabled={saving}
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${
                    validationErrors.menuOrder
                      ? 'border-red-500 ring-1 ring-red-500'
                      : 'border-gray-200 dark:border-white/10'
                  } bg-gray-50/50 dark:bg-white/5 text-sm font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all`}
                />
                {validationErrors.menuOrder && (
                  <span className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {validationErrors.menuOrder}
                  </span>
                )}
              </div>

              {/* Icon (CSS Class / Lucide) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Icon (CSS Class / Lucide) <span className="text-xs font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.menuIcon}
                  onChange={(e) => handleChange('menuIcon', e.target.value)}
                  placeholder="e.g. feather icon-home, home, layout"
                  disabled={saving}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                />
              </div>

              {/* Status Toggle Card */}
              <div className="sm:col-span-2 flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/30 dark:bg-white/[0.02]">
                <div>
                  <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                    Status
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.isActive ? 'Menu is active and available in navigation' : 'Menu is disabled and hidden'}
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
              {saving ? 'Saving...' : isEditing ? 'Update Menu' : 'Create Menu'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default MenuModal;
