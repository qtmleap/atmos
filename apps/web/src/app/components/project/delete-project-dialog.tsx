// "プロジェクトを削除" (designs/pages/project-delete.html): what goes, then
// the name typed again before 削除する is enabled. Presentational;
// hooks/use-project-actions.ts owns the open state (?delete=1) and the DELETE.
import { FormField, FormMessage } from '../settings/form-field'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

export interface DeleteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  /** See projectDeleteDescription. */
  description: string
  typed: string
  onTypedChange: (typed: string) => void
  confirmed: boolean
  submitting: boolean
  error: string | null
  onConfirm: () => void
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  name,
  description,
  typed,
  onTypedChange,
  confirmed,
  submitting,
  error,
  onConfirm,
}: DeleteProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog" showClose={false}>
        <DialogTitle>プロジェクトを削除</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (confirmed) {
              onConfirm()
            }
          }}
        >
          <DialogBody className="grid gap-4">
            <FormField>
              <Label htmlFor="project-delete-confirm">確認のためプロジェクト名を入力</Label>
              <Input
                id="project-delete-confirm"
                className="font-mono"
                placeholder={name}
                autoComplete="off"
                value={typed}
                onChange={(event) => onTypedChange(event.target.value)}
              />
              {error === null ? null : <FormMessage>{error}</FormMessage>}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={!confirmed || submitting}>
              削除する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
