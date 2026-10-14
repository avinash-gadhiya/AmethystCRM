import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const SelectContext = createContext(null);

const getOptionText = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getOptionText).filter(Boolean).join(' ').trim();
  if (React.isValidElement(node)) return getOptionText(node.props.children);
  return '';
};

export function Select({ value, onValueChange, children, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [itemLabels, setItemLabels] = useState({});
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const listboxId = useId();

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        (!contentRef.current || !contentRef.current.contains(e.target))
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleViewportChange = (event) => {
      // Keep the menu open while its own options are being scrolled. The
      // capture listener also receives scroll events from the portal content,
      // which previously closed long menus before an option could be chosen.
      if (event?.type === 'scroll' && contentRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open]);

  const registerItem = useCallback((val, label) => {
    setItemLabels((prev) => {
      if (prev[val] === label) return prev;
      return { ...prev, [val]: label };
    });
  }, []);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        open,
        setOpen,
        itemLabels,
        registerItem,
        disabled,
        triggerRef,
        contentRef,
        listboxId,
      }}
    >
      <div ref={containerRef} className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className = '', children, ...props }) {
  const context = useContext(SelectContext);
  if (!context) return null;
  const { open, setOpen, disabled, triggerRef, listboxId } = context;
  const { onClick, onKeyDown, ...triggerProps } = props;

  const handleClick = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented && !disabled) setOpen((current) => !current);
  };

  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <button
      type="button"
      ref={triggerRef}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      data-state={open ? 'open' : 'closed'}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`flex items-center justify-between gap-2 px-3 py-2 text-left font-medium transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...triggerProps}
    >
      <div className="flex-1 truncate">{children}</div>
      <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

export function SelectValue({ placeholder = 'Select...' }) {
  const context = useContext(SelectContext);
  if (!context) return null;
  const { value, itemLabels } = context;

  const display = value !== undefined && value !== null && itemLabels[value] !== undefined ? itemLabels[value] : placeholder;

  return <span className="truncate block">{display}</span>;
}

export function SelectContent({ className = '', children, search = null, position = 'popper', sideOffset = 4, style, ...props }) {
  const context = useContext(SelectContext);
  if (!context) return null;

  // Keep options mounted while closed so their labels are registered and the
  // trigger can display the selected value before the menu is opened once.
  if (!context.open) {
    return (
      <div className="hidden" aria-hidden="true">
        {children}
      </div>
    );
  }

  const triggerRect = context.triggerRef.current?.getBoundingClientRect();
  const viewportPadding = 8;
  const maxViewportWidth = Math.max(160, window.innerWidth - viewportPadding * 2);
  const menuWidth = Math.min(maxViewportWidth, Math.max(200, triggerRect?.width || 200));
  const availableBelow = Math.max(
    0,
    window.innerHeight - (triggerRect?.bottom || 0) - sideOffset - viewportPadding,
  );
  const availableAbove = Math.max(0, (triggerRect?.top || 0) - sideOffset - viewportPadding);

  // Keep menus below their controls in normal layouts. Opening upward over
  // section headers made the Create Order fields look detached and obscured
  // the payment method tabs. Only flip when there is almost no usable room.
  const openAbove = availableBelow < 72 && availableAbove > availableBelow;
  const availableSpace = openAbove ? availableAbove : availableBelow;
  const menuMaxHeight = Math.max(64, Math.min(288, availableSpace));
  const left = Math.max(
    viewportPadding,
    Math.min(triggerRect?.left || viewportPadding, window.innerWidth - menuWidth - viewportPadding),
  );
  const placementStyle = openAbove
    ? { bottom: window.innerHeight - (triggerRect?.top || 0) + sideOffset }
    : { top: (triggerRect?.bottom || 0) + sideOffset };

  return createPortal(
    <div
      ref={context.contentRef}
      id={context.listboxId}
      role="listbox"
      data-position={position}
      className={`fixed isolate flex min-w-[160px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${className}`}
      style={{ ...placementStyle, left, width: menuWidth, maxHeight: menuMaxHeight, zIndex: 10000, ...style }}
      {...props}
    >
      {search && <div className="z-10 shrink-0">{search}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">{children}</div>
    </div>,
    document.body
  );
}

export function SelectItem({ value, children, className = '', meta = null, textValue, disabled = false, ...props }) {
  const context = useContext(SelectContext);
  if (!context) return null;
  const { value: selectedValue, onValueChange, setOpen, registerItem } = context;

  const isSelected = String(selectedValue) === String(value);

  const optionLabel = String(textValue || getOptionText(children)).replace(/\s+/g, ' ').trim();

  // Register a plain-text label for the trigger. Complex product/user rows must
  // not be rendered inside the compact trigger after selection.
  useEffect(() => {
    if (optionLabel) registerItem(value, optionLabel);
  }, [value, optionLabel, registerItem]);

  const handleSelect = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onValueChange?.(value);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') handleSelect(event);
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={`group relative flex select-none flex-col rounded-lg px-2.5 py-2 text-xs outline-none transition-colors focus:bg-violet-50 focus:ring-2 focus:ring-inset focus:ring-violet-500/20 dark:focus:bg-violet-500/10 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-500/10'} ${
        isSelected ? 'bg-purple-50 font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : ''
      } ${className}`}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        {isSelected && <span className="flex h-1.5 w-1.5 rounded-full bg-purple-600 dark:bg-purple-400 shrink-0" />}
      </div>
      {meta && <div className="mt-1 flex flex-wrap items-center gap-1">{meta}</div>}
    </div>
  );
}

export default {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
};
