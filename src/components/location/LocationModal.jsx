import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import locationService from '@/services/locationService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const LocationModal = ({ open, location = null, onClose, onSuccess, canAdd = true, canUpdate = true }) => {
  const isEditing = Boolean(location && location.locationId);

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving] = useState(false);
  const modalRef = useRef(null);
  const nameInputRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

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

  // Keep keyboard focus and page scrolling inside the modal while it is open.
  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = modalRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, saving, onClose]);

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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-3 backdrop-blur-sm animate-fadeIn sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
      aria-describedby="location-modal-description"
    >
      <div
        ref={modalRef}
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl animate-scaleUp dark:border-white/10 dark:bg-[#17132a] sm:max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/50 dark:border-purple-800/30 shadow-xs">
              <MapPin size={20} />
            </div>
            <div>
              <h2 id="location-modal-title" className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {isEditing ? 'Edit Location' : 'Add Location'}
              </h2>
              <p id="location-modal-description" className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {isEditing ? `Modify location #${location.locationId}` : 'Define a new operational branch or location'}
              </p>
            </div>
          </div>

          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Modal Body: Scrollable */}
        <form id="location-form" onSubmit={handleSubmit} noValidate className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {/* Location Name */}
          <div>
            <label htmlFor="location-name" className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Location Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              id="location-name"
              name="locationName"
              type="text"
              autoComplete="organization"
              maxLength={150}
              placeholder="e.g. New York Headquarters, London Office"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError('');
              }}
              disabled={saving}
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? 'location-name-error' : undefined}
              className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                validationError
                  ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                  : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
              }`}
            />
            {validationError && (
              <p id="location-name-error" role="alert" className="mt-1 flex items-center gap-1 text-xs text-red-500">
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
                <span className="text-xs font-bold font-mono text-gray-700 dark:text-gray-300">{isActive ? 'ON' : 'OFF'}</span>
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
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-4 dark:border-white/10 dark:bg-white/5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-all"
          >
            Cancel
          </button>

          <LiquidGlassButton type="submit" form="location-form" disabled={saving} className="text-xs font-semibold min-w-[130px] shadow-md">
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
