import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export default function GatewayTabs({ items, value, onChange }) {
  const trackRef = useRef(null);
  const buttonRefs = useRef({});
  const [position, setPosition] = useState(null);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const button = buttonRefs.current[value];
    if (!track || !button) return;
    const trackBounds = track.getBoundingClientRect();
    const buttonBounds = button.getBoundingClientRect();
    const next = {
      left: buttonBounds.left - trackBounds.left - track.clientLeft + track.scrollLeft,
      top: buttonBounds.top - trackBounds.top - track.clientTop + track.scrollTop,
      width: buttonBounds.width,
      height: buttonBounds.height
    };
    setPosition((previous) => (previous && Object.keys(next).every((key) => previous[key] === next[key]) ? previous : next));
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (trackRef.current) observer?.observe(trackRef.current);
    Object.values(buttonRefs.current).forEach((button) => {
      if (button) observer?.observe(button);
    });
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, items]);

  return (
    <nav ref={trackRef} className="gateway-tabs" aria-label="Gateway sections">
      <span
        className="gateway-tabs__indicator"
        aria-hidden="true"
        style={{
          transform: `translate3d(${position?.left || 0}px, ${position?.top || 0}px, 0)`,
          width: position?.width || 0,
          height: position?.height || 0,
          opacity: position ? 1 : 0
        }}
      />
      {items.map(({ id, label, icon: Icon }) => (
        <button
          ref={(button) => {
            buttonRefs.current[id] = button;
          }}
          type="button"
          key={id}
          className="gateway-tab"
          aria-current={value === id ? 'page' : undefined}
          aria-controls="gateway-records"
          onClick={() => onChange(id)}
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
