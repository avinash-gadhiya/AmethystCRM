import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tags, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import settingService from '@/services/settingService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const SettingValueModal = ({
  open,
  parentSetting = null,
  value = null,
  onClose,
  onSuccess
}) => {
  const isEditing = Boolean(value && value.settingValueId);

  const [settingValueText, setSettingValueText] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const settingId = Number(parentSetting?.settingId || value?.settingId || 0);
  const parentName = parentSetting?.settingName || parentSetting?.name || `Setting #${settingId}`;
  const parentKey = parentSetting?.settingKey || parentSetting?.key || '';

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    if (value) {
      setSettingValueText(value.settingValueText || value.text || value.value || '');
      setIsActive(value.isActive !== false);
    } else {
      setSettingValueText('');
      setIsActive(true);
    }
  }, [open, value]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedText = settingValueText.trim();
    if (!trimmedText) {
      setErrorMsg('Setting value text is required.');
      return;
    }

    if (!settingId) {
      setErrorMsg('Parent setting reference is missing.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await settingService.updateSettingValue({
          settingValueId: value.settingValueId,
          settingId,
          settingValueText: trimmedText,
          isActive
        });
        toast.success(`Value "${trimmedText}" updated successfully`);
      } else {
        await settingService.createSettingValue({
          settingValueId: 0,
          settingId,
          settingValueText: trimmedText,
          isActive
        });
        toast.success(`Value "${trimmedText}" added to ${parentName}`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save setting value:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save setting value');
      setErrorMsg(apiMsg);
      toast.error(apiMsg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-gray-200 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Tags size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Value' : 'Add Value'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Parent: <strong className="text-gray-700 dark:text-gray-200">{parentName}</strong>
                {parentKey && <span className="font-mono ml-1 text-purple-600 dark:text-purple-400">({parentKey})</span>}
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 dark:bg-[#17132a]">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Setting Value Text <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settingValueText}
                onChange={(e) => setSettingValueText(e.target.value)}
                placeholder="e.g. In Progress, Closed, USD, etc."
                disabled={saving}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                autoFocus
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Status
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isActive ? 'Value is active and selectable' : 'Value is disabled'}
                </span>
              </div>
              <IosToggle
                checked={Boolean(isActive)}
                onCheckedChange={(next) => setIsActive(next)}
                disabled={saving}
                title={isActive ? 'Active' : 'Inactive'}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
            <LiquidGlassButton
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </LiquidGlassButton>
            <LiquidGlassButton
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
            >
              {isEditing ? 'Save Changes' : 'Add Value'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default SettingValueModal;
