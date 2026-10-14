'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const checkboxSizeClass = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};

const checkboxIconSizeClass = {
  sm: 'size-3',
  md: 'size-3.5',
  lg: 'size-4',
};
const Checkbox = React.forwardRef(({
  className,
  size = 'md',
  ...props
}, ref) => <CheckboxPrimitive.Root ref={ref} className={cn('peer bg-light-light shrink-0 rounded-md border border-input ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary/20 data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary', checkboxSizeClass[size] || checkboxSizeClass.md, className)} {...props}>
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <Check className={cn(checkboxIconSizeClass[size] || checkboxIconSizeClass.md)} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
export { Checkbox };

