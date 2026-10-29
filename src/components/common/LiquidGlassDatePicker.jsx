import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import MiniCalendar from './MiniCalendar';
import { nextCalendarRange, shiftCalendarRange } from '@/utils/calendarUtils';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import '@/styles/liquid-glass-surfaces.css';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  quickDateOptions = [],
  quickDateValue = '',
  onQuickDateChange,
  quickDatePlaceholder = 'Quick ranges',
  quickDateTriggerClassName = '',
  glass = false,
  showClearButton = false,
  onStep,
  onChange,
  onClear,
  stretch = false
}) {
  const iconButtonClassName = `inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors shrink-0 ${glass ? 'liquid-glass-control liquid-glass-control--icon' : ''}`;
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [isOpen, setIsOpen] = useState(false);
  const handleStepClick = (direction) => {
    if (onStep) {
      setIsOpen(false);
      onStep(direction);
      return;
    }
    setIsOpen(false);
    const next = shiftCalendarRange(initialFromDate, initialToDate, direction);
    setFromDate(next.fromDate);
    setToDate(next.toDate);
    onChange?.(next.fromDate, next.toDate);
  };

  const handleApply = (e) => {
    e?.preventDefault();
    if (fromDate && !toDate) {
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

  const handleQuickDateSelect = (value) => {
    onQuickDateChange?.(value);
    setIsOpen(false);
  };

  const formatDateLabel = () => {
    const fromDate = initialFromDate;
    const toDate = initialToDate;
    if (!fromDate && !toDate) return emptyLabel;
    if (fromDate && !toDate) return formatDisplayDate(fromDate);
    if (fromDate === toDate) return formatDisplayDate(fromDate);
    return `${formatDisplayDate(fromDate)} - ${formatDisplayDate(toDate)}`;
  };

  return (
    <Popover.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          setFromDate(initialFromDate);
          setToDate(initialToDate);
        }
        setIsOpen(open);
      }}
    >
      <div className={`liquid-glass-date-picker relative inline-flex items-center gap-1.5 ${className}`}>
        {/* Prev period button */}
        <button
          type="button"
          className={iconButtonClassName}
          onClick={() => handleStepClick(-1)}
          title="Previous period"
          aria-label="Previous period"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Pill button */}
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Choose date range"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className={`inline-flex min-w-0 max-w-full flex-1 items-center justify-between gap-2 shadow-sm transition-colors ${glass ? 'liquid-glass-control' : ''} ${
              quickDateTriggerClassName || 'h-8 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50'
            } ${stretch ? 'justify-start' : 'justify-center sm:flex-none'}`}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" />
            <span
              className={`truncate text-xs font-semibold text-slate-800 dark:text-slate-100 ${stretch ? 'flex-1 text-left' : 'sm:max-w-[190px]'}`}
            >
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
        </Popover.Trigger>

        {/* Next period button */}
        <button
          type="button"
          className={iconButtonClassName}
          onClick={() => handleStepClick(1)}
          title="Next period"
          aria-label="Next period"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Clear button if enabled */}
        {showClearButton && (
          <button type="button" className={iconButtonClassName} onClick={onClear} title="Reset dates" aria-label="Reset dates">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content
          className="mini-calendar-popover"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Date range"
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          {showQuickDateDropdown && quickDateOptions.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold">{quickDatePlaceholder}</div>
              <div className="mini-calendar__presets" role="group" aria-label={quickDatePlaceholder}>
                {quickDateOptions.map((option) => {
                  const value = option?.value ?? option;
                  const label = option?.label ?? option;
                  const selected = String(quickDateValue) === String(value);

                  return (
                    <button
                      key={String(value)}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleQuickDateSelect(value)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <MiniCalendar
            range
            value={fromDate}
            endValue={toDate}
            onSelect={(day) => {
              const next = nextCalendarRange(fromDate, toDate, day);
              setFromDate(next.fromDate);
              setToDate(next.toDate);
            }}
          />
          <div className="mini-calendar__hint" aria-live="polite">
            {fromDate
              ? formatDisplayDate(fromDate) + (toDate ? ' - ' + formatDisplayDate(toDate) : ' - Select end date, or Apply for one day')
              : 'Select start date'}
          </div>
          <div className="mini-calendar__footer">
            <button type="button" onClick={() => setIsOpen(false)}>
              Cancel
            </button>
            <button type="button" className="mini-calendar__apply" disabled={!fromDate} onClick={handleApply}>
              Apply
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default LiquidGlassDatePicker;
