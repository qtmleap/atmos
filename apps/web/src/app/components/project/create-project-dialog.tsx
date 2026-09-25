// The "新規プロジェクト" dialog of / (designs/pages/projects-new.html): name,
// then a visibility choice with a one-line explanation per tier. Presentational;
// hooks/use-create-project.ts owns the form state, the open state (?new=1) and
// the submission.
import { PlusIcon } from 'lucide-react'
import { VISIBILITIES } from '@/shared/types'
import type { CreateProjectFormInput } from '../../hooks/use-create-project'
import { isVisibility } from '../../hooks/use-create-project'
import { VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS } from '../../lib/format'
import { FormDescription, FormField, FormMessage } from '../settings/form-field'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'

export interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CreateProjectFormInput
  onChange: (form: CreateProjectFormInput) => void
  submitting: boolean
  error: string | null
  onSubmit: () => void
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  form,
  onChange,
  submitting,
  error,
  onSubmit,
}: CreateProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon aria-hidden="true" />
          新規プロジェクト
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>新規プロジェクト</DialogTitle>
        <DialogDescription>SDKからジョブを送信する先になります。</DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogBody className="grid gap-4">
            <FormField>
              <Label htmlFor="new-project-name">
                プロジェクト名 <span className="text-muted-foreground">（必須）</span>
              </Label>
              <Input
                id="new-project-name"
                className="font-mono"
                placeholder="例：voice-synthesis-v5"
                required
                aria-describedby="new-project-name-help"
                value={form.name}
                onChange={(event) => onChange({ ...form, name: event.target.value })}
              />
              <FormDescription id="new-project-name-help">
                SDK の wb.init() で指定する名前と同じにすると、そのプロジェクトに記録されます。
              </FormDescription>
              {error === null ? null : <FormMessage>{error}</FormMessage>}
            </FormField>
            <FormField>
              <span id="new-project-visibility-label" className="text-sm leading-none font-medium">
                公開範囲
              </span>
              <RadioGroup
                aria-labelledby="new-project-visibility-label"
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
                      id={`new-project-visibility-${visibility}`}
                      className="mt-0.5"
                    />
                    <label htmlFor={`new-project-visibility-${visibility}`} className="grid gap-1">
                      <span className="text-sm leading-none font-medium">
                        {VISIBILITY_LABELS[visibility]}
                      </span>
                      <FormDescription>{VISIBILITY_DESCRIPTIONS[visibility]}</FormDescription>
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
              作成する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
