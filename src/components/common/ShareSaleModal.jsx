import { useEffect, useMemo, useState } from 'react';
import { ModalPortal } from '@/components/common/page-card';
import LiquidGlassButton from '@/components/ui/LiquidGlassButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CircleDollarSign, Plus, Receipt, Trash2, UserCheck, Users } from 'lucide-react';
import GlassCloseButton from '@/components/common/GlassCloseButton';
import SelectSearchInput from '@/components/common/SelectSearchInput';
import UserOptionBadges, { getUserBadgeSearchText } from '@/components/common/UserOptionBadges';

const ShareSaleModal = ({
  open,
  onClose,
  paymentOptions,
  selectedPaymentId,
  onPaymentChange,
  isPaymentChanging,
  salesPersonLabel,
  salesPersonAmount,
  orderTotal,
  splitTotal,
  remainingAmount,
  isExceeded,
  rows,
  salesPersonSplitTypeId,
  onSalesPersonSplitTypeChange,
  fixedShareWithId,
  salesPersons,
  onUserSearch,
  salesAgentRoleIds,
  salesShareTypeOptions,
  labelClass,
  selectTriggerCompactClass,
  inputCompactClass,
  formatMoney2,
  getSalesPersonLabel,
  splitReceiptRows,
  onAddShareSaleRow,
  onRemoveShareSaleRow,
  onUpdateShareSaleRow,
  onSave,
  isSaving,
  saveButtonLabel,
  doneButtonLabel,
  saveMode,
}) => {
  const [userSearchText, setUserSearchText] = useState('');

  // Only callers that split an existing order pass payments to choose from.
  const hasPaymentPicker = (paymentOptions || []).length > 0;

  useEffect(() => {
    if (!open) {
      setUserSearchText('');
      return undefined;
    }
    if (typeof onUserSearch !== 'function') return undefined;

    const query = String(userSearchText || '').trim();
    if (!query) return undefined;

    const id = setTimeout(() => {
      onUserSearch(query);
    }, 300);

    return () => clearTimeout(id);
  }, [open, onUserSearch, userSearchText]);

  const salesAgentUsers = useMemo(
    () => (salesPersons || []).filter((u) => Number(u?.userId) !== Number(fixedShareWithId || 0)),
    [salesPersons, fixedShareWithId],
  );

  const filteredSalesAgentUsers = useMemo(() => {
    const query = String(userSearchText || '').trim().toLowerCase();
    if (!query) return salesAgentUsers;

    return salesAgentUsers.filter((user) =>
      String(getSalesPersonLabel(user) || '').toLowerCase().includes(query)
      || getUserBadgeSearchText(user).includes(query),
    );
  }, [salesAgentUsers, userSearchText, getSalesPersonLabel]);

  const nonFullSalesShareTypeOptions = useMemo(
    () =>
      (salesShareTypeOptions || []).filter((opt) => {
        const name = String(opt?.name || '').trim().toLowerCase();
        return name !== 'full';
      }),
    [salesShareTypeOptions],
  );

  const hasIncompleteRows = (rows || []).some((row) => {
    const isExistingPostRow = saveMode === 'post' && Number(row?.id) > 0;
    if (isExistingPostRow) return false;

    const hasShareWith = Number(row?.shareWithId) > 0;
    const hasAmount = Number(row?.amount) > 0;
    const hasSplitType = Number(row?.splitTypeId) > 0;
    return !hasShareWith || !hasAmount || !hasSplitType;
  });

  const isSalesPersonSplitTypeMissing = (rows || []).length > 0 && Number(salesPersonSplitTypeId) <= 0;

  const disableDone = hasIncompleteRows || isSalesPersonSplitTypeMissing || !!isExceeded;

  const validationMessage = useMemo(() => {
    if (!disableDone) return '';
    if (isExceeded) {
      const limitLabel = hasPaymentPicker ? 'selected payment amount' : 'order total';
      return `Split total ($${formatMoney2(splitTotal)}) cannot exceed ${limitLabel} ($${formatMoney2(orderTotal)}).`;
    }
    if (isSalesPersonSplitTypeMissing) {
      return 'Sales Person Sale Contribution is required.';
    }
    if (hasIncompleteRows) {
      return 'Complete all required fields before Save.';
    }
    return 'Unable to save. Please review entered values.';
  }, [disableDone, isExceeded, isSalesPersonSplitTypeMissing, hasIncompleteRows, splitTotal, orderTotal, formatMoney2, hasPaymentPicker]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sale-modal-title"
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSaving) onClose?.();
        }}
      >
        <div
          className="relative my-auto flex w-full max-w-4xl max-h-[calc(100dvh-2.5rem)] flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-[0_25px_70px_-15px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#141122] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-violet-50/70 via-white to-indigo-50/50 px-5 py-4 dark:border-white/10 dark:from-violet-500/10 dark:via-[#141122] dark:to-indigo-500/10 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/25">
                <CircleDollarSign size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 id="share-sale-modal-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Share Sale
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Split this sale between eligible team members.
                </p>
              </div>
            </div>
            <GlassCloseButton onClick={onClose} label="Close share sale" disabled={isSaving} className="ml-4 shrink-0 !h-9 !w-9 !rounded-xl dark:!border-white/10 dark:!bg-white/5 dark:!text-slate-300" />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/40 p-4 dark:bg-black/10 sm:p-6">
            {/* Payment Picker (editing existing order) */}
            {hasPaymentPicker && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-white/[0.03]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-8">
                    <label className={labelClass}>Payment</label>
                    <Select
                      value={selectedPaymentId ? String(selectedPaymentId) : ''}
                      onValueChange={(value) => onPaymentChange?.(value)}
                      disabled={isSaving || !!isPaymentChanging || (paymentOptions || []).length <= 1}
                    >
                      <SelectTrigger className={selectTriggerCompactClass}>
                        <SelectValue placeholder="Select payment" />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {(paymentOptions || []).map((payment) => (
                          <SelectItem key={String(payment.id)} value={String(payment.id)}>
                            {payment.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="lg:col-span-4">
                    <label className={labelClass}>Selected Payment Amount</label>
                    <input
                      type="text"
                      readOnly
                      value={formatMoney2(orderTotal)}
                      className={`${inputCompactClass} bg-slate-50/80 text-slate-700 cursor-not-allowed border-slate-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {isPaymentChanging && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Loading share rows for selected payment...</div>
                )}
              </div>
            )}

            {/* Split Summary / Receipt */}
            <div className="rounded-2xl border border-violet-100/90 bg-gradient-to-r from-violet-50/70 via-indigo-50/40 to-violet-50/70 p-4 shadow-xs dark:border-violet-500/20 dark:from-violet-500/10 dark:to-indigo-500/10">
              <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-violet-100 pb-2 dark:border-violet-500/20">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-900 dark:text-violet-300">
                  <Receipt size={14} className="text-violet-600 dark:text-violet-400" />
                  <span>Split Summary</span>
                </div>
                {orderTotal > 0 && (
                  <span className="inline-flex items-center rounded-full bg-violet-100/80 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                    Total: ${formatMoney2(orderTotal)}
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {(splitReceiptRows || []).length === 0 ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400 py-1">No split rows added.</div>
                ) : (
                  <>
                    {(splitReceiptRows || []).map((row) => (
                      <div key={String(row.rowId)} className="flex items-center justify-between gap-2 py-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{row.label}</span>
                          <span className="inline-flex items-center rounded-md border border-violet-200/70 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
                            {row.splitTypeLabel}
                          </span>
                        </div>
                        <div className="shrink-0 text-right font-semibold text-slate-900 dark:text-white">
                          ${formatMoney2(row.amount)}
                        </div>
                      </div>
                    ))}

                    <div className="mt-2.5 border-t border-dashed border-violet-200 pt-2.5 flex items-center justify-between dark:border-violet-500/30">
                      <span className="font-bold text-slate-800 dark:text-slate-100">Entered Total</span>
                      <span className="text-base font-bold text-violet-700 dark:text-violet-300">
                        ${formatMoney2((splitReceiptRows || []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sales Person Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 dark:text-slate-300">
                <UserCheck size={14} className="text-violet-600 dark:text-violet-400" />
                <span>Sales Person</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-5">
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    readOnly
                    value={salesPersonLabel || ''}
                    className={`${inputCompactClass} bg-slate-50/80 text-slate-700 cursor-not-allowed border-slate-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300`}
                    placeholder="Sales Person"
                  />
                </div>
                <div className="lg:col-span-4">
                  <label className={labelClass}>Amount</label>
                  <input
                    type="text"
                    readOnly
                    value={formatMoney2(salesPersonAmount)}
                    className={`${inputCompactClass} bg-slate-50/80 text-slate-700 cursor-not-allowed border-slate-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300`}
                    placeholder="0.00"
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className={labelClass}>Sale Contribution<span className="text-red-600 dark:text-red-400">*</span></label>
                  {(rows || []).length === 0 ? (
                    <input
                      type="text"
                      readOnly
                      value="Full"
                      className={`${inputCompactClass} bg-slate-50/80 text-slate-700 cursor-not-allowed border-slate-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300`}
                      placeholder="Full"
                    />
                  ) : (
                    <Select
                      value={salesPersonSplitTypeId ? String(salesPersonSplitTypeId) : ''}
                      onValueChange={(value) => onSalesPersonSplitTypeChange(value)}
                    >
                      <SelectTrigger className={selectTriggerCompactClass}>
                        <SelectValue placeholder="Select Sale contribution" />
                      </SelectTrigger>
                      <SelectContent className="z-[10000]">
                        {nonFullSalesShareTypeOptions.map((opt) => (
                          <SelectItem key={opt.id} value={String(opt.id)}>
                            {opt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              {isSalesPersonSplitTypeMissing && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>Sales Person Split Type is required.</span>
                </div>
              )}
            </div>

            {/* Share Sale Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <Users size={14} className="text-violet-600 dark:text-violet-400" />
                  <span>Share Sale</span>
                </div>
                <button
                  type="button"
                  onClick={onAddShareSaleRow}
                  className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50/80 hover:bg-violet-100 dark:bg-violet-500/10 dark:hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus size={14} />
                  <span>Add User</span>
                </button>
              </div>

              {rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.01] dark:text-slate-400">
                  No share users added yet. Click <span className="font-semibold text-violet-600 dark:text-violet-400">Add User</span> to split this sale.
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.map((row) => {
                    const isExistingPostRow = saveMode === 'post' && Number(row?.id) > 0;
                    const isAmountDisabled = isExistingPostRow || Number(row?.shareWithId) <= 0;

                    return (
                    <div key={row.rowId} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5 lg:grid-cols-12 dark:border-white/10 dark:bg-white/[0.02] transition-colors hover:border-slate-300 dark:hover:border-white/20">
                      <div className="lg:col-span-4 min-w-0">
                        <label className={labelClass}>Sale With <span className="text-red-600 dark:text-red-400">*</span></label>
                        <Select
                          value={row.shareWithId ? String(row.shareWithId) : ''}
                          onValueChange={(value) => {
                            setUserSearchText('');
                            onUpdateShareSaleRow(row.rowId, 'shareWithId', value);
                          }}
                          onOpenChange={(nextOpen) => {
                            if (!nextOpen) setUserSearchText('');
                          }}
                          disabled={isExistingPostRow}
                        >
                          <SelectTrigger className={selectTriggerCompactClass}>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent
                            className="z-[10000] max-h-72"
                            search={(
                              <SelectSearchInput
                                value={userSearchText}
                                onChange={setUserSearchText}
                                placeholder="Search user..."
                              />
                            )}
                          >
                            {(() => {
                              const selectedId = Number(row?.shareWithId);
                              const selectedUser = selectedId > 0
                                ? salesAgentUsers.find((u) => Number(u?.userId) === selectedId)
                                : null;
                              const rowUsers = selectedUser && !filteredSalesAgentUsers.some((u) => Number(u?.userId) === selectedId)
                                ? [selectedUser, ...filteredSalesAgentUsers]
                                : filteredSalesAgentUsers;
                              if (rowUsers.length === 0) {
                                return <div className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">No eligible user found.</div>;
                              }
                              return rowUsers.map((u) => (
                                <SelectItem
                                  key={u.userId}
                                  value={String(u.userId)}
                                  meta={<UserOptionBadges user={u} />}
                                >
                                  {getSalesPersonLabel(u)}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="lg:col-span-4 min-w-0">
                        <label className={labelClass}>Amount <span className="text-red-600 dark:text-red-400">*</span></label>
                        <input
                          type="text"
                          value={row.amount ?? ''}
                          onChange={(e) => onUpdateShareSaleRow(row.rowId, 'amount', e.target.value)}
                          placeholder={Number(row?.shareWithId) > 0 ? 'Enter Sale amount' : 'Select user first'}
                          className={`${inputCompactClass} ${isAmountDisabled ? 'bg-slate-50/80 text-slate-700 cursor-not-allowed border-slate-200 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300' : ''}`}
                          disabled={isAmountDisabled}
                        />
                      </div>

                      <div className="lg:col-span-3 min-w-0">
                        <label className={labelClass}>Sale Contribution <span className="text-red-600 dark:text-red-400">*</span></label>
                        <Select
                          value={row.splitTypeId ? String(row.splitTypeId) : ''}
                          onValueChange={(value) => onUpdateShareSaleRow(row.rowId, 'splitTypeId', value)}
                          disabled={isExistingPostRow}
                        >
                          <SelectTrigger className={selectTriggerCompactClass}>
                            <SelectValue placeholder="Select Sale Contribution" />
                          </SelectTrigger>
                          <SelectContent className="z-[10000]">
                            {nonFullSalesShareTypeOptions.map((opt) => (
                              <SelectItem key={opt.id} value={String(opt.id)}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="lg:col-span-1 flex justify-end">
                        <button
                          type="button"
                          className="h-10 w-10 flex items-center justify-center rounded-xl border border-red-200/80 bg-red-50/70 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-300 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 dark:hover:text-red-200 dark:hover:border-red-500/50 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => onRemoveShareSaleRow(row.rowId)}
                          aria-label="Delete split row"
                          title="Delete"
                          disabled={isExistingPostRow}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {!isExistingPostRow && (Number(row?.shareWithId) <= 0 || Number(row?.amount) <= 0 || Number(row?.splitTypeId) <= 0) && (
                        <div className="lg:col-span-12 mt-1 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>Sale With, Amount, and Sale Contribution are required.</span>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200/80 bg-slate-50/50 px-5 py-3.5 dark:border-white/10 dark:bg-[#141122] sm:px-6">
            <div className="min-w-0">
              {disableDone && validationMessage && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-red-200/70 bg-red-50/80 px-2.5 py-1 text-xs font-medium text-red-600 dark:border-red-500/25 dark:bg-red-500/15 dark:text-red-300">
                  <AlertCircle size={13} className="shrink-0" />
                  <span className="truncate">{validationMessage}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={!!isSaving}
                className="h-10 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all shadow-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <LiquidGlassButton
                type="button"
                onClick={typeof onSave === 'function' ? onSave : onClose}
                disabled={disableDone || !!isSaving}
                className="!h-10 !rounded-xl px-6 text-center !text-sm !font-semibold shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
              >
                {isSaving ? 'Saving...' : (saveButtonLabel || doneButtonLabel || 'Save & Continue')}
              </LiquidGlassButton>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ShareSaleModal;

