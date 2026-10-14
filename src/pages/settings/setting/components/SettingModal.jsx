import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sliders, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import settingService from '@/services/settingService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const SettingModal = ({ open, setting = null, onClose, onSuccess }) => {
  const isEditing = Boolean(setting && setting.settingId);

  const [settingName, setSettingName] = useState('');
  const [settingKey, setSettingKey] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    if (setting) {
      setSettingName(setting.settingName || setting.name || '');
      setSettingKey(setting.settingKey || setting.key || '');
      setIsActive(setting.isActive !== false);
    } else {
      setSettingName('');
      setSettingKey('');
      setIsActive(true);
    }
  }, [open, setting]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = settingName.trim();
    const trimmedKey = settingKey.trim();

    if (!trimmedName) {
      setErrorMsg('Setting name is required.');
      return;
    }
    if (!trimmedKey) {
      setErrorMsg('Setting key is required.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        // When saving an existing setting, preserve the existing settingValueDTOs array
        await settingService.updateSetting({
          settingId: setting.settingId,
          settingName: trimmedName,
          settingKey: trimmedKey,
          isActive,
          settingValueDTOs: Array.isArray(setting.settingValueDTOs) ? setting.settingValueDTOs : []
        });
        toast.success(`Setting "${trimmedName}" updated successfully`);
      } else {
        await settingService.createSetting({
          settingId: 0,
          settingName: trimmedName,
          settingKey: trimmedKey,
          isActive,
          settingValueDTOs: []
        });
        toast.success(`Setting "${trimmedName}" created successfully`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save setting:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save setting');
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
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Setting' : 'Add Setting'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditing ? 'Update configuration setting.' : 'Define a new configuration setting key.'}
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
                Setting Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settingName}
                onChange={(e) => setSettingName(e.target.value)}
                placeholder="e.g. Lead Statuses or Default Currency"
                disabled={saving}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Setting Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settingKey}
                onChange={(e) => setSettingKey(e.target.value)}
                placeholder="e.g. LEAD_STATUS or DEFAULT_CURRENCY"
                disabled={saving}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 font-mono transition-all"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Status
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isActive ? 'Setting is active and available across the system' : 'Setting is disabled'}
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
              {isEditing ? 'Save Changes' : 'Create Setting'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default SettingModal;
