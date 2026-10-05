import React, { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const TableRefreshButton = ({
  className = '',
  title = 'Refresh',
  onClick,
  disabled = false,
  loading = false,
  minSpinMs = 450
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleClick = useCallback(
    async (e) => {
      if (disabled || loading || isRefreshing) return;

      setIsRefreshing(true);
      try {
        const startedAt = Date.now();
        const maybePromise = onClick?.(e);
        if (maybePromise && typeof maybePromise.then === 'function') {
          await maybePromise;
        }

        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, Number(minSpinMs) - elapsed);
        if (remaining > 0) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, remaining);
          });
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [disabled, loading, isRefreshing, minSpinMs, onClick]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading || isRefreshing}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${className}`.trim()}
    >
      <RefreshCw className={`h-4 w-4 ${isRefreshing || loading ? 'animate-spin text-indigo-600' : ''}`} />
    </button>
  );
};

export default TableRefreshButton;
