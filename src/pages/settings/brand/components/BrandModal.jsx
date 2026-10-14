import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Award,
  AlertCircle,
  Upload,
  X,
  Image as ImageIcon,
  Building2,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  KeyRound,
  FileCheck2,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  Globe,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const TABS = [
  { id: 'general', label: 'General Info', icon: Building2 },
  { id: 'contact', label: 'Contact & Policy', icon: Phone },
  { id: 'docs', label: 'Doc Signing (API)', icon: FileCheck2 }
];

const BrandModal = ({ open, brand = null, onClose, onSuccess }) => {
  const isEditing = Boolean(brand && (brand.brandId || brand.id));

  const [activeTab, setActiveTab] = useState('general');
  const [showApiKey, setShowApiKey] = useState(false);
  const [logoInputMode, setLogoInputMode] = useState('upload'); // 'upload' | 'url'

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
  const brandNameInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    setActiveTab('general');
    setShowApiKey(false);

    if (brand) {
      const initialLogo = brand.logoUrl || brand.logo || '';
      setFormData({
        brandName: brand.brandName || brand.name || '',
        brandDisplayName: brand.brandDisplayName || brand.displayName || '',
        tollfree: brand.tollfree || brand.tollFree || '',
        altTollFree: brand.altTollFree || brand.altTollfree || '',
        supportEmail: brand.supportEmail || '',
        docRole: brand.docRole || '',
        docAPIKey: brand.docAPIKey || brand.docApiKey || '',
        docTemplateId: brand.docTemplateId || '',
        address: brand.address || '',
        refundPolicyUrl: brand.refundPolicyUrl || '',
        isDocAPILive: Boolean(brand.isDocAPILive ?? brand.isDocApiLive),
        isActive: brand.isActive !== false,
        logoUrl: initialLogo
      });
      setLogoPreview(initialLogo);
      if (initialLogo && initialLogo.startsWith('http')) {
        setLogoInputMode('url');
      } else {
        setLogoInputMode('upload');
      }
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
      setLogoInputMode('upload');
    }
  }, [open, brand]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'brandName' && errorMsg) {
      setErrorMsg('');
    }
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
      toast.success('Logo uploaded successfully');
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

  const handleUrlLogoChange = (url) => {
    setFormData((prev) => ({ ...prev, logoUrl: url }));
    setLogoPreview(url.trim());
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (saving || uploadingLogo) return;
    setErrorMsg('');

    const trimmedName = formData.brandName.trim();
    if (!trimmedName) {
      setActiveTab('general');
      setErrorMsg('Brand name is required.');
      toast.error('Please enter a Brand Name');
      setTimeout(() => brandNameInputRef.current?.focus(), 50);
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await brandService.updateBrand({
          ...formData,
          brandId: brand.brandId || brand.id,
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

  const handleNextTab = () => {
    if (activeTab === 'general') {
      if (!formData.brandName.trim()) {
        setErrorMsg('Brand name is required before proceeding.');
        brandNameInputRef.current?.focus();
        return;
      }
      setActiveTab('contact');
    } else if (activeTab === 'contact') {
      setActiveTab('docs');
    }
  };

  const handlePrevTab = () => {
    if (activeTab === 'docs') setActiveTab('contact');
    else if (activeTab === 'contact') setActiveTab('general');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white dark:bg-[#17132a] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border border-gray-200 dark:border-white/10 max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ========================================================= */}
        {/* Header (shrink-0)                                         */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#1d1733] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-xs">
              <Award size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Brand' : 'Add Brand'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditing
                  ? 'Update brand identity, support contacts, and document signing.'
                  : 'Register a new brand identity and configure its properties.'}
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* ========================================================= */}
        {/* Segmented Tab Navigation Bar (shrink-0)                   */}
        {/* ========================================================= */}
        <div className="px-6 pt-3 pb-0 bg-gray-50/80 dark:bg-[#141026] border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-3">
            {TABS.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all select-none shrink-0 ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'} />
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* Form Body (Scrollable flex-1 min-h-0)                     */}
        {/* ========================================================= */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-5 dark:bg-[#17132a]">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* TAB 1: GENERAL INFO                                   */}
            {/* ----------------------------------------------------- */}
            {activeTab === 'general' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Brand Logo Upload & Preview Card */}
                <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200/80 dark:border-white/10">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Logo Preview Square */}
                    <div className="w-20 h-20 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative group">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Brand Logo"
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        style={{ display: logoPreview ? 'none' : 'flex' }}
                        className="text-gray-300 dark:text-gray-600 items-center justify-center w-full h-full flex-col gap-1"
                      >
                        <ImageIcon size={26} />
                      </div>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={handleClearLogo}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="Remove logo"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Logo Controls */}
                    <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                      <div className="flex items-center justify-between">
                        <span className="block text-xs font-semibold text-gray-800 dark:text-gray-200">
                          Brand Logo
                        </span>
                        <div className="inline-flex rounded-lg p-0.5 bg-gray-200/60 dark:bg-white/10 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setLogoInputMode('upload')}
                            className={`px-2 py-0.5 rounded-md transition-colors ${
                              logoInputMode === 'upload'
                                ? 'bg-white dark:bg-[#1d1733] font-medium text-purple-600 dark:text-purple-400 shadow-2xs'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            Upload File
                          </button>
                          <button
                            type="button"
                            onClick={() => setLogoInputMode('url')}
                            className={`px-2 py-0.5 rounded-md transition-colors ${
                              logoInputMode === 'url'
                                ? 'bg-white dark:bg-[#1d1733] font-medium text-purple-600 dark:text-purple-400 shadow-2xs'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            Direct URL
                          </button>
                        </div>
                      </div>

                      {logoInputMode === 'upload' ? (
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
                            <span>{uploadingLogo ? 'Processing Image...' : 'Choose Image File'}</span>
                          </label>
                          <span className="block text-[11px] text-gray-400 mt-1">
                            PNG, JPG, SVG, WebP. Resized automatically.
                          </span>
                        </div>
                      ) : (
                        <div className="pt-1">
                          <input
                            type="url"
                            value={formData.logoUrl}
                            onChange={(e) => handleUrlLogoChange(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            disabled={saving}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      Brand Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={brandNameInputRef}
                      type="text"
                      required
                      value={formData.brandName}
                      onChange={(e) => handleChange('brandName', e.target.value)}
                      placeholder="e.g. DashboardKit CRM"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                      autoFocus
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Unique corporate brand identifier.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.brandDisplayName}
                      onChange={(e) => handleChange('brandDisplayName', e.target.value)}
                      placeholder="e.g. DashboardKit Global"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Friendly public name shown to customers.</p>
                  </div>
                </div>

                {/* Brand Active Status Toggle */}
                <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        Brand Active Status
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          formData.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20'
                        }`}
                      >
                        {formData.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      Active brands are available across orders, leads, and customer transactions.
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
            )}

            {/* ----------------------------------------------------- */}
            {/* TAB 2: CONTACT & POLICY                               */}
            {/* ----------------------------------------------------- */}
            {activeTab === 'contact' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Toll Free */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                      <Phone size={13} className="text-purple-600 dark:text-purple-400" />
                      <span>Toll Free Number</span>
                    </label>
                    <input
                      type="text"
                      value={formData.tollfree}
                      onChange={(e) => handleChange('tollfree', e.target.value)}
                      placeholder="e.g. +1 (800) 555-0199"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                    />
                  </div>

                  {/* Alternate Toll Free */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                      <Phone size={13} className="text-gray-400" />
                      <span>Alternate Toll Free</span>
                    </label>
                    <input
                      type="text"
                      value={formData.altTollFree}
                      onChange={(e) => handleChange('altTollFree', e.target.value)}
                      placeholder="e.g. +1 (888) 555-0188"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                    />
                  </div>

                  {/* Support Email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                      <Mail size={13} className="text-purple-600 dark:text-purple-400" />
                      <span>Support Email</span>
                    </label>
                    <input
                      type="email"
                      value={formData.supportEmail}
                      onChange={(e) => handleChange('supportEmail', e.target.value)}
                      placeholder="e.g. support@dashboardkit.io"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                    />
                  </div>

                  {/* Refund Policy URL */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                      <ExternalLink size={13} className="text-gray-400" />
                      <span>Refund Policy URL</span>
                    </label>
                    <input
                      type="url"
                      value={formData.refundPolicyUrl}
                      onChange={(e) => handleChange('refundPolicyUrl', e.target.value)}
                      placeholder="https://example.com/refund-policy"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                {/* Physical / Mailing Address */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                    <MapPin size={13} className="text-purple-600 dark:text-purple-400" />
                    <span>Physical / Mailing Address</span>
                  </label>
                  <textarea
                    rows={3}
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="e.g. 100 Innovation Way, Suite 400, New York, NY 10001"
                    disabled={saving}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all resize-none"
                  />
                </div>
              </div>
            )}

            {/* ----------------------------------------------------- */}
            {/* TAB 3: DOCUMENT SIGNING (PANDADOC / SIGNARI)           */}
            {/* ----------------------------------------------------- */}
            {activeTab === 'docs' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Integration Info Banner */}
                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
                  <ShieldCheck size={18} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Electronic Document Signing</span>
                    <span className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                      Connect your document signing credentials (such as PandaDoc or SignAPI) to generate and send legally binding e-signature proposals to clients.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Doc Role */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      Doc Role
                    </label>
                    <input
                      type="text"
                      value={formData.docRole}
                      onChange={(e) => handleChange('docRole', e.target.value)}
                      placeholder="e.g. Client, Signer, Customer"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Role name configured in your signing template.</p>
                  </div>

                  {/* Doc Template ID */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      Doc Template ID
                    </label>
                    <input
                      type="text"
                      value={formData.docTemplateId}
                      onChange={(e) => handleChange('docTemplateId', e.target.value)}
                      placeholder="e.g. d290f1ee-6c54-4b01-90e6-d701748f0851"
                      disabled={saving}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all font-mono text-xs"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">External template UUID or ID from PandaDoc.</p>
                  </div>
                </div>

                {/* Doc API Key */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <KeyRound size={13} className="text-purple-600 dark:text-purple-400" />
                      <span>Doc API Secret Key</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      {showApiKey ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{showApiKey ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.docAPIKey}
                      onChange={(e) => handleChange('docAPIKey', e.target.value)}
                      placeholder="Paste your API secret key here..."
                      disabled={saving}
                      className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all font-mono text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    API authorization bearer token used for sending document signing requests.
                  </p>
                </div>

                {/* Doc API Mode Toggle */}
                <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        Doc API Environment
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          formData.isDocAPILive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {formData.isDocAPILive ? 'Live Production' : 'Sandbox / Test'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      {formData.isDocAPILive
                        ? 'Requests will be sent to the live production signing endpoint.'
                        : 'Requests will be simulated in sandbox mode without sending real documents.'}
                    </span>
                  </div>
                  <IosToggle
                    checked={Boolean(formData.isDocAPILive)}
                    onCheckedChange={(next) => handleChange('isDocAPILive', next)}
                    disabled={saving}
                    title={formData.isDocAPILive ? 'Live Mode' : 'Sandbox Mode'}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* Solid Fixed Footer (shrink-0)                             */}
          {/* ========================================================= */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#1d1733] shrink-0 flex items-center justify-between gap-3">
            {/* Left Action */}
            <div>
              {activeTab === 'general' ? (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl border border-gray-300 dark:border-white/15 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePrevTab}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl border border-gray-300 dark:border-white/15 transition-colors disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                  <span>Back</span>
                </button>
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {activeTab !== 'docs' && (
                <button
                  type="button"
                  onClick={handleNextTab}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 rounded-xl border border-purple-200 dark:border-purple-800/40 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              )}

              <button
                type="submit"
                disabled={saving || uploadingLogo}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                <span>
                  {saving
                    ? isEditing
                      ? 'Saving Changes...'
                      : 'Creating Brand...'
                    : isEditing
                    ? 'Save Changes'
                    : 'Create Brand'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BrandModal;
