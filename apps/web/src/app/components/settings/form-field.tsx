import type * as React from 'react'
import { cn } from '@/app/lib/utils'

/** Label, control, then helper or error text, 8px apart (the mocks' .form-field). */
export function FormField({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid content-start gap-2', className)} {...props} />
}

/** 12/18 muted helper text under a control (.form-description). */
export function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />
}

/** 12/18 destructive text under a control (.form-message). */
export function FormMessage({ className, ...props }: React.ComponentProps<'p'>) {
  return <p role="alert" className={cn('text-xs text-destructive', className)} {...props} />
}
