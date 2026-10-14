import { useEffect, useMemo, useState } from 'react';
import { ModalPortal } from '@/components/common/page-card';
import { Button } from '@/components/ui/button';
import LiquidGlassButton from '@/components/ui/LiquidGlassButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
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
    if (!open) return undefined;
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
      <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
        <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-700 dark:bg-slate-900">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Share Sale</h3>
            <GlassCloseButton onClick={onClose} label="Close share sale" />
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-auto">
            {/* A share row belongs to one payment, so callers editing an existing
                order pick which payment the split applies to. While creating an
                order there is only the payment being created, so this whole card
                is hidden rather than shown as an empty, disabled picker. */}
            {hasPaymentPicker && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
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
                      <SelectContent className="z-[90]">
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
                      className={`${inputCompactClass} bg-slate-100 text-slate-700 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {isPaymentChanging && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Loading share rows for selected payment...</div>
                )}
              </div>
            )}

            <div className="rounded-md border border-slate-200 bg-white px-3 py-3 text-xs dark:border-slate-700 dark:bg-slate-800">
              <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {(splitReceiptRows || []).length === 0 ? (
                  <div className="text-slate-500 dark:text-slate-400">No split rows added.</div>
                ) : (
                  <>
                    {(splitReceiptRows || []).map((row) => (
                      <div key={String(row.rowId)} className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="truncate">{row.label} - </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{row.splitTypeLabel}</div>
                        </div>
                        <div className="shrink-0 text-right font-medium">${formatMoney2(row.amount)}</div>
                      </div>
                    ))}

                    <div className="mt-2 border-t border-dashed border-slate-200 pt-2 flex items-center justify-between dark:border-slate-700">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">Total Amount</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        ${formatMoney2((splitReceiptRows || []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2 dark:text-slate-300">Sales Person</div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-5">
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    readOnly
                    value={salesPersonLabel || ''}
                    className={`${inputCompactClass} bg-slate-100 text-slate-700 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300`}
                    placeholder="Sales Person"
                  />
                </div>
                <div className="lg:col-span-4">
                  <label className={labelClass}>Amount</label>
                  <input
                    type="text"
                    readOnly
                    value={formatMoney2(salesPersonAmount)}
                    className={`${inputCompactClass} bg-slate-100 text-slate-700 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300`}
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
                      className={`${inputCompactClass} bg-slate-100 text-slate-700 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300`}
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
                      <SelectContent className="z-[90]">
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
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Sales Person Split Type is required.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Share Sale</div>
                <Button type="button" size="sm" variant="outline" className="h-9 border-dashed" onClick={onAddShareSaleRow}>
                  <Plus size={14} className="mr-1" />
                  Add User
                </Button>
              </div>

              {rows.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">No share users added yet. Click Add User to create split rows.</div>
              ) : (
                <div className="space-y-2">
                  {rows.map((row) => {
                    const isExistingPostRow = saveMode === 'post' && Number(row?.id) > 0;
                    const isAmountDisabled = isExistingPostRow || Number(row?.shareWithId) <= 0;

                    return (
                    <div key={row.rowId} className="grid grid-cols-1 lg:grid-cols-12 gap-3 rounded-xl border border-slate-200 bg-white p-3 items-end shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <div className="lg:col-span-4 min-w-0">
                        <label className={labelClass}>Sale With <span className="text-red-600 dark:text-red-400">*</span></label>
                        <Select
                          value={row.shareWithId ? String(row.shareWithId) : ''}
                          onValueChange={(value) => onUpdateShareSaleRow(row.rowId, 'shareWithId', value)}
                          disabled={isExistingPostRow}
                        >
                          <SelectTrigger className={selectTriggerCompactClass}>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent
                            className="z-[90] max-h-72"
                            search={(
                              <SelectSearchInput
                                value={userSearchText}
                                onChange={setUserSearchText}
                                placeholder="Search user..."
                              />
                            )}
                          >
                            {filteredSalesAgentUsers.length === 0 ? (
                              <div className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">No eligible user found.</div>
                            ) : (
                              filteredSalesAgentUsers.map((u) => (
                                <SelectItem
                                  key={u.userId}
                                  value={String(u.userId)}
                                  meta={<UserOptionBadges user={u} />}
                                >
                                  {getSalesPersonLabel(u)}
                                </SelectItem>
                              ))
                            )}
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
                          className={`${inputCompactClass} ${isAmountDisabled ? 'bg-slate-100 text-slate-700 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300' : ''}`}
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
                          <SelectContent className="z-[90]">
                            {nonFullSalesShareTypeOptions.map((opt) => (
                              <SelectItem key={opt.id} value={String(opt.id)}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="lg:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-10 w-10 p-0 rounded-lg border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-300 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25 dark:hover:text-red-200 dark:hover:border-red-500/50"
                          onClick={() => onRemoveShareSaleRow(row.rowId)}
                          aria-label="Delete split row"
                          title="Delete"
                          disabled={isExistingPostRow}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>

                      {!isExistingPostRow && (Number(row?.shareWithId) <= 0 || Number(row?.amount) <= 0 || Number(row?.splitTypeId) <= 0) && (
                        <div className="lg:col-span-12 text-xs text-red-600 dark:text-red-400">
                          Sale With, Amount, and Sale Contribution are required.
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>

          </div>

          <div className="px-4 py-3 border-t bg-slate-50 flex justify-end dark:border-slate-700 dark:bg-slate-800">
            {typeof onSave === 'function' ? (
              <div className="flex items-center gap-3">
                {disableDone && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {validationMessage}
                  </div>
                )}
                <Button type="button" variant="outline" onClick={onClose} disabled={!!isSaving}>Close</Button>
                <LiquidGlassButton
                  type="button"
                  onClick={onSave}
                  disabled={disableDone || !!isSaving}
                  className="text-center"
                >
                  {isSaving ? 'Saving...' : (saveButtonLabel || 'Save')}
                </LiquidGlassButton>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {disableDone && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {validationMessage || 'Complete all required fields before Done.'}
                  </div>
                )}
                <LiquidGlassButton type="button" onClick={onClose} disabled={disableDone} className="text-center">
                  {doneButtonLabel || 'Done'}
                </LiquidGlassButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ShareSaleModal;


