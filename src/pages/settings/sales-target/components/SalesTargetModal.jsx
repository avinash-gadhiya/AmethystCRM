import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, MapPin, Search, Sparkles, Target, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';

import salesTargetService from '@/services/salesTargetService';
import { getApiErrorMessage } from '@/lib/apiError';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import './SalesTargetModal.css';

const EMPTY_FORM = {
  salesTargetId: 0,
  userId: 0,
  salesTarget: '',
  rplTarget: ''
};

const hasExistingTarget = (user) => user?.salesTarget != null || user?.rplTarget != null;
const displayName = (user) => user?.fullName || user?.username || 'N/A';
const userInitials = (user) =>
  displayName(user)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const inputValue = (value) => (value === null || value === undefined ? '' : String(value));

const SalesTargetModal = ({ open, user = null, users = [], usersLoading = false, onClose, onSuccess }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [userSearch, setUserSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pickerRef = useRef(null);

  const selectedUser = useMemo(() => users.find((item) => Number(item.userId) === Number(form.userId)) || null, [form.userId, users]);
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
          [item.fullName, item.firstName, item.lastName, item.username, item.email, item.roleName, item.locationName, item.userId]
            .filter((value) => value !== null && value !== undefined)
            .some((value) => String(value).toLowerCase().includes(query))
        )
      : users;

    if (!selectedUser || matches.some((item) => Number(item.userId) === Number(selectedUser.userId))) return matches;
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

    const numericValues = [form.salesTarget, form.rplTarget].filter((value) => value !== '').map(Number);
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">Set the selected user&apos;s target values</p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        <form id="sales-target-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          <div ref={pickerRef}>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              User <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              disabled={usersLoading || saving}
              onClick={() => setPickerOpen((current) => !current)}
              className={`w-full min-h-[52px] px-3 py-2 rounded-xl border bg-white dark:bg-[#0f1322] text-left flex items-center justify-between gap-3 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                pickerOpen
                  ? 'border-purple-500 ring-2 ring-purple-500/15'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
              }`}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              aria-controls="sales-user-options"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-[11px] font-bold text-purple-600 dark:bg-purple-950/50 dark:text-purple-300">
                  {selectedUser ? userInitials(selectedUser) : <UserRound size={16} />}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm font-medium ${selectedUser ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
                  >
                    {usersLoading ? 'Loading users...' : selectedUser ? displayName(selectedUser) : 'Select user'}
                  </span>
                  {selectedUser && (
                    <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                      {[selectedUser.roleName, selectedUser.locationName].filter(Boolean).join(' · ') || 'Sales user'}
                    </span>
                  )}
                </span>
              </span>
              <ChevronDown size={17} className={`shrink-0 text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {pickerOpen && !usersLoading && (
              <div className="mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg shadow-gray-200/60 dark:border-white/10 dark:bg-[#151126] dark:shadow-black/30">
                <div className="p-2.5 border-b border-gray-100 dark:border-white/10">
                  <div className="sales-target-user-search flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 transition-colors focus-within:border-purple-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-500/10 dark:border-white/10 dark:bg-[#0f1322] dark:focus-within:bg-[#0f1322]">
                    <Search size={15} className="text-gray-400 shrink-0" />
                    <input
                      autoFocus
                      type="search"
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search users"
                      aria-label="Search users"
                      className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                    />
                    {userSearch && (
                      <button
                        type="button"
                        onClick={() => setUserSearch('')}
                        className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200"
                        aria-label="Clear user search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <span>Users</span>
                  <span>{visibleUsers.length} found</span>
                </div>
                <div
                  id="sales-user-options"
                  className="sales-target-user-options max-h-56 overflow-y-auto p-1.5"
                  role="listbox"
                  aria-label="Sales users"
                >
                  {visibleUsers.length ? (
                    visibleUsers.map((item) => {
                      const selected = Number(item.userId) === Number(selectedUser?.userId);
                      return (
                        <button
                          key={item.userId}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => selectUser(item)}
                          className={`group w-full rounded-lg px-2.5 py-2 text-left flex items-center gap-2.5 transition-colors ${
                            selected
                              ? 'bg-purple-50 text-purple-900 dark:bg-purple-950/40 dark:text-purple-100'
                              : 'hover:bg-gray-50 dark:hover:bg-white/5'
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${selected ? 'bg-white text-purple-600 shadow-sm dark:bg-white/10 dark:text-purple-300' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}
                          >
                            {userInitials(item)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName(item)}</span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                              {item.roleName && <span className="truncate">{item.roleName}</span>}
                              {item.locationName && (
                                <span className="inline-flex min-w-0 items-center gap-1 before:text-gray-300 before:content-['•'] dark:before:text-gray-600">
                                  <MapPin size={10} className="shrink-0" /> <span className="truncate">{item.locationName}</span>
                                </span>
                              )}
                            </span>
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-purple-600 text-white' : 'text-transparent'}`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
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
