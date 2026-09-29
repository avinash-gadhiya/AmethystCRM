import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Globe, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import countryService from '@/services/countryService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';

const CountryModal = ({ open, country = null, onClose, onSuccess }) => {
  const isEditing = Boolean(country && country.countryId);

  const [countryName, setCountryName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    if (country) {
      setCountryName(country.countryName || country.name || '');
    } else {
      setCountryName('');
    }
  }, [open, country]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = countryName.trim();
    if (!trimmed) {
      setErrorMsg('Country name is required.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await countryService.updateCountry({
          countryId: country.countryId,
          countryName: trimmed
        });
        toast.success(`Country "${trimmed}" updated successfully`);
      } else {
        await countryService.createCountry({
          countryId: 0,
          countryName: trimmed
        });
        toast.success(`Country "${trimmed}" created successfully`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save country:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save country');
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
              <Globe size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Country' : 'Add Country'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditing ? 'Update country name.' : 'Register a new country record.'}
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
                Country Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={countryName}
                onChange={(e) => {
                  setCountryName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. United States, Germany, India"
                autoFocus
                className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#0f1322] px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
              />
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
                isEditing ? 'Updating...' : 'Saving...'
              ) : isEditing ? (
                'Update Country'
              ) : (
                'Add Country'
              )}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CountryModal;
