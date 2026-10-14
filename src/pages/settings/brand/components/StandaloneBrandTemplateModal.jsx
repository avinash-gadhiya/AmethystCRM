import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import brandTemplateService from '@/services/brandTemplateService';
import { getApiErrorMessage } from '@/lib/apiError';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';

const EMPTY_FORM = {
  brandEmailTemplateId: 0,
  templateId: 0,
  saleTypeId: 0,
  brandId: 0,
  brandName: '',
  fromEmailId: 0,
  fromEmail: '',
  ccEmail: '',
  bccEmail: '',
  templateName: '',
  subject: '',
  isActive: true
};

const StandaloneBrandTemplateModal = ({
  open,
  template = null,
  brands = [],
  initialBrandId = 0,
  canAdd = false,
  canUpdate = false,
  onClose,
  onSuccess
}) => {
  const isEditing = Boolean(template?.brandEmailTemplateId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [masterTemplates, setMasterTemplates] = useState([]);
  const [saleTypes, setSaleTypes] = useState([]);
  const [brandEmails, setBrandEmails] = useState([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const emailRequestRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const startingBrandId = Number(template?.brandId || initialBrandId) || 0;
    const selectedBrand = brands.find((brand) => Number(brand.brandId) === startingBrandId);
    setForm({
      ...EMPTY_FORM,
      ...(template || {}),
      brandEmailTemplateId: Number(template?.brandEmailTemplateId) || 0,
      templateId: Number(template?.templateId) || 0,
      saleTypeId: Number(template?.saleTypeId) || 0,
      brandId: startingBrandId,
      brandName: template?.brandName || selectedBrand?.brandName || '',
      fromEmailId: Number(template?.fromEmailId) || 0,
      fromEmail: template?.fromEmail || '',
      ccEmail: template?.ccEmail || '',
      bccEmail: template?.bccEmail || '',
      templateName: template?.templateName || '',
      subject: template?.subject || '',
      isActive: template?.isActive !== false
    });
    setErrorMessage('');
  }, [initialBrandId, open, template]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoadingReferences(true);
    Promise.all([brandTemplateService.getMasterTemplates(), brandTemplateService.getSaleTypes()])
      .then(([templates, types]) => {
        if (!active) return;
        setMasterTemplates(templates);
        setSaleTypes(types);
      })
      .catch((error) => {
        if (active) toast.error(getApiErrorMessage(error, 'Failed to load template reference data.'));
      })
      .finally(() => {
        if (active) setLoadingReferences(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const brandId = Number(form.brandId);
    const requestId = ++emailRequestRef.current;
    if (!brandId) {
      setBrandEmails([]);
      setLoadingEmails(false);
      return undefined;
    }

    setLoadingEmails(true);
    brandTemplateService
      .getBrandEmails(brandId)
      .then((emails) => {
        if (requestId === emailRequestRef.current) setBrandEmails(emails);
      })
      .catch((error) => {
        if (requestId === emailRequestRef.current) {
          setBrandEmails([]);
          toast.error(getApiErrorMessage(error, 'Failed to load Brand Emails.'));
        }
      })
      .finally(() => {
        if (requestId === emailRequestRef.current) setLoadingEmails(false);
      });
    return () => {
      emailRequestRef.current += 1;
    };
  }, [form.brandId, open]);

  if (!open) return null;

  const showValidation = (message) => {
    setErrorMessage(message);
    toast.error(message);
  };

  const handleBrandChange = (value) => {
    const brandId = Number(value) || 0;
    const selectedBrand = brands.find((brand) => Number(brand.brandId) === brandId);
    setForm((current) => ({
      ...current,
      brandId,
      brandName: selectedBrand?.brandName || '',
      fromEmailId: 0,
      fromEmail: ''
    }));
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isEditing && !canUpdate) return showValidation('You do not have permission to update templates.');
    if (!isEditing && !canAdd) return showValidation('You do not have permission to create templates.');
    if (!Number(form.brandId)) return showValidation('Please select a brand');
    if (!Number(form.fromEmailId)) return showValidation('Please select From Email');
    if (!Number(form.templateId)) return showValidation('Please select Template ID');
    if (!form.templateName.trim()) return showValidation('Please enter Template Name');
    if (!form.subject.trim()) return showValidation('Please enter Subject');

    try {
      setSaving(true);
      setErrorMessage('');
      const payload = {
        ...form,
        brandEmailTemplateId: isEditing ? Number(form.brandEmailTemplateId) : 0,
        templateId: Number(form.templateId),
        saleTypeId: Number(form.saleTypeId) || 0,
        brandId: Number(form.brandId),
        fromEmailId: Number(form.fromEmailId),
        templateName: form.templateName.trim(),
        subject: form.subject.trim(),
        ccEmail: form.ccEmail.trim(),
        bccEmail: form.bccEmail.trim(),
        isActive: Boolean(form.isActive)
      };

      if (isEditing) {
        await brandTemplateService.updateBrandTemplate(payload);
        toast.success('Template updated successfully');
      } else {
        await brandTemplateService.createBrandTemplate(payload);
        toast.success('Template created successfully');
      }
      onClose?.();
      await onSuccess?.();
    } catch (error) {
      const message = getApiErrorMessage(error, `Failed to ${isEditing ? 'update' : 'create'} template.`);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const controlClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#0f1322] text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-template-modal-title"
    >
      <div className="relative w-full max-w-3xl max-h-[95vh] bg-white dark:bg-[#17132a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/50 dark:border-purple-800/30">
              <FileText size={20} />
            </div>
            <div>
              <h2 id="brand-template-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Template' : 'Add Template'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Configure a brand email template</p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        <form id="standalone-brand-template-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Brand <span className="text-red-500">*</span>
              </label>
              <select value={form.brandId || ''} onChange={(event) => handleBrandChange(event.target.value)} disabled={saving} className={controlClass}>
                <option value="">Select brand</option>
                {brands.map((brand) => <option key={brand.brandId} value={brand.brandId}>{brand.brandName}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Subject <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Enter email subject" disabled={saving} className={controlClass} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.templateName} onChange={(event) => setForm((current) => ({ ...current, templateName: event.target.value }))} placeholder="Enter template name" disabled={saving} className={controlClass} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Email Template <span className="text-red-500">*</span>
              </label>
              <select value={form.templateId || ''} onChange={(event) => setForm((current) => ({ ...current, templateId: Number(event.target.value) || 0 }))} disabled={saving || loadingReferences} className={controlClass}>
                <option value="">{loadingReferences ? 'Loading templates...' : 'Select Template ID'}</option>
                {masterTemplates.map((item) => <option key={item.templateId} value={item.templateId}>{item.templateName}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                From Email <span className="text-red-500">*</span>
              </label>
              <select
                value={form.fromEmailId || ''}
                onChange={(event) => {
                  const fromEmailId = Number(event.target.value) || 0;
                  const selected = brandEmails.find((item) => item.brandEmailId === fromEmailId);
                  setForm((current) => ({ ...current, fromEmailId, fromEmail: selected?.email || '' }));
                }}
                disabled={saving || !form.brandId || loadingEmails}
                className={controlClass}
              >
                <option value="">{!form.brandId ? 'Select brand first' : loadingEmails ? 'Loading emails...' : 'Select from email'}</option>
                {brandEmails.map((item) => <option key={item.brandEmailId} value={item.brandEmailId}>{item.email}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">CC Email</label>
              <input type="text" value={form.ccEmail} onChange={(event) => setForm((current) => ({ ...current, ccEmail: event.target.value }))} placeholder="cc@example.com" disabled={saving} className={controlClass} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">BCC Email</label>
              <input type="text" value={form.bccEmail} onChange={(event) => setForm((current) => ({ ...current, bccEmail: event.target.value }))} placeholder="bcc@example.com" disabled={saving} className={controlClass} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Sale Type</label>
              <select value={form.saleTypeId || ''} onChange={(event) => setForm((current) => ({ ...current, saleTypeId: Number(event.target.value) || 0 }))} disabled={saving || loadingReferences} className={controlClass}>
                <option value="">{loadingReferences ? 'Loading sale types...' : 'Select sale type'}</option>
                {saleTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
            <div>
              <label htmlFor="brand-template-active" className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">Status</label>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Enable this template for email delivery</span>
            </div>
            <IosToggle id="brand-template-active" checked={form.isActive} onCheckedChange={(value) => setForm((current) => ({ ...current, isActive: value }))} disabled={saving} title={form.isActive ? 'Active' : 'Inactive'} aria-label={form.isActive ? 'Active' : 'Inactive'} />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl disabled:opacity-60">
            Cancel
          </button>
          <LiquidGlassButton type="submit" form="standalone-brand-template-form" disabled={saving || loadingReferences} className="text-xs font-semibold min-w-[135px]">
            {saving ? <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Saving...</span> : isEditing ? 'Update Template' : 'Create Template'}
          </LiquidGlassButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StandaloneBrandTemplateModal;
