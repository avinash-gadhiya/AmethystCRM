import { useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { calendarDate, calendarDays, calendarYmd, dateWithinBounds } from '@/utils/calendarUtils';
import '@/styles/mini-calendar.css';

export default function MiniCalendar({ value = '', endValue = '', onSelect, min = '', max = '', range = false }) {
  const requested = value || calendarYmd(new Date());
  const clamped =
    min && requested < min.slice(0, 10) ? min.slice(0, 10) : max && requested > max.slice(0, 10) ? max.slice(0, 10) : requested;
  const initial = calendarDate(clamped) || new Date();
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [focusedDay, setFocusedDay] = useState(calendarYmd(initial));
  const dayRefs = useRef({});
  const headingId = useId();
  const days = calendarDays(month);
  const moveMonth = (direction) => {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    setMonth(next);
    const firstEnabled = calendarDays(next).find(
      (day) => day.getMonth() === next.getMonth() && dateWithinBounds(calendarYmd(day), min, max)
    );
    if (firstEnabled) setFocusedDay(calendarYmd(firstEnabled));
  };
  const moveFocus = (event, date) => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -date.getDay(), End: 6 - date.getDay() };
    let next;
    if (event.key in offsets) next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsets[event.key]);
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const destination = new Date(date.getFullYear(), date.getMonth() + (event.key === 'PageUp' ? -1 : 1), 1);
      const last = new Date(destination.getFullYear(), destination.getMonth() + 1, 0).getDate();
      next = new Date(destination.getFullYear(), destination.getMonth(), Math.min(date.getDate(), last));
    } else return;
    event.preventDefault();
    const key = calendarYmd(next);
    if (!dateWithinBounds(key, min, max)) return;
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setFocusedDay(key);
    window.requestAnimationFrame(() => dayRefs.current[key]?.focus());
  };

  return (
    <div className="mini-calendar">
      <div className="mini-calendar__heading">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
          <ChevronLeft size={16} />
        </button>
        <strong id={headingId} aria-live="polite">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </strong>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div role="grid" aria-labelledby={headingId}>
        <div role="row" className="mini-calendar__week">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <span role="columnheader" key={day}>
              {day}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div role="row" className="mini-calendar__week" key={week}>
            {days.slice(week * 7, week * 7 + 7).map((date) => {
              const day = calendarYmd(date);
              const selected = day === value || (range && day === endValue);
              return (
                <button
                  key={day}
                  ref={(element) => {
                    dayRefs.current[day] = element;
                  }}
                  role="gridcell"
                  type="button"
                  tabIndex={day === focusedDay ? 0 : -1}
                  aria-label={date.toLocaleDateString(undefined, { dateStyle: 'full' })}
                  aria-selected={selected}
                  aria-current={day === calendarYmd(new Date()) ? 'date' : undefined}
                  data-other-month={date.getMonth() !== month.getMonth()}
                  data-in-range={range && Boolean(value && endValue && day > value && day < endValue)}
                  disabled={!dateWithinBounds(day, min, max)}
                  onFocus={() => setFocusedDay(day)}
                  onKeyDown={(event) => moveFocus(event, date)}
                  onClick={() => {
                    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                    setFocusedDay(day);
                    onSelect(day);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
