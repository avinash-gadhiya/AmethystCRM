import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, UserCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import userService from '@/services/userService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const UserEditorModal = ({
  open,
  user = null,
  roles = [],
  locations = [],
  currentUserId,
  onClose,
  onSuccess
}) => {
  const isEditing = Boolean(user && user.userId);

  const [formData, setFormData] = useState({
    userId: 0,
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    passwordHash: '',
    roleId: '',
    locationId: '',
    salesTarget: '',
    rplTarget: '',
    isActive: true,
    isLeadOn: true
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selfWarningOpen, setSelfWarningOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    setSelfWarningOpen(false);

    if (user) {
      setFormData({
        userId: user.userId || 0,
        username: user.username || '',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        passwordHash: '',
        roleId: user.roleId || (roles.length > 0 ? roles[0].roleId || roles[0].id : ''),
        locationId: user.locationId || (locations.length > 0 ? locations[0].locationId || locations[0].id : ''),
        salesTarget: user.salesTarget ?? 0,
        rplTarget: user.rplTarget ?? 0,
        isActive: user.isActive !== false,
        isLeadOn: Boolean(user.isLeadOn)
      });
    } else {
      setFormData({
        userId: 0,
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        passwordHash: '',
        roleId: roles.length > 0 ? roles[0].roleId || roles[0].id : '',
        locationId: locations.length > 0 ? locations[0].locationId || locations[0].id : '',
        salesTarget: 0,
        rplTarget: 0,
        isActive: true,
        isLeadOn: true
      });
    }
  }, [open, user, roles, locations]);

  if (!open) return null;

  const isEditingSelf = Boolean(
    isEditing &&
      currentUserId &&
      Number(formData.userId) === Number(currentUserId)
  );

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validations
    if (!formData.username?.trim()) {
      setErrorMsg('Username is required.');
      return;
    }
    if (!formData.email?.trim()) {
      setErrorMsg('Email address is required.');
      return;
    }
    if (!isEditing && !formData.passwordHash?.trim()) {
      setErrorMsg('Password is required for new accounts.');
      return;
    }

    if (isEditingSelf && !formData.isActive) {
      setSelfWarningOpen(true);
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await userService.updateUser(formData);
        toast.success(`User "${formData.username}" updated successfully`);
      } else {
        await userService.createUser(formData);
        toast.success(`User "${formData.username}" created successfully`);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save user:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save user account');
      setErrorMsg(apiMsg);
      toast.error(apiMsg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit User' : 'Add New User'}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">
                {isEditing ? 'Update user details and permissions.' : 'Create a user account to manage access.'}
              </p>
            </div>
            <GlassCloseButton onClick={onClose} disabled={saving} />
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 space-y-4 overflow-y-auto flex-1 dark:bg-[#17132a]">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Username & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    required
                    disabled={isEditing}
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="e.g. john_doe"
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {isEditing && (
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                      Username cannot be changed after the user is created.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="e.g. user@company.com"
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  {isEditing ? 'New Password (leave blank to keep unchanged)' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  name="passwordHash"
                  required={!isEditing}
                  value={formData.passwordHash}
                  onChange={handleInputChange}
                  placeholder={isEditing ? 'Enter new password or leave blank' : 'Minimum 6 characters'}
                  className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                />
              </div>

              {/* Role & Location Selects */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="roleId"
                    value={formData.roleId}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  >
                    <option value="">Select a role</option>
                    {roles.map((r) => {
                      const id = r.roleId ?? r.id;
                      const name = r.roleName ?? r.name ?? `Role #${id}`;
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Location
                  </label>
                  <select
                    name="locationId"
                    value={formData.locationId}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  >
                    <option value="">Select location (optional)</option>
                    {locations.map((loc) => {
                      const id = loc.locationId ?? loc.id;
                      const name = loc.locationName ?? loc.name ?? `Location #${id}`;
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Sales Target & RPL Target */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Monthly Sales Target ($)
                  </label>
                  <input
                    type="number"
                    name="salesTarget"
                    min="0"
                    step="any"
                    value={formData.salesTarget}
                    onChange={handleInputChange}
                    placeholder="e.g. 50000"
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    RPL Target ($)
                  </label>
                  <input
                    type="number"
                    name="rplTarget"
                    min="0"
                    step="any"
                    value={formData.rplTarget}
                    onChange={handleInputChange}
                    placeholder="e.g. 1500"
                    className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Toggles Panels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Status Toggle */}
                <div className="rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3 bg-gray-50/50 dark:bg-white/5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-white mb-2">
                    Status
                  </label>
                  <div className="flex items-center gap-3">
                    <IosToggle
                      checked={Boolean(formData.isActive)}
                      onCheckedChange={(nextChecked) => {
                        if (isEditingSelf && formData.isActive && !nextChecked) {
                          setSelfWarningOpen(true);
                          return;
                        }
                        setFormData((prev) => ({ ...prev, isActive: Boolean(nextChecked) }));
                      }}
                      title={formData.isActive ? 'Active' : 'Inactive'}
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-200">
                      {formData.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Lead Assignment ON Toggle */}
                <div className="rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3 bg-gray-50/50 dark:bg-white/5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-white mb-2">
                    Lead Flow
                  </label>
                  <div className="flex items-center gap-3">
                    <IosToggle
                      checked={Boolean(formData.isLeadOn)}
                      onCheckedChange={(nextChecked) =>
                        setFormData((prev) => ({ ...prev, isLeadOn: Boolean(nextChecked) }))
                      }
                      title={formData.isLeadOn ? 'On' : 'Off'}
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-200">
                      {formData.isLeadOn ? 'Lead ON' : 'Lead OFF'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-white/10 sticky bottom-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-gray-300 dark:border-white/15 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <LiquidGlassButton type="submit" disabled={saving} className="text-center">
                {saving ? (
                  isEditing ? 'Updating...' : 'Creating...'
                ) : isEditing ? (
                  'Update User'
                ) : (
                  'Create User'
                )}
              </LiquidGlassButton>
            </div>
          </form>
        </div>
      </div>

      {/* Self Deactivation Warning Modal */}
      {selfWarningOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#1d1733] backdrop-blur">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Action not allowed</h3>
                <GlassCloseButton onClick={() => setSelfWarningOpen(false)} />
              </div>

              <div className="p-6">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  You cannot deactivate your own user account.
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This prevents locking yourself out of the system.
                </p>

                <div className="mt-6 flex items-center justify-end">
                  <LiquidGlassButton onClick={() => setSelfWarningOpen(false)} className="text-center">
                    OK
                  </LiquidGlassButton>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>,
    document.body
  );
};

export default UserEditorModal;
