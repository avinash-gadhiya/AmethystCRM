import React, { useState, useEffect } from 'react';
import { X, Layers, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import groupService from '@/services/groupService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import IosToggle from '@/components/common/IosToggle';

/**
 * Centered modal for creating or editing a Group.
 */
const GroupModal = ({ isOpen, onClose, group = null, onSaved }) => {
  const isEdit = Boolean(group && group.groupId);

  const [groupName, setGroupName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Prefill on open or prop change
  useEffect(() => {
    if (isOpen) {
      if (group) {
        setGroupName(group.groupName || '');
        setIsActive(Boolean(group.isActive ?? true));
      } else {
        setGroupName('');
        setIsActive(true);
      }
      setErrorMsg('');
      setSubmitting(false);
    }
  }, [isOpen, group]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      setErrorMsg('Group name is required.');
      toast.error('Group name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      if (isEdit) {
        await groupService.updateGroup({
          groupId: Number(group.groupId),
          groupName: trimmedName,
          isActive
        });
        toast.success(`Group "${trimmedName}" updated successfully.`);
      } else {
        await groupService.createGroup({
          groupId: 0,
          groupName: trimmedName,
          isActive
        });
        toast.success(`Group "${trimmedName}" created successfully.`);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save group:', err);
      const msg = getApiErrorMessage(err, isEdit ? 'Failed to update group' : 'Failed to create group');
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[28rem] max-h-[90vh] flex flex-col bg-white dark:bg-[#17132a] border border-gray-300 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {isEdit ? 'Edit Group' : 'Add Group'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEdit ? `Update Group ID #${group.groupId}` : 'Create a new organizational group'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="group-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Group Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Sales, Support, Operations"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0f1322] border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
            />
          </div>

          {/* Active Status Switch */}
          <div className="pt-2 flex items-center justify-between rounded-xl p-3 bg-gray-50 dark:bg-[#0f1322] border border-gray-200 dark:border-white/5">
            <div>
              <span className="block text-xs font-semibold text-gray-800 dark:text-gray-200">
                Active Status
              </span>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                Enable or disable this group across the system
              </span>
            </div>
            <IosToggle
              checked={isActive}
              onCheckedChange={(val) => setIsActive(val)}
              disabled={submitting}
              title={isActive ? 'Active' : 'Inactive'}
            />
          </div>
        </form>

        {/* Fixed Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1a1630] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <LiquidGlassButton
            type="submit"
            form="group-form"
            disabled={submitting}
            className="text-xs px-4 py-2 font-medium"
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Group' : 'Create Group'}
          </LiquidGlassButton>
        </div>
      </div>
    </div>
  );
};

export default GroupModal;
