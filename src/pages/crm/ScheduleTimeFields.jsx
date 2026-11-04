import { useId } from 'react';

const FIELDS = [
  { key: 'shiftStartTime', label: 'Shift start' },
  { key: 'shiftEndTime', label: 'Shift end' }
];

export default function ScheduleTimeFields({ startValue, endValue, onChange, disabled = false }) {
  const id = useId();
  const values = { shiftStartTime: startValue, shiftEndTime: endValue };

  return (
    <div className="scheduler-form-times">
      {FIELDS.map((field) => (
        <div key={field.key}>
          <label htmlFor={`${id}-${field.key}`}>
            {field.label} <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${id}-${field.key}`}
            type="time"
            step={60}
            aria-label={field.label}
            value={values[field.key].slice(0, 5)}
            disabled={disabled}
            required
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
