'use client'

import { Button as ButtonPrimitive } from '@base-ui/react/button'

import { cn } from '@/lib/utils'
import { buttonVariants, type ButtonVariants } from './button-variants'

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & ButtonVariants) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// Re-export buttonVariants for backwards compat with client-side importers.
// Server components must import from `./button-variants` directly to avoid
// the `'use client'` boundary that this file sits behind.
export { Button, buttonVariants }
