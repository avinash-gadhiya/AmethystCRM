import React, { useCallback, useState } from 'react';

const LiquidGlassButton = React.forwardRef(
  (
    {
      className = '',
      onClick,
      type = 'button',
      variant = 'default',
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState([]);

    const handleClick = useCallback(
      (e) => {
        if (disabled) return;

        try {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          const id = Date.now();
          setRipples((prev) => [...prev, { x, y, id }]);

          window.setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== id));
          }, 600);
        } catch {
          // ignore ripple calculation errors
        }

        onClick?.(e);
      },
      [disabled, onClick]
    );

    const variantClass = variant === 'danger' ? 'liquid-glass-btn--danger' : '';
    const combinedClassName = `liquid-glass-btn ${variantClass} ${className}`.trim();

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        onClick={handleClick}
        className={combinedClassName}
        {...props}
      >
        <span className="liquid-glass-btn__bg" aria-hidden="true" />
        <span className="liquid-glass-btn__shine" aria-hidden="true" />
        <span className="liquid-glass-btn__shimmer" aria-hidden="true" />

        {ripples.map((r) => (
          <span
            key={r.id}
            className="liquid-glass-btn__ripple"
            style={{ left: r.x, top: r.y }}
            aria-hidden="true"
          />
        ))}

        <span className="liquid-glass-btn__content">{children}</span>
        <span className="liquid-glass-btn__inner-glow" aria-hidden="true" />
      </button>
    );
  }
);

LiquidGlassButton.displayName = 'LiquidGlassButton';

export default LiquidGlassButton;
