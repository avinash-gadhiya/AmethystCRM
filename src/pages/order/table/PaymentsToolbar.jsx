import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import TableSearchField from '@/components/common/TableSearchField';
import GlassSegmentedControl from '@/components/common/GlassSegmentedControl';
import { LiquidGlassDatePicker } from '@/components/common/LiquidGlassDatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const STATUS_OPTIONS = [
  { label: 'Sales', value: 'Sale' },
  { label: 'All', value: '' },
  { label: 'Refunds', value: 'Refund' }
];

export default function PaymentsToolbar({
  searchInput, searchField, searchFields, searchPlaceholder, fromDate, toDate, paymentStatus,
  onPaymentStatusChange, onSearchFieldChange, onSearchChange, onDateRangeChange, onDateClear,
  onRefresh, loading, onDownload, downloadDisabled, onClearSearch, total, shown
}) {
  return (
    <div className="payments-toolbar" aria-label="Payment filters">
      <div className="payments-toolbar__top">
        <span className="payments-toolbar__count">
          <span className="payments-toolbar__dot" aria-hidden="true" />
          <span><strong>{shown}</strong> of <strong>{total}</strong> Payments</span>
        </span>
        <div className="payments-toolbar__actions">
          <TableRefreshButton className="payments-icon-button" title="Refresh payments" onClick={onRefresh} loading={loading} />
          <Button
            type="button" variant="outline" size="icon" className="payments-icon-button"
            title="Download payments" aria-label="Download payments"
            onClick={onDownload} disabled={downloadDisabled || loading} aria-busy={downloadDisabled || undefined}
          >
            {downloadDisabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="payments-toolbar__filters">
        <GlassSegmentedControl
          className="payments-status-filter" ariaLabel="Payment status"
          options={STATUS_OPTIONS} value={paymentStatus} onChange={onPaymentStatusChange}
        />
        <div className="payments-field-filter">
          <Select value={searchField} onValueChange={onSearchFieldChange}>
            <SelectTrigger className="payments-filter-select" aria-label="Search payment field">
              <SelectValue placeholder="All Payments" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="min-w-[var(--radix-select-trigger-width)]">
              {searchFields.map((field) => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <TableSearchField
          className="payments-search" inputStyle={{ fontSize: '13px' }}
          inputClassName="payments-search__input w-full outline-none bg-transparent"
          placeholder={searchPlaceholder} value={searchInput} onChange={onSearchChange}
          onClear={onClearSearch} clearAriaLabel="Clear payment search"
        />
        <LiquidGlassDatePicker
          key={`payments-date-${fromDate || ''}-${toDate || ''}`}
          initialFromDate={fromDate || ''} initialToDate={toDate || ''}
          showQuickDateDropdown showClearButton={false}
          onChange={(from, to, isSingle) => onDateRangeChange(from, isSingle ? from : to)}
          onClear={onDateClear} quickDateTriggerClassName="payments-date-trigger" className="payments-date-filter"
        />
      </div>
    </div>
  );
}
