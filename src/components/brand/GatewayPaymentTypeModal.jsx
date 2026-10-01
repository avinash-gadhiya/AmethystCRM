import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, AlertCircle, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import brandService from '@/services/brandService';
import { getApiErrorMessage } from '@/lib/apiError';
import LiquidGlassButton from '@/components/common/LiquidGlassButton';
import GlassCloseButton from '@/components/common/GlassCloseButton';

const GatewayPaymentTypeModal = ({
  open,
  brand = null,
  gateway = null,
  onClose,
  onSuccess,
  permissions = { canAdd: false, canDelete: false }
}) => {
  const [availablePaymentTypes, setAvailablePaymentTypes] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [existingRecord, setExistingRecord] = useState([]);

  const brandId = Number(brand?.brandId || gateway?.brandId);
  const gatewayId = Number(gateway?.gatewayId);
  const gatewayName = gateway?.gatewayName || `Gateway #${gatewayId}`;

  useEffect(() => {
    if (!open || !gatewayId) return;
    setErrorMsg('');
    setLoading(true);

    const loadData = async () => {
      try {
        // 1. Load system payment types
        const types = await brandService.getPaymentTypes();
        setAvailablePaymentTypes(types);

        // 2. Load assigned payment types for this gateway & brand
        const assignedRes = await brandService.getGatewayPaymentTypes({
          GatewayId: gatewayId,
          BrandId: brandId
        });

        const list = assignedRes.data || [];
        const matching = list.filter((m) => Number(m.gatewayId) === gatewayId && (!brandId || Number(m.brandId) === brandId));
        setExistingRecord(matching);
        const ids = new Set(
          matching
            .flatMap((m) => m.paymentTypeIds || [m.paymentTypeId])
            .filter(Boolean)
            .map(Number)
        );
        setSelectedIds(ids);
      } catch (err) {
        console.error('Failed to load gateway payment types:', err);
        setErrorMsg(getApiErrorMessage(err, 'Failed to load payment types.'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, gatewayId, brandId]);

  if (!open) return null;

  const togglePaymentType = (typeId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) {
        next.delete(typeId);
      } else {
        next.add(typeId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === availablePaymentTypes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(availablePaymentTypes.map((t) => Number(t.paymentTypeId))));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!gatewayId || !brandId) {
      setErrorMsg('Gateway or Brand identifier is missing.');
      return;
    }

    setSaving(true);
    try {
      const originalIds = new Set(
        existingRecord
          .flatMap((m) => m.paymentTypeIds || [m.paymentTypeId])
          .filter(Boolean)
          .map(Number)
      );
      const removed = [...originalIds].filter((id) => !selectedIds.has(id));
      const added = [...selectedIds].filter((id) => !originalIds.has(id));
      if (removed.length && !permissions.canDelete) throw new Error('You do not have permission to delete payment assignments.');
      if (added.length && !permissions.canAdd) throw new Error('You do not have permission to add payment assignments.');
      // Grouped backend records must be recreated with their retained assignments.
      const affected = existingRecord.filter((m) => (m.paymentTypeIds || [m.paymentTypeId]).some((id) => removed.includes(Number(id))));
      const retained = affected
        .flatMap((m) => m.paymentTypeIds || [m.paymentTypeId])
        .map(Number)
        .filter((id) => selectedIds.has(id));
      if (retained.length && !permissions.canAdd) throw new Error('Updating grouped assignments also requires Add permission.');
      if (removed.length && !window.confirm(`Remove ${removed.length} payment type assignment(s) from ${gatewayName}?`)) return;
      for (const mapping of affected) await brandService.deleteGatewayPaymentType(mapping);
      const paymentTypeIds = [...new Set([...added, ...retained])];
      if (paymentTypeIds.length)
        await brandService.saveGatewayPaymentTypes({
          gatewayPaymentTypeId: 0,
          gatewayId,
          brandId,
          gatewayName,
          paymentTypeIds,
          isActive: true
        });
      toast.success(`Payment types updated for ${gatewayName}`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to save gateway payment types:', err);
      const apiMsg = getApiErrorMessage(err, 'Failed to save payment types');
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
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Assigned Payment Types</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Gateway: <strong className="text-gray-700 dark:text-gray-200">{gatewayName}</strong>
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

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Select Allowed Methods ({selectedIds.size} of {availablePaymentTypes.length})
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
              >
                {selectedIds.size === availablePaymentTypes.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Loader2 size={24} className="animate-spin text-purple-600" />
                <span className="text-xs">Loading payment methods...</span>
              </div>
            ) : availablePaymentTypes.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">No payment types available in the system.</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {availablePaymentTypes.map((type) => {
                  const id = Number(type.paymentTypeId);
                  const isChecked = selectedIds.has(id);

                  return (
                    <button
                      type="button"
                      aria-pressed={isChecked}
                      disabled={saving}
                      key={id}
                      onClick={() => togglePaymentType(id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                        isChecked
                          ? 'border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800/50'
                          : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'bg-purple-600 border-purple-600 text-white'
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-white/5'
                          }`}
                        >
                          {isChecked && <Check size={13} strokeWidth={3} />}
                        </div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{type.paymentTypeName}</span>
                      </div>
                      <span className="text-xs font-mono text-gray-400">#{id}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
            <LiquidGlassButton type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </LiquidGlassButton>
            <LiquidGlassButton
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={loading || saving || Boolean(errorMsg) || (!permissions.canAdd && !permissions.canDelete)}
            >
              Save Payment Methods
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default GatewayPaymentTypeModal;
