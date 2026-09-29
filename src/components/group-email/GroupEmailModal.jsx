import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mail, AlertCircle, RefreshCw, ChevronDown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import groupEmailService from '@/services/groupEmailService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

/**
 * Centered responsive modal for creating and editing Group Email identities.
 */
const GroupEmailModal = ({
  open,
  groupEmail = null,
  groupOptions = [],
  onRefreshGroups = null,
  onClose,
  onSuccess,
  canAdd = true,
  canUpdate = true
}) => {
  const isEditing = Boolean(groupEmail && groupEmail.groupEmailId);

  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [email, setEmail] = useState('');
  const [nameOnEmail, setNameOnEmail] = useState('');
  const [location, setLocation] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Prefill on open or prop change
  useEffect(() => {
    if (open) {
      if (groupEmail) {
        setGroupId(groupEmail.groupId ? String(groupEmail.groupId) : '');
        setGroupName(groupEmail.groupName || '');
        setEmail(groupEmail.email || '');
        setNameOnEmail(groupEmail.nameOnEmail || '');
        setLocation(groupEmail.location || '');
        setIsActive(Boolean(groupEmail.isActive ?? true));
      } else {
        setGroupId('');
        setGroupName('');
        setEmail('');
        setNameOnEmail('');
        setLocation('');
        setIsActive(true);
      }
      setValidationErrors({});
      setSaving(false);
    }
  }, [open, groupEmail]);

  if (!open) return null;

  // Handle Group selection change
  const handleGroupSelect = (e) => {
    const selectedId = e.target.value;
    setGroupId(selectedId);
    const found = groupOptions.find((g) => String(g.id) === String(selectedId));
    if (found) {
      setGroupName(found.name);
    } else {
      setGroupName('');
    }
    if (validationErrors.groupId) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next.groupId;
        return next;
      });
    }
  };

  const handleRefreshGroupsClick = async () => {
    if (!onRefreshGroups || refreshing) return;
    setRefreshing(true);
    try {
      await onRefreshGroups();
      toast.success('Group options refreshed');
    } catch {
      toast.error('Failed to refresh groups');
    } finally {
      setRefreshing(false);
    }
  };

  const validate = () => {
    const errors = {};
    const numericGroupId = Number(groupId);
    if (!groupId || !Number.isFinite(numericGroupId) || numericGroupId <= 0) {
      errors.groupId = 'Please select group';
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        errors.email = 'Please enter a valid email address.';
      }
    }

    if (!nameOnEmail.trim()) {
      errors.nameOnEmail = 'Name on email is required.';
    }

    if (!location.trim()) {
      errors.location = 'Location is required.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isEditing && !canUpdate) {
      toast.error('You do not have permission to update group emails.');
      return;
    }
    if (!isEditing && !canAdd) {
      toast.error('You do not have permission to create group emails.');
      return;
    }

    if (!validate()) {
      const firstError = Object.values(validationErrors)[0] || 'Please complete all required fields.';
      toast.error(firstError);
      return;
    }

    const numericGroupId = Number(groupId);
    const trimmedEmail = email.trim();
    const trimmedName = nameOnEmail.trim();
    const trimmedLocation = location.trim();

    // Resolve groupName if empty from selected options
    let finalGroupName = groupName.trim();
    if (!finalGroupName) {
      const found = groupOptions.find((g) => String(g.id) === String(numericGroupId));
      if (found) finalGroupName = found.name;
    }

    setSaving(true);
    try {
      const payload = {
        groupEmailId: isEditing ? Number(groupEmail.groupEmailId) : 0,
        email: trimmedEmail,
        nameOnEmail: trimmedName,
        location: trimmedLocation,
        groupId: numericGroupId,
        groupName: finalGroupName,
        isActive: Boolean(isActive)
      };

      if (isEditing) {
        await groupEmailService.updateGroupEmail(payload);
        toast.success('Group email updated successfully');
      } else {
        await groupEmailService.createGroupEmail(payload);
        toast.success('Group email created successfully');
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg = getApiErrorMessage(
        err,
        `Failed to ${isEditing ? 'update' : 'create'} group email.`
      );
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-email-modal-title"
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-[#17132a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#1d1733] backdrop-blur sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30 flex items-center justify-center shrink-0">
              <Mail size={20} />
            </div>
            <div>
              <h3
                id="group-email-modal-title"
                className="text-base font-bold text-gray-900 dark:text-white"
              >
                {isEditing ? 'Edit Group Email' : 'Add Group Email'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isEditing
                  ? `Update Group Email ID #${groupEmail.groupEmailId}`
                  : 'Configure group sender address and identity'}
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Scrollable Form Body */}
        <form
          id="group-email-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-4.5"
        >
          {/* 1. Group Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="group-email-group"
                className="block text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                Group <span className="text-red-500">*</span>
              </label>
              {onRefreshGroups && (
                <button
                  type="button"
                  onClick={handleRefreshGroupsClick}
                  disabled={refreshing}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              )}
            </div>
            <div className="relative">
              <select
                id="group-email-group"
                value={groupId}
                onChange={handleGroupSelect}
                disabled={saving}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white outline-none appearance-none cursor-pointer pr-10 transition-all ${
                  validationErrors.groupId
                    ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                    : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                }`}
              >
                <option value="">Select Group</option>
                {groupOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="dark:bg-[#17132a]">
                    {opt.name} {opt.isActive === false ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500"
              />
            </div>
            {validationErrors.groupId && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {validationErrors.groupId}
              </p>
            )}
          </div>

          {/* 2. Email Field */}
          <div>
            <label
              htmlFor="group-email-address"
              className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="group-email-address"
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationErrors.email) {
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }
              }}
              disabled={saving}
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-all ${
                validationErrors.email
                  ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                  : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
              }`}
            />
            {validationErrors.email && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {validationErrors.email}
              </p>
            )}
          </div>

          {/* 3 & 4. Name and Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name Field */}
            <div>
              <label
                htmlFor="group-email-name"
                className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="group-email-name"
                type="text"
                placeholder="Enter name on email"
                value={nameOnEmail}
                onChange={(e) => {
                  setNameOnEmail(e.target.value);
                  if (validationErrors.nameOnEmail) {
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next.nameOnEmail;
                      return next;
                    });
                  }
                }}
                disabled={saving}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-all ${
                  validationErrors.nameOnEmail
                    ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                    : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                }`}
              />
              {validationErrors.nameOnEmail && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.nameOnEmail}
                </p>
              )}
            </div>

            {/* Location Field */}
            <div>
              <label
                htmlFor="group-email-location"
                className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5"
              >
                Location <span className="text-red-500">*</span>
              </label>
              <input
                id="group-email-location"
                type="text"
                placeholder="Enter location"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (validationErrors.location) {
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next.location;
                      return next;
                    });
                  }
                }}
                disabled={saving}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-all ${
                  validationErrors.location
                    ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                    : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                }`}
              />
              {validationErrors.location && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.location}
                </p>
              )}
            </div>
          </div>

          {/* 5. Status Toggle */}
          <div className="pt-1">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
              <div>
                <label
                  htmlFor="group-email-active-toggle"
                  className="text-xs font-semibold text-gray-800 dark:text-gray-200 block cursor-pointer"
                >
                  Status
                </label>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {isActive ? 'Active and operational' : 'Inactive (disabled)'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold font-mono text-gray-700 dark:text-gray-300">
                  {isActive ? 'ON' : 'OFF'}
                </span>
                <IosToggle
                  id="group-email-active-toggle"
                  checked={isActive}
                  onCheckedChange={(val) => setIsActive(val)}
                  disabled={saving}
                  title={isActive ? 'Active' : 'Inactive'}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Fixed Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1d1733] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl border border-gray-200 dark:border-white/10 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <LiquidGlassButton
            type="submit"
            form="group-email-form"
            disabled={saving}
            className="text-xs font-semibold px-6 py-2.5 shadow-md min-w-[150px]"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="animate-spin" /> Saving...
              </span>
            ) : isEditing ? (
              'Update Group Email'
            ) : (
              'Create Group Email'
            )}
          </LiquidGlassButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GroupEmailModal;
