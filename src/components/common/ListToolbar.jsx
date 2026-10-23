import PropTypes from 'prop-types';

import { LiquidGlassDatePicker } from './LiquidGlassDatePicker';
import TableRefreshButton from './TableRefreshButton';
import TableSearchField from './TableSearchField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Same frosted control look as the Orders toolbar, so every list page reads as one row of controls.
export const TOOLBAR_SELECT_TRIGGER_CLASS =
  'h-10 w-full rounded-xl border border-[rgba(210,218,240,0.65)] bg-white/75 px-3 text-sm text-gray-700 backdrop-blur ' +
  'hover:border-purple-300 focus:border-purple-400 data-[state=open]:border-purple-400 ' +
  'dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:border-white/20';

const SEARCH_FIELD_CLASS =
  'relative flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-[rgba(210,218,240,0.65)] bg-white/75 px-3 text-sm ' +
  'text-gray-700 backdrop-blur transition-colors hover:border-purple-300 focus-within:border-purple-400 ' +
  'dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 sm:min-w-[220px] xl:w-[300px]';

// The custom Select treats '' as "nothing selected", so empty option values travel under this key.
const EMPTY_OPTION = '__all__';

/**
 * Filter row used at the top of list pages (Orders style): record count pill, optional search-field
 * select, search box, date range picker and refresh button.
 */
export default function ListToolbar({
  shown,
  total,
  itemName,
  searchFields,
  searchField,
  onSearchFieldChange,
  searchValue,
  onSearchChange,
  onSearchClear,
  onSearchSubmit,
  searchPlaceholder = 'Search',
  fromDate,
  toDate,
  onDateChange,
  onDateClear,
  dateEmptyLabel = 'All dates',
  onRefresh,
  loading = false
}) {
  const refreshButton = onRefresh && <TableRefreshButton title={`Refresh ${itemName.toLowerCase()}`} loading={loading} onClick={onRefresh} />;

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.02] xl:flex-row xl:items-center">
      <div className="flex items-center justify-between gap-2 xl:shrink-0">
        <span className="inline-flex min-w-0 shrink-0 items-center gap-2 rounded-full border border-purple-100/80 bg-white/80 px-3 py-2 text-xs text-gray-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" aria-hidden="true" />
          <span className="truncate whitespace-nowrap">
            <strong className="font-semibold text-gray-900 dark:text-white">{shown}</strong>
            {' of '}
            <strong className="font-semibold text-gray-900 dark:text-white">{total}</strong> {itemName}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-2 xl:hidden">{refreshButton}</div>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[150px_minmax(220px,1fr)] lg:grid-cols-[150px_minmax(240px,1fr)_auto] xl:ml-auto xl:flex xl:flex-none xl:items-center">
        {searchFields?.length > 0 && (
          <div className="w-full sm:w-[150px]">
            <Select
              value={searchField === '' ? EMPTY_OPTION : searchField}
              onValueChange={(value) => onSearchFieldChange(value === EMPTY_OPTION ? '' : value)}
            >
              <SelectTrigger className={TOOLBAR_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Search field" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="min-w-[var(--radix-select-trigger-width)]">
                {searchFields.map((field) => (
                  <SelectItem key={field.label} value={field.value === '' ? EMPTY_OPTION : field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <TableSearchField
          className={SEARCH_FIELD_CLASS}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSearchSubmit?.();
            }
          }}
          onClear={onSearchClear}
        />

        {onDateChange && (
          <LiquidGlassDatePicker
            initialFromDate={fromDate}
            initialToDate={toDate}
            emptyLabel={dateEmptyLabel}
            onChange={onDateChange}
            onClear={onDateClear}
            showClearButton={Boolean(onDateClear && (fromDate || toDate))}
            className="w-full shrink-0 sm:col-span-2 lg:col-span-1 lg:w-auto"
          />
        )}

        <div className="hidden shrink-0 xl:block">{refreshButton}</div>
      </div>
    </div>
  );
}

ListToolbar.propTypes = {
  shown: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  itemName: PropTypes.string.isRequired,
  searchFields: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.string.isRequired })),
  searchField: PropTypes.string,
  onSearchFieldChange: PropTypes.func,
  searchValue: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  onSearchClear: PropTypes.func.isRequired,
  onSearchSubmit: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  fromDate: PropTypes.string,
  toDate: PropTypes.string,
  onDateChange: PropTypes.func,
  onDateClear: PropTypes.func,
  dateEmptyLabel: PropTypes.string,
  onRefresh: PropTypes.func,
  loading: PropTypes.bool
};
