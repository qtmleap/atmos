// An opened dialog drawn in the page flow for the catalog, using the dialog's
// shared classes (Radix only renders content while open, in a portal).
import { XIcon } from 'lucide-react'
import type * as React from 'react'
import { Button } from '../../components/ui/button'
import { dialogStyles } from '../../components/ui/dialog'
import { cn } from '../../lib/utils'

export interface StaticDialogProps {
  id: string
  title: string
  description: string
  closeLabel: string
  footer: React.ReactNode
  children: React.ReactNode
}

export function StaticDialog({
  id,
  title,
  description,
  closeLabel,
  footer,
  children,
}: StaticDialogProps) {
  return (
    <div
      role="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className={cn(dialogStyles.content, 'relative')}
    >
      <Button variant="ghost" size="icon" aria-label={closeLabel} className={dialogStyles.close}>
        <XIcon />
      </Button>
      <h3 id={`${id}-title`} className={dialogStyles.title}>
        {title}
      </h3>
      <p id={`${id}-description`} className={dialogStyles.description}>
        {description}
      </p>
      <div className={cn(dialogStyles.body, 'grid gap-4')}>{children}</div>
      <div className={dialogStyles.footer}>{footer}</div>
    </div>
  )
}
