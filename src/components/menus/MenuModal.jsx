import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Menu as MenuIcon, AlertCircle, Sparkles } from 'lucide-react';
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
        toast.success('Menu updated successfully');
      } else {
        await menuService.createMenu(payload);
        toast.success('Menu created successfully');
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-modal-title"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-[#17132a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/50 dark:border-purple-800/30 shadow-xs">
              <MenuIcon size={20} />
            </div>
            <div>
              <h2 id="menu-modal-title" className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {isEditing ? 'Edit Menu' : 'Add Menu'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isEditing ? `Modify menu #${menu.menuId}` : 'Define a top-level system navigation menu'}
              </p>
            </div>
          </div>

          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Modal Body: Scrollable */}
        <form id="menu-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Menu Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Menu Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Sales, Settings, Operations"
              value={formData.menuName}
              onChange={(e) => handleChange('menuName', e.target.value)}
              disabled={saving}
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all ${
                validationErrors.menuName
                  ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                  : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
              }`}
            />
            {validationErrors.menuName && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {validationErrors.menuName}
              </p>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Sales Management"
              value={formData.menuDisplayName}
              onChange={(e) => handleChange('menuDisplayName', e.target.value)}
              disabled={saving}
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all ${
                validationErrors.menuDisplayName
                  ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                  : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
              }`}
            />
            {validationErrors.menuDisplayName && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {validationErrors.menuDisplayName}
              </p>
            )}
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              URL <span className="text-red-500">*</span>
            </label>
            <input
                type="text"
                placeholder="e.g. /sales or #"
                value={formData.menuUrl}
                onChange={(e) => handleChange('menuUrl', e.target.value)}
                disabled={saving}
                className={`w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all ${
                  validationErrors.menuUrl
                    ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                    : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                }`}
            />
            {validationErrors.menuUrl && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {validationErrors.menuUrl}
              </p>
            )}
          </div>

          {/* Icon (CSS class) & Menu Order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Icon */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Icon (CSS Class / Lucide)
              </label>
              <input
                  type="text"
                  placeholder="e.g. feather icon-home"
                  value={formData.menuIcon}
                  onChange={(e) => handleChange('menuIcon', e.target.value)}
                  disabled={saving}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
            </div>

            {/* Menu Order */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Order <span className="text-red-500">*</span>
              </label>
              <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={formData.menuOrder}
                  onChange={(e) => handleChange('menuOrder', e.target.value)}
                  disabled={saving}
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all ${
                    validationErrors.menuOrder
                      ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                      : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                  }`}
              />
              {validationErrors.menuOrder && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.menuOrder}
                </p>
              )}
            </div>
          </div>

          {/* Status Toggle */}
          <div className="pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
              <div>
                <label htmlFor="menu-active-toggle" className="text-xs font-semibold text-gray-800 dark:text-gray-200 block cursor-pointer">
                  Status
                </label>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {formData.isActive ? 'Active and visible in navigation' : 'Inactive (hidden from navigation)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-gray-700 dark:text-gray-300">
                  {formData.isActive ? 'ON' : 'OFF'}
                </span>
                <IosToggle
                  id="menu-active-toggle"
                  checked={formData.isActive}
                  onCheckedChange={(val) => handleChange('isActive', val)}
                  disabled={saving}
                  title={formData.isActive ? 'Active' : 'Inactive'}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer: Fixed */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-transparent border border-gray-300 dark:border-white/15 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <LiquidGlassButton
            type="submit"
            form="menu-form"
            disabled={saving}
            className="text-sm font-semibold min-w-[132px] justify-center shadow-md"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="animate-spin" /> Saving...
              </span>
            ) : isEditing ? (
              'Update Menu'
            ) : (
              'Create Menu'
            )}
          </LiquidGlassButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MenuModal;
