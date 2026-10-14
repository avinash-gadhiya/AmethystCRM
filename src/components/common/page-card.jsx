import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { PanelsTopLeft } from 'lucide-react';

/**
 * TableCard â€” shared card wrapper used on every table/list page.
 * Change styles here once and all pages update automatically.
 */
export function TableCard({ children, className }) {
  return (
    <div className={cn('card', className)}>
      {children}
    </div>
  );
}

export function PageCard({
  children,
  className,
  cardClassName,
  contentClassName,
}) {
  return (
    <div className={cn('w-full h-full', className)}>
      <div
        className={cn(
          'w-full h-full rounded-xl',
          'bg-white/05 backdrop-blur-sm ',
          'dark:border-white/10',
          cardClassName,
        )}
      >
        <div className={cn('p-4', contentClassName)}>{children}</div>
      </div>
    </div>
  );
}

/**
 * PageWrapper â€” shared outer wrapper used on every page.
 */
export function PageWrapper({ children, className }) {
  return (
    <div className={cn('app-page w-full h-full p-6', className)}>
      {children}
    </div>
  );
}

/**
 * PageHeader â€” shared page-level title + optional description + optional action (e.g. Add button).
 * Title/description on the left, children (button) on the right.
 */
export function PageHeader({ title, description, children }) {
  return (
    <div className="app-page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div className="flex items-start gap-3">
        <span className="app-page-header-icon" aria-hidden="true">
          <PanelsTopLeft />
        </span>
        <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * ModalPortal â€” renders children directly into document.body via a React portal.
 * This guarantees modals always cover the full viewport regardless of any
 * CSS containing blocks (backdrop-filter, transform, etc.) in ancestor elements.
 */
export function ModalPortal({ children }) {
  const rootEl = typeof document !== 'undefined' ? document.documentElement : null;
  const bodyEl = typeof document !== 'undefined' ? document.body : null;

  const isDarkClass =
    !!rootEl?.classList?.contains('dark') ||
    !!bodyEl?.classList?.contains('dark');

  const themeMode =
    rootEl?.getAttribute('data-theme-mode') ||
    bodyEl?.getAttribute('data-theme-mode') ||
    (isDarkClass ? 'dark' : null);

  const modalRootClass = isDarkClass || themeMode === 'dark' ? 'dark' : undefined;

  return createPortal(
    <div data-modal-root="true" data-theme-mode={themeMode || undefined} className={modalRootClass}>
      {children}
    </div>,
    document.body,
  );
}


