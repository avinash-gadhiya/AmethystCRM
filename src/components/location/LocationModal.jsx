import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import locationService from '@/services/locationService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const LocationModal = ({
  open,
  location = null,
  onClose,
  onSuccess,
  canAdd = true,
  canUpdate = true
}) => {
  const isEditing = Boolean(location && location.locationId);

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync form state when modal opens or location changes
  useEffect(() => {
    if (open) {
      if (location) {
        setName(location.name || '');
        setIsActive(location.isActive !== false);
      } else {
        setName('');
        setIsActive(true);
      }
      setValidationError('');
    }
  }, [open, location]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isEditing && !canUpdate) {
      toast.error('You do not have permission to update locations.');
      return;
    }
    if (!isEditing && !canAdd) {
      toast.error('You do not have permission to create locations.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('Location name is required.');
      toast.error('Please enter a location name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        locationId: isEditing ? Number(location.locationId) : 0,
        name: trimmedName,
        isActive: Boolean(isActive)
      };

      if (isEditing) {
        await locationService.updateLocation(payload);
        toast.success('Location updated successfully');
      } else {
        await locationService.createLocation(payload);
        toast.success('Location created successfully');
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg = getApiErrorMessage(err, `Failed to ${isEditing ? 'update' : 'create'} location.`);
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
      aria-labelledby="location-modal-title"
    >
      <div className="relative w-full max-w-md max-h-[90vh] bg-white dark:bg-[#17132a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/50 dark:border-purple-800/30 shadow-xs">
              <MapPin size={20} />
            </div>
            <div>
              <h2 id="location-modal-title" className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {isEditing ? 'Edit Location' : 'Add Location'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isEditing ? `Modify location #${location.locationId}` : 'Define a new operational branch or location'}
              </p>
            </div>
          </div>

          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Modal Body: Scrollable */}
        <form id="location-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Location Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Location Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. New York Headquarters, London Office"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError('');
              }}
              disabled={saving}
              className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all ${
                validationError
                  ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                  : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
              }`}
            />
            {validationError && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {validationError}
              </p>
            )}
          </div>

          {/* Status Toggle */}
          <div className="pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
              <div>
                <label htmlFor="loc-active-toggle" className="text-xs font-semibold text-gray-800 dark:text-gray-200 block cursor-pointer">
                  Status
                </label>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {isActive ? 'Active and selectable' : 'Inactive (disabled)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-gray-700 dark:text-gray-300">
                  {isActive ? 'ON' : 'OFF'}
                </span>
                <IosToggle
                  id="loc-active-toggle"
                  checked={isActive}
                  onCheckedChange={(val) => setIsActive(val)}
                  disabled={saving}
                  title={isActive ? 'Active' : 'Inactive'}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer: Fixed */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-all"
          >
            Cancel
          </button>

          <LiquidGlassButton
            type="submit"
            form="location-form"
            disabled={saving}
            className="text-xs font-semibold min-w-[130px] shadow-md"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="animate-spin" /> Saving...
              </span>
            ) : isEditing ? (
              'Update Location'
            ) : (
              'Create Location'
            )}
          </LiquidGlassButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LocationModal;
