// "名前を変更" of the run page (designs/pages/job-rename.html). Presentational;
// hooks/use-job-actions.ts owns the name, the open state (?rename=1) and the
// PATCH.
import { FormField, FormMessage } from '../settings/form-field'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

export interface RenameJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onNameChange: (name: string) => void
  submitting: boolean
  error: string | null
  onSubmit: () => void
}

export function RenameJobDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  submitting,
  error,
  onSubmit,
}: RenameJobDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} closeLabel="名前を変更を閉じる">
        <DialogTitle>名前を変更</DialogTitle>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogBody className="grid gap-4">
            <FormField>
              <Label htmlFor="job-rename-name">
                ジョブ名 <span className="text-muted-foreground">（必須）</span>
              </Label>
              <Input
                id="job-rename-name"
                className="font-mono"
                required
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
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
            <Button type="submit" disabled={submitting}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
