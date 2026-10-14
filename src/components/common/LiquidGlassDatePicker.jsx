import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toYmd = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (ymdStr) => {
  if (!ymdStr) return '';
  const parts = ymdStr.split('-');
  if (parts.length !== 3) return ymdStr;
  const year = parts[0];
  const monthIdx = Number(parts[1]) - 1;
  const day = parts[2];
  return `${day} ${MONTH_NAMES[monthIdx] || ''} ${year}`.trim();
};

const fromYmd = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const calendarDaysFor = (visibleMonth) => {
  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const firstCell = new Date(firstOfMonth);
  firstCell.setDate(firstCell.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return date;
  });
};

export function LiquidGlassDatePicker({
  className = '',
  initialFromDate = '',
  initialToDate = '',
  emptyLabel = 'This month',
  showQuickDateDropdown = false,
  quickDateOptions = [],
  quickDateValue = '',
  onQuickDateChange,
  showQuickDateCustomOption = true,
  quickDatePlaceholder = 'Quick ranges',
  quickDateTriggerClassName = '',
  calendarMode = false,
  showClearButton = false,
  onChange,
  onClear,
  stretch = false,
}) {
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = fromYmd(initialFromDate) || new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const containerRef = useRef(null);
  const calendarDays = useMemo(() => calendarDaysFor(visibleMonth), [visibleMonth]);

  useEffect(() => {
    setFromDate(initialFromDate);
    setToDate(initialToDate);
  }, [initialFromDate, initialToDate]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const handleStepClick = (direction) => {
    const start = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date();
    const end = toDate ? new Date(`${toDate}T00:00:00`) : new Date();

    // Determine span in months
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = (yearDiff * 12) + (end.getMonth() - start.getMonth());

    if (monthDiff === 0) {
      // Step by 1 month
      const newStart = new Date(start.getFullYear(), start.getMonth() + direction, 1);
      const newEnd = new Date(start.getFullYear(), start.getMonth() + direction + 1, 0);
      const fromStr = toYmd(newStart);
      const toStr = toYmd(newEnd);
      setFromDate(fromStr);
      setToDate(toStr);
      onChange?.(fromStr, toStr);
    } else {
      // Step by span in days
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const shift = days * direction;
      const newStart = new Date(start.getTime() + (shift * 24 * 60 * 60 * 1000));
      const newEnd = new Date(end.getTime() + (shift * 24 * 60 * 60 * 1000));
      const fromStr = toYmd(newStart);
      const toStr = toYmd(newEnd);
      setFromDate(fromStr);
      setToDate(toStr);
      onChange?.(fromStr, toStr);
    }
  };

  const handleApply = (e) => {
    e?.preventDefault();
    if (calendarMode && fromDate && !toDate) {
      setToDate(fromDate);
      onChange?.(fromDate, fromDate);
      setIsOpen(false);
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      // swap if inverted
      onChange?.(toDate, fromDate);
      setFromDate(toDate);
      setToDate(fromDate);
    } else {
      onChange?.(fromDate, toDate);
    }
    setIsOpen(false);
  };

  const togglePicker = () => {
    if (!isOpen) {
      setFromDate(initialFromDate);
      setToDate(initialToDate);
      const selectedDate = fromYmd(initialFromDate) || new Date();
      setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
    setIsOpen((open) => !open);
  };

  const handleQuickDateSelect = (value) => {
    onQuickDateChange?.(value);
    setIsOpen(false);
  };

  const selectCalendarDate = (date) => {
    const selected = toYmd(date);

    if (!fromDate || toDate) {
      setFromDate(selected);
      setToDate('');
      return;
    }

    if (selected < fromDate) {
      setToDate(fromDate);
      setFromDate(selected);
      return;
    }

    setToDate(selected);
  };

  const formatDateLabel = () => {
    if (!fromDate && !toDate) return emptyLabel;
    if (fromDate === toDate) return formatDisplayDate(fromDate);
    return `${formatDisplayDate(fromDate)} - ${formatDisplayDate(toDate)}`;
  };

  return (
    <div ref={containerRef} className={`relative inline-flex items-center gap-1.5 ${className}`}>
      {/* Prev period button */}
      <button
        type="button"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors shrink-0"
        onClick={() => handleStepClick(-1)}
        title="Previous period"
        aria-label="Previous period"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Pill button */}
      <button
        type="button"
        onClick={togglePicker}
        className={`inline-flex min-w-0 max-w-full flex-1 items-center justify-between gap-2 shadow-sm transition-colors ${
          quickDateTriggerClassName || 'h-8 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50'
        } ${stretch ? 'justify-start' : 'justify-center sm:flex-none'}`}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" />
        <span className={`truncate text-xs font-semibold text-slate-800 ${stretch ? 'flex-1 text-left' : 'sm:max-w-[190px]'}`}>
          {formatDateLabel()}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Next period button */}
      <button
        type="button"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors shrink-0"
        onClick={() => handleStepClick(1)}
        title="Next period"
        aria-label="Next period"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Clear button if enabled */}
      {showClearButton && (
        <button
          type="button"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors shrink-0"
          onClick={onClear}
          title="Reset dates"
          aria-label="Reset dates"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      )}

      {/* Date Picker Popover */}
      {isOpen && calendarMode && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[19rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <strong className="text-xs font-semibold text-slate-900 dark:text-white">
              {visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </strong>
            <button
              type="button"
              onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5" aria-label="Choose a date range">
            {WEEK_DAYS.map((day) => (
              <span key={day} className="flex h-7 items-center justify-center text-[10px] font-bold text-slate-400">
                {day}
              </span>
            ))}
            {calendarDays.map((date) => {
              const value = toYmd(date);
              const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
              const isRangeStart = value === fromDate;
              const isRangeEnd = value === toDate;
              const isInRange = Boolean(fromDate && toDate && value > fromDate && value < toDate);
              const isToday = value === toYmd(new Date());

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectCalendarDate(date)}
                  className={`relative flex h-8 items-center justify-center rounded-lg text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isRangeStart || isRangeEnd
                      ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                      : isInRange
                        ? 'rounded-none bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-200'
                        : isCurrentMonth
                          ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                          : 'text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800/60'
                  }`}
                  aria-label={date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  aria-pressed={isRangeStart || isRangeEnd}
                >
                  {date.getDate()}
                  {isToday && !isRangeStart && !isRangeEnd && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-indigo-500" />}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="min-w-0 truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {fromDate ? `${formatDisplayDate(fromDate)}${toDate ? ` - ${formatDisplayDate(toDate)}` : ' - Select end date'}` : 'Select start date'}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!fromDate}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && !calendarMode && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          {showQuickDateDropdown && quickDateOptions.length > 0 && (
            <div className={showQuickDateCustomOption ? 'mb-4 border-b border-slate-100 pb-4' : ''}>
              <div className="mb-2 text-xs font-semibold text-slate-800">{quickDatePlaceholder}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {quickDateOptions.map((option) => {
                  const value = option?.value ?? option;
                  const label = option?.label ?? option;
                  const selected = String(quickDateValue) === String(value);

                  return (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => handleQuickDateSelect(value)}
                      className={`rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                        selected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showQuickDateCustomOption && (
            <>
              <div className="mb-3 text-xs font-semibold text-slate-800">Custom Date Range</div>
              <form onSubmit={handleApply} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm transition-colors"
              >
                Apply
              </button>
            </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default LiquidGlassDatePicker;
