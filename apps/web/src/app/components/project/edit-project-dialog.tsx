// "プロジェクトを変更" (designs/pages/project-settings.html): the name, then
// the same visibility choice as the new-project dialog. Presentational;
// hooks/use-project-actions.ts owns the form, the open state (?edit=1) and
// the PATCH.
import { VISIBILITIES, type Visibility } from '@/shared/types'
import { VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS } from '../../lib/format'
import type { EditProjectFormInput } from '../../lib/manage'
import { FormDescription, FormField, FormMessage } from '../settings/form-field'
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
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'

const isVisibility = (value: string): value is Visibility =>
  VISIBILITIES.some((visibility) => visibility === value)

export interface EditProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: EditProjectFormInput
  onChange: (form: EditProjectFormInput) => void
  submitting: boolean
  error: string | null
  onSubmit: () => void
}

export function EditProjectDialog({
  open,
  onOpenChange,
  form,
  onChange,
  submitting,
  error,
  onSubmit,
}: EditProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} closeLabel="プロジェクトを変更を閉じる">
        <DialogTitle>プロジェクトを変更</DialogTitle>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogBody className="grid gap-4">
            <FormField>
              <Label htmlFor="project-settings-name">
                プロジェクト名 <span className="text-muted-foreground">（必須）</span>
              </Label>
              <Input
                id="project-settings-name"
                className="font-mono"
                required
                value={form.name}
                onChange={(event) => onChange({ ...form, name: event.target.value })}
              />
              {error === null ? null : <FormMessage>{error}</FormMessage>}
            </FormField>
            <FormField>
              <span
                id="project-settings-visibility-label"
                className="text-sm leading-none font-medium"
              >
                公開範囲
              </span>
              <RadioGroup
                aria-labelledby="project-settings-visibility-label"
                value={form.visibility}
                onValueChange={(value) => {
                  if (isVisibility(value)) {
                    onChange({ ...form, visibility: value })
                  }
                }}
              >
                {VISIBILITIES.map((visibility) => (
                  <div key={visibility} className="flex items-start gap-3">
                    <RadioGroupItem
                      value={visibility}
                      id={`project-settings-visibility-${visibility}`}
                      aria-labelledby={`project-settings-visibility-${visibility}-label`}
                      aria-describedby={`project-settings-visibility-${visibility}-description`}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`project-settings-visibility-${visibility}`}
                      className="grid gap-1"
                    >
                      <span
                        id={`project-settings-visibility-${visibility}-label`}
                        className="text-sm leading-none font-medium"
                      >
                        {VISIBILITY_LABELS[visibility]}
                      </span>
                      <FormDescription id={`project-settings-visibility-${visibility}-description`}>
                        {VISIBILITY_DESCRIPTIONS[visibility]}
                      </FormDescription>
                    </label>
                  </div>
                ))}
              </RadioGroup>
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
