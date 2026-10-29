import PropTypes from 'prop-types';
import { useState } from 'react';
import { Filter, RefreshCw, X } from 'lucide-react';

import LiquidGlassSurface from '@/components/common/LiquidGlassSurface';
import LiquidGlassDatePicker from '@/components/common/LiquidGlassDatePicker';
import { getMonthToDateRange, toInputDate } from 'utils/dateUtils';

export default function DashboardRangeToolbar({ range, onRangeChange, onApply, onReset, loading, children }) {
  const [preset, setPreset] = useState('monthToDate');

  const selectPreset = (value) => {
    setPreset(value);
    if (value === 'custom') return;
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);
    if (value === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (value === 'thisWeek') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    } else if (value === 'last30Days') {
      start.setDate(start.getDate() - 29);
    }
    onRangeChange(value === 'monthToDate' ? getMonthToDateRange(today) : { fromDate: toInputDate(start), toDate: toInputDate(end) });
  };

  return (
    <LiquidGlassSurface allowOverflow className="relative z-40 mb-4 rounded-2xl p-4 sm:p-5">
      <form
        onSubmit={onApply}
        className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(150px,0.7fr)_minmax(300px,1.4fr)_auto]"
      >
        {children}
        <div className="min-w-0">
          <label htmlFor="dashboard-date-preset" className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Period
          </label>
          <select
            id="dashboard-date-preset"
            value={preset}
            onChange={(event) => selectPreset(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white/70 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="thisWeek">This week</option>
            <option value="monthToDate">Month to date</option>
            <option value="last30Days">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        <div className="min-w-0">
          <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">Date range</span>
          <LiquidGlassDatePicker
            className="w-full min-w-0"
            initialFromDate={range.fromDate}
            initialToDate={range.toDate}
            calendarMode
            stretch
            quickDateTriggerClassName="h-10 rounded-xl border border-slate-200 bg-white/70 px-3 dark:border-slate-700 dark:bg-slate-900"
            onChange={(fromDate, toDate) => {
              onRangeChange({ fromDate, toDate });
              setPreset('custom');
            }}
          />
        </div>
        <div className="flex h-10 items-stretch gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <Filter size={15} />}
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setPreset('monthToDate');
              onReset();
            }}
            title="Reset filters"
            aria-label="Reset filters"
            className="inline-flex w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-slate-500 transition hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </form>
    </LiquidGlassSurface>
  );
}

DashboardRangeToolbar.propTypes = {
  range: PropTypes.shape({ fromDate: PropTypes.string.isRequired, toDate: PropTypes.string.isRequired }).isRequired,
  onRangeChange: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  children: PropTypes.node
};
