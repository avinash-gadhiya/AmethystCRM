import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, MapPin, Search, Sparkles, Target, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import salesTargetService from '@/services/salesTargetService';
import { getApiErrorMessage } from '@/lib/apiError';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';

const EMPTY_FORM = {
  salesTargetId: 0,
  userId: 0,
  salesTarget: '',
  rplTarget: ''
};

const hasExistingTarget = (user) => user?.salesTarget != null || user?.rplTarget != null;
const displayName = (user) => user?.fullName || user?.username || 'N/A';

const inputValue = (value) => (value === null || value === undefined ? '' : String(value));

const SalesTargetModal = ({ open, user = null, users = [], usersLoading = false, onClose, onSuccess }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [userSearch, setUserSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pickerRef = useRef(null);

  const selectedUser = useMemo(
    () => users.find((item) => Number(item.userId) === Number(form.userId)) || null,
    [form.userId, users]
  );
  const isEditing = hasExistingTarget(selectedUser);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY_FORM,
      userId: Number(user?.userId) || 0,
      salesTarget: inputValue(user?.salesTarget),
      rplTarget: inputValue(user?.rplTarget)
    });
    setUserSearch('');
    setPickerOpen(false);
  }, [open, user]);

  useEffect(() => {
    if (!pickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!pickerRef.current?.contains(event.target)) setPickerOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen]);

  const visibleUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    const matches = query
      ? users.filter((item) =>
          [
            item.fullName,
            item.firstName,
            item.lastName,
            item.username,
            item.email,
            item.roleName,
            item.locationName,
            item.userId
          ]
            .filter((value) => value !== null && value !== undefined)
            .some((value) => String(value).toLowerCase().includes(query))
        )
      : users;

    if (!selectedUser || matches.some((item) => item.userId === selectedUser.userId)) return matches;
    return [selectedUser, ...matches];
  }, [selectedUser, userSearch, users]);

  if (!open) return null;

  const selectUser = (nextUser) => {
    setForm({
      ...EMPTY_FORM,
      userId: Number(nextUser.userId),
      salesTarget: inputValue(nextUser.salesTarget),
      rplTarget: inputValue(nextUser.rplTarget)
    });
    setUserSearch('');
    setPickerOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedUser) {
      toast.error('Please select a user.');
      return;
    }

    const numericValues = [form.salesTarget, form.rplTarget]
      .filter((value) => value !== '')
      .map(Number);
    if (numericValues.some((value) => !Number.isFinite(value))) {
      toast.error('Target values must be valid numbers.');
      return;
    }

    try {
      setSaving(true);
      if (isEditing) {
        await salesTargetService.updateSalesTarget(form, users);
        toast.success('Sales target updated');
      } else {
        await salesTargetService.createSalesTarget(form);
        toast.success('Sales target created');
      }
      onClose?.();
      await onSuccess?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to ${isEditing ? 'update' : 'create'} sales target.`));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sales-target-modal-title"
    >
      <div className="relative w-full max-w-md max-h-[90vh] bg-white dark:bg-[#17132a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/50 dark:border-purple-800/30 shrink-0">
              <Target size={20} />
            </div>
            <div className="min-w-0">
              <h2 id="sales-target-modal-title" className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {isEditing ? 'Edit Sales Target' : 'Add Sales Target'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                Set the selected user&apos;s target values
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        <form id="sales-target-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          <div ref={pickerRef} className="relative">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              User <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              disabled={usersLoading || saving}
              onClick={() => setPickerOpen((current) => !current)}
              className="w-full min-h-11 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#0f1322] text-left flex items-center justify-between gap-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
            >
              <span className={selectedUser ? 'text-sm text-gray-900 dark:text-white' : 'text-sm text-gray-400'}>
                {usersLoading ? 'Loading users...' : selectedUser ? displayName(selectedUser) : 'Select user'}
              </span>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {pickerOpen && !usersLoading && (
              <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#151126] shadow-2xl overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-white/10">
                  <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-[#0f1322] border border-gray-200 dark:border-white/10 px-2.5">
                    <Search size={14} className="text-gray-400 shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search users"
                      className="w-full py-2 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
                    />
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto p-1.5" role="listbox" aria-label="Sales users">
                  {visibleUsers.length ? (
                    visibleUsers.map((item) => {
                      const selected = item.userId === selectedUser?.userId;
                      return (
                        <button
                          key={item.userId}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => selectUser(item)}
                          className={`w-full rounded-lg px-3 py-2.5 text-left flex items-start gap-2 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors ${selected ? 'bg-purple-50/80 dark:bg-purple-950/30' : ''}`}
                        >
                          <UserRound size={16} className="mt-0.5 text-purple-500 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {displayName(item)}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
                                {item.roleName}
                              </span>
                              {item.locationName && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-300">
                                  <MapPin size={9} /> {item.locationName}
                                </span>
                              )}
                            </span>
                          </span>
                          {selected && <Check size={15} className="mt-0.5 text-purple-600 shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-6 text-center text-xs text-gray-500">No matching users found.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="sales-target-input" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Sales Target
            </label>
            <input
              id="sales-target-input"
              type="number"
              step="any"
              value={form.salesTarget}
              onChange={(event) => setForm((current) => ({ ...current, salesTarget: event.target.value }))}
              placeholder="Enter sales target"
              disabled={saving}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="rpl-target-input" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              RPL Target
            </label>
            <input
              id="rpl-target-input"
              type="number"
              step="any"
              value={form.rplTarget}
              onChange={(event) => setForm((current) => ({ ...current, rplTarget: event.target.value }))}
              placeholder="Enter RPL target"
              disabled={saving}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-all disabled:opacity-60"
          >
            Cancel
          </button>
          <LiquidGlassButton
            type="submit"
            form="sales-target-form"
            disabled={saving || usersLoading}
            className="text-xs font-semibold min-w-[150px] shadow-md"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="animate-spin" /> Saving...
              </span>
            ) : isEditing ? (
              'Update Sales Target'
            ) : (
              'Create Sales Target'
            )}
          </LiquidGlassButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SalesTargetModal;
