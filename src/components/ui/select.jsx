import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import useLiquidOverlay from '@/components/common/liquid-membrane/useLiquidOverlay';

const SelectContext = createContext(null);

const getOptionText = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getOptionText).filter(Boolean).join(' ').trim();
  if (React.isValidElement(node)) return getOptionText(node.props.children);
  return '';
};

export function Select({ value, onValueChange, onOpenChange, children, disabled = false, multiple = false }) {
  const [open, setOpenState] = useState(false);
  const [itemLabels, setItemLabels] = useState({});
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const listboxId = useId();
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpen = useCallback((nextOpenOrUpdater) => {
    setOpenState((prev) => {
      const next = typeof nextOpenOrUpdater === 'function' ? nextOpenOrUpdater(prev) : Boolean(nextOpenOrUpdater);
      if (next !== prev) {
        onOpenChangeRef.current?.(next);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled, setOpen]);

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
    const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const handleViewportChange = (event) => {
      // Keep the menu open while its own options are being scrolled. The
      // capture listener also receives scroll events from the portal content,
      // which previously closed long menus before an option could be chosen.
      if (event?.type === 'scroll' && contentRef.current?.contains(event.target)) return;
      // Ignore vertical-only viewport resizes caused by mobile virtual keyboards
      // opening when focusing SelectSearchInput inside the dropdown.
      if (event?.type === 'resize' && typeof window !== 'undefined' && Math.abs(window.innerWidth - initialWidth) < 8) {
        return;
      }
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
  }, [open, setOpen]);

  const registerItem = useCallback((val, label) => {
    const key = String(val);
    setItemLabels((prev) => {
      if (prev[val] === label && prev[key] === label) return prev;
      return { ...prev, [val]: label, [key]: label };
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
        multiple,
        triggerRef,
        contentRef,
        listboxId
      }}
    >
      <div ref={containerRef} className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export const SelectTrigger = React.forwardRef(function SelectTrigger({ className = '', children, ...props }, forwardedRef) {
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
      ref={(node) => {
        triggerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
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
});

export function SelectValue({ placeholder = 'Select...' }) {
  const context = useContext(SelectContext);
  if (!context) return null;
  const { value, itemLabels } = context;

  if (Array.isArray(value)) {
    const labels = value.map((item) => itemLabels[String(item)]).filter(Boolean);
    return <span className="truncate block">{labels.length ? labels.join(', ') : placeholder}</span>;
  }

  const resolvedLabel = value !== undefined && value !== null ? (itemLabels[value] ?? itemLabels[String(value)]) : undefined;
  const display = resolvedLabel !== undefined ? resolvedLabel : placeholder;

  return <span className="truncate block">{display}</span>;
}

export function SelectContent({ className = '', children, search = null, position = 'popper', sideOffset = 4, style, ...props }) {
  const context = useContext(SelectContext);
  const fallbackAnchor = useRef(null);
  const layerIndex = Number(style?.zIndex) || 11000;
  const { surface, mountContent } = useLiquidOverlay({
    open: Boolean(context?.open),
    onOpenChange: context?.setOpen || (() => {}),
    anchorRef: context?.triggerRef || fallbackAnchor,
    forwardedRef: context?.contentRef,
    placement: 'self',
    zIndex: layerIndex
  });
  useEffect(() => {
    if (!context?.open) return;
    const content = context.contentRef.current;
    if (!content || content.contains(document.activeElement)) return;
    (
      content.querySelector('input') ||
      content.querySelector('[aria-selected="true"]:not([aria-disabled="true"])') ||
      content.querySelector('[role="option"]:not([aria-disabled="true"])')
    )?.focus({ preventScroll: true });
  }, [context?.open]);
  if (!context) return null;

  // Keep options mounted while closed so their labels are registered and the
  // trigger can display the selected value before the menu is opened once.
  if (!context.open) {
    return (
      <>
        {surface}
        <div className="hidden" aria-hidden="true">
          {children}
        </div>
      </>
    );
  }

  const triggerRect = context.triggerRef.current?.getBoundingClientRect();
  const gap = Math.max(12, sideOffset);
  const viewportPadding = 8;
  const maxViewportWidth = Math.max(160, window.innerWidth - viewportPadding * 2);
  const menuWidth = Math.min(maxViewportWidth, Math.max(200, triggerRect?.width || 200));
  const availableBelow = Math.max(0, window.innerHeight - (triggerRect?.bottom || 0) - gap - viewportPadding);
  const availableAbove = Math.max(0, (triggerRect?.top || 0) - gap - viewportPadding);

  // Keep menus below their controls in normal layouts. Opening upward over
  // section headers made the Create Order fields look detached and obscured
  // the payment method tabs. Only flip when there is almost no usable room.
  const openAbove = availableBelow < 72 && availableAbove > availableBelow;
  const availableSpace = openAbove ? availableAbove : availableBelow;
  const menuMaxHeight = Math.max(64, Math.min(288, availableSpace));
  const left = Math.max(viewportPadding, Math.min(triggerRect?.left || viewportPadding, window.innerWidth - menuWidth - viewportPadding));
  const placementStyle = openAbove
    ? { bottom: window.innerHeight - (triggerRect?.top || 0) + gap }
    : { top: (triggerRect?.bottom || 0) + gap };

  return (
    <>
      {surface}
      {createPortal(
        <div
          ref={mountContent}
          id={context.listboxId}
          role="listbox"
          aria-multiselectable={context.multiple || undefined}
          data-position={position}
          className={`liquid-overlay-content fixed isolate flex min-w-[160px] flex-col overflow-hidden rounded-xl border border-slate-200 text-slate-800 dark:text-slate-100 ${className}`}
          style={{ ...placementStyle, left, width: menuWidth, maxHeight: menuMaxHeight, ...style, zIndex: layerIndex + 1 }}
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              context.setOpen(false);
              context.triggerRef.current?.focus({ preventScroll: true });
              return;
            }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const isInput = event.target.tagName === 'INPUT';
            if (isInput && ['Home', 'End'].includes(event.key)) return;
            const options = [...context.contentRef.current.querySelectorAll('[role="option"]:not([aria-disabled="true"])')];
            if (!options.length) return;
            event.preventDefault();
            const current = options.indexOf(document.activeElement);
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            options[next].focus({ preventScroll: true });
            const viewport = options[next].closest('[data-select-scroll]');
            if (viewport) {
              const top = options[next].offsetTop;
              if (top < viewport.scrollTop) viewport.scrollTop = top;
              else if (top + options[next].offsetHeight > viewport.scrollTop + viewport.clientHeight)
                viewport.scrollTop = top + options[next].offsetHeight - viewport.clientHeight;
            }
          }}
          {...props}
        >
          {search && <div className="z-10 shrink-0">{search}</div>}
          <div data-select-scroll className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
            {children}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function SelectItem({ value, children, className = '', meta = null, textValue, disabled = false, ...props }) {
  const context = useContext(SelectContext);
  const registerItem = context?.registerItem;
  const optionLabel = String(textValue || getOptionText(children))
    .replace(/\s+/g, ' ')
    .trim();

  // Register a plain-text label for the trigger. Complex product/user rows must
  // not be rendered inside the compact trigger after selection.
  useEffect(() => {
    if (registerItem && optionLabel) registerItem(value, optionLabel);
  }, [value, optionLabel, registerItem]);

  if (!context) return null;
  const { value: selectedValue, onValueChange, setOpen } = context;

  const isSelected = Array.isArray(selectedValue)
    ? selectedValue.some((item) => String(item) === String(value))
    : String(selectedValue) === String(value);

  const handleSelect = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onValueChange?.(value);
    if (!context.multiple) {
      setOpen(false);
      context.triggerRef.current?.focus({ preventScroll: true });
    }
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
