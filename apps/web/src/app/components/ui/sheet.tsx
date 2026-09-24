import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import type * as React from 'react'
import { cn } from '@/app/lib/utils'
import { Button } from './button'

/**
 * A panel the full height of the window, anchored to one side over the dimmed
 * page (designs/pages/project-jobs-compare-drawer.html `.job-drawer`): 560px
 * wide, at most 90vw, padded 20px 24px, a one pixel rule along its inner edge
 * instead of a border, scrolling on its own. The header carries a rule below
 * and room on the right for the corner close button; the footer sits at the
 * bottom with a rule above.
 */
const sheetStyles = {
  overlay: 'bg-black/50',
  content:
    'flex h-full w-[560px] max-w-[90vw] flex-col overflow-y-auto bg-background px-6 py-5 text-foreground outline-none',
  side: {
    left: 'inset-y-0 left-0 shadow-[1px_0_0_var(--border)] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
    right:
      'inset-y-0 right-0 shadow-[-1px_0_0_var(--border)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
  },
  close: 'absolute top-3 right-3 text-muted-foreground',
  header: 'flex items-center gap-3 border-b pr-10 pb-4',
  title: 'text-base leading-7 font-semibold',
  description: 'pt-3 text-xs text-muted-foreground',
  footer: 'mt-auto flex justify-end gap-2 border-t pt-4',
}

export type SheetSide = keyof typeof sheetStyles.side

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        sheetStyles.overlay,
        'fixed inset-0 z-50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  closeLabel = '閉じる',
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide
  closeLabel?: string
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          sheetStyles.content,
          'fixed z-50 data-[state=closed]:animate-out data-[state=open]:animate-in',
          sheetStyles.side[side],
          className,
        )}
        // The panel itself takes focus when it opens (Radix gives it
        // tabIndex -1), not its first control: what was asked for is the panel,
        // and a ring on a search box would say "type here" first. The focus
        // trap only starts guarding once something inside has focus, and Tab
        // from here goes to the first control. A caller that prevents the
        // default in its own handler keeps the decision.
        onOpenAutoFocus={(event) => {
          if (onOpenAutoFocus !== undefined) {
            onOpenAutoFocus(event)
          }
          if (event.defaultPrevented) {
            return
          }
          event.preventDefault()
          if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.focus()
          }
        }}
        {...props}
      >
        {children}
        <SheetPrimitive.Close asChild>
          <Button variant="ghost" size="icon" className={sheetStyles.close} aria-label={closeLabel}>
            <XIcon />
          </Button>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn(sheetStyles.header, className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn(sheetStyles.footer, className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(sheetStyles.title, className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(sheetStyles.description, className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  sheetStyles,
}
