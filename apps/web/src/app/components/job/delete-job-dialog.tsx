// "ジョブを削除" (designs/pages/job-delete.html). Presentational;
// hooks/use-job-actions.ts owns the open state (?delete=1) and the DELETE.
import { FormMessage } from '../settings/form-field'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '../ui/dialog'

export interface DeleteJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** See jobDeleteDescription. */
  description: string
  submitting: boolean
  error: string | null
  onConfirm: () => void
}

export function DeleteJobDialog({
  open,
  onOpenChange,
  description,
  submitting,
  error,
  onConfirm,
}: DeleteJobDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog" showClose={false}>
        <DialogTitle>ジョブを削除</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {error === null ? null : <FormMessage className="mt-4">{error}</FormMessage>}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              キャンセル
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={submitting}>
            削除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
