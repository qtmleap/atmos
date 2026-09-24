import type * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * A native range input drawn the way the mocks draw `.slider`: a 4px muted
 * track and a 16px ring thumb. Native because the job widgets need the
 * browser's own keyboard handling and there is no Slider in components/ui.
 */
export function RangeInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="range"
      data-slot="range-input"
      className={cn(
        'm-0 h-4 w-full appearance-none bg-transparent accent-primary outline-none disabled:cursor-not-allowed disabled:opacity-50',
        '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted',
        '[&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background',
        '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted',
        '[&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background',
        'focus-visible:[&::-webkit-slider-thumb]:ring-[3px] focus-visible:[&::-webkit-slider-thumb]:ring-ring/50',
        className,
      )}
      {...props}
    />
  )
}

export interface StepSliderProps {
  id: string
  label: string
  /** Steps that have media, ascending; empty disables the slider. */
  steps: number[]
  /** The selected step, or null when there is none. */
  value: number | null
  onChange: (step: number) => void
  /** Text after the slider; defaults to the selected step. */
  readout: string
}

/** `label | slider | readout` on one 12px row, as `.step-slider` in the mocks. */
export function StepSlider({ id, label, steps, value, onChange, readout }: StepSliderProps) {
  const max = steps.at(-1)
  const disabled = max === undefined || steps.length < 2
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 py-3 text-xs">
      <label htmlFor={id}>{label}</label>
      <RangeInput
        id={id}
        min={0}
        max={max === undefined ? 0 : max}
        value={value === null ? 0 : value}
        disabled={disabled}
        aria-valuetext={value === null ? undefined : `${value.toLocaleString('en-US')} ステップ`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="font-mono">{readout}</span>
    </div>
  )
}
