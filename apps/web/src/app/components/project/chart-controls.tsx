// Controls row above the comparison charts (project-jobs-compare.html
// `.chart-controls`): the name filter, the smoothing slider, the two log
// switches and the display size select. Presentational; state lives in the
// URL (hooks/use-chart-view.ts). Also drawn above the job page's own metric
// charts (components/job/metric-charts.tsx), where `searchLabel` reads
// "メトリクス名で絞り込み" instead of the comparison chart's job-name filter.
import { SearchIcon } from 'lucide-react'
import { useId } from 'react'
import type { ChartSize } from '../../lib/job-filter'
import { RangeInput } from '../job/step-slider'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { NativeSelect, NativeSelectOption } from '../ui/native-select'
import { Switch } from '../ui/switch'

const SIZE_OPTIONS: ReadonlyArray<{ value: ChartSize; label: string }> = [
  { value: 's', label: '小' },
  { value: 'm', label: '中' },
  { value: 'l', label: '大' },
]

export interface ChartControlsProps {
  run: string
  onRunChange: (value: string) => void
  smooth: number
  onSmoothChange: (value: number) => void
  logX: boolean
  onLogXChange: (value: boolean) => void
  logY: boolean
  onLogYChange: (value: boolean) => void
  size: ChartSize
  onSizeChange: (value: ChartSize) => void
  /** Label and placeholder of the search field; defaults to the comparison chart's job-name filter. */
  searchLabel?: string
}

export function ChartControls({
  run,
  onRunChange,
  smooth,
  onSmoothChange,
  logX,
  onLogXChange,
  logY,
  onLogYChange,
  size,
  onSizeChange,
  searchLabel = 'ジョブ名で絞り込み',
}: ChartControlsProps) {
  const searchId = useId()
  const smoothId = useId()
  const logXId = useId()
  const logYId = useId()
  const sizeId = useId()
  return (
    <fieldset
      aria-label="チャートの表示"
      className="m-0 flex flex-wrap items-center gap-x-6 gap-y-3 border-0 p-0 pb-3"
    >
      <div className="relative w-[240px]">
        <label htmlFor={searchId} className="sr-only">
          {searchLabel}
        </label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground"
        />
        <Input
          id={searchId}
          type="search"
          placeholder={searchLabel}
          value={run}
          onChange={(event) => onRunChange(event.target.value)}
          className="pl-[34px]"
        />
      </div>
      <div className="flex h-8 items-center gap-2">
        <Label htmlFor={smoothId} className="text-xs font-normal">
          平滑化
        </Label>
        <RangeInput
          id={smoothId}
          min={0}
          max={0.99}
          step={0.01}
          value={smooth}
          className="w-[140px]"
          onChange={(event) => onSmoothChange(Number(event.target.value))}
        />
        <output htmlFor={smoothId} className="w-8 font-mono text-xs">
          {smooth.toFixed(2)}
        </output>
      </div>
      <div className="flex h-8 items-center gap-2">
        <Switch id={logXId} checked={logX} onCheckedChange={onLogXChange} />
        <Label htmlFor={logXId} className="text-xs font-normal">
          X軸を対数
        </Label>
      </div>
      <div className="flex h-8 items-center gap-2">
        <Switch id={logYId} checked={logY} onCheckedChange={onLogYChange} />
        <Label htmlFor={logYId} className="text-xs font-normal">
          Y軸を対数
        </Label>
      </div>
      <div className="ml-auto flex h-8 items-center gap-2">
        <Label htmlFor={sizeId} className="text-xs font-normal">
          表示サイズ
        </Label>
        <NativeSelect
          id={sizeId}
          value={size}
          onChange={(event) => {
            const next = event.target.value
            if (next === 's' || next === 'm' || next === 'l') {
              onSizeChange(next)
            }
          }}
          className="w-24"
        >
          {SIZE_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </fieldset>
  )
}
