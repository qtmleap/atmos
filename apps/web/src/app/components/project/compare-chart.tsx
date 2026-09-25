// One metric's chart in the comparison grid (project-jobs-compare.html
// `.metric-chart`): the mono title, the "ズームを戻す" action, the legend
// (chart-legend.tsx) and the chart itself (chart-svg.tsx). "拡大表示"
// (`onEnlarge`) always opens the fullscreen dialog
// (chart-dialog.tsx, project-jobs-compare-expanded.html) that the `chart`
// URL param names (hooks/use-chart-view.ts) — compare-layout.tsx decides
// which chart that is and renders the dialog; this figure itself never
// grows in place. Box measurement, drag-to-zoom, hover and the legend's
// highlight all come from hooks/use-chart-interaction.ts; this component
// only wires that hook's output into the header, the legend and the svg.
import { Maximize2Icon, RotateCcwIcon } from 'lucide-react'
import { memo } from 'react'
import { useChartInteraction } from '../../hooks/use-chart-interaction'
import type { ChartRun } from '../../hooks/use-compare-chart'
import type { AxisDomain } from '../../lib/chart-scale'
import { Button } from '../ui/button'
import { ChartLegend } from './chart-legend'
import { ChartSvg } from './chart-svg'

export interface CompareChartProps {
  metricKey: string
  runs: ChartRun[]
  xDomain: AxisDomain
  yDomain: AxisDomain
  smooth: number
  heightClassName: string
  /** Opens this chart fullscreen (`?chart=`). */
  onEnlarge: () => void
}

function CompareChartImpl({
  metricKey,
  runs,
  xDomain,
  yDomain,
  smooth,
  heightClassName,
  onEnlarge,
}: CompareChartProps) {
  const interaction = useChartInteraction(runs, xDomain, yDomain)
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-center justify-between gap-4 border-b py-2">
        <h4 className="font-mono">{metricKey}</h4>
        <div className="flex items-center gap-1">
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
            aria-label="拡大表示"
            onClick={onEnlarge}
            className="text-muted-foreground"
          >
            <Maximize2Icon />
          </Button>
        </div>
      </figcaption>
      <ChartLegend
        runs={interaction.runs}
        onEnter={interaction.onLegendEnter}
        onLeave={interaction.onLegendLeave}
      />
      <ChartSvg
        metricKey={metricKey}
        sizeRef={interaction.sizeRef}
        box={interaction.box}
        xDomain={interaction.xDomain}
        yDomain={interaction.yDomain}
        runs={interaction.runs}
        hover={interaction.hover}
        highlightedJobId={interaction.highlightedJobId}
        drag={interaction.drag}
        smooth={smooth}
        heightClassName={heightClassName}
        onPointerDown={interaction.svgHandlers.onPointerDown}
        onPointerMove={interaction.svgHandlers.onPointerMove}
        onPointerUp={interaction.svgHandlers.onPointerUp}
        onPointerCancel={interaction.svgHandlers.onPointerCancel}
        onPointerLeave={interaction.svgHandlers.onPointerLeave}
        onDoubleClick={interaction.svgHandlers.onDoubleClick}
      />
    </figure>
  )
}

/** Memoized: a hover or a drag in one chart must not redraw the others. */
export const CompareChart = memo(CompareChartImpl)
