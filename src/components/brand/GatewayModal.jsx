import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Server, AlertCircle, Eye, EyeOff, Key, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const GATEWAY_TYPES = [
  { value: 0, label: 'Unknown' },
  { value: 1, label: 'Authorize.Net' },
  { value: 2, label: 'NMI' },
  { value: 3, label: 'Nuvei' }
];

const GatewayModal = ({
  open,
  brand = null,
  gateway = null,
  onClose,
  onSuccess
}) => {
  const isEditing = Boolean(gateway && gateway.gatewayId);

  const [gatewayName, setGatewayName] = useState('');
  const [gatewayType, setGatewayType] = useState(1);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [isSandbox, setIsSandbox] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Credentials editing state
  const [changeCredentials, setChangeCredentials] = useState(false);
  const [apiLoginId, setApiLoginId] = useState('');
  const [apiSecretKey, setApiSecretKey] = useState('');
  const [merchantSiteId, setMerchantSiteId] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const brandId = Number(brand?.brandId || gateway?.brandId);
  const brandName = brand?.brandName || gateway?.brandName || `Brand #${brandId}`;

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    setShowSecretKey(false);

    if (gateway) {
      setGatewayName(gateway.gatewayName || '');
      setGatewayType(Number(gateway.gatewayType ?? 1));
      setApiBaseUrl(gateway.apiBaseUrl || '');
      setIsSandbox(Boolean(gateway.isSandbox));
      setIsActive(gateway.isActive !== false);

      // Reset credentials fields
      setChangeCredentials(false);
      setApiLoginId('');
      setApiSecretKey('');
      setMerchantSiteId('');
    } else {
      setGatewayName('');
      setGatewayType(1);
      setApiBaseUrl('');
      setIsSandbox(false);
      setIsActive(true);

      // Require credentials on create
      setChangeCredentials(true);
      setApiLoginId('');
      setApiSecretKey('');
      setMerchantSiteId('');
    }
  }, [open, gateway]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = gatewayName.trim();
    if (!trimmedName) {
      setErrorMsg('Gateway name is required.');
      return;
    }
    if (!brandId) {
      setErrorMsg('Parent brand is missing.');
      return;
    }

    if (changeCredentials) {
      if (!apiLoginId.trim()) {
        setErrorMsg('API Login ID is required when updating credentials.');
        return;
      }
      if (!apiSecretKey.trim()) {
        setErrorMsg('API Secret Key is required when updating credentials.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        gatewayId: isEditing ? gateway.gatewayId : 0,
        gatewayName: trimmedName,
        brandId,
        brandName,
        gatewayType: Number(gatewayType),
        apiBaseUrl: apiBaseUrl.trim() ? apiBaseUrl.trim() : null, // send null instead of empty string
        isSandbox,
        isActive,
        lastSyncedAtUtc: gateway?.lastSyncedAtUtc || null,
        hasCredentials: gateway?.hasCredentials || changeCredentials,
        changeCredentials
      };

      if (changeCredentials) {
        payload.apiLoginId = apiLoginId.trim();
        payload.apiSecretKey = apiSecretKey.trim();
        if (merchantSiteId.trim()) {
          payload.merchantSiteId = merchantSiteId.trim();
        }
      }

      if (isEditing) {
        await brandService.updateGateway(payload);
        toast.success(`Gateway "${trimmedName}" updated successfully`);
      } else {
        await brandService.createGateway(payload);
        toast.success(`Gateway "${trimmedName}" created successfully`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save gateway:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save gateway');
      setErrorMsg(apiMsg);
      toast.error(apiMsg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200 dark:border-white/10 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Server size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Gateway' : 'Add Gateway'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Brand: <strong className="text-gray-700 dark:text-gray-200">{brandName}</strong>
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
                Gateway Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={gatewayName}
                onChange={(e) => setGatewayName(e.target.value)}
                placeholder="e.g. Authorize.Net Primary or NMI USD"
                disabled={saving}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Gateway Type
                </label>
                <select
                  value={gatewayType}
                  onChange={(e) => setGatewayType(Number(e.target.value))}
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1d1733] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                >
                  {GATEWAY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Environment
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="env"
                      checked={!isSandbox}
                      onChange={() => setIsSandbox(false)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>Production</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      name="env"
                      checked={isSandbox}
                      onChange={() => setIsSandbox(true)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>Sandbox</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Custom API Base URL (optional)
              </label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="Leave blank for standard gateway endpoint"
                disabled={saving}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all font-mono text-xs"
              />
            </div>

            {/* Read-only Sync info if exists */}
            {isEditing && gateway.lastSyncedAtUtc && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400">
                <Clock size={14} className="text-gray-400" />
                <span>Last Synced: {new Date(gateway.lastSyncedAtUtc).toLocaleString()}</span>
              </div>
            )}

            {/* Credentials Section */}
            <div className="pt-2 border-t border-gray-100 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    API Credentials
                  </span>
                  {isEditing && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      {gateway.hasCredentials ? (
                        <>
                          <ShieldCheck size={13} className="text-green-500" />
                          <span>Credentials Configured</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={13} className="text-amber-500" />
                          <span>No Credentials Set</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                {isEditing && (
                  <button
                    type="button"
                    onClick={() => setChangeCredentials(!changeCredentials)}
                    className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    {changeCredentials ? 'Cancel credential change' : 'Update Credentials'}
                  </button>
                )}
              </div>

              {changeCredentials && (
                <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/30 space-y-3 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                      API Login ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={apiLoginId}
                      onChange={(e) => setApiLoginId(e.target.value)}
                      placeholder="e.g. 5xG78yK..."
                      disabled={saving}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                      API Secret Key <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showSecretKey ? 'text' : 'password'}
                        value={apiSecretKey}
                        onChange={(e) => setApiSecretKey(e.target.value)}
                        placeholder="Transaction secret key"
                        disabled={saving}
                        className="w-full pl-3 pr-9 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        tabIndex={-1}
                      >
                        {showSecretKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                      Merchant Site ID (Nuvei / optional)
                    </label>
                    <input
                      type="text"
                      value={merchantSiteId}
                      onChange={(e) => setMerchantSiteId(e.target.value)}
                      placeholder="e.g. 123456"
                      disabled={saving}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17132a] text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
              <div>
                <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Active Status
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Allow processing payments through this gateway
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
              {isEditing ? 'Save Changes' : 'Create Gateway'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default GatewayModal;
