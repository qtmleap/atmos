import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/app/lib/utils'

/**
 * A ruled notice: rules above and below, no box. The icon (16px) sits 2px
 * down so it lines up with the title; an action button may follow the text.
 */
const alertVariants = cva(
  'group/alert flex w-full items-start gap-3 border-y py-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'text-foreground',
        destructive: 'border-destructive/35 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

/** Wraps the title and description; grows so a trailing action sits right. */
function AlertBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-body" className={cn('min-w-0 flex-1', className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="alert-title" className={cn('leading-5 font-medium', className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="alert-description"
      className={cn(
        'mt-1 text-muted-foreground group-data-[variant=destructive]/alert:text-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertBody, AlertDescription, AlertTitle, alertVariants }
