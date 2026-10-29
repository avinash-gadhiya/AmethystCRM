import { useId } from 'react';
import { Check, SearchX } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function GatewayButton({ children, icon: Icon, variant = 'secondary', className = '', type = 'button', ...props }) {
  return (
    <button type={type} className={`gateway-button gateway-button--${variant} ${className}`} {...props}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function GatewayInput({ label, className = '', ...props }) {
  const generatedId = useId();
  const id = props.id || generatedId;
  return (
    <div className={`gateway-field ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <input {...props} id={id} className="gateway-input" />
    </div>
  );
}

export function GatewaySelect({ label, value, onChange, options, placeholder = 'Select an option', disabled, className = '' }) {
  const id = useId();
  return (
    <div className={`gateway-field ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <Select value={String(value ?? '')} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={label || placeholder} className="gateway-input w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="gateway-select-menu">
          {options.map((option, index) => (
            <SelectItem key={`${option.value}-${index}`} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
          {!options.length && (
            <SelectItem value="__empty" disabled>
              No options available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export function GatewayBadge({ children, tone = 'secondary' }) {
  return (
    <span className={`gateway-badge gateway-badge--${tone}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}

export function GatewayToggle({ label, checked, onChange }) {
  return (
    <label className="gateway-toggle">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <span className="gateway-toggle__track" aria-hidden="true">
        <Check size={12} />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function GatewayEmptyState({ section, filtered, onReset, action }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-5 py-12 text-center">
      <span className="gateway-empty-icon">
        <SearchX size={27} aria-hidden="true" />
      </span>
      <div>
        <p className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">No {section.toLowerCase()} found</p>
        <p className="mb-0 text-xs text-slate-500 dark:text-slate-400">
          {filtered ? 'Try another search or clear your filters.' : 'Records will appear here when available.'}
        </p>
      </div>
      {filtered ? <GatewayButton onClick={onReset}>Clear filters</GatewayButton> : action}
    </div>
  );
}
