import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import './liquid-select.css';
import { createLiquidMotion, stepLiquidMotion } from './motion';
import LiquidMembraneSurface from './LiquidMembraneSurface';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Keep the membrane separate from the text: only the surface passes through
// the SVG filter, so labels and the search field stay sharp during the pour.
export default function LiquidMembraneSelect({
  id: triggerId,
  value,
  onValueChange,
  options,
  label,
  placeholder = 'Select...',
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  disabled = false
}) {
  const id = useId().replace(/:/g, '');
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [layout, setLayout] = useState(null);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const surfaceRef = useRef(null);
  const bodyRef = useRef(null);
  const neckRef = useRef(null);
  const dropsRef = useRef(null);
  const motion = useRef(createLiquidMotion());
  const openRef = useRef(false);
  const focusOnOpen = useRef(false);
  const typeahead = useRef({ text: '', time: 0 });
  const searchable = typeof onSearchChange === 'function';
  const selected = options.find((option) => String(option.value) === String(value));
  const selectedLabel = selected?.label || placeholder;
  const callbacks = useRef({ onSearchChange });
  callbacks.current = { onSearchChange };

  const close = useCallback((restoreFocus = false) => {
    openRef.current = false;
    setOpen(false);
    // Leave results in place until the membrane has flowed back to the trigger.
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const dismiss = useCallback(() => {
    // A viewport scroll invalidates every fixed portal coordinate. Remove the
    // entire surface immediately, including a trigger already draining closed.
    openRef.current = false;
    setOpen(false);
    setPresent(false);
    setLayout(null);
    motion.current = createLiquidMotion();
    callbacks.current.onSearchChange?.('');
  }, []);

  const show = (keyboard = false) => {
    if (disabled) return;
    focusOnOpen.current = keyboard;
    openRef.current = true;
    setActive(
      Math.max(
        0,
        options.findIndex((option) => String(option.value) === String(value))
      )
    );
    setPresent(true);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!present) return;
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, searchable ? 252 : 220), window.innerWidth - 24);
      const gap = 12;
      const below = window.innerHeight - rect.bottom - gap - 12;
      const above = rect.top - gap - 12;
      const upwards = below < 160 && above > below;
      const maxHeight = Math.max(60, Math.min(320, upwards ? above : below));
      const height = Math.min(panelRef.current?.scrollHeight || maxHeight, maxHeight);
      const left = clamp(rect.left, 12, window.innerWidth - width - 12);
      setLayout({
        x: rect.left,
        y: rect.top,
        triggerWidth: rect.width,
        triggerHeight: rect.height,
        left,
        top: upwards ? rect.top - gap - height : rect.bottom + gap,
        width,
        height,
        maxHeight,
        upwards,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (panelRef.current) observer.observe(panelRef.current);
    observer.observe(triggerRef.current);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [present, searchable, options.length]);

  useEffect(() => {
    if (!open || !layout) return;
    const option = panelRef.current?.querySelector('[aria-selected="true"]');
    if (option) {
      const viewport = option.parentElement;
      viewport.scrollTop = Math.max(0, option.offsetTop - (viewport.clientHeight - option.offsetHeight) / 2);
    }
    if (searchable) searchRef.current?.focus({ preventScroll: true });
    else if (focusOnOpen.current) panelRef.current?.querySelector('[data-active="true"]')?.focus({ preventScroll: true });
    focusOnOpen.current = false;
  }, [open, Boolean(layout), searchable]);

  useEffect(() => {
    if (!present || !layout) return;
    let frame;
    let previous;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const paint = (time) => {
      const state = motion.current;
      const target = openRef.current ? 1 : 0;
      const dt = previous ? (time - previous) / 1000 : 1 / 60;
      previous = time;
      const result = stepLiquidMotion(state, target, layout, dt, reduced.matches);
      const { body, neck, droplets, opacity, settled } = result;
      if (bodyRef.current) {
        for (const [name, number] of Object.entries({ x: body.x, y: body.y, width: body.width, height: body.height, rx: body.radius })) {
          bodyRef.current.setAttribute(name, number);
        }
      }
      neckRef.current?.setAttribute('d', neck);
      const elements = dropsRef.current?.children || [];
      for (let index = 0; index < elements.length; index++) {
        const drop = droplets[index];
        const element = elements[index];
        element.setAttribute('rx', drop?.rx || 0);
        element.setAttribute('ry', drop?.ry || 0);
        if (!drop) continue;
        element.setAttribute('cx', drop.x);
        element.setAttribute('cy', drop.y);
        element.setAttribute('transform', 'rotate(' + drop.angle + ' ' + drop.x + ' ' + drop.y + ')');
      }
      if (surfaceRef.current) surfaceRef.current.style.opacity = '1';
      if (panelRef.current) {
        const panel = panelRef.current;
        panel.style.opacity = String(opacity);
        panel.style.transform = 'translateY(' + (body.y - layout.top) + 'px)';
        panel.style.clipPath =
          'inset(0 ' + Math.max(0, (layout.width - body.width) / 2) + 'px ' + Math.max(0, layout.height - body.height) + 'px round 16px)';
      }
      if (settled) {
        state.progress = target;
        state.velocity = 0;
        if (!target) {
          setPresent(false);
          setLayout(null);
          callbacks.current.onSearchChange?.('');
        }
      } else frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [present, layout, open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!triggerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) close();
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, close]);

  useEffect(() => {
    if (!present) return;
    const scroll = (event) => {
      if (!panelRef.current?.contains(event.target)) dismiss();
    };
    window.addEventListener('scroll', scroll, true);
    return () => window.removeEventListener('scroll', scroll, true);
  }, [present, dismiss]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);

  const choose = (option) => {
    if (!openRef.current || option.disabled) return;
    onValueChange?.(option.value);
    close(true);
  };
  const keyboard = (event) => {
    if (event.key === 'Tab') {
      close();
      return;
    }
    const enabled = options.map((option, index) => (option.disabled ? -1 : index)).filter((index) => index >= 0);
    if (!enabled.length) return;
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const current = enabled.indexOf(active);
      next = enabled[(current + direction + enabled.length) % enabled.length];
    } else if (event.target !== searchRef.current && (event.key === 'Home' || event.key === 'End'))
      next = enabled[event.key === 'Home' ? 0 : enabled.length - 1];
    else if (event.target !== searchRef.current && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (options[active]) choose(options[active]);
      return;
    } else if (!searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - typeahead.current.time < 700 ? typeahead.current.text : '') + event.key.toLowerCase();
      typeahead.current = { text, time: now };
      next = enabled.find((index) => options[index].label.toLowerCase().startsWith(text));
    }
    if (next !== undefined) {
      event.preventDefault();
      setActive(next);
      const option = panelRef.current?.querySelector(`[data-index="${next}"]`);
      option?.focus({ preventScroll: true });
      option?.scrollIntoView({ block: 'nearest' });
    }
  };

  const triggerContent = (
    <>
      <span key={selectedLabel} className="dashboard-liquid-label">
        {selectedLabel}
      </span>
      <ChevronDown size={16} aria-hidden="true" />
    </>
  );
  return (
    <>
      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        className="dashboard-liquid-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        disabled={disabled}
        data-present={present && Boolean(layout)}
        data-open={open}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            close();
            return;
          }
          if (open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            keyboard(event);
            return;
          }
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            if (open) close();
            else show(true);
          }
        }}
      >
        {triggerContent}
      </button>
      {present &&
        createPortal(
          <div className="dashboard-liquid-layer" data-open={open}>
            {layout && (
              <>
                <LiquidMembraneSurface
                  ref={surfaceRef}
                  id={id}
                  layout={layout}
                  bodyRef={bodyRef}
                  neckRef={neckRef}
                  dropsRef={dropsRef}
                  className="dashboard-liquid-surface"
                />
                <div
                  className="dashboard-liquid-trigger dashboard-liquid-trigger-copy"
                  aria-hidden="true"
                  data-open={open}
                  style={{ left: layout.x, top: layout.y, width: layout.triggerWidth, height: layout.triggerHeight }}
                >
                  {triggerContent}
                </div>
              </>
            )}
            <div
              ref={panelRef}
              className="dashboard-liquid-panel"
              data-ready={Boolean(layout)}
              aria-hidden={!open}
              inert={!open ? '' : undefined}
              onKeyDown={keyboard}
              style={{
                left: layout?.left ?? 0,
                top: layout?.top ?? 0,
                width: layout?.width ?? 252,
                maxHeight: layout?.maxHeight ?? 320,
                pointerEvents: open ? 'auto' : 'none'
              }}
            >
              {searchable && (
                <div className="dashboard-liquid-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    ref={searchRef}
                    aria-label={searchPlaceholder}
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(event) => {
                      onSearchChange(event.target.value);
                      setActive(-1);
                    }}
                  />
                </div>
              )}
              <div role="listbox" id={`${id}-list`} aria-label={label} className="dashboard-liquid-options">
                {options.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    id={`${id}-option-${index}`}
                    aria-selected={String(value) === String(option.value)}
                    disabled={option.disabled}
                    data-index={index}
                    data-active={active === index}
                    tabIndex={open && index === active ? 0 : -1}
                    className="dashboard-liquid-option"
                    onClick={() => choose(option)}
                    onFocus={() => setActive(index)}
                  >
                    <span className="dashboard-liquid-option-label">{option.label}</span>
                    {String(value) === String(option.value) && <Check size={15} aria-hidden="true" />}
                    {option.meta && <span className="dashboard-liquid-option-meta">{option.meta}</span>}
                  </button>
                ))}
                {!options.length && <p className="dashboard-liquid-empty">No options found.</p>}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
