import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';

/**
 * GlassSegmentedControl â€” iOS-style segmented control.
 *
 * A single glass "thumb" is absolutely positioned over the track and slides to
 * whichever option is selected, rather than each option painting its own
 * background. That is what makes the change read as one pill moving instead of
 * two independent colour swaps.
 *
 * The thumb's box is measured from the live DOM (options are label-width, not
 * equal-width, so it cannot be derived from an index) and handed to CSS as
 * --seg-x / --seg-y / --seg-w / --seg-h.
 */
const GlassSegmentedControl = ({
  options,
  value,
  onChange,
  className,
  ariaLabel,
  disabled = false,
}) => {
  const trackRef = useRef(null);
  const optionRefs = useRef([]);
  const [box, setBox] = useState(null);
  const [pressed, setPressed] = useState(false);

  const activeIndex = options.findIndex((option) => option.value === value);
  // Nothing matched: fall back to the first option so the thumb still has a
  // home rather than collapsing to zero width.
  const thumbIndex = activeIndex >= 0 ? activeIndex : 0;

  const measure = useCallback(() => {
    const el = optionRefs.current[thumbIndex];
    if (!el) return;
    setBox((prev) => {
      const next = {
        x: el.offsetLeft,
        y: el.offsetTop,
        w: el.offsetWidth,
        h: el.offsetHeight,
      };
      // Skip the state write when nothing moved â€” a ResizeObserver fires on
      // every layout pass and would otherwise loop.
      if (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h) {
        return prev;
      }
      return next;
    });
  }, [thumbIndex]);

  // Layout effect so the first paint already has the thumb in place; the
  // `data-ready` flag below keeps that first positioning from animating in
  // from the left edge.
  useLayoutEffect(() => {
    measure();
  }, [measure, options.length]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    if (trackRef.current) observer.observe(trackRef.current);
    optionRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [measure, options.length]);

  // Arrow keys walk the group, the way a native radio group does.
  const handleKeyDown = useCallback(
    (event) => {
      if (disabled) return;
      const isPrev = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      const isNext = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      if (!isPrev && !isNext) return;
      event.preventDefault();
      const delta = isPrev ? -1 : 1;
      const nextIndex = (thumbIndex + delta + options.length) % options.length;
      optionRefs.current[nextIndex]?.focus();
      onChange?.(options[nextIndex].value);
    },
    [disabled, onChange, options, thumbIndex],
  );

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={ariaLabel}
      data-ready={box ? 'true' : 'false'}
      data-pressed={pressed ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      className={clsx('glass-segmented', className)}
      style={
        box
          ? {
              '--seg-x': `${box.x}px`,
              '--seg-y': `${box.y}px`,
              '--seg-w': `${box.w}px`,
              '--seg-h': `${box.h}px`,
            }
          : undefined
      }
    >
      <span className="glass-segmented__thumb" aria-hidden="true" />

      {options.map((option, index) => {
        const isActive = index === thumbIndex && activeIndex >= 0;
        return (
          <button
            key={option.label}
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            // Roving tabindex: the group is one tab stop, arrows move inside it.
            tabIndex={index === thumbIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange?.(option.value)}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            className="glass-segmented__option"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default GlassSegmentedControl;


