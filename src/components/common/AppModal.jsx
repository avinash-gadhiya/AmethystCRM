import PropTypes from 'prop-types';
import { useEffect } from 'react';

import GlassCloseButton from './GlassCloseButton';
import { ModalPortal } from './page-card';

// One modal look for the whole app (gradient header with icon, scrolling body, tinted footer).
// The parts are exported so the Bootstrap-style <Modal> shim can render the same design.

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl'
};

export function ModalShell({ open, onClose, size = 'md', className = '', children, labelledBy }) {
  useEffect(() => {
    if (!open || !onClose) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <div
          className={`my-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_70px_-15px_rgba(15,23,42,0.35)] animate-in zoom-in-95 duration-200 dark:border-white/10 dark:bg-slate-900 sm:rounded-3xl [&>form]:flex [&>form]:min-h-0 [&>form]:flex-1 [&>form]:flex-col ${SIZES[size] || SIZES.md} ${className}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}

ModalShell.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  size: PropTypes.oneOf(Object.keys(SIZES)),
  className: PropTypes.string,
  children: PropTypes.node,
  labelledBy: PropTypes.string
};

export function ModalHeaderBar({ icon: Icon, title, description, onClose, closeDisabled = false, titleId, className = '', children }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-gradient-to-r from-violet-50/70 via-white to-indigo-50/50 px-5 py-4 dark:border-white/10 dark:from-violet-500/10 dark:via-slate-900 dark:to-indigo-500/10 sm:px-6 ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/25">
            <Icon size={20} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <h3 id={titleId} className="mb-0 truncate text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </h3>
          )}
          {description && <p className="mb-0 mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          {children}
        </div>
      </div>
      {onClose && <GlassCloseButton onClick={onClose} disabled={closeDisabled} className="shrink-0 !h-9 !w-9 !rounded-xl" />}
    </div>
  );
}

ModalHeaderBar.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.node,
  description: PropTypes.node,
  onClose: PropTypes.func,
  closeDisabled: PropTypes.bool,
  titleId: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node
};

export function ModalBodyArea({ className = '', children }) {
  return <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${className}`}>{children}</div>;
}

ModalBodyArea.propTypes = { className: PropTypes.string, children: PropTypes.node };

export function ModalFooterBar({ className = '', children }) {
  return (
    <div
      className={`flex shrink-0 flex-col-reverse gap-2.5 border-t border-slate-200/80 bg-slate-50/60 px-5 py-3.5 dark:border-white/10 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-end sm:px-6 ${className}`}
    >
      {children}
    </div>
  );
}

ModalFooterBar.propTypes = { className: PropTypes.string, children: PropTypes.node };

/**
 * Complete modal: header (icon, title, description, close), scrolling body and optional footer.
 * Pass `onSubmit` to render the body and footer inside a <form>.
 */
export default function AppModal({
  open,
  onClose,
  icon,
  title,
  description,
  size = 'md',
  footer,
  onSubmit,
  busy = false,
  bodyClassName = '',
  className = '',
  children
}) {
  const close = busy ? undefined : onClose;
  const content = (
    <>
      <ModalBodyArea className={bodyClassName}>{children}</ModalBodyArea>
      {footer && <ModalFooterBar>{footer}</ModalFooterBar>}
    </>
  );

  return (
    <ModalShell open={open} onClose={close} size={size} className={className} labelledBy="app-modal-title">
      <ModalHeaderBar icon={icon} title={title} description={description} onClose={onClose} closeDisabled={busy} titleId="app-modal-title" />
      {onSubmit ? <form onSubmit={onSubmit}>{content}</form> : content}
    </ModalShell>
  );
}

AppModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  icon: PropTypes.elementType,
  title: PropTypes.node,
  description: PropTypes.node,
  size: PropTypes.oneOf(Object.keys(SIZES)),
  footer: PropTypes.node,
  onSubmit: PropTypes.func,
  busy: PropTypes.bool,
  bodyClassName: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node
};
