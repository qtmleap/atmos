// Confirmation before reissuing an already-active token
// (designs/pages/settings-tokens-reissue.html). Presentational: TokenPanel
// owns the open state, useAccessToken owns the POST.
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '../ui/dialog'

export interface ReissueTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The current token's issue time, already formatted (see formatIssuedAt). */
  issuedAt: string
  /** The current token's first and last characters, when recorded. */
  hint: string | null
  issuing: boolean
  onConfirm: () => void
}

export function ReissueTokenDialog({
  open,
  onOpenChange,
  issuedAt,
  hint,
  issuing,
  onConfirm,
}: ReissueTokenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog">
        <DialogTitle>トークンを発行し直しますか？</DialogTitle>
        <DialogDescription>
          {issuedAt} に発行した今のトークン{hint === null ? '' : `（${hint}）`}
          はすぐに失効し、それを使っている SDK からの送信はできなくなります。
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              キャンセル
            </Button>
          </DialogClose>
          <Button type="button" onClick={onConfirm} disabled={issuing}>
            発行し直す
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
