// The "…" button at the right of a project or job heading and its menu: one
// edit item, a rule, then the destructive delete item
// (designs/pages/project-jobs-menu.html, job-detail-menu.html).
// Presentational; the open state lives in ?menu=1 (hooks/use-action-flags.ts).
import { EllipsisIcon } from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

export interface ActionsMenuProps {
  /** Accessible name of the button and the menu, e.g. "プロジェクトの操作". */
  label: string
  editLabel: string
  deleteLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

export function ActionsMenu({
  label,
  editLabel,
  deleteLabel,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ActionsMenuProps) {
  // Not modal: the dialog an item opens takes over focus and pointer events.
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={label}>
        <DropdownMenuItem onSelect={onEdit}>{editLabel}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
