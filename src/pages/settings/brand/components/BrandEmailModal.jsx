import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const BrandEmailModal = ({
  open,
  isOpen,
  brands = [],
  initialBrandId = 0,
  brand = null,
  brandId: parentBrandId = 0,
  emailRecord = null,
  brandEmail = null,
  canAdd = true,
  canUpdate = true,
  onClose,
  onSuccess,
  onSaved
}) => {
  const visible = open ?? isOpen ?? false;
  const record = emailRecord || brandEmail;
  const isEditing = Boolean(record?.brandEmailId);

  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [sslEnable, setSslEnable] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState(0);

  const brandOptions = brands.length
    ? brands
    : brand?.brandId
      ? [{ id: brand.brandId, name: brand.brandName }]
      : parentBrandId
        ? [{ id: parentBrandId, name: record?.brandName || `Brand #${parentBrandId}` }]
        : [];
  const selectedBrand = brandOptions.find((item) => Number(item.id ?? item.brandId) === Number(selectedBrandId));
  const brandName = selectedBrand?.name || selectedBrand?.brandName || record?.brandName || '';

  useEffect(() => {
    if (!visible) return;
    setErrorMsg('');
    setShowPassword(false);
    setSelectedBrandId(Number(record?.brandId || initialBrandId || brand?.brandId || parentBrandId || 0));

    if (record) {
      setEmail(record.email || '');
      setUserName(record.userName || '');
      setHost(record.host || '');
      setPort(record.port || 587);
      setSslEnable(Boolean(record.sslEnable));
      setPassword(''); // Never prefill existing password
      setIsActive(record.isActive !== false);
    } else {
      setEmail('');
      setUserName('');
      setHost('smtp.gmail.com');
      setPort(587);
      setSslEnable(true);
      setPassword('');
      setIsActive(true);
    }
  }, [visible, record, initialBrandId, brand?.brandId, parentBrandId]);

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if ((isEditing && !canUpdate) || (!isEditing && !canAdd)) {
      const message = `You do not have permission to ${isEditing ? 'update' : 'create'} brand emails.`;
      setErrorMsg(message);
      toast.error(message);
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedUserName = userName.trim();
    const trimmedHost = host.trim();
    const numericPort = Number(port);
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!selectedBrandId) {
      setErrorMsg('Please select a brand.');
      toast.error('Please select a brand.');
      return;
    }
    if (!emailIsValid) {
      setErrorMsg('Please enter a valid email address.');
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!trimmedUserName || !trimmedHost) {
      setErrorMsg('User name and SMTP host are required.');
      toast.error('User name and SMTP host are required.');
      return;
    }
    if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
      setErrorMsg('Port must be a number between 1 and 65535.');
      toast.error('Port must be a number between 1 and 65535.');
      return;
    }
    if (!isEditing && !password.trim()) {
      setErrorMsg('Password is required when creating a brand email.');
      toast.error('Password is required when creating a brand email.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        brandEmailId: isEditing ? record.brandEmailId : 0,
        brandId: Number(selectedBrandId),
        brandName,
        email: trimmedEmail,
        userName: trimmedUserName,
        host: trimmedHost,
        port: numericPort,
        sslEnable,
        isActive
      };

      // Only send password if user intentionally entered one
      if (password && password.trim()) {
        payload.password = password.trim();
      }

      if (isEditing) {
        await brandService.updateBrandEmail(payload);
        toast.success(`Brand email "${trimmedEmail}" updated successfully`);
      } else {
        await brandService.createBrandEmail(payload);
        toast.success(`Brand email "${trimmedEmail}" added successfully`);
      }

      onSuccess?.();
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save brand email:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save brand email');
      setErrorMsg(apiMsg);
      toast.error(apiMsg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="brand-email-modal-title" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}>
      <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Mail size={18} />
            </div>
            <div>
              <h3 id="brand-email-modal-title" className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Brand Email' : 'Add Brand Email'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Brand: <strong className="text-gray-700 dark:text-gray-200">{brandName}</strong>
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Form Body */}
        <form id="brand-email-form" onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 space-y-4 dark:bg-[#17132a] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="brand-email-brand" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Brand <span className="text-red-500">*</span>
              </label>
              <select
                id="brand-email-brand"
                value={selectedBrandId || ''}
                onChange={(e) => setSelectedBrandId(Number(e.target.value || 0))}
                disabled={saving}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
              >
                <option value="">Select a brand</option>
                {brandOptions.map((item) => {
                  const id = Number(item.id ?? item.brandId);
                  return <option key={id} value={id}>{item.name || item.brandName || `Brand #${id}`}</option>;
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Sender Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="noreply@brand.com"
                disabled={saving}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                User Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="SMTP username (defaults to email)"
                disabled={saving}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  SMTP Host <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.example.com"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Port <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="587"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all font-mono"
                />
              </div>
            </div>

            {/* Password with Visibility Toggle */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                {isEditing ? 'New Password (leave blank to keep current)' : <>Password <span className="text-red-500">*</span></>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEditing ? '••••••••' : 'Enter email password or app password'}
                  disabled={saving}
                  required={!isEditing}
                  autoComplete="new-password"
                  className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* SSL & Active Toggles */}
            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                    Enable SSL / TLS
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Secure encrypted connection
                  </span>
                </div>
                <IosToggle
                  checked={Boolean(sslEnable)}
                  onCheckedChange={(next) => setSslEnable(next)}
                  disabled={saving}
                  title={sslEnable ? 'SSL Enabled' : 'SSL Disabled'}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                    Active Status
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Allow sending emails from this address
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
              {saving ? 'Saving...' : isEditing ? 'Update Brand Email' : 'Create Brand Email'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BrandEmailModal;
