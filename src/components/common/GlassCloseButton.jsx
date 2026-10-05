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
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${className}`.trim()}
      {...props}
    >
      <X size={iconSize} />
    </button>
  )
);

GlassCloseButton.displayName = 'GlassCloseButton';

export default GlassCloseButton;
