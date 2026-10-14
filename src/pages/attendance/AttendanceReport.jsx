import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogIn,
  Search,
  Target,
  UserCheck,
  Users,
  UserX,
  X
} from 'lucide-react';

import attendanceService from 'services/attendanceService';
import AnchorPagination from '@/components/common/AnchorPagination';
import LiquidGlassDatePicker from '@/components/common/LiquidGlassDatePicker';
import TableRefreshButton from '@/components/common/TableRefreshButton';
import './AttendanceReport.css';

const PAGE_SIZES = [10, 25, 50];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const toInputDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const QUICK_DATE_FILTERS = [
  { value: 'Current Month', label: 'Current Month' },
  { value: 'Today', label: 'Today' },
  { value: 'Yesterday', label: 'Yesterday' },
  { value: 'Last Week', label: 'Last Week' },
  { value: 'Last Month', label: 'Last Month' },
  { value: 'This Year', label: 'This Year' },
  { value: 'Last Year', label: 'Last Year' }
];

const getQuickDatePayload = (value) => {
  const selected = String(value || 'Current Month').trim();
  const now = new Date();
  const today = toInputDate(now);

  if (selected === 'Today') {
    return { fromDate: today, toDate: today };
  }

  if (selected === 'Yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = toInputDate(yesterday);
    return { fromDate: yStr, toDate: yStr };
  }

  if (selected === 'Last Week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { fromDate: toInputDate(start), toDate: today };
  }

  if (selected === 'Current Month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { fromDate: toInputDate(start), toDate: today };
  }

  if (selected === 'Last Month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { fromDate: toInputDate(start), toDate: toInputDate(end) };
  }

  if (selected === 'This Year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { fromDate: toInputDate(start), toDate: today };
  }

  if (selected === 'Last Year') {
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear() - 1, 11, 31);
    return { fromDate: toInputDate(start), toDate: toInputDate(end) };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { fromDate: toInputDate(start), toDate: today };
};

const getInitialFilters = () => {
  const initialRange = getQuickDatePayload('Current Month');
  return {
    fromDate: initialRange.fromDate,
    toDate: initialRange.toDate,
    searchText: '',
    includeInactiveUsers: false
  };
};

const formatMinutes = (value) => {
  const total = Math.max(0, Number(value) || 0);
  if (!total) return '0m';
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total % 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const getTotalCount = (...values) => {
  for (const value of values) {
    const count = Number(value);
    if (Number.isFinite(count) && count > 0) return count;
  }
  return 0;
};

const buildApiParams = (filters, page, pageSize) => ({
  PageNumber: page,
  PageSize: pageSize,
  IsDescending: false,
  IncludeInactiveUsers: filters.includeInactiveUsers,
  FromDate: filters.fromDate ? `${filters.fromDate}T00:00:00` : '',
  ToDate: filters.toDate ? `${filters.toDate}T23:59:59` : '',
  Text: (filters.searchText || '').trim()
});

const getInitials = (row) => {
  const name = String(row?.fullName || row?.userName || 'User').trim();
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

const getValue = (row, keys, fallback = 0) => {
  for (const key of keys) {
    if (row?.[key] !== null && row?.[key] !== undefined && row?.[key] !== '') return row[key];
  }
  return fallback;
};

const getRowStats = (row) => {
  const present = Number(getValue(row, ['presentDays', 'presentCount', 'totalPresent'])) || 0;
  const absent = Number(getValue(row, ['absentDays', 'absentCount', 'totalAbsent'])) || 0;
  const late = Number(getValue(row, ['lateDays', 'lateCount', 'totalLate'])) || 0;
  const totalMarked = present + absent;
  const percentage = Number(getValue(row, ['presentPct', 'presentPercentage', 'attendancePercentage'], NaN));

  return {
    present,
    absent,
    late,
    percentage: Number.isFinite(percentage) ? percentage : totalMarked ? (present / totalMarked) * 100 : 0,
    logins: Number(getValue(row, ['totalLogins', 'loginCount', 'logins'])) || 0,
    session: Number(getValue(row, ['totalSessionMinutes', 'sessionMinutes'])) || 0,
    leads: Number(getValue(row, ['totalLeads', 'totalLeadsPicked', 'leadsPicked'])) || 0
  };
};

/**
 * Universal date comparator that matches date keys in DD-MM-YYYY, YYYY-MM-DD,
 * DD/MM/YYYY, DD-MMM-YYYY, or single day numbers against target year, month (1-based), day.
 */
const matchDate = (dateVal, targetYear, targetMonth, targetDay) => {
  if (dateVal === null || dateVal === undefined || dateVal === '') return false;
  const s = String(dateVal).trim();
  if (!s) return false;

  // 1. Matches YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = Number(ymdMatch[1]);
    const m = Number(ymdMatch[2]);
    const d = Number(ymdMatch[3]);
    return y === targetYear && m === targetMonth && d === targetDay;
  }

  // 2. Matches DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    if (y === targetYear) {
      if (d === targetDay && m === targetMonth) return true;
      if (d === targetMonth && m === targetDay) return true;
    }
    return false;
  }

  // 3. Matches DD-MMM-YYYY or DD-MMM (e.g. 01-Oct-2026, 1-Oct, 06-Oct)
  const dMmmMatch = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s]?(\d{4})?/);
  if (dMmmMatch) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIndex = months.indexOf(dMmmMatch[2].toLowerCase()) + 1;
    const y = dMmmMatch[3] ? Number(dMmmMatch[3]) : targetYear;
    return mIndex === targetMonth && y === targetYear && Number(dMmmMatch[1]) === targetDay;
  }

  // 4. Matches single day number: e.g. "1" or "01"
  if (/^\d{1,2}$/.test(s)) {
    return Number(s) === targetDay;
  }

  // 5. Standard Date parse fallback
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return (
      parsed.getFullYear() === targetYear &&
      parsed.getMonth() + 1 === targetMonth &&
      parsed.getDate() === targetDay
    );
  }

  return false;
};

/**
 * Searches user record across all possible containers (.dates, .dayWise, .attendance, etc.)
 */
const findAttendanceEntry = (user, year, month, day) => {
  if (!user) return null;

  const containers = [
    user.dates,
    user.attendance,
    user.attendanceDetails,
    user.records,
    user.dayWise,
    user.attendanceList,
    user.days
  ];

  for (const container of containers) {
    if (!container) continue;

    if (Array.isArray(container)) {
      const match = container.find((item) => {
        if (!item) return false;
        if (typeof item === 'string') return matchDate(item, year, month, day);
        return [
          item.date,
          item.dateCol,
          item.businessDate,
          item.attendanceDate,
          item.day,
          item.recordDate,
          item.dateString
        ].some((val) => matchDate(val, year, month, day));
      });
      if (match) return match;
    }

    if (typeof container === 'object' && !Array.isArray(container)) {
      const matchedKey = Object.keys(container).find((k) => matchDate(k, year, month, day));
      if (matchedKey !== undefined) {
        return container[matchedKey];
      }
    }
  }

  return null;
};

const parseDateToTuple = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return { y: Number(ymd[1]), m: Number(ymd[2]), d: Number(ymd[3]) };
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return { y: Number(dmy[3]), m: Number(dmy[2]), d: Number(dmy[1]) };
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return { y: parsed.getFullYear(), m: parsed.getMonth() + 1, d: parsed.getDate() };
  }
  return null;
};

const dateToNumber = (tuple) => (tuple ? tuple.y * 10000 + tuple.m * 100 + tuple.d : 0);

/**
 * Resolves standard status: 'present' | 'absent' | 'late' | 'weekend' | 'leave' | 'holiday' | null
 */
const resolveAttendanceStatus = (entry) => {
  if (entry === null || entry === undefined) return null;
  let statusStr = '';
  let isLate = false;
  let logins = 0;
  let session = 0;

  if (typeof entry === 'object') {
    isLate = Boolean(entry.isLate || entry.late);
    logins = Number(entry.logins || entry.loginCount || 0);
    session = Number(entry.sessionMinutes || entry.session || 0);
    statusStr = String(
      entry.status ||
      entry.attendanceStatus ||
      entry.value ||
      entry.code ||
      entry.attendance ||
      entry.state ||
      ''
    ).trim();
  } else {
    statusStr = String(entry).trim();
  }

  const s = statusStr.toLowerCase();

  // If entry is a dash or empty string, do not treat as resolved status - let range analysis decide
  if (!s || s === '-' || s === '—' || s === 'none' || s === 'no record') {
    if (logins > 0 || session > 0) return isLate ? 'late' : 'present';
    return null;
  }

  if (s === 'p' || s.startsWith('pres') || s === 'pr' || s === 'present') {
    return isLate ? 'late' : 'present';
  }
  if (s === 'a' || s.startsWith('abs') || s === 'absent') {
    return 'absent';
  }
  if (s === 'l' || s.startsWith('late') || isLate) {
    return 'late';
  }
  if (s === 'w' || s === 'wo' || s.startsWith('week') || s === 'off') {
    return 'weekend';
  }
  if (s === 'h' || s.startsWith('holi')) {
    return 'holiday';
  }
  if (s.startsWith('leave') || s === 'lv' || s === 'pl' || s === 'cl' || s === 'sl') {
    return 'leave';
  }
  if (s.startsWith('half') || s === 'hd') {
    return 'halfday';
  }

  if (logins > 0 || session > 0) {
    return isLate ? 'late' : 'present';
  }

  return null;
};

/**
 * Computes calendar day status with smart fallback for active date range
 */
const getDayAttendanceInfo = (user, year, month, day, dateRange) => {
  const targetDateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayDate = new Date(year, month - 1, day);
  const isSunday = dayDate.getDay() === 0;

  // 1. Direct record in user.dates or related fields
  const entry = findAttendanceEntry(user, year, month, day);
  const status = resolveAttendanceStatus(entry);

  if (status) {
    return {
      type: status,
      raw: entry,
      dateKey: targetDateKey,
      isSunday
    };
  }

  // 2. Check if this date falls within the active query date range (numeric comparison)
  const targetNum = year * 10000 + month * 100 + day;
  const fromNum = dateToNumber(parseDateToTuple(dateRange?.fromDate));
  const toNum = dateToNumber(parseDateToTuple(dateRange?.toDate));
  const isWithinQueryRange = fromNum > 0 && toNum > 0 && targetNum >= fromNum && targetNum <= toNum;

  if (isWithinQueryRange) {
    const stats = getRowStats(user);

    // If user has 0 present days and > 0 absent days: all days in range are Absent!
    if (stats.present === 0 && stats.absent > 0) {
      return {
        type: 'absent',
        raw: 'Absent',
        dateKey: targetDateKey,
        isSunday
      };
    }

    // If user has > 0 present days and 0 absent days: all days in range are Present!
    if (stats.absent === 0 && stats.present > 0) {
      return {
        type: 'present',
        raw: 'Present',
        dateKey: targetDateKey,
        isSunday
      };
    }

    // If user has mixed stats:
    // If entry had any punch/login activity -> present; otherwise unmarked working day is absent
    if (stats.absent > 0) {
      return {
        type: 'absent',
        raw: 'Absent',
        dateKey: targetDateKey,
        isSunday
      };
    }
  }

  // 3. Sunday default if no record outside active range
  if (isSunday) {
    return {
      type: 'weekend',
      raw: null,
      dateKey: targetDateKey,
      isSunday
    };
  }

  return {
    type: 'none',
    raw: null,
    dateKey: targetDateKey,
    isSunday
  };
};

const buildCalendarDays = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekDay }, () => null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const StatCard = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    violet: {
      card: 'border-violet-100 bg-gradient-to-br from-violet-500/5 via-violet-500/[0.02] to-transparent dark:border-violet-500/20 dark:from-violet-500/10',
      icon: 'bg-violet-50 text-violet-600 ring-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:ring-violet-400/20'
    },
    green: {
      card: 'border-emerald-100 bg-gradient-to-br from-emerald-500/5 via-emerald-500/[0.02] to-transparent dark:border-emerald-500/20 dark:from-emerald-500/10',
      icon: 'bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/20'
    },
    rose: {
      card: 'border-rose-100 bg-gradient-to-br from-rose-500/5 via-rose-500/[0.02] to-transparent dark:border-rose-500/20 dark:from-rose-500/10',
      icon: 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:ring-rose-400/20'
    },
    amber: {
      card: 'border-amber-100 bg-gradient-to-br from-amber-500/5 via-amber-500/[0.02] to-transparent dark:border-amber-500/20 dark:from-amber-500/10',
      icon: 'bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-400/20'
    }
  };

  const style = tones[tone] || tones.violet;

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md dark:bg-[#17132a] ${style.card}`}
    >
      <div className="flex items-center gap-3.5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-xs ${style.icon}`}>
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
};

const AttendanceCalendarModal = ({ user, initialMonth, dateRange, onClose }) => {
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState('');
  const days = useMemo(() => buildCalendarDays(month), [month]);
  const stats = getRowStats(user);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const moveMonth = (amount) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    setSelectedDate('');
  };

  const selectedDayInfo = useMemo(() => {
    if (!selectedDate) return null;
    const parts = selectedDate.split('-');
    if (parts.length !== 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    return getDayAttendanceInfo(user, y, m, d, dateRange);
  }, [selectedDate, user, dateRange]);

  return (
    <div
      className="attendance-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="User attendance calendar"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="attendance-calendar-modal w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl dark:border-white/10 dark:bg-[#17132a]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 bg-slate-50/60 px-5 py-4 sm:px-6 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="attendance-user-avatar flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-md shadow-violet-500/20">
              {getInitials(user)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">
                {user.fullName || user.userName || `User #${user.userId}`}
              </h2>
              <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-violet-600 dark:text-violet-400">{user.roleName || 'User'}</span>
                {user.userName ? ` · ${user.userName}` : ''}
                {user.email ? ` · ${user.email}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 dark:border-white/10 dark:hover:bg-white/5"
            aria-label="Close calendar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-200/80 p-4 sm:grid-cols-4 sm:px-6 dark:border-white/10">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-300">{stats.present}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-400">Present</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-center dark:border-rose-500/20 dark:bg-rose-500/10">
            <div className="text-xl font-bold text-rose-600 dark:text-rose-300">{stats.absent}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700/80 dark:text-rose-400">Absent</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-300">{stats.late}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-400">Late</div>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-center dark:border-violet-500/20 dark:bg-violet-500/10">
            <div className="text-xl font-bold text-violet-600 dark:text-violet-300">{Math.round(stats.percentage)}%</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700/80 dark:text-violet-400">Rate</div>
          </div>
        </div>

        {/* Calendar Body */}
        <div className="p-4 sm:p-6">
          {/* Month Navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white">
              <CalendarDays size={18} className="text-violet-600 dark:text-violet-400" />
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday Row */}
          <div className="attendance-calendar-grid mb-1.5">
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className={`text-center text-[11px] font-bold uppercase tracking-wider pb-1 ${
                  day === 'Sun' ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid of Day Boxes */}
          <div className="attendance-calendar-grid">
            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="attendance-calendar-empty rounded-xl border border-transparent" />;
              }

              const dNum = date.getDate();
              const mNum = date.getMonth() + 1;
              const yNum = date.getFullYear();
              const dayInfo = getDayAttendanceInfo(user, yNum, mNum, dNum, dateRange);
              const dateKey = dayInfo.dateKey;
              const isToday = dateKey === toInputDate(new Date());
              const isSelected = dateKey === selectedDate;

              // Determine classes and labels
              let boxClass = 'attendance-day--none';
              let statusLabel = '—';
              let badgeElement = <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>;
              let dateColor = 'text-slate-400 dark:text-slate-500';

              if (dayInfo.type === 'present') {
                boxClass = 'attendance-day--present';
                statusLabel = 'Present';
                dateColor = 'font-bold text-emerald-700 dark:text-emerald-300 text-sm';
                badgeElement = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white shadow-xs uppercase tracking-wider">
                    Present
                  </span>
                );
              } else if (dayInfo.type === 'absent') {
                boxClass = 'attendance-day--absent';
                statusLabel = 'Absent';
                dateColor = 'font-bold text-rose-700 dark:text-rose-300 text-sm';
                badgeElement = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-white shadow-xs uppercase tracking-wider">
                    Absent
                  </span>
                );
              } else if (dayInfo.type === 'late') {
                boxClass = 'attendance-day--late';
                statusLabel = 'Late';
                dateColor = 'font-bold text-amber-700 dark:text-amber-300 text-sm';
                badgeElement = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-xs uppercase tracking-wider">
                    Late
                  </span>
                );
              } else if (dayInfo.type === 'weekend') {
                boxClass = 'attendance-day--weekend';
                statusLabel = 'Off';
                dateColor = 'font-semibold text-slate-500 dark:text-slate-400 text-sm';
                badgeElement = (
                  <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                    Off
                  </span>
                );
              } else if (dayInfo.type === 'leave') {
                boxClass = 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-300';
                statusLabel = 'Leave';
                dateColor = 'font-bold text-sky-700 dark:text-sky-300 text-sm';
                badgeElement = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500 text-white shadow-xs uppercase tracking-wider">
                    Leave
                  </span>
                );
              }

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDate(dateKey)}
                  className={`attendance-calendar-day relative flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer ${boxClass} ${
                    isSelected ? 'ring-2 ring-violet-500 ring-offset-2 scale-[1.02] shadow-md dark:ring-offset-[#17132a]' : ''
                  }`}
                  title={`${dateKey}: ${statusLabel}`}
                >
                  <span className={`attendance-calendar-date ${dateColor}`}>{dNum}</span>
                  <div className="attendance-calendar-status flex items-center justify-center">
                    {badgeElement}
                  </div>
                  {isToday && (
                    <span
                      className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-600 ring-2 ring-white dark:ring-[#17132a]"
                      title="Today"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Legend & Selected Day Info */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4 dark:border-white/10">
            {/* Color Legend */}
            <div className="flex flex-wrap items-center gap-3.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-md border border-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 dark:border-emerald-500" />
                <span>Present</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-md border border-rose-400 bg-rose-100 dark:bg-rose-950/60 dark:border-rose-500" />
                <span>Absent</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-md border border-amber-400 bg-amber-100 dark:bg-amber-950/60 dark:border-amber-500" />
                <span>Late</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-md border border-dashed border-slate-300 bg-slate-100 dark:border-white/10 dark:bg-white/5" />
                <span>Weekend / Off</span>
              </span>
            </div>

            {/* Selected day badge */}
            {selectedDate && selectedDayInfo && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/90 px-3 py-1.5 text-xs font-semibold text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200">
                <span>{selectedDate}</span>
                <span>·</span>
                <span className="capitalize">
                  {selectedDayInfo.type === 'none' ? 'No record' : selectedDayInfo.type}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AttendanceReport() {
  const initialFilters = useMemo(getInitialFilters, []);
  const [filters, setFilters] = useState(initialFilters);
  const [quickDateFilter, setQuickDateFilter] = useState('Current Month');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);

  // Debounce user search input
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      setFilters((prev) => ({ ...prev, searchText: value }));
    }, 350);
  };

  // Status dropdown change
  const handleStatusChange = (event) => {
    const includeInactive = event.target.value === 'all';
    setPage(1);
    setFilters((prev) => ({ ...prev, includeInactiveUsers: includeInactive }));
  };

  // Quick Date Filter change (Current Month, Today, Yesterday, etc.)
  const handleQuickDateChange = (event) => {
    const value = event.target.value;
    setQuickDateFilter(value);
    const range = getQuickDatePayload(value);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      fromDate: range.fromDate,
      toDate: range.toDate
    }));
  };

  // LiquidGlassDatePicker change (custom dates or step arrows)
  const handleDateRangeChange = (from, to) => {
    setQuickDateFilter('Custom');
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      fromDate: from,
      toDate: to
    }));
  };

  const handleResetDate = () => {
    const def = getQuickDatePayload('Current Month');
    setQuickDateFilter('Current Month');
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      fromDate: def.fromDate,
      toDate: def.toDate
    }));
  };

  const loadReport = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const response = await attendanceService.getRegister(buildApiParams(filters, page, pageSize), signal);
        const payload = response?.data || {};
        const users = Array.isArray(payload.users) ? payload.users : [];
        const totals = new Map(
          (Array.isArray(payload.totals) ? payload.totals : []).map((item) => [Number(item?.userId) || 0, item])
        );
        setRows(users.map((user) => ({ ...(totals.get(Number(user?.userId) || 0) || {}), ...user })));
        setTotalCount(getTotalCount(payload.totalCount, response?.totalCount, users.length));
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        setRows([]);
        setTotalCount(0);
        setError(requestError.message || 'Unable to load attendance data.');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [filters, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadReport(controller.signal);
    return () => controller.abort();
  }, [loadReport, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const summary = useMemo(() => {
    const totals = rows.reduce(
      (result, row) => {
        const stats = getRowStats(row);
        result.present += stats.present;
        result.absent += stats.absent;
        result.session += stats.session;
        return result;
      },
      { present: 0, absent: 0, session: 0 }
    );
    const marked = totals.present + totals.absent;
    return { ...totals, percentage: marked ? Math.round((totals.present / marked) * 100) : 0 };
  }, [rows]);

  const calendarInitialMonth = useMemo(() => {
    const dateStr = filters.toDate || filters.fromDate || toInputDate(new Date());
    const date = new Date(`${dateStr}T12:00:00`);
    return Number.isNaN(date.getTime()) ? new Date() : new Date(date.getFullYear(), date.getMonth(), 1);
  }, [filters.toDate, filters.fromDate]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── Top Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-600 shadow-sm dark:border-violet-500/20 dark:bg-gradient-to-br dark:from-violet-500/10 dark:to-indigo-500/10 dark:text-violet-300">
            <CalendarDays size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Attendance</h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Review attendance, login activity, session time, and leads.
            </p>
          </div>
        </div>
      </div>

      {/* ── Modern Toolbar (Dashboard Style with LiquidGlassDatePicker + TableRefreshButton and NO Apply Button) ── */}
      <div className="attendance-toolbar flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between dark:border-white/10 dark:bg-[#17132a]">
        {/* Left filters: Search user & User status */}
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search User Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name, username, or email"
              value={searchInput}
              onChange={handleSearchChange}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-white/10 dark:bg-[#0f1322] dark:text-white"
            />
          </div>

          {/* User Status Select */}
          <div className="w-full sm:w-44 shrink-0">
            <select
              value={filters.includeInactiveUsers ? 'all' : 'active'}
              onChange={handleStatusChange}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-white/10 dark:bg-[#0f1322] dark:text-white"
            >
              <option value="active">Active users</option>
              <option value="all">Include inactive</option>
            </select>
          </div>
        </div>

        {/* Right filters: Quick Date Dropdown + Dashboard LiquidGlassDatePicker + TableRefreshButton */}
        <div className="flex flex-col min-[520px]:flex-row items-stretch min-[520px]:items-center gap-2 shrink-0">
          {/* Quick Date Presets */}
          <div className="w-full min-[520px]:w-36 shrink-0">
            <select
              value={quickDateFilter}
              onChange={handleQuickDateChange}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 dark:border-white/10 dark:bg-[#0f1322] dark:text-white font-medium"
            >
              {QUICK_DATE_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              {quickDateFilter === 'Custom' && <option value="Custom">Custom Range</option>}
            </select>
          </div>

          {/* LiquidGlassDatePicker & Refresh Button Group (Exactly like Dashboard!) */}
          <div className="flex items-center gap-2">
            <LiquidGlassDatePicker
              className="attendance-datepicker flex-1 sm:flex-none"
              key={`attendance-date-${filters.fromDate || ''}-${filters.toDate || ''}`}
              initialFromDate={filters.fromDate || ''}
              initialToDate={filters.toDate || ''}
              emptyLabel="This month"
              showQuickDateDropdown={false}
              showClearButton={false}
              onChange={handleDateRangeChange}
              onClear={handleResetDate}
            />
            <TableRefreshButton
              title="Refresh attendance data"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-xs dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={totalCount} tone="violet" />
        <StatCard icon={UserCheck} label="Present days" value={summary.present} tone="green" />
        <StatCard icon={UserX} label="Absent days" value={summary.absent} tone="rose" />
        <StatCard icon={Clock3} label="Session time" value={formatMinutes(summary.session)} tone="amber" />
      </div>

      {/* ── User Attendance Table Card ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-white/10 dark:bg-[#17132a]">
        <div className="flex flex-col gap-2 border-b border-slate-200/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">User Attendance</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Click any user row to view their monthly calendar with present and absent boxes.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-200/60 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20">
            Team attendance: {summary.percentage}%
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-[#1d1733] dark:text-slate-400">
                <th className="px-5 py-3.5">User</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5 text-center">Present</th>
                <th className="px-4 py-3.5 text-center">Absent</th>
                <th className="px-4 py-3.5 text-center">Late</th>
                <th className="px-4 py-3.5 text-center">Present %</th>
                <th className="px-4 py-3.5 text-center">Logins</th>
                <th className="px-4 py-3.5 text-center">Session</th>
                <th className="px-4 py-3.5 text-center">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm dark:divide-white/5">
              {loading &&
                Array.from({ length: Math.min(pageSize, 6) }).map((_, index) => (
                  <tr key={`attendance-loading-${index}`} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="h-9 w-44 rounded-lg bg-slate-100 dark:bg-white/5" />
                    </td>
                    {Array.from({ length: 8 }).map((__, cell) => (
                      <td key={cell} className="px-4 py-4">
                        <div className="mx-auto h-5 w-12 rounded bg-slate-100 dark:bg-white/5" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-300">
                        <CalendarDays size={27} />
                      </div>
                      <p className="font-semibold text-slate-700 dark:text-slate-200">No attendance records found</p>
                      <p className="mt-1 text-xs text-slate-400">Try adjusting your date range or search term.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row, index) => {
                  const stats = getRowStats(row);
                  return (
                    <tr
                      key={row.userId || index}
                      onClick={() => setSelectedUser(row)}
                      className="group cursor-pointer transition hover:bg-violet-50/50 dark:hover:bg-violet-500/[0.04]"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 text-left">
                          <span className="attendance-user-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm">
                            {getInitials(row)}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[220px] truncate font-semibold text-slate-800 transition group-hover:text-violet-700 dark:text-slate-100 dark:group-hover:text-violet-300">
                              {row.fullName || row.userName || `User #${row.userId}`}
                            </span>
                            <span className="block max-w-[220px] truncate text-xs text-slate-400">
                              {row.email || row.userName || `ID #${row.userId}`}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
                          {row.roleName || row.role || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex min-w-8 justify-center rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {stats.present}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex min-w-8 justify-center rounded-lg bg-rose-50 px-2 py-1 font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                          {stats.absent}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex min-w-8 justify-center rounded-lg bg-amber-50 px-2 py-1 font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                          {stats.late}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="mx-auto w-24">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round(stats.percentage)}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                              style={{ width: `${Math.min(100, Math.max(0, stats.percentage))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                          <LogIn size={14} className="text-sky-500" />
                          {stats.logins}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{formatMinutes(stats.session)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                          <Target size={14} className="text-violet-500" />
                          {stats.leads}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none dark:border-white/10 dark:bg-[#0f1322] dark:text-white"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>{totalCount} users</span>
          </div>
          <AnchorPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />
        </div>
      </div>

      {/* ── User Monthly Attendance Calendar Modal ── */}
      {selectedUser && (
        <AttendanceCalendarModal
          user={selectedUser}
          initialMonth={calendarInitialMonth}
          dateRange={{ fromDate: filters.fromDate, toDate: filters.toDate }}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
