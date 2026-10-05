import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Check, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import userService from '@/services/userService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';

const UserGroupsModal = ({ open, user, onClose, onSuccess }) => {
  const [groups, setGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!open || !user) return;

    let isMounted = true;
    setLoading(true);
    setSearchTerm('');

    const loadData = async () => {
      try {
        // 1. Fetch available groups
        const available = await userService.getGroups();
        if (!isMounted) return;
        setGroups(available || []);

        // 2. Fetch current user groups
        try {
          const userGroups = await userService.getUserGroup(user.userId);
          if (!isMounted) return;

          // Extract assigned group IDs
          const ids = new Set();
          if (Array.isArray(userGroups)) {
            const hasActiveFlag = userGroups.some((g) => g.isActive !== undefined);
            userGroups.forEach((g) => {
              const isAssigned = hasActiveFlag
                ? Boolean(g.isActive || (g.userGroupId && g.userGroupId > 0))
                : true;
              if (isAssigned) {
                const id = g.groupId ?? g.id;
                if (id) ids.add(Number(id));
              }
            });
          }

          // If no active groups found from endpoint, check user.groupName or user.groups
          if (ids.size === 0 && user) {
            const userGroupNames = Array.isArray(user.groupName)
              ? user.groupName
              : typeof user.groupName === 'string'
              ? user.groupName.split(',').map((s) => s.trim())
              : [];
            (available || []).forEach((g) => {
              const name = g.groupName || g.name;
              if (userGroupNames.includes(name)) {
                ids.add(Number(g.groupId ?? g.id));
              }
            });
          }

          setSelectedIds(ids);
        } catch (err) {
          console.warn('Could not load assigned user groups:', err);
          // If error, check if user object already has group info
          if (Array.isArray(user.groupIds)) {
            setSelectedIds(new Set(user.groupIds.map(Number)));
          }
        }
      } catch (err) {
        console.error('Failed to load groups data:', err);
        toast.error(getApiErrorMessage(err, 'Failed to load groups'));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [open, user]);

  if (!open || !user) return null;

  const toggleGroup = (groupId) => {
    const id = Number(groupId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredGroups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGroups.map((g) => Number(g.groupId ?? g.id))));
    }
  };

  const handleSave = async () => {
    const groupIds = Array.from(selectedIds);
    if (groupIds.length === 0) {
      toast.error('Please select at least one group to assign.');
      return;
    }

    setSaving(true);
    try {
      await userService.updateUserGroup({
        userId: user.userId || user.id,
        groupId: groupIds,
        GroupId: groupIds
      });

      toast.success(`Groups updated for ${user.username || user.userName || 'user'}`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save user groups:', err);
      toast.error(getApiErrorMessage(err, 'Failed to save groups'));
    } finally {
      setSaving(false);
    }
  };

  const filteredGroups = groups.filter((g) => {
    const name = String(g.groupName || g.name || '').toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Manage Groups</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Assign groups for <span className="font-medium text-gray-700 dark:text-gray-200">&ldquo;{displayName}&rdquo;</span>
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Search & Actions */}
        <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-[#0f1322] border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {filteredGroups.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors shrink-0"
            >
              {selectedIds.size === filteredGroups.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {/* Scrollable Group List */}
        <div className="p-4 space-y-2 overflow-y-auto flex-1 dark:bg-[#17132a]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-500 dark:text-gray-400">
              <span className="inline-block w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading groups...</span>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-xs">
              {searchTerm ? 'No groups match your search' : 'No groups available'}
            </div>
          ) : (
            filteredGroups.map((group) => {
              const id = Number(group.groupId ?? group.id);
              const name = group.groupName || group.name || `Group #${id}`;
              const isChecked = selectedIds.has(id);

              return (
                <div
                  key={id}
                  onClick={() => toggleGroup(id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-amber-50/70 border-amber-300 dark:bg-amber-950/20 dark:border-amber-600/40'
                      : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-gray-300 dark:border-white/20 bg-white dark:bg-white/5'
                      }`}
                    >
                      {isChecked && <Check size={12} className="stroke-[3]" />}
                    </div>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{name}</span>
                  </div>
                  {isChecked && (
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-900/40">
                      Assigned
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#1d1733] backdrop-blur sticky bottom-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <strong>{selectedIds.size}</strong> selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-gray-300 dark:border-white/15 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <LiquidGlassButton onClick={handleSave} disabled={saving} className="text-xs py-1.5 px-4">
              {saving ? 'Saving...' : 'Save Groups'}
            </LiquidGlassButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UserGroupsModal;
