import * as Popover from '@radix-ui/react-popover';
import useLiquidOverlay from './useLiquidOverlay';
import './liquid-calendar.css';

export default function LiquidCalendarContent({ open, onOpenChange, anchorRef, children, className = '', onCloseAutoFocus, ...props }) {
  const { surface, mountContent, dismissed } = useLiquidOverlay({ open, onOpenChange, anchorRef });
  return (
    <>
      <Popover.Portal>
        <Popover.Content
          {...props}
          ref={mountContent}
          className={`mini-calendar-popover mini-calendar-popover--liquid liquid-overlay-content ${className}`}
          sideOffset={12}
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            if (dismissed.current) event.preventDefault();
            else onCloseAutoFocus?.(event);
          }}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
      {surface}
    </>
  );
}
