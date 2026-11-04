'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import useLiquidOverlay from '@/components/common/liquid-membrane/useLiquidOverlay';
const LiquidMenuContext = React.createContext(null);
function DropdownMenu({ open: controlledOpen, defaultOpen = false, onOpenChange, children, ...props }) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen);
  const anchorRef = React.useRef(null);
  const open = controlledOpen ?? localOpen;
  const change = (next) => {
    setLocalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <LiquidMenuContext.Provider value={{ open, change, anchorRef }}>
      <DropdownMenuPrimitive.Root {...props} open={open} onOpenChange={change}>
        {children}
      </DropdownMenuPrimitive.Root>
    </LiquidMenuContext.Provider>
  );
}
const DropdownMenuTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <LiquidMenuTrigger ref={ref} className={cn('drop-label', className)} {...props} />
));
const LiquidMenuTrigger = React.forwardRef(function LiquidMenuTrigger(props, forwardedRef) {
  const context = React.useContext(LiquidMenuContext);
  return (
    <DropdownMenuPrimitive.Trigger
      {...props}
      ref={(node) => {
        if (context) context.anchorRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
    />
  );
});
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
const DropdownMenuSubTrigger = React.forwardRef(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'drop-item flex cursor-pointer gap-2 select-none items-center rounded-md px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ms-auto !size-3.5 text-muted-foreground" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;
const DropdownMenuSubContent = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'drop-content z-50 min-w-[8rem] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 shadow-lg',
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;
const DropdownMenuContent = React.forwardRef(function DropdownMenuContent(
  { className, sideOffset = 12, style, onCloseAutoFocus, ...props },
  ref
) {
  const context = React.useContext(LiquidMenuContext);
  const fallback = React.useRef(null);
  const zIndex = Number(style?.zIndex) || 11000;
  const { surface, mountContent, dismissed } = useLiquidOverlay({
    open: Boolean(context?.open),
    onOpenChange: context?.change || (() => {}),
    anchorRef: context?.anchorRef || fallback,
    forwardedRef: ref,
    zIndex
  });
  return (
    <>
      {surface}
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={mountContent}
          sideOffset={Math.max(12, sideOffset)}
          style={{ ...style, zIndex: zIndex + 1 }}
          onCloseAutoFocus={(event) => {
            if (dismissed.current) event.preventDefault();
            else onCloseAutoFocus?.(event);
          }}
          className={cn(
            'drop-content liquid-overlay-content min-w-[8rem] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-2xl border p-1 text-slate-700 dark:text-slate-100',
            className
          )}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    </>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;
const DropdownMenuItem = React.forwardRef(({ className, inset, selected, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    data-selected={selected ? '' : undefined} // Conditionally add data-selected when selected is true
    className={cn(
      // Base styles for the item
      'drop-item relative flex min-h-9 leading-5 cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
      // Styles applied when the item is focused
      'focus:bg-slate-100 focus:text-slate-900 data-[highlighted]:bg-slate-100 dark:focus:bg-slate-800 dark:focus:text-white dark:data-[highlighted]:bg-slate-800',
      // Styles applied when the item is disabled
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      // Additional styles for any SVG elements inside the item
      '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
      // Conditional class for inset
      inset && 'pl-8',
      // Additional custom class name passed to the component
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;
const DropdownMenuCheckboxItem = React.forwardRef(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'drop-item relative flex min-h-9 leading-5 cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-slate-100 focus:text-slate-900 data-[highlighted]:bg-slate-100 dark:focus:bg-slate-800 dark:focus:text-white dark:data-[highlighted]:bg-slate-800 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center text-muted-foreground justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;
const DropdownMenuRadioItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'drop-item relative flex min-h-9 leading-5 cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-slate-100 focus:text-slate-900 data-[highlighted]:bg-slate-100 dark:focus:bg-slate-800 dark:focus:text-white dark:data-[highlighted]:bg-slate-800 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;
const DropdownMenuLabel = React.forwardRef(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label ref={ref} className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)} {...props} />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;
const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;
const DropdownMenuShortcut = ({ className, ...props }) => {
  return <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />;
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup
};
