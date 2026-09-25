import type * as React from 'react'
import { cn } from '@/app/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-[color,border-color,box-shadow] outline-none placeholder:text-muted-foreground not-disabled:hover:border-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
