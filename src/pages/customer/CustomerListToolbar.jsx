import { useState } from 'react';
import LiquidGlassDatePicker from '@/components/common/LiquidGlassDatePicker';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import TableSearchField from '@/components/common/TableSearchField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDailySalesDateRange } from '@/utils/dailySalesReportUtils';

const PERIODS = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['last-week', 'Last week'],
  ['current-month', 'This month'],
  ['last-month', 'Last month'],
  ['this-year', 'This year']
];

export default function CustomerListToolbar({
  shown,
  total,
  searchFields,
  searchField,
  onSearchFieldChange,
  searchValue,
  onSearchChange,
  onSearchClear,
  onSearchSubmit,
  fromDate,
  toDate,
  onDateChange,
  onDateClear,
  onRefresh,
  loading
}) {
  const [period, setPeriod] = useState('');
  return (
    <div className="customer-list-toolbar">
      <div className="customer-toolbar-top">
        <span className="customer-count">
          <i aria-hidden="true" />
          Showing <strong>{shown}</strong> of <strong>{total}</strong> Customers
        </span>
        <TableRefreshButton title="Refresh customers" onClick={onRefresh} loading={loading} />
      </div>
      <div className="customer-toolbar-filters">
        <div className="customer-search-field">
          <Select value={searchField || 'all'} onValueChange={(value) => onSearchFieldChange(value === 'all' ? '' : value)}>
            <SelectTrigger aria-label="Search field">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              {searchFields.map((field) => (
                <SelectItem key={field.value || 'all'} value={field.value || 'all'}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TableSearchField
          className="customer-search-input"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={
            searchField
              ? `Search by ${searchFields.find((field) => field.value === searchField)?.label.toLowerCase() || searchField}`
              : 'Search all fields'
          }
          onClear={onSearchClear}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSearchSubmit();
            }
          }}
        />
        <div className="customer-date-filters">
          <div className="customer-quick-date">
            <Select
              value={period}
              onValueChange={(value) => {
                setPeriod(value);
                if (value === 'custom') return;
                if (value === 'all') {
                  onDateClear();
                  return;
                }
                const range = getDailySalesDateRange(value);
                onDateChange(range.fromDate, range.toDate);
              }}
            >
              <SelectTrigger aria-label="Quick date">
                <SelectValue placeholder="Quick Date:..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                {period === 'custom' && <SelectItem value="custom">Custom range</SelectItem>}
                {PERIODS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <LiquidGlassDatePicker
            initialFromDate={fromDate}
            initialToDate={toDate}
            emptyLabel="All dates"
            stretch
            className="customer-list-dates"
            onChange={(from, to) => {
              setPeriod('custom');
              onDateChange(from, to);
            }}
          />
        </div>
      </div>
    </div>
  );
}
