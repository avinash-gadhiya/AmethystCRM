import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const SelectContext = createContext(null);

export function Select({ value, onValueChange, children, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [itemLabels, setItemLabels] = useState({});
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);

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

  const registerItem = (val, label) => {
    setItemLabels((prev) => {
      if (prev[val] === label) return prev;
      return { ...prev, [val]: label };
    });
  };

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
        contentRef
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
  const { open, setOpen, disabled, triggerRef } = context;

  return (
    <button
      type="button"
      ref={triggerRef}
      disabled={disabled}
      onClick={() => !disabled && setOpen(!open)}
      className={`flex items-center justify-between gap-2 px-3 py-2 text-left font-medium transition-colors focus:outline-none ${className}`}
      {...props}
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

export function SelectContent({ className = '', children, search = null, position = 'popper', sideOffset = 4, ...props }) {
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
  const menuWidth = Math.max(200, triggerRect?.width || 200);
  const availableBelow = window.innerHeight - (triggerRect?.bottom || 0);
  const openAbove = availableBelow < 300 && (triggerRect?.top || 0) > availableBelow;
  const left = Math.max(8, Math.min(triggerRect?.left || 8, window.innerWidth - menuWidth - 8));
  const placementStyle = openAbove
    ? { bottom: window.innerHeight - (triggerRect?.top || 0) + sideOffset }
    : { top: (triggerRect?.bottom || 0) + sideOffset };

  return createPortal(
    <div
      ref={context.contentRef}
      className={`fixed max-h-72 min-w-[200px] overflow-hidden rounded-xl shadow-xl backdrop-blur-md transition-all ${className}`}
      style={{ ...placementStyle, left, width: menuWidth, zIndex: 10000 }}
      {...props}
    >
      {search && <div className="sticky top-0 z-10">{search}</div>}
      <div className="max-h-60 overflow-y-auto p-1 divide-y-0">{children}</div>
    </div>,
    document.body
  );
}

export function SelectItem({ value, children, className = '', meta = null, ...props }) {
  const context = useContext(SelectContext);
  if (!context) return null;
  const { value: selectedValue, onValueChange, setOpen, registerItem } = context;

  const isSelected = String(selectedValue) === String(value);

  // Register label for display in SelectValue
  useEffect(() => {
    let label = '';
    if (typeof children === 'string') {
      label = children;
    } else if (React.isValidElement(children)) {
      label = children.props.children || '';
    }
    if (label) {
      registerItem(value, label);
    }
  }, [value, children, registerItem]);

  const handleSelect = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onValueChange?.(value);
    setOpen(false);
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={handleSelect}
      className={`group relative flex cursor-pointer select-none flex-col rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors hover:bg-gray-100 dark:hover:bg-slate-800 ${
        isSelected ? 'bg-purple-50 font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : ''
      } ${className}`}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{children}</span>
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
