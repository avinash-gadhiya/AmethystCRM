import React from 'react';

const LiquidGlassButton = React.forwardRef(
  ({ className = '', onClick, type = 'button', variant = 'default', disabled = false, loading = false, children, ...props }, ref) => {
    const isDanger = variant === 'danger';
    const isSecondary = variant === 'secondary' || variant === 'outline';

    let variantClasses = 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white border-transparent shadow-sm focus:ring-indigo-500/20';
    if (isDanger) {
      variantClasses = 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white border-transparent shadow-sm focus:ring-rose-500/20';
    } else if (isSecondary) {
      variantClasses = 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-300 shadow-sm focus:ring-slate-500/20';
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onClick={onClick}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-150 select-none cursor-pointer focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses} ${className}`.trim()}
        {...props}
      >
        {loading && (
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          />
        )}
        {children}
      </button>
    );
  }
);

LiquidGlassButton.displayName = 'LiquidGlassButton';

export default LiquidGlassButton;
