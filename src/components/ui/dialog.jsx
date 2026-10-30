import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import GlassCloseButton from '@/components/common/GlassCloseButton';
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DialogOverlay = React.forwardRef(({
  className,
  ...props
}, ref) => <DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)} {...props} />);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const DialogContent = React.forwardRef(({
  className,
  children,
  ...props
}, ref) => {
  const rootEl = typeof document !== 'undefined' ? document.documentElement : null;
  const bodyEl = typeof document !== 'undefined' ? document.body : null;
  const isDarkClass = !!rootEl?.classList?.contains('dark') || !!bodyEl?.classList?.contains('dark');
  const themeMode = rootEl?.getAttribute('data-theme-mode') || bodyEl?.getAttribute('data-theme-mode') || (isDarkClass ? 'dark' : null);
  const modalRootClass = isDarkClass || themeMode === 'dark' ? 'dark' : undefined;
  return <DialogPortal>
  <div data-modal-root="true" data-theme-mode={themeMode || undefined} className={modalRootClass}>
    <DialogOverlay />
    <DialogPrimitive.Content data-modal-surface="true" ref={ref} className={cn('fixed max-h-[95%] overflow-y-auto left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border border-purple-100/80 bg-white/95 backdrop-blur-xl shadow-2xl shadow-purple-950/15 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] dark:border-purple-900/40 dark:bg-[#151226]/95 sm:rounded-xl', className)} {...props}>
        {children}
        <DialogPrimitive.Close asChild>
          <GlassCloseButton className="absolute end-5 top-5" iconSize={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
  </div>
  </DialogPortal>;
});
DialogContent.displayName = DialogPrimitive.Content.displayName;
const DialogHeader = ({
  className,
  ...props
}) => <div className={cn('flex items-center px-5 py-4 border-b border-gray-100 dark:border-slate-700', className)} {...props} />;
DialogHeader.displayName = 'DialogHeader';
const DialogBody = React.forwardRef(({
  className,
  ...props
}, ref) => <div ref={ref} className={cn('modal-body', className)} {...props} />);
DialogBody.displayName = 'DialogBody';
const DialogFooter = ({
  className,
  ...props
}) => <div className={cn('modal-footer', className)} {...props} />;
DialogFooter.displayName = 'DialogFooter';
const DialogTitle = React.forwardRef(({
  className,
  ...props
}, ref) => <DialogPrimitive.Title ref={ref} className={cn('modal-title', className)} {...props} />);
DialogTitle.displayName = DialogPrimitive.Title.displayName;
const DialogDescription = React.forwardRef(({
  className,
  ...props
}, ref) => <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />);
DialogDescription.displayName = DialogPrimitive.Description.displayName;
export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription };

