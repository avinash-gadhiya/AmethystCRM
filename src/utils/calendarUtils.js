export const calendarDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

export const calendarYmd = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const calendarDays = (month) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  first.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
};

export const dateWithinBounds = (day, min = '', max = '') => (!min || day >= min.slice(0, 10)) && (!max || day <= max.slice(0, 10));

export const nextCalendarRange = (from, to, day) =>
  !from || to ? { fromDate: day, toDate: '' } : day < from ? { fromDate: day, toDate: from } : { fromDate: from, toDate: day };

export const dateWithTime = (day, previous = '', min = '', max = '') => {
  let result = `${day}T${previous.split('T')[1] || '00:00'}`;
  if (min && result < min) result = min;
  if (max && result > max) result = max;
  return result;
};

export const shiftCalendarRange = (from, to, direction) => {
  const start = calendarDate(from) || new Date();
  const end = calendarDate(to) || start;
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (start.getDate() === 1 && calendarYmd(end) === calendarYmd(lastDay)) {
    return {
      fromDate: calendarYmd(new Date(start.getFullYear(), start.getMonth() + direction, 1)),
      toDate: calendarYmd(new Date(start.getFullYear(), start.getMonth() + direction + 1, 0))
    };
  }
  const utcDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const span = Math.max(1, utcDay(end) - utcDay(start) + 1) * direction;
  return {
    fromDate: calendarYmd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + span)),
    toDate: calendarYmd(new Date(end.getFullYear(), end.getMonth(), end.getDate() + span))
  };
};
