import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { toast } from 'sonner';

import CommonTable from '@/components/common/CommonTable';
import authService from '@/services/authService';
import leadService from '@/services/leadService';

const PAGE_SIZES = [10, 25, 50, 100];

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

export {
  CallbackEditor,
  DateCell,
  ErrorState,
  LeadDataTable,
  LeadDateRangeCalendar,
  badge,
  csvCell,
  currentUser,
  formatDate,
  formatPhone,
  getMessage,
  hasPermissionCode,
  pagination,
  useNow,
  usePagedData,
  userName,
  ymd
};
