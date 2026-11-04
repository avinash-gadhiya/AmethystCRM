'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import useLiquidOverlay from '@/components/common/liquid-membrane/useLiquidOverlay';

const LiquidPopoverContext = React.createContext(null);
function Popover({ open: controlledOpen, defaultOpen = false, onOpenChange, children, ...props }) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen);
  const anchorRef = React.useRef(null);
  const open = controlledOpen ?? localOpen;
  const change = (next) => {
    setLocalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <LiquidPopoverContext.Provider value={{ open, change, anchorRef }}>
      <PopoverPrimitive.Root {...props} open={open} onOpenChange={change}>
        {children}
      </PopoverPrimitive.Root>
    </LiquidPopoverContext.Provider>
  );
}
const PopoverTrigger = React.forwardRef(function PopoverTrigger(props, forwardedRef) {
  const context = React.useContext(LiquidPopoverContext);
  return (
    <PopoverPrimitive.Trigger
      {...props}
      ref={(node) => {
        if (context) context.anchorRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
    />
  );
});
const PopoverContent = React.forwardRef(function PopoverContent(
  { className, align = 'center', sideOffset = 12, style, onCloseAutoFocus, ...props },
  ref
) {
  const context = React.useContext(LiquidPopoverContext);
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
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          {...props}
          ref={mountContent}
          align={align}
          sideOffset={Math.max(12, sideOffset)}
          avoidCollisions
          collisionPadding={12}
          className={cn('liquid-overlay-content w-72 rounded-2xl border p-4 text-slate-800 outline-none dark:text-slate-100', className)}
          style={{ ...style, zIndex: zIndex + 1 }}
          onCloseAutoFocus={(event) => {
            if (dismissed.current) event.preventDefault();
            else onCloseAutoFocus?.(event);
          }}
        />
      </PopoverPrimitive.Portal>
    </>
  );
});
export { Popover, PopoverTrigger, PopoverContent };
