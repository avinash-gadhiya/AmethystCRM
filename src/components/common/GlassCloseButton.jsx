import React from 'react';
import { X } from 'lucide-react';

const GlassCloseButton = React.forwardRef(
  (
    {
      className = '',
      iconSize = 18,
      label = 'Close',
      type = 'button',
      onClick,
      disabled = false,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`liquid-close-btn ${className}`.trim()}
      {...props}
    >
      <X size={iconSize} />
    </button>
  )
);

GlassCloseButton.displayName = 'GlassCloseButton';

export default GlassCloseButton;
