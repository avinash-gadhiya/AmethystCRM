import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex dark:text-white items-center justify-center gap-2 whitespace-nowrap font-medium ring-0 focus:ring-0 ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        outline:
          'border border-input bg-background/80 hover:bg-accent hover:text-accent-foreground hover:border-slate-400 dark:hover:border-slate-600 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        ghost:
          'hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
        link:
          'text-primary underline-offset-4 hover:underline',
        gradient:
          'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-500/25 hover:shadow-lg hover:shadow-purple-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        amber:
          'bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white hover:from-amber-700 hover:to-amber-900 shadow-md shadow-amber-600/25 hover:shadow-lg hover:shadow-amber-600/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        glow:
          'bg-primary text-primary-foreground shadow-lg shadow-primary/35 hover:shadow-xl hover:shadow-primary/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        glass:
          'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/70 dark:border-slate-700/70 text-foreground hover:bg-white dark:hover:bg-slate-900 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        subtle:
          'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        soft:
          'bg-accent/70 text-foreground hover:bg-accent hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        // Metronic variants
        light: 'btn btn-light hover:-translate-y-0.5 active:scale-[0.98]'
      },
      size: {
        default: 'text-sm h-10 rounded-xl px-4 py-2',
        sm: 'text-xs btn-sm h-8 rounded-lg px-3 gap-1.5',
        lg: 'text-sm h-11 rounded-xl px-7 font-semibold',
        icon: 'h-10 w-10 rounded-xl'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(
          buttonVariants({
            variant,
            size,
            className
          })
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

