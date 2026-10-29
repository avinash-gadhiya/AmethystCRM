import { forwardRef, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays } from 'lucide-react';
import MiniCalendar from './MiniCalendar';
import { dateWithTime } from '@/utils/calendarUtils';

// Keep a real input for form submission, browser validation, refs, and typing.
// Only date selection moves into the project's calendar popup.
const MiniCalendarInput = forwardRef(function MiniCalendarInput(
  { type = 'date', value, defaultValue = '', onChange, onClick, onKeyDown, className = '', disabled, readOnly, min, max, ...props },
  forwardedRef
) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(defaultValue);
  const currentValue = String(value !== undefined ? (value ?? '') : (localValue ?? ''));
  const editable = !disabled && !readOnly;
  const update = (next) => {
    const input = inputRef.current;
    if (!input || !editable) return;
    input.value = next;
    setLocalValue(next);
    // Existing handlers continue receiving an event with the actual input as target.
    const event = new Event('change', { bubbles: true });
    Object.defineProperties(event, { target: { value: input }, currentTarget: { value: input } });
    onChange?.(event);
  };

  return (
    <Popover.Root open={open && editable} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <span className="mini-calendar-input">
          <input
            {...props}
            ref={(element) => {
              inputRef.current = element;
              if (typeof forwardedRef === 'function') forwardedRef(element);
              else if (forwardedRef) forwardedRef.current = element;
            }}
            type={type}
            value={currentValue}
            min={min}
            max={max}
            disabled={disabled}
            readOnly={readOnly}
            className={`mini-calendar-input__field ${className}`}
            onChange={(event) => {
              setLocalValue(event.target.value);
              onChange?.(event);
            }}
            onClick={(event) => {
              onClick?.(event);
              if (!event.defaultPrevented && editable) setOpen(true);
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (!event.defaultPrevented && editable && (event.key === 'F4' || (event.altKey && event.key === 'ArrowDown'))) {
                event.preventDefault();
                setOpen(true);
              }
            }}
          />
          <Popover.Trigger asChild>
            <button
              type="button"
              className="mini-calendar-input__trigger"
              disabled={!editable}
              aria-label={props['aria-label'] ? `Choose ${props['aria-label']}` : 'Choose date'}
            >
              <CalendarDays size={16} aria-hidden="true" />
            </button>
          </Popover.Trigger>
        </span>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="mini-calendar-popover"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Choose date"
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onOpenAutoFocus={(event) => {
            if (document.activeElement === inputRef.current) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <MiniCalendar
            value={currentValue.slice(0, 10)}
            min={min}
            max={max}
            onSelect={(day) => {
              update(type === 'datetime-local' ? dateWithTime(day, currentValue, min, max) : day);
              if (type !== 'datetime-local') setOpen(false);
            }}
          />
          {type === 'datetime-local' && (
            <label className="mini-calendar__time">
              Time
              <input
                type="time"
                aria-label="Time"
                value={currentValue.split('T')[1] || ''}
                step={props.step}
                min={min?.slice(0, 10) === currentValue.slice(0, 10) ? min.split('T')[1] : undefined}
                max={max?.slice(0, 10) === currentValue.slice(0, 10) ? max.split('T')[1] : undefined}
                onChange={(event) => {
                  if (currentValue && event.target.value) update(`${currentValue.slice(0, 10)}T${event.target.value}`);
                }}
              />
            </label>
          )}
          <div className="mini-calendar__footer">
            {!props.required && (
              <button
                type="button"
                onClick={() => {
                  update('');
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
            <button type="button" className="mini-calendar__apply" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});

export default MiniCalendarInput;
