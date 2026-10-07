import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileBarChart,
  History,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserRoundCheck
} from 'lucide-react';
import { Badge, Button, Card, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { toast } from 'sonner';

import CommonTable from '@/components/common/CommonTable';
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal';
import IosToggle from '@/components/common/IosToggle';
import authService from '@/services/authService';
import leadService from '@/services/leadService';
import { resolveConfiguredPagePermissions } from '@/utils/configuredPagePermissions';
import './LeadsPage.css';

const PAGE_SIZES = [10, 25, 50, 100];
const MAX_EXPORT_PAGES = 1000;
const TABS = [
  { id: 'new', label: 'New Leads', short: 'New', route: '/NewLeads', aliases: ['/NewLeads', 'New Leads', 'NewLeads'] },
  { id: 'my', label: 'My Leads', short: 'Mine', route: '/Leads/MyLeads', aliases: ['/Leads/MyLeads', 'My Leads', 'MyLeads'] },
  {
    id: 'callback',
    label: 'Call Back',
    short: 'Callbacks',
    route: '/Leads/CallBack',
    aliases: ['/Leads/CallBack', 'Call Back', 'Callback']
  },
  {
    id: 'voicemail',
    label: 'Voicemails',
    short: 'Voicemail',
    route: '/Leads/voicemail',
    aliases: ['/Leads/voicemail', 'Voicemails', 'Voicemail']
  },
  { id: 'leads', label: 'Leads', short: 'All', route: '/Leads?tab=leads', aliases: ['/Leads', 'Leads'] }
];

const getMessage = (error, fallback) => error?.message || error?.response?.data?.message || fallback;
const currentUser = () => authService.getUser() || {};
const userName = () => currentUser().displayName || currentUser().userName || currentUser().email || '';
const hasPermissionCode = (code) =>
  (currentUser().permissionCodes || []).some((permission) =>
    String(typeof permission === 'string' ? permission : permission?.permissionCode)
      .trim()
      .toLowerCase()
      .includes(String(code).toLowerCase())
  );
const ymd = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const toInputParts = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { date: '', time: '' };
  return { date: ymd(date), time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` };
};
const localDateTime = (date, time = '') => (date ? `${date}T${time || '00:00'}:00` : '');
const formatPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const us = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return us.length === 10 ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : value || '-';
};
const formatDate = (value, timeZone) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
};
const relativeDate = (value, now) => {
  const time = new Date(value).getTime();
  if (!value || Number.isNaN(time)) return '';
  const seconds = Math.round((time - now) / 1000);
  const abs = Math.abs(seconds);
  const [amount, unit] =
    abs < 60
      ? [seconds, 'second']
      : abs < 3600
        ? [Math.round(seconds / 60), 'minute']
        : abs < 86400
          ? [Math.round(seconds / 3600), 'hour']
          : [Math.round(seconds / 86400), 'day'];
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(amount, unit);
};
const badge = (value, bg = 'light', text = 'dark') =>
  value ? (
    <Badge bg={bg} text={text} className="lead-badge">
      {value}
    </Badge>
  ) : (
    '-'
  );
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function DateCell({ value, timeZone, now }) {
  return (
    <div className="text-nowrap">
      <div>{formatDate(value, timeZone)}</div>
      {value && <small className="text-muted">{relativeDate(value, now)}</small>}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="lead-error" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" variant="outline-danger" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

function LeadDataTable({ loading, data, ...props }) {
  if (!loading) return <CommonTable {...props} data={data} loading={false} />;
  const columns = props.columns || [];
  return (
    <div className="lead-skeleton-card" role="status" aria-label="Loading lead records">
      <div className="lead-skeleton-scroll">
        <div className="lead-skeleton-grid lead-skeleton-header" style={{ '--lead-columns': columns.length }}>
          {columns.map((column, index) => (
            <span key={column.id || column.accessor || index}>{typeof column.header === 'string' ? column.header : ''}</span>
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, rowIndex) => (
          <div className="lead-skeleton-grid lead-skeleton-row" style={{ '--lead-columns': columns.length }} key={rowIndex}>
            {columns.map((column, columnIndex) => (
              <span
                className={`lead-skeleton-bar lead-skeleton-bar-${(rowIndex + columnIndex) % 4}`}
                key={column.id || column.accessor || columnIndex}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="visually-hidden">Loading lead records</span>
    </div>
  );
}

const calendarDate = (value) => {
  const [year, month, day] = String(value || '')
    .split('-')
    .map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};
const calendarLabel = (fromDate, toDate) => {
  if (!fromDate && !toDate) return 'Select date range';
  const formatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const from = calendarDate(fromDate);
  const to = calendarDate(toDate);
  if (from && to) return `${formatter.format(from)} – ${formatter.format(to)}`;
  return from ? formatter.format(from) : 'Select date range';
};

function LeadDateRangeCalendar({ fromDate, toDate, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => calendarDate(fromDate) || new Date());
  const [draftFrom, setDraftFrom] = useState(fromDate || '');
  const [draftTo, setDraftTo] = useState(toDate || '');
  const rootRef = useRef(null);
  useEffect(() => {
    setDraftFrom(fromDate || '');
    setDraftTo(toDate || '');
  }, [fromDate, toDate]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstGridDate = new Date(year, month, 1 - new Date(year, month, 1).getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDate.getFullYear(), firstGridDate.getMonth(), firstGridDate.getDate() + index);
    return { date, value: ymd(date), outside: date.getMonth() !== month };
  });
  const chooseDay = (value) => {
    if (!draftFrom || draftTo) {
      setDraftFrom(value);
      setDraftTo('');
    } else if (value < draftFrom) {
      setDraftFrom(value);
    } else {
      setDraftTo(value);
    }
  };
  const apply = () => {
    onChange(draftFrom, draftTo || draftFrom);
    setOpen(false);
  };
  return (
    <div className="lead-calendar" ref={rootRef}>
      <button type="button" className="lead-calendar-trigger" onClick={() => !disabled && setOpen((value) => !value)} disabled={disabled}>
        <CalendarDays size={17} />
        <span>{calendarLabel(fromDate, toDate)}</span>
      </button>
      {open && (
        <div className="lead-calendar-popover">
          <div className="lead-calendar-topbar">
            <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">
              <ChevronLeft size={17} />
            </button>
            <strong>{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(cursor)}</strong>
            <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="lead-calendar-weekdays">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="lead-calendar-days">
            {days.map((day) => {
              const inRange = draftFrom && draftTo && day.value > draftFrom && day.value < draftTo;
              const endpoint = day.value === draftFrom || day.value === draftTo;
              return (
                <button
                  type="button"
                  key={day.value}
                  onClick={() => chooseDay(day.value)}
                  className={`${day.outside ? 'outside' : ''} ${inRange ? 'in-range' : ''} ${endpoint ? 'selected' : ''}`}
                  aria-label={day.date.toDateString()}
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="lead-calendar-selection">
            <span>{draftFrom || 'Start date'}</span>
            <span>to</span>
            <span>{draftTo || 'End date'}</span>
          </div>
          <div className="lead-calendar-footer">
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={() => {
                setDraftFrom('');
                setDraftTo('');
                onChange('', '');
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={apply} disabled={!draftFrom}>
              Apply range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function usePagedData(loader, dependencies) {
  const [data, setData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const requestId = useRef(0);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  const silentRefresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const result = await loader();
      if (id !== requestId.current) return;
      setData(result.data);
      setTotalCount(result.totalCount);
      setError('');
    } catch (errorValue) {
      if (errorValue?.name !== 'AbortError') console.error(errorValue);
    }
  }, [loader]);
  useEffect(() => {
    const controller = new AbortController();
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    loader(controller.signal)
      .then((result) => {
        if (id !== requestId.current || controller.signal.aborted) return;
        setData(result.data);
        setTotalCount(result.totalCount);
      })
      .catch((errorValue) => {
        if (controller.signal.aborted || errorValue?.name === 'AbortError') return;
        console.error(errorValue);
        setData([]);
        setTotalCount(0);
        setError(getMessage(errorValue, 'Unable to load data.'));
      })
      .finally(() => {
        if (id === requestId.current && !controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // dependencies intentionally supplied by each server-side table
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, refreshKey]);
  return { data, setData, totalCount, loading, error, refresh, silentRefresh };
}

const pagination = (page, pageSize, totalCount, setPage, setPageSize) => ({
  pageNumber: page,
  pageSize,
  totalCount,
  pageSizeOptions: PAGE_SIZES,
  onPageChange: setPage,
  onPageSizeChange: (size) => {
    setPageSize(size);
    setPage(1);
  },
  itemName: 'leads'
});

function NewLeadsTab({ permissions, onClaimed }) {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ sortProperty: 'leadId', isDescending: true });
  const [claiming, setClaiming] = useState(0),
    [autoRefresh, setAutoRefresh] = useState(false),
    [countdown, setCountdown] = useState(3);
  const now = useNow();
  const loader = useCallback(
    (signal) =>
      leadService.getNewLeads(
        { PageNumber: page, PageSize: pageSize, SortProperty: sort.sortProperty, IsDescending: sort.isDescending },
        signal
      ),
    [page, pageSize, sort]
  );
  const state = usePagedData(loader, [loader]);
  useEffect(() => {
    if (!autoRefresh) {
      setCountdown(3);
      return undefined;
    }
    const timer = setInterval(
      () =>
        setCountdown((value) => {
          if (value <= 1) {
            state.refresh();
            return 3;
          }
          return value - 1;
        }),
      1000
    );
    return () => clearInterval(timer);
  }, [autoRefresh, state.refresh]);
  const claim = async (lead) => {
    if (!permissions.canClaim || claiming) return;
    setClaiming(lead.leadId);
    try {
      await leadService.claimLead(lead.leadId);
      toast.success(userName() ? `Lead claimed by ${userName()}` : 'Lead claimed');
      onClaimed();
    } catch (error) {
      console.error(error);
      toast.error(getMessage(error, 'Unable to claim this lead.'));
    } finally {
      setClaiming(0);
    }
  };
  const columns = [
    { id: 'serial', header: '#' },
    {
      id: 'date',
      header: 'Date',
      accessor: 'leadDate',
      sortable: true,
      sortKey: 'dateAdded',
      cell: (lead) => <DateCell value={lead.leadDate} timeZone={lead.timeZone} now={now} />
    },
    { id: 'claimed', header: 'Claim By', cell: (lead) => lead.assignedToName || '-' },
    { id: 'group', header: 'Group', cell: (lead) => badge(lead.groupName, 'info', 'dark') },
    {
      id: 'action',
      header: 'Action',
      sticky: 'right',
      cell: (lead) => {
        const mine =
          (lead.assignedTo && lead.assignedTo === Number(currentUser().userId)) ||
          (lead.assignedToName && lead.assignedToName.toLowerCase() === userName().toLowerCase());
        const claimed = (lead.assignedTo || lead.assignedToName) && !mine;
        if (claimed || mine) return <Badge bg="secondary">Claimed{mine ? ' by you' : ''}</Badge>;
        return permissions.canClaim ? (
          <Button size="sm" onClick={() => claim(lead)} disabled={Boolean(claiming)}>
            {claiming === lead.leadId ? <Spinner size="sm" /> : <UserRoundCheck size={15} />} <span className="ms-1">Claim</span>
          </Button>
        ) : (
          '-'
        );
      }
    }
  ];
  const availableCount = state.data.filter((lead) => !lead.assignedTo && !lead.assignedToName).length;
  const claimedCount = state.data.filter((lead) => lead.assignedTo || lead.assignedToName).length;
  return (
    <>
      <div className="lead-summary-bar">
        <div className="lead-summary-overview">
          <div className="lead-metrics" aria-label="New lead summary">
            <div className="lead-metric lead-metric-total">
              <span className="lead-metric-dot" />
              <div>
                <strong>{state.totalCount}</strong>
                <span>Total leads</span>
              </div>
            </div>
            <div className="lead-metric lead-metric-available">
              <span className="lead-metric-dot" />
              <div>
                <strong>{availableCount}</strong>
                <span>Available now</span>
              </div>
            </div>
            <div className="lead-metric lead-metric-claimed">
              <span className="lead-metric-dot" />
              <div>
                <strong>{claimedCount}</strong>
                <span>Claimed</span>
              </div>
            </div>
          </div>
        </div>
        <div className="lead-summary-actions">
          <div className="lead-auto-copy">
            <strong>Auto refresh</strong>
            <small>{autoRefresh ? `Next update in ${countdown}s` : 'Refresh manually'}</small>
          </div>
          <IosToggle
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
            title={autoRefresh ? `Refresh in ${countdown} seconds` : 'Enable automatic refresh'}
            aria-label={autoRefresh ? 'Disable automatic refresh' : 'Enable automatic refresh'}
          />
          <button
            type="button"
            className="lead-round-refresh"
            onClick={state.refresh}
            disabled={state.loading}
            aria-label="Refresh new leads"
          >
            <RefreshCw size={18} className={state.loading ? 'spin' : ''} />
          </button>
        </div>
      </div>
      <ErrorState message={state.error} onRetry={state.refresh} />
      <LeadDataTable
        columns={columns}
        data={state.data}
        loading={state.loading}
        rowKey="leadId"
        sort={{
          ...sort,
          onSort: (key) => setSort((old) => ({ sortProperty: key, isDescending: old.sortProperty === key ? !old.isDescending : false }))
        }}
        pagination={pagination(page, pageSize, state.totalCount, setPage, setPageSize)}
        emptyState={{ title: 'No new leads', description: 'There are no unclaimed leads available right now.' }}
      />
    </>
  );
}

const emptyCallbackForm = {
  callbackId: 0,
  leadId: 0,
  name: '',
  email: '',
  phone: '',
  date: '',
  time: '',
  assignedTo: '',
  dispositionId: '',
  completionNotes: '',
  completedBy: ''
};
function validateCallback(form, mode) {
  if (!form.name.trim() || !/[A-Za-z]/.test(form.name) || form.name.trim().length < 2 || form.name.length > 100)
    return 'Customer name must contain letters and be 2 to 100 characters.';
  if (form.email && (!/^\S+@\S+\.\S+$/.test(form.email) || form.email.length > 150))
    return 'Enter a valid email address of at most 150 characters.';
  const digits = form.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (form.phone && digits.length !== 10) return 'Enter a valid US phone number.';
  if (!form.date) return 'Callback date is required.';
  const appointment = new Date(localDateTime(form.date, form.time));
  const limit = new Date();
  limit.setDate(limit.getDate() + 365);
  if (appointment > limit) return 'Callback date cannot be more than 365 days ahead.';
  if ((mode === 'edit' || mode === 'reschedule') && !Number(form.assignedTo)) return 'Assigned user is required.';
  if (mode === 'reschedule' && form.date < ymd()) return 'The rescheduled date cannot be in the past.';
  if (mode === 'reschedule' && form.time && appointment <= new Date()) return 'The rescheduled time must be in the future.';
  if (form.completionNotes.length > 500) return 'Completion notes cannot exceed 500 characters.';
  if (mode === 'edit' && Boolean(form.completedBy) !== Boolean(form.dispositionId))
    return 'Completed by and disposition must both be selected.';
  return '';
}

function CallbackEditor({ show, mode, source, dispositions, users, onClose, onSaved }) {
  const [form, setForm] = useState(emptyCallbackForm),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!show) return;
    const parts = toInputParts(source?.assignDate);
    setForm({
      ...emptyCallbackForm,
      ...source,
      name: source?.name || source?.customerName || '',
      dispositionId: source?.dispositionId || '',
      assignedTo: source?.assignedTo || currentUser().userId || '',
      date: mode === 'reschedule' && parts.date < ymd() ? '' : parts.date,
      time: mode === 'reschedule' && parts.date < ymd() ? '' : parts.time,
      completedBy: mode === 'reschedule' ? '' : source?.completedBy || '',
      completionNotes: mode === 'reschedule' ? '' : source?.completionNotes || source?.comments || ''
    });
    setError('');
  }, [show, source, mode]);
  const update = (field, value) => setForm((old) => ({ ...old, [field]: value }));
  const save = async (event) => {
    event.preventDefault();
    const problem = validateCallback(form, mode);
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }
    const user = users.find((item) => item.id === Number(form.assignedTo));
    const disposition = dispositions.find((item) => item.id === Number(form.dispositionId));
    const me = currentUser();
    const payload = {
      callbackId: mode === 'edit' ? Number(form.callbackId) : 0,
      leadId: Number(form.leadId),
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.replace(/\D/g, ''),
      assignedTo: Number(form.assignedTo || me.userId),
      assignedToName: user?.label || (Number(form.assignedTo) === Number(me.userId) ? userName() : source?.assignedToName || ''),
      assignDate: localDateTime(form.date, form.time),
      completionNotes: form.completionNotes.trim(),
      createdBy: Number(source?.createdBy || me.userId),
      createdByName: source?.createdByName || userName(),
      despositionId: Number(form.dispositionId) || 0,
      despositionName: disposition?.label || '',
      ...(mode === 'edit'
        ? {
            completedDateTime: form.completedBy ? source?.completedDateTime || localDateTime(ymd(), '00:00') : '',
            completedBy: Number(form.completedBy) || 0,
            completedByName: users.find((item) => item.id === Number(form.completedBy))?.label || ''
          }
        : {})
    };
    setSaving(true);
    setError('');
    try {
      if (mode === 'edit') await leadService.updateCallback(payload);
      else await leadService.createCallback(payload);
      toast.success(
        mode === 'create'
          ? 'Callback created successfully'
          : mode === 'edit'
            ? 'Callback updated successfully'
            : 'Callback rescheduled successfully'
      );
      onSaved();
      setForm(emptyCallbackForm);
    } catch (requestError) {
      console.error(requestError);
      const message = getMessage(requestError, 'Unable to save callback.');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal show={show} onHide={() => !saving && onClose()} size="lg" centered scrollable>
      <Form onSubmit={save}>
        <Modal.Header closeButton>
          <Modal.Title>{mode === 'create' ? 'Create Callback' : mode === 'edit' ? 'Edit Callback' : 'Reschedule Callback'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <AlertCircle className="me-2 text-danger" size={16} />}
          <span className="text-danger small">{error}</span>
          <Row className="g-3 mt-0">
            <Col md={6}>
              <Form.Label>Customer name *</Form.Label>
              <Form.Control value={form.name} maxLength={100} onChange={(e) => update('name', e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" maxLength={150} value={form.email} onChange={(e) => update('email', e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label>Phone</Form.Label>
              <Form.Control value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label>Assigned user *</Form.Label>
              <Form.Select value={form.assignedTo} onChange={(e) => update('assignedTo', e.target.value)}>
                <option value="">Select user</option>
                {users.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.label}
                    {user.role ? ` — ${user.role}` : ''}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label>Callback date *</Form.Label>
              <Form.Control
                type="date"
                value={form.date}
                min={mode === 'reschedule' ? ymd() : undefined}
                onChange={(e) => update('date', e.target.value)}
              />
            </Col>
            <Col md={6}>
              <Form.Label>Callback time</Form.Label>
              <Form.Control type="time" value={form.time} onChange={(e) => update('time', e.target.value)} />
            </Col>
            <Col md={mode === 'edit' ? 6 : 12}>
              <Form.Label>Disposition</Form.Label>
              <Form.Select value={form.dispositionId} onChange={(e) => update('dispositionId', e.target.value)}>
                <option value="">Select</option>
                {dispositions.map((option) => (
                  <option value={option.id} key={option.id}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            {mode === 'edit' && (
              <Col md={6}>
                <Form.Label>Completed by</Form.Label>
                <Form.Select value={form.completedBy} onChange={(e) => update('completedBy', e.target.value)}>
                  <option value="">Not completed</option>
                  {users.map((user) => (
                    <option value={user.id} key={user.id}>
                      {user.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            )}
            <Col xs={12}>
              <Form.Label>Completion notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={500}
                value={form.completionNotes}
                onChange={(e) => update('completionNotes', e.target.value)}
              />
              <Form.Text>{form.completionNotes.length}/500</Form.Text>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}Save
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function MyLeadsTab({ permissions, dispositions, users }) {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState({ sortProperty: 'leadId', isDescending: true });
  const [drafts, setDrafts] = useState({}),
    [saving, setSaving] = useState(0),
    [transferring, setTransferring] = useState(0),
    [callbackLead, setCallbackLead] = useState(null);
  const now = useNow();
  const loader = useCallback(
    (signal) =>
      leadService.getMyLeads(
        { PageNumber: page, PageSize: pageSize, SortProperty: sort.sortProperty, IsDescending: sort.isDescending },
        signal
      ),
    [page, pageSize, sort]
  );
  const state = usePagedData(loader, [loader]);
  useEffect(() => {
    setDrafts((old) =>
      Object.fromEntries(
        state.data.map((lead) => [
          lead.leadId,
          old[lead.leadId] || { dispositionId: lead.dispositionId || '', comments: lead.comments || '' }
        ])
      )
    );
  }, [state.data]);
  const save = async (lead) => {
    if (!permissions.canUpdate || saving) return;
    const draft = drafts[lead.leadId] || {};
    if (!Number(draft.dispositionId)) {
      toast.error('Disposition is required.');
      return;
    }
    if (!draft.comments?.trim()) {
      toast.error('Comment is required.');
      return;
    }
    setSaving(lead.leadId);
    try {
      await leadService.updateLead(lead.leadId, draft.dispositionId, draft.comments);
      toast.success('Lead updated successfully');
      state.refresh();
    } catch (error) {
      console.error(error);
      toast.error(
        error?.status === 404 ? 'The backend disposition update endpoint is unavailable.' : getMessage(error, 'Unable to update lead.')
      );
    } finally {
      setSaving(0);
    }
  };
  const transfer = async (lead, userId) => {
    if (!permissions.canUpdate || !userId || transferring) return;
    setTransferring(lead.leadId);
    try {
      await leadService.transferLead(lead.leadId, Number(userId));
      toast.success('Lead transferred successfully');
      state.refresh();
    } catch (error) {
      console.error(error);
      toast.error(getMessage(error, 'Unable to transfer lead.'));
    } finally {
      setTransferring(0);
    }
  };
  const columns = [
    { id: 'serial', header: '#' },
    { accessor: 'leadId', header: 'Lead ID', sortable: true },
    {
      id: 'customer',
      header: 'Customer Name',
      cell: (lead) => (
        <div>
          <strong>{lead.customerName || '-'}</strong>
          {lead.isValid === false && (
            <Badge bg="danger" className="ms-2">
              Invalid
            </Badge>
          )}
          <small className="d-block text-muted">
            {lead.email || '-'} · {formatPhone(lead.phone)}
          </small>
          {(lead.timeZone || lead.country) && <small className="text-muted">{lead.timeZone || lead.country}</small>}
        </div>
      )
    },
    {
      accessor: 'description',
      header: 'Description',
      cell: (lead) => (
        <div className="lead-clamp" title={lead.description}>
          {lead.description || '-'}
        </div>
      )
    },
    {
      id: 'leadDate',
      header: 'Lead Date',
      sortable: true,
      sortKey: 'dateAdded',
      cell: (lead) => <DateCell value={lead.leadDate} timeZone={lead.timeZone} now={now} />
    },
    {
      id: 'assignDate',
      header: 'Assign Date',
      sortable: true,
      cell: (lead) => <DateCell value={lead.assignDate} timeZone={lead.timeZone} now={now} />
    },
    {
      id: 'comment',
      header: 'Comment',
      cell: (lead) => (
        <Form.Control
          as="textarea"
          rows={2}
          value={drafts[lead.leadId]?.comments ?? lead.comments}
          disabled={!permissions.canUpdate || saving === lead.leadId}
          onChange={(e) => setDrafts((old) => ({ ...old, [lead.leadId]: { ...old[lead.leadId], comments: e.target.value } }))}
          aria-label={`Comment for lead ${lead.leadId}`}
        />
      )
    },
    {
      id: 'disposition',
      header: 'Disposition',
      cell: (lead) => (
        <Form.Select
          size="sm"
          value={drafts[lead.leadId]?.dispositionId ?? lead.dispositionId}
          disabled={!permissions.canUpdate || saving === lead.leadId}
          onChange={(e) => setDrafts((old) => ({ ...old, [lead.leadId]: { ...old[lead.leadId], dispositionId: e.target.value } }))}
        >
          <option value="">Select</option>
          {dispositions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Form.Select>
      )
    },
    {
      id: 'action',
      header: 'Action',
      sticky: 'right',
      cell: (lead) => (
        <div className="lead-actions">
          {permissions.canUpdate && (
            <>
              <Button size="sm" onClick={() => save(lead)} disabled={Boolean(saving)}>
                {saving === lead.leadId ? <Spinner size="sm" /> : 'Save'}
              </Button>
              <Form.Select
                size="sm"
                aria-label={`Transfer lead ${lead.leadId}`}
                value=""
                disabled={Boolean(transferring)}
                onChange={(e) => transfer(lead, e.target.value)}
              >
                <option value="">Transfer…</option>
                {users.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.label} · {user.role || 'Sales'} · {user.location || 'N/A'}
                  </option>
                ))}
              </Form.Select>
            </>
          )}
          {permissions.canAdd && (
            <Button size="sm" variant="outline-primary" onClick={() => setCallbackLead(lead)} title="Create callback">
              <CalendarPlus size={15} />
            </Button>
          )}
        </div>
      )
    }
  ];
  return (
    <>
      <div className="lead-toolbar">
        <span className="text-muted small">Assigned leads requiring follow-up</span>
        <Button size="sm" variant="outline-secondary" onClick={state.refresh} disabled={state.loading}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>
      <ErrorState message={state.error} onRetry={state.refresh} />
      <LeadDataTable
        columns={columns}
        data={state.data}
        loading={state.loading}
        rowKey="leadId"
        sort={{
          ...sort,
          onSort: (key) => setSort((old) => ({ sortProperty: key, isDescending: old.sortProperty === key ? !old.isDescending : false }))
        }}
        pagination={pagination(page, pageSize, state.totalCount, setPage, setPageSize)}
        emptyState={{ title: 'No assigned leads' }}
      />
      <CallbackEditor
        show={Boolean(callbackLead)}
        mode="create"
        source={callbackLead}
        dispositions={dispositions}
        users={users}
        onClose={() => setCallbackLead(null)}
        onSaved={() => {
          setCallbackLead(null);
          state.refresh();
        }}
      />
    </>
  );
}

function CallbackTab({ permissions, dispositions, users }) {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState({ sortProperty: 'assignDate', isDescending: true });
  const [editor, setEditor] = useState(null),
    [historyLead, setHistoryLead] = useState(null),
    [history, setHistory] = useState([]),
    [historyLoading, setHistoryLoading] = useState(false),
    [historyError, setHistoryError] = useState('');
  const now = useNow();
  const loader = useCallback(
    (signal) =>
      leadService.getCallbacks(
        { PageNumber: page, PageSize: pageSize, SortProperty: sort.sortProperty, IsDescending: sort.isDescending },
        signal
      ),
    [page, pageSize, sort]
  );
  const state = usePagedData(loader, [loader]);
  const openHistory = async (row) => {
    setHistoryLead(row);
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      setHistory(await leadService.getCallbackHistory(row.leadId));
    } catch (error) {
      console.error(error);
      setHistoryError(getMessage(error, 'Unable to load callback history.'));
    } finally {
      setHistoryLoading(false);
    }
  };
  const columns = [
    { id: 'serial', header: '#' },
    {
      id: 'name',
      header: 'Customer Name',
      cell: (row) => (
        <div>
          <strong>{row.name || row.customerName || '-'}</strong>
          <small className="d-block text-muted">
            {row.email || '-'} · {formatPhone(row.phone)}
          </small>
        </div>
      )
    },
    {
      id: 'assignDate',
      header: 'Assign Date',
      sortable: true,
      cell: (row) => <DateCell value={row.assignDate} timeZone={row.timeZone} now={now} />
    },
    { id: 'disposition', header: 'Disposition', cell: (row) => badge(row.dispositionName, 'primary') },
    { accessor: 'assignedToName', header: 'Assigned To' },
    { accessor: 'createdByName', header: 'Created By' },
    {
      id: 'comments',
      header: 'Comments',
      cell: (row) => (
        <div className="lead-clamp" title={row.completionNotes}>
          {row.completionNotes || '-'}
        </div>
      )
    },
    {
      id: 'action',
      header: 'Action',
      sticky: 'right',
      cell: (row) => (
        <div className="lead-actions">
          <Button size="sm" variant="outline-secondary" onClick={() => openHistory(row)} title="History">
            <History size={15} />
          </Button>
          {permissions.canUpdate && (
            <>
              <Button size="sm" variant="outline-primary" onClick={() => setEditor({ mode: 'reschedule', row })}>
                <Clock3 size={15} /> <span>Reschedule</span>
              </Button>
              <Button size="sm" onClick={() => setEditor({ mode: 'edit', row })}>
                Edit
              </Button>
            </>
          )}
        </div>
      )
    }
  ];
  return (
    <>
      <div className="lead-toolbar">
        <span className="text-muted small">Scheduled customer follow-ups</span>
        <button
          type="button"
          className="lead-round-refresh"
          onClick={state.refresh}
          disabled={state.loading}
          aria-label="Refresh callbacks"
          title="Refresh callbacks"
        >
          <RefreshCw size={18} className={state.loading ? 'spin' : ''} />
        </button>
      </div>
      <ErrorState message={state.error} onRetry={state.refresh} />
      <LeadDataTable
        columns={columns}
        data={state.data}
        loading={state.loading}
        rowKey="callbackId"
        sort={{
          ...sort,
          onSort: (key) => setSort((old) => ({ sortProperty: key, isDescending: old.sortProperty === key ? !old.isDescending : false }))
        }}
        pagination={pagination(page, pageSize, state.totalCount, setPage, setPageSize)}
        emptyState={{ title: 'No callbacks scheduled' }}
      />
      <CallbackEditor
        show={Boolean(editor)}
        mode={editor?.mode}
        source={editor?.row}
        dispositions={dispositions}
        users={users}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          state.refresh();
        }}
      />
      <Modal show={Boolean(historyLead)} onHide={() => setHistoryLead(null)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Callback History · Lead #{historyLead?.leadId}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {historyLoading ? (
            <div className="text-center py-5">
              <Spinner className="me-2" />
              Loading history…
            </div>
          ) : historyError ? (
            <ErrorState message={historyError} />
          ) : history.length === 0 ? (
            <div className="text-center text-muted py-5">No callback history found.</div>
          ) : (
            <div className="callback-timeline">
              {history.map((item, index) => (
                <div className="callback-history" key={item.callbackId || index}>
                  <strong>{formatDate(item.assignDate)}</strong>
                  <span>
                    {item.dispositionName || 'No disposition'} · {item.assignedToName || 'Unassigned'}
                  </span>
                  <small>{item.completionNotes || 'No notes'}</small>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

const LEAD_REPORTS = {
  disposition: {
    label: 'Leads By Disposition',
    description: 'Filtered by selected date and lead filters',
    endpoint: 'LeadsByDisposition',
    columns: [
      { label: 'Disposition', keys: ['disposition', 'dispositionName', 'name'] },
      { label: 'Total leads', keys: ['total', 'leadCount', 'totalLeads', 'count'], numeric: true },
      { label: 'Percentage', keys: ['percentage', 'percent'], percentage: true }
    ]
  },
  conversation: {
    label: 'Conversation Report',
    description: 'Summary by user without pagination',
    endpoint: 'LeadPickByUsers',
    columns: [
      { label: 'Name', keys: ['userName', 'name', 'fullName'] },
      { label: 'Leads picked', keys: ['leadsPicked', 'leadPicked', 'leadCount', 'totalLeads', 'total', 'count'], badge: 'blue' },
      { label: 'Sale done', keys: ['saleDone', 'salesDone', 'salesCount', 'totalSales', 'saleCount'], badge: 'green' },
      {
        label: 'Conversation %',
        keys: ['conversationPercentage', 'conversationPercent', 'conversation', 'conversionRate', 'percentage'],
        percentage: true,
        badge: 'red'
      }
    ]
  }
};

const reportValue = (row, keys) => {
  for (const key of keys) {
    const pascalKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
    if (row?.[pascalKey] !== undefined && row?.[pascalKey] !== null) return row[pascalKey];
  }
  return undefined;
};
function ReportDialog({ report, filters, lookups, onClose }) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [refreshKey, setRefreshKey] = useState(0),
    [search, setSearch] = useState(''),
    [period, setPeriod] = useState(''),
    [reportFilters, setReportFilters] = useState(null);
  const config = LEAD_REPORTS[report];

  useEffect(() => {
    if (!config) return;
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const hasParentRange = Boolean(filters.fromDate || filters.toDate);
    setSearch('');
    setPeriod(hasParentRange ? 'custom' : report === 'conversation' ? 'yesterday' : 'month');
    setReportFilters({
      report,
      fromDate: filters.fromDate || (report === 'conversation' ? ymd(yesterday) : ymd(new Date(today.getFullYear(), today.getMonth(), 1))),
      toDate: filters.toDate || (report === 'conversation' ? ymd(yesterday) : ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0))),
      userId: filters.salesPersonId || '',
      vendorId: filters.vendorId || '',
      groupId: filters.groupId || ''
    });
  }, [config, filters.fromDate, filters.groupId, filters.salesPersonId, filters.toDate, filters.vendorId, report]);

  useEffect(() => {
    if (!config || reportFilters?.report !== report) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const dateParams = {
      fromdate: reportFilters.fromDate ? `${reportFilters.fromDate}T00:00:00` : undefined,
      todate: reportFilters.toDate ? `${reportFilters.toDate}T23:59:59` : undefined
    };
    const params =
      report === 'disposition'
        ? { ...dateParams, userId: reportFilters.userId || undefined, vendorId: reportFilters.vendorId || undefined }
        : { ...dateParams, groupId: reportFilters.groupId || undefined };
    leadService
      .getReport(config.endpoint, params, controller.signal)
      .then((result) => setRows(result.data))
      .catch((requestError) => {
        if (requestError?.name !== 'AbortError') {
          console.error(requestError);
          setRows([]);
          setError(getMessage(requestError, 'Unable to load report.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [config, refreshKey, report, reportFilters]);

  const filteredRows = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((row) =>
      config?.columns.some((column) =>
        String(reportValue(row, column.keys) ?? '')
          .toLowerCase()
          .includes(value)
      )
    );
  }, [config, rows, search]);
  const totalDispositionLeads = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(reportValue(row, ['total', 'leadCount', 'totalLeads', 'count'])) || 0), 0),
    [rows]
  );
  const cellValue = (row, column) => {
    const direct = reportValue(row, column.keys);
    if (column.percentage && (direct === undefined || direct === null || direct === '')) {
      if (report === 'disposition') {
        const total = Number(reportValue(row, ['total', 'leadCount', 'totalLeads', 'count'])) || 0;
        return totalDispositionLeads ? (total / totalDispositionLeads) * 100 : 0;
      }
      const leads = Number(reportValue(row, ['leadsPicked', 'leadPicked', 'leadCount', 'totalLeads'])) || 0;
      const sales = Number(reportValue(row, ['saleDone', 'salesDone', 'salesCount', 'totalSales', 'saleCount'])) || 0;
      return leads ? (sales / leads) * 100 : 0;
    }
    return direct;
  };
  const changePeriod = (value) => {
    setPeriod(value);
    if (value === 'custom') return;
    const today = new Date();
    let from = today,
      to = today;
    if (value === 'yesterday') from = to = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (value === 'week') from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    if (value === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }
    setReportFilters((old) => ({ ...old, fromDate: ymd(from), toDate: ymd(to) }));
  };
  const exportReport = () => {
    if (!filteredRows.length) return;
    const headers = ['#', ...config.columns.map((column) => column.label)];
    const lines = [
      headers,
      ...filteredRows.map((row, index) => [
        index + 1,
        ...config.columns.map((column) => {
          const value = cellValue(row, column);
          return column.percentage ? `${Number(value || 0).toFixed(1)}%` : (value ?? '-');
        })
      ])
    ].map((line) => line.map(csvCell).join(','));
    const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report}-report-${ymd()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!config) return null;

  return (
    <Modal
      show={Boolean(config)}
      onHide={onClose}
      size="xl"
      centered
      scrollable
      className="lead-report-window"
      dialogClassName="lead-report-modal"
    >
      <Modal.Header closeButton className="lead-report-modal-header">
        <div className="lead-report-modal-title">
          <div>
            <Modal.Title>{config?.label}</Modal.Title>
            <small>{config?.description}</small>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="lead-report-control-card">
          <div className="lead-report-control-top">
            <div className="lead-report-count">
              <span />
              <strong>{filteredRows.length}</strong> of <strong>{rows.length}</strong> results
            </div>
            <div className="lead-report-control-actions">
              <button type="button" onClick={exportReport} disabled={!filteredRows.length} aria-label="Export report" title="Export report">
                <Download size={18} />
              </button>
              <button
                type="button"
                className="round"
                onClick={() => setRefreshKey((value) => value + 1)}
                disabled={loading}
                aria-label="Refresh report"
                title="Refresh report"
              >
                <RefreshCw size={18} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>
          <div className={`lead-report-control-grid ${report === 'conversation' ? 'conversation' : ''}`}>
            {report === 'disposition' && (
              <>
                <Form.Select
                  value={reportFilters?.userId || ''}
                  onChange={(event) => setReportFilters((old) => ({ ...old, userId: event.target.value }))}
                  aria-label="Report user"
                >
                  <option value="">All Users</option>
                  {lookups.users.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.label}
                    </option>
                  ))}
                </Form.Select>
                <Form.Select
                  value={reportFilters?.vendorId || ''}
                  onChange={(event) => setReportFilters((old) => ({ ...old, vendorId: event.target.value }))}
                  aria-label="Report vendor"
                >
                  <option value="">All Vendors</option>
                  {lookups.vendors.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.label}
                    </option>
                  ))}
                </Form.Select>
              </>
            )}
            <div className="lead-report-search">
              <Search size={17} />
              <input
                type="text"
                className="lead-search-input lead-report-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={report === 'disposition' ? 'Search disposition…' : 'Search by name…'}
                aria-label="Search report"
              />
            </div>
            <Form.Select value={period} onChange={(event) => changePeriod(event.target.value)} aria-label="Report period">
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Current Month</option>
              <option value="custom">Custom Range</option>
            </Form.Select>
            <LeadDateRangeCalendar
              fromDate={reportFilters?.fromDate || ''}
              toDate={reportFilters?.toDate || ''}
              onChange={(fromDate, toDate) => {
                setPeriod('custom');
                setReportFilters((old) => ({ ...old, fromDate, toDate }));
              }}
            />
          </div>
        </div>
        {loading ? (
          <div className="lead-report-loading" role="status">
            {Array.from({ length: 7 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} />
        ) : filteredRows.length === 0 ? (
          <div className="lead-report-empty">
            <FileBarChart size={30} />
            <strong>No report data found</strong>
            <span>Try changing the active filters or date range.</span>
          </div>
        ) : (
          <div className="table-responsive lead-report-table-wrap">
            <table className="table align-middle lead-report-table">
              <thead>
                <tr>
                  <th>#</th>
                  {config.columns.map((column) => (
                    <th key={column.label}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row.id || row.userId || row.dispositionId || index}>
                    <td>{index + 1}</td>
                    {config.columns.map((column) => {
                      const value = cellValue(row, column);
                      if (column.percentage) {
                        const percent = Number(value) || 0;
                        return (
                          <td key={column.label}>
                            {report === 'disposition' ? (
                              <div className="lead-report-percent">
                                <span>
                                  <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
                                </span>
                                <strong>{percent.toFixed(1)}%</strong>
                              </div>
                            ) : (
                              <span className="lead-report-value-badge red">{percent.toFixed(1)}%</span>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td key={column.label}>
                          {column.badge ? (
                            <span className={`lead-report-value-badge ${column.badge}`}>{Number(value) || 0}</span>
                          ) : (
                            String(value ?? '-')
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}

function LeadsReportTab({ permissions, voicemail, lookups }) {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [sort, setSort] = useState({ sortProperty: 'leadId', isDescending: true });
  const [searchInput, setSearchInput] = useState(''),
    [filters, setFilters] = useState({ text: '', salesPersonId: '', groupId: '', locationId: '', vendorId: '', fromDate: '', toDate: '' });
  const [deleting, setDeleting] = useState(false),
    [deleteLead, setDeleteLead] = useState(null),
    [exporting, setExporting] = useState(false),
    [report, setReport] = useState(''),
    [reportMenuOpen, setReportMenuOpen] = useState(false);
  const reportMenuRef = useRef(null);
  const now = useNow();
  useEffect(() => {
    if (!reportMenuOpen) return undefined;
    const closeMenu = (event) => {
      if (!reportMenuRef.current?.contains(event.target)) setReportMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [reportMenuOpen]);
  const query = useCallback(
    (pageNumber = page, size = pageSize) => ({
      PageNumber: pageNumber,
      PageSize: size,
      ...(filters.text
        ? { Text: filters.text }
        : {
            FromDate: filters.fromDate ? `${filters.fromDate}T00:00:00` : undefined,
            ToDate: filters.toDate ? `${filters.toDate}T23:59:59` : undefined
          }),
      SalesPersonId: filters.salesPersonId || undefined,
      GroupId: filters.groupId || undefined,
      LocationId: filters.locationId || undefined,
      VendorId: filters.vendorId || undefined,
      DispositionId: voicemail ? 21 : undefined,
      SortProperty: sort.sortProperty,
      IsDescending: sort.isDescending
    }),
    [page, pageSize, filters, voicemail, sort]
  );
  const loader = useCallback((signal) => leadService.getLeadReport(query(), signal), [query]);
  const state = usePagedData(loader, [loader]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const text = searchInput.trim();
      if (text === filters.text) return;
      setPage(1);
      setFilters((old) => ({ ...old, text }));
    }, 450);
    return () => clearTimeout(timer);
  }, [filters.text, searchInput]);
  const updateFilter = (key, value) => {
    setFilters((old) => ({ ...old, [key]: value }));
    setPage(1);
  };
  const hasActiveFilters = Boolean(
    filters.salesPersonId ||
      filters.groupId ||
      filters.locationId ||
      filters.vendorId ||
      filters.fromDate ||
      filters.toDate ||
      searchInput.trim() ||
      filters.text
  );
  const resetFilters = () => {
    setSearchInput('');
    setFilters({
      text: '',
      salesPersonId: '',
      groupId: '',
      locationId: '',
      vendorId: '',
      fromDate: '',
      toDate: ''
    });
    setPage(1);
  };
  const remove = async () => {
    if (!deleteLead || deleting) return;
    setDeleting(true);
    try {
      await leadService.deleteLead(deleteLead.leadId);
      toast.success('Lead deleted successfully');
      setDeleteLead(null);
      state.refresh();
    } catch (error) {
      console.error(error);
      toast.error(getMessage(error, 'Unable to delete lead.'));
    } finally {
      setDeleting(false);
    }
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = [];
      let currentPage = 1,
        total = Infinity;
      while (rows.length < total && currentPage <= MAX_EXPORT_PAGES) {
        const result = await leadService.getLeadReport(query(currentPage, 1000));
        rows.push(...result.data);
        total = result.totalCount;
        if (!result.data.length || result.data.length < 1000) break;
        currentPage += 1;
      }
      const headers = [
        'Lead ID',
        'Customer',
        'Email',
        'Phone',
        'Sales Person',
        'Group',
        'Location',
        'Description',
        'Disposition',
        'Comments',
        'Vendor',
        'Lead Date',
        'Assign Date'
      ];
      const lines = [
        headers,
        ...rows.map((lead) => [
          lead.leadId,
          lead.customerName,
          lead.email,
          lead.phone,
          lead.assignedToName,
          lead.groupName,
          lead.locationName,
          lead.description,
          lead.dispositionName,
          lead.comments,
          lead.vendorName,
          lead.leadDate,
          lead.assignDate
        ])
      ].map((row) => row.map(csvCell).join(','));
      const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `leads-${ymd()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} leads`);
    } catch (error) {
      console.error(error);
      toast.error(getMessage(error, 'Unable to export leads.'));
    } finally {
      setExporting(false);
    }
  };
  const columns = [
    { id: 'serial', header: '#' },
    {
      id: 'customer',
      header: 'Customer',
      cell: (lead) => (
        <div>
          <strong>{lead.customerName || '-'}</strong>
          {lead.isValid === false && (
            <Badge bg="danger" className="ms-2">
              Invalid
            </Badge>
          )}
          {lead.isProxy && (
            <Badge bg="warning" text="dark" className="ms-1">
              VPN/Proxy
            </Badge>
          )}
          <small className="d-block text-muted">
            {lead.email || '-'} · {formatPhone(lead.phone)}
          </small>
          {lead.activityScore !== undefined && lead.activityScore !== null && (
            <small className="text-muted">Activity: {lead.activityScore}</small>
          )}
        </div>
      )
    },
    {
      id: 'sales',
      header: 'Sales Person',
      cell: (lead) => (
        <div>
          {lead.assignedToName || '-'}
          <div className="d-flex gap-1 mt-1">
            {badge(lead.groupName, 'info', 'dark')}
            {badge(lead.locationName, 'light', 'dark')}
          </div>
          {lead.transferByName && <small className="text-muted">Transferred by {lead.transferByName}</small>}
        </div>
      )
    },
    {
      id: 'description',
      header: 'Description',
      cell: (lead) => (
        <div className="lead-clamp" title={lead.description}>
          {lead.description || '-'}
        </div>
      )
    },
    {
      id: 'disposition',
      header: 'Disposition',
      cell: (lead) => (
        <div>
          {badge(lead.dispositionName, 'primary')}
          <small className="d-block text-muted lead-clamp" title={lead.comments}>
            {lead.comments || '-'}
          </small>
        </div>
      )
    },
    { id: 'vendor', header: 'Vendor', cell: (lead) => badge(lead.vendorName) },
    {
      id: 'leadDate',
      header: 'Lead Date',
      sortable: true,
      sortKey: 'dateAdded',
      cell: (lead) => <DateCell value={lead.leadDate} timeZone={lead.timeZone} now={now} />
    },
    {
      id: 'assignDate',
      header: 'Assign Date',
      sortable: true,
      cell: (lead) => <DateCell value={lead.assignDate} timeZone={lead.timeZone} now={now} />
    },
    {
      id: 'action',
      header: 'Action',
      sticky: 'right',
      cell: (lead) =>
        permissions.canDelete ? (
          <Button variant="outline-danger" size="sm" onClick={() => setDeleteLead(lead)} aria-label={`Delete lead ${lead.leadId}`}>
            <Trash2 size={15} />
          </Button>
        ) : (
          '-'
        )
    }
  ];
  return (
    <>
      <div className="lead-summary-bar">
        <div className="lead-summary-overview">
          <div className="lead-metrics" aria-label={voicemail ? 'Voicemail summary' : 'Lead summary'}>
            <div className="lead-metric lead-metric-total">
              <span className="lead-metric-dot" />
              <div>
                <strong>{state.totalCount}</strong>
                <span>Total {voicemail ? 'Voicemails' : 'Leads'}</span>
              </div>
            </div>
            <div className="lead-metric lead-metric-available">
              <span className="lead-metric-dot" />
              <div>
                <strong>{state.data.length}</strong>
                <span>Showing now</span>
              </div>
            </div>
          </div>
        </div>
        <div className="lead-summary-actions">
          {filters.text && <span className="lead-search-mode">Searching across all dates</span>}
          {hasActiveFilters && (
            <button
              type="button"
              className="lead-reset-chip"
              onClick={resetFilters}
              title="Reset all filters"
              aria-label="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
          <div className="lead-report-menu" ref={reportMenuRef}>
            <button
              type="button"
              className={`lead-export-icon-button lead-report-icon-button ${reportMenuOpen ? 'active' : ''}`}
              onClick={() => setReportMenuOpen((value) => !value)}
              aria-label="Open reports"
              aria-haspopup="menu"
              aria-expanded={reportMenuOpen}
              title="Reports"
            >
              <FileBarChart size={18} />
            </button>
            {reportMenuOpen && (
              <div className="lead-report-menu-popover" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setReport('disposition');
                    setReportMenuOpen(false);
                  }}
                >
                  Disposition
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setReport('conversation');
                    setReportMenuOpen(false);
                  }}
                >
                  Conversation
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="lead-export-icon-button"
            onClick={exportCsv}
            disabled={exporting}
            aria-label="Export CSV"
            title={exporting ? 'Preparing CSV' : 'Export CSV'}
          >
            {exporting ? <Spinner size="sm" /> : <Download size={18} />}
          </button>
          <button
            type="button"
            className="lead-round-refresh"
            onClick={state.refresh}
            disabled={state.loading}
            aria-label={`Refresh ${voicemail ? 'voicemails' : 'leads'}`}
            title={`Refresh ${voicemail ? 'voicemails' : 'leads'}`}
          >
            <RefreshCw size={18} className={state.loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="lead-report-panel">
        <div className="lead-filters">
          <div className="lead-search-field">
            <Search size={17} aria-hidden="true" />
            <input
              type="text"
              className="lead-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={voicemail ? 'Search voicemails…' : 'Search leads…'}
              aria-label={voicemail ? 'Search voicemails' : 'Search all leads'}
            />
            {searchInput && (
              <button type="button" className="lead-search-clear" onClick={() => setSearchInput('')} aria-label="Clear search">
                ×
              </button>
            )}
          </div>
          <div className="lead-date-picker">
            <LeadDateRangeCalendar
              fromDate={filters.fromDate}
              toDate={filters.toDate}
              disabled={Boolean(filters.text)}
              onChange={(fromDate, toDate) => {
                setFilters((old) => ({ ...old, fromDate, toDate }));
                setPage(1);
              }}
            />
          </div>
          <Form.Select
            aria-label="Sales person"
            value={filters.salesPersonId}
            onChange={(e) => updateFilter('salesPersonId', e.target.value)}
          >
            <option value="">Sales Person: All</option>
            {lookups.users.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </Form.Select>
          <Form.Select aria-label="Group" value={filters.groupId} onChange={(e) => updateFilter('groupId', e.target.value)}>
            <option value="">Groups: All</option>
            {lookups.groups.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </Form.Select>
          <Form.Select aria-label="Location" value={filters.locationId} onChange={(e) => updateFilter('locationId', e.target.value)}>
            <option value="">Locations: All</option>
            {lookups.locations.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </Form.Select>
          <Form.Select aria-label="Vendor" value={filters.vendorId} onChange={(e) => updateFilter('vendorId', e.target.value)}>
            <option value="">Vendors: All</option>
            {lookups.vendors.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </Form.Select>
        </div>
      </div>
      <ErrorState message={state.error} onRetry={state.refresh} />
      <LeadDataTable
        columns={columns}
        data={state.data}
        loading={state.loading}
        rowKey="leadId"
        sort={{
          ...sort,
          onSort: (key) => setSort((old) => ({ sortProperty: key, isDescending: old.sortProperty === key ? !old.isDescending : false }))
        }}
        pagination={pagination(page, pageSize, state.totalCount, setPage, setPageSize)}
        emptyState={{ title: voicemail ? 'No voicemail leads' : 'No leads found', description: 'Try changing the active filters.' }}
      />
      <DeleteConfirmModal
        open={Boolean(deleteLead)}
        title="Delete Lead"
        description="Are you sure you want to delete"
        itemName={deleteLead?.customerName || `Lead #${deleteLead?.leadId}`}
        details={[
          { label: 'Lead ID', value: deleteLead?.leadId },
          { label: 'Customer', value: deleteLead?.customerName || '-' }
        ]}
        loading={deleting}
        onCancel={() => setDeleteLead(null)}
        onConfirm={remove}
      />
      {report && <ReportDialog report={report} filters={filters} lookups={lookups} onClose={() => setReport('')} />}
    </>
  );
}

export default function LeadsPage() {
  const location = useLocation(),
    navigate = useNavigate();
  const [lookups, setLookups] = useState({ dispositions: [], users: [], groups: [], locations: [], vendors: [] }),
    [lookupsLoading, setLookupsLoading] = useState(true);
  const permissions = useMemo(
    () => Object.fromEntries(TABS.map((tab) => [tab.id, resolveConfiguredPagePermissions(tab.route, tab.aliases)])),
    []
  );
  const queryTab = new URLSearchParams(location.search).get('tab')?.toLowerCase();
  const activeId =
    location.pathname.toLowerCase() === '/newleads'
      ? 'new'
      : location.pathname.toLowerCase().includes('/myleads')
        ? 'my'
        : location.pathname.toLowerCase().includes('/callback')
          ? 'callback'
          : location.pathname.toLowerCase().includes('/voicemail')
            ? 'voicemail'
            : queryTab && TABS.some((tab) => tab.id === queryTab)
              ? queryTab
              : 'new';
  const visibleTabs = TABS.filter((tab) => permissions[tab.id].canView);
  useEffect(() => {
    const bareLeads = location.pathname.toLowerCase() === '/leads' && !queryTab;
    const allowed = visibleTabs.some((tab) => tab.id === activeId);
    if ((bareLeads || !allowed) && visibleTabs.length) navigate(visibleTabs[0].route, { replace: true });
  }, [activeId, location.pathname, navigate, queryTab, visibleTabs]);
  useEffect(() => {
    const controller = new AbortController();
    setLookupsLoading(true);
    Promise.all([
      leadService.getOptions('Dispositions', controller.signal),
      leadService.getSalesUsers(),
      leadService.getLookup('/Group', ['groupId', 'GroupId', 'id'], ['groupName', 'GroupName', 'name'], controller.signal),
      leadService.getLookup('/Location', ['locationId', 'LocationId', 'id'], ['name', 'locationName', 'LocationName'], controller.signal),
      leadService.getOptions('vendors', controller.signal)
    ])
      .then(([dispositions, users, groups, locations, vendors]) => setLookups({ dispositions, users, groups, locations, vendors }))
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error(error);
          toast.error(getMessage(error, 'Some lead filters could not be loaded.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLookupsLoading(false);
      });
    return () => controller.abort();
  }, []);
  const activePermissions = permissions[activeId];
  const claimPermission =
    hasPermissionCode('Claim_New_Leads') ||
    activePermissions.canUpdate ||
    String(currentUser().role || '')
      .toLowerCase()
      .match(/admin|developer/);
  const combinedPermissions = { ...activePermissions, canClaim: Boolean(claimPermission) };
  const myLeadPermissions = { ...combinedPermissions, canAdd: permissions.callback.canAdd };
  if (!visibleTabs.length)
    return (
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-5">
          <AlertCircle size={38} className="text-danger mb-3" />
          <h4>Access denied</h4>
          <p className="text-muted mb-0">You do not have view permission for any Lead page.</p>
        </Card.Body>
      </Card>
    );
  return (
    <section className="lead-page">
      <Card className="lead-shell">
        <div className="lead-tabs" role="tablist" aria-label="Lead sections">
          {visibleTabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeId === tab.id}
              key={tab.id}
              className={activeId === tab.id ? 'active' : ''}
              onClick={() => navigate(tab.route)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const currentIndex = visibleTabs.findIndex((item) => item.id === tab.id);
                const nextIndex =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? visibleTabs.length - 1
                      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
                navigate(visibleTabs[nextIndex].route);
              }}
            >
              <span className="lead-tab-full">{tab.label}</span>
              <span className="lead-tab-short">{tab.short}</span>
            </button>
          ))}
        </div>
        <Card.Body>
          {lookupsLoading && (
            <div className="lead-lookup-loading">
              <Spinner size="sm" />
              <span>Loading permissions and lead options…</span>
            </div>
          )}
          {activePermissions.canView ? (
            <>
              {activeId === 'new' && <NewLeadsTab permissions={combinedPermissions} onClaimed={() => navigate('/Leads/MyLeads')} />}
              {activeId === 'my' && (
                <MyLeadsTab permissions={myLeadPermissions} dispositions={lookups.dispositions} users={lookups.users} />
              )}
              {activeId === 'callback' && (
                <CallbackTab permissions={combinedPermissions} dispositions={lookups.dispositions} users={lookups.users} />
              )}
              {activeId === 'voicemail' && <LeadsReportTab permissions={combinedPermissions} voicemail lookups={lookups} />}
              {activeId === 'leads' && <LeadsReportTab permissions={combinedPermissions} lookups={lookups} />}
            </>
          ) : (
            <div className="text-center py-5">
              <AlertCircle size={32} className="text-danger mb-2" />
              <h5>Access denied</h5>
              <p className="text-muted">You do not have permission to view this page.</p>
            </div>
          )}
        </Card.Body>
      </Card>
    </section>
  );
}
