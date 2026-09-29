import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Award, AlertCircle, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const BrandModal = ({ open, brand = null, onClose, onSuccess }) => {
  const isEditing = Boolean(brand && brand.brandId);

  const [formData, setFormData] = useState({
    brandName: '',
    brandDisplayName: '',
    tollfree: '',
    altTollFree: '',
    supportEmail: '',
    docRole: '',
    docAPIKey: '',
    docTemplateId: '',
    address: '',
    refundPolicyUrl: '',
    isDocAPILive: false,
    isActive: true,
    logoUrl: ''
  });

  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    if (brand) {
      setFormData({
        brandName: brand.brandName || '',
        brandDisplayName: brand.brandDisplayName || '',
        tollfree: brand.tollfree || '',
        altTollFree: brand.altTollFree || '',
        supportEmail: brand.supportEmail || '',
        docRole: brand.docRole || '',
        docAPIKey: brand.docAPIKey || '',
        docTemplateId: brand.docTemplateId || '',
        address: brand.address || '',
        refundPolicyUrl: brand.refundPolicyUrl || '',
        isDocAPILive: Boolean(brand.isDocAPILive),
        isActive: brand.isActive !== false,
        logoUrl: brand.logoUrl || ''
      });
      setLogoPreview(brand.logoUrl || '');
    } else {
      setFormData({
        brandName: '',
        brandDisplayName: '',
        tollfree: '',
        altTollFree: '',
        supportEmail: '',
        docRole: '',
        docAPIKey: '',
        docTemplateId: '',
        address: '',
        refundPolicyUrl: '',
        isDocAPILive: false,
        isActive: true,
        logoUrl: ''
      });
      setLogoPreview('');
    }
  }, [open, brand]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    setUploadingLogo(true);
    try {
      const url = await brandService.uploadLogo(file);
      setFormData((prev) => ({ ...prev, logoUrl: url }));
      setLogoPreview(url);
      toast.success('Logo loaded successfully');
    } catch (err) {
      console.error('Logo upload error:', err);
      toast.error('Failed to process logo image');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleClearLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
    setLogoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = formData.brandName.trim();
    if (!trimmedName) {
      setErrorMsg('Brand name is required.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await brandService.updateBrand({
          ...formData,
          brandId: brand.brandId,
          brandName: trimmedName
        });
        toast.success(`Brand "${trimmedName}" updated successfully`);
      } else {
        await brandService.createBrand({
          ...formData,
          brandId: 0,
          brandName: trimmedName
        });
        toast.success(`Brand "${trimmedName}" created successfully`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save brand:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save brand');
      setErrorMsg(apiMsg);
      toast.error(apiMsg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-white/10 my-8 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-[#1d1733] backdrop-blur z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Award size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Brand' : 'Add Brand'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditing ? 'Update brand identity, support contacts, and document signing.' : 'Register a new brand identity and configuration.'}
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5 dark:bg-[#17132a]">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Logo Upload & Preview */}
            <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-20 h-20 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative group">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Brand Logo"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <ImageIcon size={28} className="text-gray-300 dark:text-gray-600" />
                )}
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleClearLogo}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove logo"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-1.5 text-center sm:text-left">
                <span className="block text-xs font-semibold text-gray-800 dark:text-gray-200">
                  Brand Logo
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Upload a high-resolution logo image (PNG, JPG, WebP). Image is resized automatically to keep it compact.
                </span>
                <div className="pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                    id="brand-logo-file-input"
                  />
                  <label
                    htmlFor="brand-logo-file-input"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium cursor-pointer hover:bg-purple-500/20 transition-all"
                  >
                    <Upload size={13} />
                    <span>{uploadingLogo ? 'Processing...' : 'Upload Image'}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.brandName}
                  onChange={(e) => handleChange('brandName', e.target.value)}
                  placeholder="e.g. Amethyst CRM"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.brandDisplayName}
                  onChange={(e) => handleChange('brandDisplayName', e.target.value)}
                  placeholder="e.g. Amethyst Global"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Toll Free Number
                </label>
                <input
                  type="text"
                  value={formData.tollfree}
                  onChange={(e) => handleChange('tollfree', e.target.value)}
                  placeholder="e.g. +1 (800) 555-0199"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Alternate Toll Free
                </label>
                <input
                  type="text"
                  value={formData.altTollFree}
                  onChange={(e) => handleChange('altTollFree', e.target.value)}
                  placeholder="e.g. +1 (888) 555-0188"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Support Email
                </label>
                <input
                  type="email"
                  value={formData.supportEmail}
                  onChange={(e) => handleChange('supportEmail', e.target.value)}
                  placeholder="e.g. support@amethystcrm.com"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Refund Policy URL
                </label>
                <input
                  type="url"
                  value={formData.refundPolicyUrl}
                  onChange={(e) => handleChange('refundPolicyUrl', e.target.value)}
                  placeholder="https://example.com/refund-policy"
                  disabled={saving}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Physical / Mailing Address
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="e.g. 100 Innovation Way, Suite 400, New York, NY 10001"
                disabled={saving}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all resize-none"
              />
            </div>

            {/* Document Signing Configuration */}
            <div className="pt-2 border-t border-gray-100 dark:border-white/5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-3">
                Document Signing Integration (PandaDoc / SignAPI)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    Doc Role
                  </label>
                  <input
                    type="text"
                    value={formData.docRole}
                    onChange={(e) => handleChange('docRole', e.target.value)}
                    placeholder="e.g. Client"
                    disabled={saving}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    Doc API Key
                  </label>
                  <input
                    type="password"
                    value={formData.docAPIKey}
                    onChange={(e) => handleChange('docAPIKey', e.target.value)}
                    placeholder="API secret key"
                    disabled={saving}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    Doc Template ID
                  </label>
                  <input
                    type="text"
                    value={formData.docTemplateId}
                    onChange={(e) => handleChange('docTemplateId', e.target.value)}
                    placeholder="Template UUID"
                    disabled={saving}
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-2 border-t border-gray-100 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                    Doc API Live Mode
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.isDocAPILive ? 'Live production mode for document signatures' : 'Sandbox / Test mode'}
                  </span>
                </div>
                <IosToggle
                  checked={Boolean(formData.isDocAPILive)}
                  onCheckedChange={(next) => handleChange('isDocAPILive', next)}
                  disabled={saving}
                  title={formData.isDocAPILive ? 'Live Mode' : 'Test Mode'}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                    Brand Status
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.isActive ? 'Brand is active and visible across orders and tickets' : 'Brand is disabled'}
                  </span>
                </div>
                <IosToggle
                  checked={Boolean(formData.isActive)}
                  onCheckedChange={(next) => handleChange('isActive', next)}
                  disabled={saving}
                  title={formData.isActive ? 'Active' : 'Inactive'}
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] sticky bottom-0 z-10 shrink-0">
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
              {isEditing ? 'Save Changes' : 'Create Brand'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BrandModal;
