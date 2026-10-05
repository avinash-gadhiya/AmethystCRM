import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export function LiquidGlassDatePicker({
  className = '',
  initialFromDate = '',
  initialToDate = '',
  emptyLabel = 'This month',
  showQuickDateDropdown = false,
  showClearButton = false,
  onChange,
  onClear,
  stretch = false,
}) {
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

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
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-colors min-w-0 max-w-full flex-1 ${
          stretch ? 'justify-start' : 'justify-center sm:flex-none'
        }`}
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
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="text-xs font-semibold text-slate-800 mb-3">Custom Date Range</div>
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
        </div>
      )}
    </div>
  );
}

export default LiquidGlassDatePicker;
