import { forwardRef, useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Retain a real select for FormData, required validation, refs and change events.
// The visible control only replaces the browser's platform-specific option menu.
const NativeLiquidSelect = forwardRef(function NativeLiquidSelect(
  { children, className = '', style, onChange, onInvalid, onFocus, onBlur, onClick, id, multiple = false, disabled = false, ...props },
  forwardedRef
) {
  const generatedId = useId();
  const triggerId = id || `liquid-select-${generatedId}`;
  const nativeRef = useRef(null);
  const triggerRef = useRef(null);
  const [snapshot, setSnapshot] = useState({ options: [], value: multiple ? [] : '', label: props['aria-label'] || 'Select option' });
  const [validation, setValidation] = useState('');
  const mounted = useRef(false);
  const sync = useCallback(() => {
    const element = nativeRef.current;
    if (!element || !mounted.current) return;
    const options = [...element.options].map((option) => ({
      value: option.value,
      label: option.label || option.text || '',
      disabled: option.disabled || (option.parentElement.tagName === 'OPTGROUP' && option.parentElement.disabled)
    }));
    const value = multiple ? [...element.selectedOptions].map((option) => option.value) : element.value;
    const label =
      props['aria-label'] || (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent.trim()) || 'Select option';
    const next = { options, value, label, disabled: element.matches(':disabled') };
    setSnapshot((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, [multiple, id, props['aria-label']]);

  useLayoutEffect(() => {
    mounted.current = true;
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(nativeRef.current, { childList: true, subtree: true, attributes: true, characterData: true });
    const fieldset = nativeRef.current.closest('fieldset');
    if (fieldset) observer.observe(fieldset, { attributes: true, attributeFilter: ['disabled'] });
    const form = nativeRef.current.form;
    const reset = () => {
      setValidation('');
      queueMicrotask(sync);
    };
    form?.addEventListener('reset', reset);
    return () => {
      mounted.current = false;
      observer.disconnect();
      form?.removeEventListener('reset', reset);
    };
  }, [sync]);
  useLayoutEffect(sync);

  const choose = (value) => {
    const element = nativeRef.current;
    if (!element || element.matches(':disabled')) return;
    if (multiple) {
      const selected = new Set([...element.selectedOptions].map((option) => option.value));
      selected.has(String(value)) ? selected.delete(String(value)) : selected.add(String(value));
      for (const option of element.options) option.selected = selected.has(option.value);
    } else element.value = String(value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const layoutClasses = className
    .split(/\s+/)
    .filter((name) => /(^|:)(w-|min-w-|max-w-|flex-|shrink-|grow|basis-|col-span-)/.test(name))
    .join(' ');
  const full = /(^|\s)(w-full|form-control|form-select)(\s|$)/.test(className);
  return (
    <span className={`liquid-native-select ${full ? 'liquid-native-select--full' : ''} ${layoutClasses}`} style={style}>
      <select
        {...props}
        id={`${triggerId}-native`}
        multiple={multiple}
        disabled={disabled}
        className="liquid-native-select__backing"
        aria-hidden="true"
        tabIndex={-1}
        ref={(element) => {
          nativeRef.current = element;
          if (typeof forwardedRef === 'function') forwardedRef(element);
          else if (forwardedRef) forwardedRef.current = element;
        }}
        onChange={(event) => {
          setValidation('');
          sync();
          onChange?.(event);
          queueMicrotask(sync);
        }}
        onInvalid={(event) => {
          onInvalid?.(event);
          event.preventDefault();
          setValidation(event.currentTarget.validationMessage);
          triggerRef.current?.focus({ preventScroll: true });
        }}
      >
        {children}
      </select>
      <Select value={snapshot.value} onValueChange={choose} disabled={disabled || snapshot.disabled} multiple={multiple}>
        <SelectTrigger
          ref={triggerRef}
          id={triggerId}
          className={`liquid-native-select__trigger ${className}`}
          aria-label={snapshot.label}
          aria-required={props.required || undefined}
          aria-invalid={validation ? true : props['aria-invalid']}
          aria-describedby={validation ? `${triggerId}-error` : props['aria-describedby']}
          title={props.title}
          onFocus={onFocus}
          onBlur={onBlur}
          onClick={onClick}
        >
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {snapshot.options.map((option, index) => (
            <SelectItem key={`${option.value}-${index}`} value={option.value} disabled={option.disabled}>
              {option.label || '\u00a0'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {validation && (
        <span id={`${triggerId}-error`} className="liquid-native-select__error" role="alert">
          {validation}
        </span>
      )}
    </span>
  );
});

export default NativeLiquidSelect;
