// The chart shown fullscreen (project-jobs-compare-expanded.html): the same
// chart as the grid, covering the whole viewport, with its own zoom, hover
// and legend (chart-legend.tsx), and roughly twice the grid's tick count so
// its axes read "細かく" (FULLSCREEN_TICK_COUNT, threaded through
// hooks/use-chart-interaction.ts into lib/chart-scale.ts's `niceDomain`/
// `exactDomain`). Driven by the `chart` URL param (hooks/use-chart-view.ts)
// via compare-layout.tsx, which resolves the key to a chart built at that
// tick count or leaves `chart` undefined — an unknown key opens nothing.
// Always mounted (`open` toggles visibility) so Radix's own open/close
// animation plays; Esc and the close button both go through `onOpenChange`,
// same as any other dialog. Unlike the grid chart it pans, pinches and
// wheel-zooms (hooks/use-chart-pan-zoom.ts); the two toggles in the header
// pick what a one-pointer drag does, moving the view or drawing the zoom
// rectangle.
import { HandIcon, Minimize2Icon, RotateCcwIcon, SquareDashedMousePointerIcon } from 'lucide-react'
import { useState } from 'react'
import { useChartInteraction } from '../../hooks/use-chart-interaction'
import type { DragMode } from '../../hooks/use-chart-pan-zoom'
import type { MetricChart } from '../../hooks/use-compare-chart'
import { niceDomain } from '../../lib/chart-scale'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { ChartLegend } from './chart-legend'
import { ChartSvg } from './chart-svg'

/** Roughly twice the grid's default of 4, per the "細かく" requirement. */
export const FULLSCREEN_TICK_COUNT = 8

const FALLBACK_DOMAIN = niceDomain(0, 1, 'linear', FULLSCREEN_TICK_COUNT)

export interface ChartDialogProps {
  open: boolean
  chart: MetricChart | undefined
  smooth: number
  onOpenChange: (open: boolean) => void
}

const DRAG_MODES: { mode: DragMode; label: string; icon: typeof HandIcon }[] = [
  { mode: 'pan', label: '移動', icon: HandIcon },
  { mode: 'brush', label: '枠で拡大', icon: SquareDashedMousePointerIcon },
]

export function ChartDialog({ open, chart, smooth, onOpenChange }: ChartDialogProps) {
  const [dragMode, setDragMode] = useState<DragMode>('pan')
  const interaction = useChartInteraction(
    chart === undefined ? [] : chart.runs,
    chart === undefined ? FALLBACK_DOMAIN : chart.xDomain,
    chart === undefined ? FALLBACK_DOMAIN : chart.yDomain,
    FULLSCREEN_TICK_COUNT,
    dragMode,
  )
  const title = chart === undefined ? '' : chart.key
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showClose={false}
        className="inset-0 flex h-screen w-screen max-w-none translate-none flex-col gap-0 rounded-none border-0 p-4 sm:max-w-none"
      >
        <div className="flex items-center justify-between gap-4 border-b pb-2">
          <DialogTitle className="pr-0 font-mono">{title}</DialogTitle>
          <div className="flex items-center gap-1">
            <fieldset
              aria-label="ドラッグの操作"
              className="m-0 flex min-w-0 items-center gap-1 border-0 p-0"
            >
              {DRAG_MODES.map(({ mode, label, icon: Icon }) => (
                <Button
                  key={mode}
                  variant={dragMode === mode ? 'secondary' : 'ghost'}
                  size="icon-xs"
                  type="button"
                  aria-label={label}
                  aria-pressed={dragMode === mode}
                  onClick={() => setDragMode(mode)}
                  className={dragMode === mode ? undefined : 'text-muted-foreground'}
                >
                  <Icon />
                </Button>
              ))}
            </fieldset>
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
            {interaction.zoomed ? (
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                aria-label="ズームを戻す"
                onClick={interaction.onZoomReset}
                className="text-muted-foreground"
              >
                <RotateCcwIcon />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label="全画面表示を閉じる"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground"
            >
              <Minimize2Icon />
            </Button>
          </div>
        </div>
        <ChartLegend
          runs={interaction.runs}
          onEnter={interaction.onLegendEnter}
          onLeave={interaction.onLegendLeave}
        />
        <ChartSvg
          metricKey={title}
          sizeRef={interaction.sizeRef}
          box={interaction.box}
          xDomain={interaction.xDomain}
          yDomain={interaction.yDomain}
          runs={interaction.runs}
          hover={interaction.hover}
          highlightedJobId={interaction.highlightedJobId}
          drag={interaction.drag}
          smooth={smooth}
          heightClassName={
            dragMode === 'pan' ? 'h-full cursor-grab active:cursor-grabbing' : 'h-full'
          }
          className="min-h-0 flex-1"
          onPointerDown={interaction.svgHandlers.onPointerDown}
          onPointerMove={interaction.svgHandlers.onPointerMove}
          onPointerUp={interaction.svgHandlers.onPointerUp}
          onPointerCancel={interaction.svgHandlers.onPointerCancel}
          onPointerLeave={interaction.svgHandlers.onPointerLeave}
          onDoubleClick={interaction.svgHandlers.onDoubleClick}
        />
      </DialogContent>
    </Dialog>
  )
}
