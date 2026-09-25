// Wires one comparison chart's box measurement (use-element-size.ts),
// drag-to-zoom (use-chart-zoom.ts), hover and legend highlight
// (use-compare-chart.ts) into the props components/project/chart-svg.tsx and
// components/project/chart-legend.tsx draw. Two components call this, one
// instance each: components/project/compare-chart.tsx for the grid figure
// and components/project/chart-dialog.tsx for the fullscreen view the
// `chart` URL param opens — each keeps its own zoom, hover and legend
// highlight, and the dialog passes a higher `tickCount` so its axes read
// "細かく" (lib/chart-scale.ts `niceDomain`/`exactDomain`). The dialog also
// passes a `dragMode`, which turns on its pan, wheel and pinch
// (use-chart-pan-zoom.ts); without one, a drag only draws the zoom brush.
import { type PointerEvent as ReactPointerEvent, type RefCallback, useCallback } from 'react'
import { type PlotBox, plotBox } from '../lib/chart-geometry'
import type { AxisDomain } from '../lib/chart-scale'
import { type DragMode, useChartPanZoom } from './use-chart-pan-zoom'
import { useChartZoom } from './use-chart-zoom'
import {
  type ChartHover,
  type ChartRun,
  projectChartRuns,
  type RenderedRun,
  resolveHighlight,
  useChartHover,
  useLegendHighlight,
} from './use-compare-chart'
import { useElementSize } from './use-element-size'

export interface ChartInteraction {
  sizeRef: RefCallback<Element>
  box: PlotBox
  xDomain: AxisDomain
  yDomain: AxisDomain
  runs: RenderedRun[]
  hover: ChartHover | null
  /** The run to draw emphasized: a pointer hover over the plot, or else a
   * legend item under the pointer or keyboard focus. */
  highlightedJobId: string | null
  onLegendEnter: (jobId: string) => void
  onLegendLeave: () => void
  drag: { x0: number; y0: number; x1: number; y1: number } | null
  zoomed: boolean
  onZoomReset: () => void
  svgHandlers: {
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void
    onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
    onPointerCancel: (event: ReactPointerEvent<SVGSVGElement>) => void
    onPointerLeave: () => void
    onDoubleClick: () => void
  }
}

export function useChartInteraction(
  runs: readonly ChartRun[],
  baseXDomain: AxisDomain,
  baseYDomain: AxisDomain,
  /** Ticks per axis carried into a drag-to-zoom; matches the domain `runs` was built at. */
  tickCount = 4,
  /** Turns on pan, wheel and pinch; 'brush' keeps a one-pointer drag as the zoom rectangle. */
  dragMode?: DragMode,
): ChartInteraction {
  const [measureRef, measured] = useElementSize<Element>()
  const box = plotBox(measured.width, measured.height)
  const zoom = useChartZoom(`${baseXDomain.kind}:${baseYDomain.kind}`)
  const xDomain = zoom.domain === null ? baseXDomain : zoom.domain.x
  const yDomain = zoom.domain === null ? baseYDomain : zoom.domain.y
  const rendered = projectChartRuns(runs, xDomain, yDomain, box)
  const hover = useChartHover(rendered, zoom.drag !== null)
  const legendHighlight = useLegendHighlight()
  const panZoom = useChartPanZoom(
    zoom,
    dragMode,
    box,
    { x: baseXDomain, y: baseYDomain },
    tickCount,
  )
  const { wheelRef } = panZoom
  const enabled = dragMode !== undefined
  const sizeRef = useCallback<RefCallback<Element>>(
    (node) => {
      const unmeasure = measureRef(node)
      const unwheel = enabled ? wheelRef(node) : undefined
      return () => {
        unmeasure?.()
        unwheel?.()
      }
    },
    [measureRef, wheelRef, enabled],
  )

  const pointerPosition = (event: ReactPointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (enabled && panZoom.onPointerDown(event)) {
      zoom.cancelDrag()
      hover.onPointerLeave()
      return
    }
    const { x, y } = pointerPosition(event)
    zoom.onDragStart(x, y)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (enabled && panZoom.onPointerMove(event)) {
      return
    }
    if (zoom.drag === null) {
      hover.onPointerMove(event)
      return
    }
    const { x, y } = pointerPosition(event)
    zoom.onDragMove(x, y)
  }
  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (enabled && panZoom.onPointerUp(event)) {
      return
    }
    zoom.onDragEnd(box, xDomain, yDomain, tickCount)
  }

  return {
    sizeRef,
    box,
    xDomain,
    yDomain,
    runs: rendered,
    hover: hover.hover,
    highlightedJobId: resolveHighlight(hover.hover, legendHighlight.jobId),
    onLegendEnter: legendHighlight.onEnter,
    onLegendLeave: legendHighlight.onLeave,
    drag: zoom.drag,
    zoomed: zoom.zoomed,
    onZoomReset: zoom.reset,
    svgHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: (event) => {
        if (enabled) {
          panZoom.onPointerUp(event)
        }
        zoom.cancelDrag()
      },
      onPointerLeave: hover.onPointerLeave,
      onDoubleClick: zoom.reset,
    },
  }
}
