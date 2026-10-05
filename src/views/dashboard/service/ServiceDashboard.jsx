import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  Inbox,
  LifeBuoy,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Ticket,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';

import dashboardService from 'services/dashboardService';
import userService from 'services/userService';
import AnchorPagination from '@/components/common/AnchorPagination';
import { getMonthToDateRange, isValidDateRange, toInputDate } from 'utils/dateUtils';
import { asArray, findNumber, integer, textValue } from '../dashboardData';

const statusOf = (ticket) => textValue(ticket, ['statusName', 'ticketStatus', 'status', 'state'], 'New').toLowerCase();
const isClosed = (status) => ['closed', 'complete', 'completed', 'resolved'].some((value) => status.includes(value));
const isProgress = (status) => ['progress', 'assigned', 'working', 'pending'].some((value) => status.includes(value));

const getInitials = (name) => {
  if (!name || name === '-') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getAvatarBg = (name) => {
  const styles = [
    'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/50',
    'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200/50',
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50',
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50',
    'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/50',
    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/50'
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return styles[Math.abs(hash) % styles.length];
};

const formatCreatedDate = (rawDate) => {
  if (!rawDate || rawDate === '-') return '-';
  try {
    const d = new Date(rawDate);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  } catch {
    // fallback
  }
  return String(rawDate);
};

export default function ServiceDashboard() {
  const initialRange = useMemo(() => getMonthToDateRange(), []);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const [userId, setUserId] = useState('');
  const [draftUserId, setDraftUserId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'new' | 'progress' | 'closed'
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState({});
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError('');
      try {
        const [dashboard, userOptions] = await Promise.all([
          dashboardService.getServiceManagerDashboard(range.fromDate, range.toDate, userId || undefined, signal, { pageSize: 100 }),
          userService.getUserDropDown({ PageSize: 200 }, signal).catch(() => [])
        ]);
        if (signal.aborted) return;
        setRaw(dashboard.data || {});
        setTickets(asArray(dashboard.data));
        setUsers(userOptions);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setRaw({});
          setTickets([]);
          setError(requestError.message || 'Service dashboard could not be loaded.');
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [range, userId]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  const derived = tickets.reduce(
    (total, ticket) => {
      const status = statusOf(ticket);
      if (isClosed(status)) total.closed += 1;
      else if (isProgress(status)) total.progress += 1;
      else total.new += 1;
      const customerId = textValue(ticket, ['customerId', 'clientId'], '');
      const customerType = textValue(ticket, ['customerType', 'customerStatus'], '').toLowerCase();
      if (customerType.includes('new') || !customerId) total.newCustomers += 1;
      else total.existingCustomers += 1;
      return total;
    },
    { new: 0, progress: 0, closed: 0, newCustomers: 0, existingCustomers: 0 }
  );

  const counts = {
    new: findNumber(raw, ['newTickets', 'newTicketCount', 'totalNew'], derived.new),
    progress: findNumber(raw, ['inProgressTickets', 'progressTicketCount', 'totalInProgress'], derived.progress),
    closed: findNumber(raw, ['closedTickets', 'closedTicketCount', 'totalClosed'], derived.closed),
    newCustomers: findNumber(raw, ['newCustomers', 'newCustomerCount'], derived.newCustomers),
    existingCustomers: findNumber(raw, ['existingCustomers', 'existingCustomerCount'], derived.existingCustomers)
  };

  const total = counts.new + counts.progress + counts.closed || tickets.length;
  const totalCustomers = counts.newCustomers + counts.existingCustomers;

  // Percentage calculations
  const pctNew = total > 0 ? Math.round((counts.new / total) * 100) : 0;
  const pctProgress = total > 0 ? Math.round((counts.progress / total) * 100) : 0;
  const pctClosed = total > 0 ? Math.max(0, 100 - pctNew - pctProgress) : 0;

  const pctNewCustomers = totalCustomers > 0 ? Math.round((counts.newCustomers / totalCustomers) * 100) : 0;
  const pctExistingCustomers = totalCustomers > 0 ? Math.max(0, 100 - pctNewCustomers) : 0;

  // Filtered tickets based on search query and status filter tab
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const status = statusOf(ticket);
      if (statusFilter === 'new' && (isClosed(status) || isProgress(status))) return false;
      if (statusFilter === 'progress' && !isProgress(status)) return false;
      if (statusFilter === 'closed' && !isClosed(status)) return false;

      if (!search.trim()) return true;
      const haystack = Object.values(ticket || {})
        .join(' ')
        .toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [tickets, search, statusFilter]);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, range, userId]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleApply = (event) => {
    if (event) event.preventDefault();
    if (!isValidDateRange(draftRange)) {
      setError('Please select a valid date range (From Date must be earlier or equal to To Date).');
      return;
    }
    setError('');
    setRange(draftRange);
    setUserId(draftUserId);
  };

  const handlePresetSelect = (presetKey) => {
    const today = new Date();
    let newRange = { fromDate: toInputDate(today), toDate: toInputDate(today) };

    if (presetKey === 'today') {
      newRange = { fromDate: toInputDate(today), toDate: toInputDate(today) };
    } else if (presetKey === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      newRange = { fromDate: toInputDate(yesterday), toDate: toInputDate(yesterday) };
    } else if (presetKey === 'thisWeek') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      newRange = { fromDate: toInputDate(monday), toDate: toInputDate(today) };
    } else if (presetKey === 'monthToDate') {
      newRange = getMonthToDateRange();
    } else if (presetKey === 'last30Days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 30);
      newRange = { fromDate: toInputDate(past), toDate: toInputDate(today) };
    }

    setDraftRange(newRange);
    setRange(newRange);
    setUserId(draftUserId);
  };

  const handleResetFilters = () => {
    const initial = getMonthToDateRange();
    setDraftRange(initial);
    setRange(initial);
    setDraftUserId('');
    setUserId('');
    setSearch('');
    setStatusFilter('all');
  };

  const selectedUserName = useMemo(() => {
    if (!userId) return null;
    const match = users.find((u) => {
      const id = u.userId || u.id || u.value;
      return String(id) === String(userId);
    });
    return match ? textValue(match, ['fullName', 'userName', 'name', 'text', 'label'], 'Assigned User') : null;
  }, [userId, users]);

  return (
    <div className="space-y-5 pb-10">
      {/* 1. TOP HEADER & BREADCRUMB SECTION */}
      <div className="relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-indigo-100/60 blur-3xl dark:bg-indigo-950/30" />
        <div className="relative flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 ring-4 ring-indigo-50 dark:ring-indigo-950/40 flex-shrink-0">
            <LifeBuoy className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Service Manager Dashboard</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Status
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
              <span>
                Ticket overview for{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {range.fromDate}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {range.toDate}
                </span>
              </span>
              {selectedUserName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                  <User size={12} />
                  Agent: {selectedUserName}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="relative flex items-center gap-2.5 self-start lg:self-center">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-95 disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER & RANGE CONTROLS CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Quick Date Presets Bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <SlidersHorizontal size={14} className="text-indigo-500" />
            <span>Quick Range Presets:</span>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'thisWeek', label: 'This Week' },
              { id: 'monthToDate', label: 'Month to Date' },
              { id: 'last30Days', label: 'Last 30 Days' }
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset.id)}
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Inputs Form */}
        <form onSubmit={handleApply} className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
            {/* User Dropdown */}
            <div className="lg:col-span-4">
              <label
                htmlFor="assigned-user-select"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Assigned Agent / User
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <select
                  id="assigned-user-select"
                  value={draftUserId}
                  onChange={(e) => setDraftUserId(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="">All Users (Entire Team)</option>
                  {users.map((user, index) => {
                    const id = user.userId || user.id || user.value || index;
                    return (
                      <option key={id} value={id}>
                        {textValue(user, ['fullName', 'userName', 'name', 'text', 'label'], `User ${index + 1}`)}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* From Date */}
            <div className="lg:col-span-3">
              <label
                htmlFor="dashboard-from-date"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                From Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={16} />
                </div>
                <input
                  id="dashboard-from-date"
                  type="date"
                  value={draftRange.fromDate}
                  max={draftRange.toDate}
                  onChange={(e) => setDraftRange((prev) => ({ ...prev, fromDate: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* To Date */}
            <div className="lg:col-span-3">
              <label
                htmlFor="dashboard-to-date"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                To Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={16} />
                </div>
                <input
                  id="dashboard-to-date"
                  type="date"
                  value={draftRange.toDate}
                  min={draftRange.fromDate}
                  onChange={(e) => setDraftRange((prev) => ({ ...prev, toDate: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Submit & Reset Buttons */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? <RefreshCw size={15} className="animate-spin" /> : <Filter size={15} />}
                <span>Apply</span>
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset filters to default"
                className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-200 shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* 3. TICKET SUMMARY CARDS (NEW, IN PROGRESS, CLOSED) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Ticket Summary</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(Live counts for selected window)</span>
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/50">
            Total Tickets: <strong className="font-bold text-indigo-900 dark:text-indigo-100">{integer.format(total)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* CARD 1: NEW TICKETS */}
          <div className="relative group overflow-hidden rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/40 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">
                  New Tickets
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Waiting to be picked up</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-100 dark:ring-blue-900/40">
                <Ticket className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-5 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  {integer.format(counts.new)}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tickets</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100/80 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                {pctNew}% of total
              </span>
            </div>

            {/* Micro Progress Bar */}
            <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, pctNew))}%` }}
              />
            </div>
          </div>

          {/* CARD 2: IN PROGRESS */}
          <div className="relative group overflow-hidden rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-br from-white via-amber-50/20 to-orange-50/40 dark:from-slate-900 dark:via-amber-950/20 dark:to-slate-900 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                  In Progress
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Currently being worked</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-100 dark:ring-amber-900/40">
                <Clock3 className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-5 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  {integer.format(counts.progress)}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tickets</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                {pctProgress}% of total
              </span>
            </div>

            {/* Micro Progress Bar */}
            <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, pctProgress))}%` }}
              />
            </div>
          </div>

          {/* CARD 3: CLOSED / RESOLVED */}
          <div className="relative group overflow-hidden rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/40 dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                  Closed / Completed
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Finished in this window</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-100 dark:ring-emerald-900/40">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-5 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  {integer.format(counts.closed)}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tickets</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                {pctClosed}% of total
              </span>
            </div>

            {/* Micro Progress Bar */}
            <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, pctClosed))}%` }}
              />
            </div>
          </div>
        </div>

        {/* COMPOSITE DISTRIBUTION BAR */}
        {total > 0 && (
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <TrendingUp size={14} className="text-indigo-500" />
              <span>Status Distribution Pipeline:</span>
            </div>

            <div className="flex-1 max-w-md">
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  title={`New: ${counts.new} (${pctNew}%)`}
                  className="bg-blue-500 transition-all duration-500"
                  style={{ width: `${pctNew}%` }}
                />
                <div
                  title={`In Progress: ${counts.progress} (${pctProgress}%)`}
                  className="bg-amber-500 transition-all duration-500"
                  style={{ width: `${pctProgress}%` }}
                />
                <div
                  title={`Closed: ${counts.closed} (${pctClosed}%)`}
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${pctClosed}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>
                  New: <strong>{counts.new}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>
                  Working: <strong>{counts.progress}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>
                  Resolved: <strong>{counts.closed}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. CUSTOMER MIX SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-5 border-b border-slate-100 dark:border-slate-800 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <span>Customer Breakdown</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Comparison of first-time vs returning customer inquiries</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {integer.format(totalCustomers)} Total Customers
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* New Customers */}
          <div className="flex items-center justify-between p-5 rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-r from-indigo-50/40 to-transparent dark:from-indigo-950/20 dark:to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">New Customers</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">First time raising a ticket</p>
                <div className="mt-1">
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{pctNewCustomers}% of total inquiries</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-slate-900 dark:text-white">{integer.format(counts.newCustomers)}</div>
              <span className="text-xs text-slate-400">accounts</span>
            </div>
          </div>

          {/* Existing Customers */}
          <div className="flex items-center justify-between p-5 rounded-xl border border-sky-100 dark:border-sky-950/60 bg-gradient-to-r from-sky-50/40 to-transparent dark:from-sky-950/20 dark:to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">Existing Customers</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Have raised tickets before</p>
                <div className="mt-1">
                  <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">{pctExistingCustomers}% of total inquiries</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-slate-900 dark:text-white">{integer.format(counts.existingCustomers)}</div>
              <span className="text-xs text-slate-400">accounts</span>
            </div>
          </div>
        </div>

        {/* Customer Mix Proportion Track */}
        {totalCustomers > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span>New Customers ({pctNewCustomers}%)</span>
              <span>Existing Customers ({pctExistingCustomers}%)</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${pctNewCustomers}%` }} />
              <div className="bg-sky-500 h-full transition-all duration-500" style={{ width: `${pctExistingCustomers}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* 5. TICKETS DATA TABLE SECTION */}
      <section
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
        aria-labelledby="service-ticket-table-title"
      >
        {/* Table Top Controls: Status Tabs & Search Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-200/70 dark:border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <h2 id="service-ticket-table-title" className="text-base font-bold text-slate-900 dark:text-white">
                Service tickets
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Review tickets for the selected date range and assigned agent.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={15} />
              </div>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket, customer or agent"
                aria-label="Search service tickets"
                className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear ticket search"
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800/80">
            {[
              { id: 'all', label: 'All Tickets', count: tickets.length },
              { id: 'new', label: 'New', count: counts.new },
              { id: 'progress', label: 'In Progress', count: counts.progress },
              { id: 'closed', label: 'Closed', count: counts.closed }
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50/90 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800">
              <tr>
                <th scope="col" className="py-3.5 px-6">
                  Ticket
                </th>
                <th scope="col" className="py-3.5 px-6">
                  Customer
                </th>
                <th scope="col" className="py-3.5 px-6">
                  Assigned To
                </th>
                <th scope="col" className="py-3.5 px-6">
                  Status
                </th>
                <th scope="col" className="py-3.5 px-6">
                  Created On
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="inline-flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading service tickets...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="max-w-xs mx-auto flex flex-col items-center justify-center text-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                        <Inbox className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">No tickets found</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {search
                          ? 'No tickets matched your search query. Try clearing the search or changing status filter.'
                          : 'No service tickets were recorded for the selected date range and user.'}
                      </p>
                      {search && (
                        <button
                          type="button"
                          onClick={() => setSearch('')}
                          className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                        >
                          Clear Search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedTickets.map((ticket, index) => {
                  const status = statusOf(ticket);
                  const isTicketClosed = isClosed(status);
                  const isTicketProgress = isProgress(status);

                  const ticketNumber = textValue(
                    ticket,
                    ['ticketNumber', 'ticketNo', 'reference', 'code'],
                    `#TK-${(currentPage - 1) * pageSize + index + 1}`
                  );
                  const subject = textValue(ticket, ['subject', 'title', 'description', 'issue'], 'Service Inquiry');
                  const customerName = textValue(ticket, ['customerName', 'clientName', 'companyName', 'customer'], '-');
                  const assignedTo = textValue(ticket, ['assignedUserName', 'assignedTo', 'userName'], 'Unassigned');
                  const createdDate = textValue(ticket, ['createdDate', 'createdOn', 'date'], '-');
                  const statusLabel = textValue(ticket, ['statusName', 'ticketStatus', 'status', 'state'], 'New');

                  return (
                    <tr
                      key={ticket.ticketId || ticket.id || index}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Ticket Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/40">
                            {ticketNumber}
                          </span>
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1 line-clamp-1 max-w-sm">{subject}</div>
                      </td>

                      {/* Customer Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0 ${getAvatarBg(
                              customerName
                            )}`}
                          >
                            {getInitials(customerName)}
                          </div>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{customerName}</span>
                        </div>
                      </td>

                      {/* Assigned Agent Column */}
                      <td className="py-4 px-6">
                        {assignedTo !== 'Unassigned' ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span>{assignedTo}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="py-4 px-6">
                        {isTicketClosed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {statusLabel}
                          </span>
                        ) : isTicketProgress ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {statusLabel}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            {statusLabel}
                          </span>
                        )}
                      </td>

                      {/* Created Date Column */}
                      <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={13} className="text-slate-400" />
                          <span>{formatCreatedDate(createdDate)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-200">
                {filteredTickets.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </strong>{' '}
              to{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-200">
                {Math.min(currentPage * pageSize, filteredTickets.length)}
              </strong>{' '}
              of <strong className="font-semibold text-slate-700 dark:text-slate-200">{filteredTickets.length}</strong> entries
            </span>

            {/* Page Size Selector */}
            <label htmlFor="service-ticket-page-size" className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                id="service-ticket-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="min-w-16 py-1.5 pl-2.5 pr-7 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          {/* Page Navigator */}
          {totalPages > 1 && (
            <AnchorPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
              disabled={loading}
              className="service-dashboard-pagination"
            />
          )}
        </div>
      </section>
    </div>
  );
}
