import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';

const BrandTemplateModal = ({
  open,
  brand = null,
  template = null,
  onClose,
  onSuccess
}) => {
  const isEditing = Boolean(template && template.brandEmailTemplateId);

  const [templateName, setTemplateName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [saleTypeId, setSaleTypeId] = useState(1);
  const [fromEmailId, setFromEmailId] = useState('');
  const [subject, setSubject] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Options
  const [masterTemplates, setMasterTemplates] = useState([]);
  const [brandEmails, setBrandEmails] = useState([]);
  const [saleTypes, setSaleTypes] = useState([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const brandId = Number(brand?.brandId || template?.brandId);
  const brandName = brand?.brandName || template?.brandName || `Brand #${brandId}`;

  useEffect(() => {
    if (!open || !brandId) return;
    setErrorMsg('');
    setLoadingRefs(true);

    const loadReferences = async () => {
      try {
        const [templates, emailsRes, sales] = await Promise.all([
          brandService.getMasterTemplates(),
          brandService.getBrandEmails({ BrandId: brandId, PageSize: 500 }),
          brandService.getSaleTypes()
        ]);

        setMasterTemplates(templates);
        setBrandEmails(emailsRes.data || []);
        setSaleTypes(sales);

        if (template) {
          setTemplateName(template.templateName || '');
          setTemplateId(template.templateId ? String(template.templateId) : '');
          setSaleTypeId(template.saleTypeId || 1);
          setFromEmailId(template.fromEmailId ? String(template.fromEmailId) : '');
          setSubject(template.subject || '');
          setCcEmail(template.ccEmail || '');
          setBccEmail(template.bccEmail || '');
          setIsActive(template.isActive !== false);
        } else {
          setTemplateName('');
          setTemplateId(templates[0]?.templateId ? String(templates[0].templateId) : '');
          setSaleTypeId(sales[0]?.saleTypeId || 1);
          setFromEmailId(emailsRes.data?.[0]?.brandEmailId ? String(emailsRes.data[0].brandEmailId) : '');
          setSubject('');
          setCcEmail('');
          setBccEmail('');
          setIsActive(true);
        }
      } catch (err) {
        console.error('Failed to load template reference data:', err);
      } finally {
        setLoadingRefs(false);
      }
    };

    loadReferences();
  }, [open, brandId, template]);

  // When master template changes, if subject/name is blank, prefill from master template
  const handleMasterTemplateSelect = (selectedId) => {
    setTemplateId(selectedId);
    const found = masterTemplates.find((t) => String(t.templateId) === String(selectedId));
    if (found) {
      if (!templateName.trim()) setTemplateName(found.templateName);
      if (!subject.trim()) setSubject(found.subject || found.templateName);
    }
  };

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = templateName.trim();
    if (!trimmedName) {
      setErrorMsg('Template name is required.');
      return;
    }
    if (!templateId) {
      setErrorMsg('Master template selection is required.');
      return;
    }
    if (!fromEmailId) {
      setErrorMsg('From sender email selection is required.');
      return;
    }
    if (!brandId) {
      setErrorMsg('Parent brand is missing.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        brandEmailTemplateId: isEditing ? template.brandEmailTemplateId : 0,
        templateName: trimmedName,
        templateId: Number(templateId),
        saleTypeId: Number(saleTypeId) || 0,
        brandId,
        fromEmailId: Number(fromEmailId),
        ccEmail: ccEmail.trim(),
        bccEmail: bccEmail.trim(),
        subject: subject.trim(),
        isActive
      };

      if (isEditing) {
        await brandService.updateBrandEmailTemplate(payload);
        toast.success(`Template "${trimmedName}" updated successfully`);
      } else {
        await brandService.createBrandEmailTemplate(payload);
        toast.success(`Template "${trimmedName}" created successfully`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save email template:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save email template');
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
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Email Template' : 'Add Email Template'}
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

            {loadingRefs ? (
              <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Loader2 size={24} className="animate-spin text-purple-600" />
                <span className="text-xs">Loading reference templates & sender emails...</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      Master Template <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={templateId}
                      onChange={(e) => handleMasterTemplateSelect(e.target.value)}
                      disabled={saving}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1d1733] text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                      <option value="">Select Master Template</option>
                      {masterTemplates.map((t) => (
                        <option key={t.templateId} value={t.templateId}>
                          {t.templateName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      From Email (Sender) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={fromEmailId}
                      onChange={(e) => setFromEmailId(e.target.value)}
                      disabled={saving}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1d1733] text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                      <option value="">Select Brand Email</option>
                      {brandEmails.map((e) => (
                        <option key={e.brandEmailId} value={e.brandEmailId}>
                          {e.email} ({e.userName || 'Default'})
                        </option>
                      ))}
                    </select>
                    {brandEmails.length === 0 && (
                      <span className="text-[11px] text-amber-500 mt-1 block">
                        No brand emails configured yet. Please configure one in the Email tab first.
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. Order Confirmation"
                      disabled={saving}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      Sale Type
                    </label>
                    <select
                      value={saleTypeId}
                      onChange={(e) => setSaleTypeId(Number(e.target.value))}
                      disabled={saving}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#1d1733] text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                      {saleTypes.map((s) => (
                        <option key={s.saleTypeId} value={s.saleTypeId}>
                          {s.saleTypeName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Your Order with {{BrandName}} is Confirmed!"
                    disabled={saving}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      CC Recipients
                    </label>
                    <input
                      type="text"
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      placeholder="finance@brand.com"
                      disabled={saving}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                      BCC Recipients
                    </label>
                    <input
                      type="text"
                      value={bccEmail}
                      onChange={(e) => setBccEmail(e.target.value)}
                      placeholder="archive@brand.com"
                      disabled={saving}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
                  <div>
                    <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                      Active Status
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Send this email template automatically when events trigger
                    </span>
                  </div>
                  <IosToggle
                    checked={Boolean(isActive)}
                    onCheckedChange={(next) => setIsActive(next)}
                    disabled={saving}
                    title={isActive ? 'Active' : 'Inactive'}
                  />
                </div>
              </>
            )}
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
              disabled={loadingRefs}
            >
              {isEditing ? 'Save Changes' : 'Create Template'}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default BrandTemplateModal;
