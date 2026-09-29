import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, AlertCircle, Sparkles, Mail, Tag } from 'lucide-react';
import { toast } from 'sonner';

import templateService from '@/services/templateService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import IosToggle from '@/components/common/IosToggle';
import RichTextEditor from './RichTextEditor';

const TemplateModal = ({
  open,
  template = null,
  emailTypes = [],
  placeholders = [],
  onClose,
  onSuccess,
  canAdd = true,
  canUpdate = true
}) => {
  const isEditing = Boolean(template && template.templateId);
  const editorRef = useRef(null);

  const [formData, setFormData] = useState({
    templateName: '',
    emailTypeId: '',
    body: '',
    isActive: true
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Sync form state when modal opens or template changes
  useEffect(() => {
    if (open) {
      if (template) {
        setFormData({
          templateName: template.templateName || '',
          emailTypeId: template.emailTypeId ? String(template.emailTypeId) : emailTypes[0]?.id ? String(emailTypes[0].id) : '',
          body: template.body || '',
          isActive: template.isActive !== false
        });
      } else {
        setFormData({
          templateName: '',
          emailTypeId: emailTypes[0]?.id ? String(emailTypes[0].id) : '',
          body: '',
          isActive: true
        });
      }
      setValidationErrors({});
    }
  }, [open, template, emailTypes]);

  if (!open) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.templateName.trim()) {
      errors.templateName = 'Template name is required.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isEditing && !canUpdate) {
      toast.error('You do not have permission to update templates.');
      return;
    }
    if (!isEditing && !canAdd) {
      toast.error('You do not have permission to create templates.');
      return;
    }

    if (!validate()) {
      toast.error('Please enter a valid template name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        templateId: isEditing ? Number(template.templateId) : 0,
        templateName: formData.templateName.trim(),
        emailTypeId: Number(formData.emailTypeId) || 0,
        body: formData.body || '',
        isActive: Boolean(formData.isActive),
        createdById: template?.createdById,
        createdDate: template?.createdDate
      };

      if (isEditing) {
        await templateService.updateTemplate(payload);
        toast.success('Template updated successfully');
      } else {
        await templateService.createTemplate(payload);
        toast.success('Template created successfully');
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg = getApiErrorMessage(err, `Failed to ${isEditing ? 'update' : 'create'} template.`);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[95vh] bg-white dark:bg-[#17132a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/50 dark:border-purple-800/30 shadow-xs">
              <FileText size={20} />
            </div>
            <div>
              <h2 id="template-modal-title" className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {isEditing ? 'Edit Template' : 'Add Template'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isEditing ? `Modify template #${template.templateId}` : 'Create a reusable email notification or message template'}
              </p>
            </div>
          </div>

          <GlassCloseButton onClick={onClose} disabled={saving} />
        </div>

        {/* Modal Body: Scrollable */}
        <form id="template-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top Form Row: Name & Email Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Template Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Order Confirmation, Welcome Email"
                value={formData.templateName}
                onChange={(e) => handleChange('templateName', e.target.value)}
                disabled={saving}
                className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all ${
                  validationErrors.templateName
                    ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                    : 'border-gray-200 dark:border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                }`}
              />
              {validationErrors.templateName && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.templateName}
                </p>
              )}
            </div>

            {/* Email Type ID */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Email Type
              </label>
              <div className="relative">
                <select
                  value={formData.emailTypeId}
                  onChange={(e) => handleChange('emailTypeId', e.target.value)}
                  disabled={saving}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#0f1322] text-gray-900 dark:text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select Email Type (Optional)</option>
                  {emailTypes.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.name}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                  ▼
                </span>
              </div>
            </div>
          </div>

          {/* Status Toggle Row */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
            <div>
              <label htmlFor="tpl-active-toggle" className="text-xs font-semibold text-gray-800 dark:text-gray-200 block cursor-pointer">
                Status
              </label>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {formData.isActive ? 'Active and available for delivery' : 'Inactive (disabled)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-gray-700 dark:text-gray-300">
                {formData.isActive ? 'ON' : 'OFF'}
              </span>
              <IosToggle
                id="tpl-active-toggle"
                checked={formData.isActive}
                onCheckedChange={(val) => handleChange('isActive', val)}
                disabled={saving}
                title={formData.isActive ? 'Active' : 'Inactive'}
              />
            </div>
          </div>

          {/* Body Rich Text Editor */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Template Body Content
            </label>
            <RichTextEditor
              ref={editorRef}
              value={formData.body}
              onChange={(html) => handleChange('body', html)}
              placeholders={placeholders}
              height={430}
            />
          </div>
        </form>

        {/* Modal Footer: Fixed */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-all"
          >
            Cancel
          </button>

          <LiquidGlassButton
            type="submit"
            form="template-form"
            disabled={saving}
            className="text-xs font-semibold min-w-[130px] shadow-md"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="animate-spin" /> Saving...
              </span>
            ) : isEditing ? (
              'Update Template'
            ) : (
              'Create Template'
            )}
          </LiquidGlassButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TemplateModal;
