import { ChevronDownIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/app/lib/utils'

/**
 * A styled native <select>. Same 32px box as Input; the chevron sits 12px
 * from the right edge. className goes to the wrapper, which is full width by
 * default, so callers size it the way they would size an Input.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div data-slot="native-select-wrapper" className={cn('relative w-full', className)}>
      <select
        data-slot="native-select"
        className={cn(
          'h-8 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent py-1 pr-9 pl-3 text-sm transition-[color,border-color,box-shadow] outline-none invalid:text-muted-foreground not-disabled:hover:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        )}
        {...props}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-2 right-3 size-4 text-muted-foreground"
      />
    </div>
  )
}

function NativeSelectOption({ ...props }: React.ComponentProps<'option'>) {
  return <option data-slot="native-select-option" {...props} />
}

export { NativeSelect, NativeSelectOption }
