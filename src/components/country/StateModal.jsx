import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import countryService from '@/services/countryService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';

const StateModal = ({
  open,
  country = null,
  countries = [],
  state = null,
  onClose,
  onSuccess
}) => {
  const isEditing = Boolean(state && state.stateId);

  const [stateName, setStateName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const countryId = Number(country?.countryId || country?.CountryId || state?.countryId || state?.CountryId);

  const matchedCountry =
    country ||
    (Array.isArray(countries)
      ? countries.find((c) => Number(c?.countryId || c?.CountryId) === Number(countryId))
      : null);

  const cleanCountryName =
    matchedCountry?.countryName ||
    matchedCountry?.CountryName ||
    matchedCountry?.name ||
    matchedCountry?.Name ||
    state?.countryName ||
    state?.CountryName ||
    '';

  const countryDisplayName =
    cleanCountryName || (countryId ? `Country #${countryId}` : 'Unknown Country');

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    if (state) {
      setStateName(state.stateName || state.name || '');
    } else {
      setStateName('');
    }
  }, [open, state]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = stateName.trim();
    if (!trimmed) {
      setErrorMsg('State name is required.');
      return;
    }

    if (!countryId) {
      setErrorMsg('Parent country is missing.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await countryService.updateState({
          stateId: state.stateId,
          stateName: trimmed,
          countryId,
          countryName: cleanCountryName
        });
        toast.success(`State "${trimmed}" updated successfully`);
      } else {
        await countryService.createState({
          stateId: 0,
          stateName: trimmed,
          countryId,
          countryName: cleanCountryName
        });
        toast.success(`State "${trimmed}" added to ${countryDisplayName}`);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save state:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save state');
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
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit State' : 'Add State'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Country: <strong className="text-gray-700 dark:text-gray-200">{countryDisplayName}</strong>
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

            {/* Parent Country Information Banner */}
            <div className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02] flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Target Country</span>
              <span className="text-xs font-semibold text-gray-900 dark:text-white">{countryDisplayName}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                State / Province Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={stateName}
                onChange={(e) => {
                  setStateName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. California, Bavaria, Maharashtra"
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
                'Update State'
              ) : (
                'Add State'
              )}
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default StateModal;
