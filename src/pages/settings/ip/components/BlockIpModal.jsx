import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import blockIpService from '@/services/blockIpService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';

// IPv4 address validation regex specified by requirement
export const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const BlockIpModal = ({ open, record = null, onClose, onSuccess }) => {
  const isEditing = Boolean(record && record.id !== undefined && record.id !== null);

  const [ip, setIp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    if (record) {
      setIp(record.ip || record.ipAddress || record.blockedIp || '');
    } else {
      setIp('');
    }
  }, [open, record]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedIp = ip.trim();

    if (!trimmedIp) {
      setErrorMsg('IP address is required.');
      return;
    }

    if (!IPV4_REGEX.test(trimmedIp)) {
      setErrorMsg('Please enter a valid IPv4 address (e.g. 192.168.1.1).');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await blockIpService.updateBlockedIp({
          id: record.id,
          ip: trimmedIp
        });
        toast.success(`Blocked IP "${trimmedIp}" updated successfully`);
      } else {
        await blockIpService.createBlockedIp({
          id: 0,
          ip: trimmedIp
        });
        toast.success(`IP "${trimmedIp}" added to blocklist`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save blocked IP:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save blocked IP address');
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
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Blocked IP' : 'Block New IP'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditing
                  ? 'Update the blocked IPv4 address.'
                  : 'Add an IPv4 address to the blocklist.'}
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
                IPv4 Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={ip}
                onChange={(e) => {
                  setIp(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. 192.168.1.100"
                autoFocus
                className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3.5 py-2.5 text-sm font-mono text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
              />
              <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                Only valid IPv4 format (e.g. 0.0.0.0 to 255.255.255.255) is allowed.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#1d1733] backdrop-blur sticky bottom-0">
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
                isEditing ? 'Updating...' : 'Blocking...'
              ) : isEditing ? (
                'Update IP'
              ) : (
                'Block IP'
              )}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BlockIpModal;
