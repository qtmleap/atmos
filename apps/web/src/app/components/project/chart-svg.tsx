// The actual <svg> of one comparison chart (project-jobs-compare.html
// `.chart-svg`): gridlines, axes, one line per run (plus a dim raw line
// under the smoothed one when smoothing is on), the hover dot and tooltip,
// and the `.chart-brush` rectangle while dragging to zoom. Pure
// presentation — every value comes from hooks/use-chart-interaction.ts, so
// this file has no hooks of its own beyond the id for its clipPath. Also
// drawn by components/job/metric-charts.tsx for a single job's own metric
// charts, which is why the line colour (`colorOf`) and the "live" marker on
// the latest point (`markLatest`) are pluggable rather than the comparison
// chart's own fixed choices.
import type { PointerEvent as ReactPointerEvent, RefCallback } from 'react'
import { useId } from 'react'
import type { ChartHover, RenderedRun } from '../../hooks/use-compare-chart'
import { formatStepTick, toPolyline } from '../../hooks/use-compare-chart'
import { runColor } from '../../lib/chart-colors'
import { type PlotBox, xOf, yOf } from '../../lib/chart-geometry'
import { type AxisDomain, formatTick } from '../../lib/chart-scale'
import { cn } from '../../lib/utils'

export interface ChartDrag {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface ChartSvgProps {
  metricKey: string
  sizeRef: RefCallback<Element>
  box: PlotBox
  xDomain: AxisDomain
  yDomain: AxisDomain
  runs: RenderedRun[]
  hover: ChartHover | null
  /** The run to dim the others for: a pointer hover or a legend highlight. */
  highlightedJobId: string | null
  drag: ChartDrag | null
  /** Above 0 draws each run's raw line dim under its smoothed line. */
  smooth: number
  heightClassName: string
  /** Extra classes for the measured wrapping div, e.g. the fullscreen dialog's `flex-1 min-h-0`. */
  className?: string
  /** Line colour by palette index; defaults to the comparison chart's `runColor`. */
  colorOf?: (index: number) => string
  /**
   * Marks the first run's latest point with a vertical dashed line and a
   * hollow dot, as the job page's live pair chart does
   * (components/job/metric-chart.tsx's old `ReferenceLine`/`ReferenceDot`).
   */
  markLatest?: boolean
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPointerCancel?: (event: ReactPointerEvent<SVGSVGElement>) => void
  onPointerLeave: () => void
  onDoubleClick: () => void
}

const formatHoverValue = (value: number): string => {
  const magnitude = Math.abs(value)
  return magnitude > 0 && magnitude < 1e-2 ? value.toExponential(2) : value.toPrecision(4)
}

const formatXTick = (tick: number, domain: AxisDomain): string =>
  domain.kind === 'log' ? formatTick(tick, domain) : formatStepTick(tick)

export function ChartSvg({
  metricKey,
  sizeRef,
  box,
  xDomain,
  yDomain,
  runs,
  hover,
  highlightedJobId,
  drag,
  smooth,
  heightClassName,
  className,
  colorOf = runColor,
  markLatest = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onDoubleClick,
}: ChartSvgProps) {
  const clipId = useId()
  const firstRun = runs[0]
  const latestPoint = markLatest ? firstRun?.points.at(-1) : undefined
  return (
    <div ref={sizeRef} className={cn('relative', className)}>
      <svg
        className={cn(
          'block w-full touch-none overflow-visible select-none font-mono text-[10px] text-muted-foreground',
          heightClassName,
        )}
        viewBox={`0 0 ${box.width} ${box.height}`}
        role="img"
        aria-label={`${metricKey} の推移をジョブごとに重ねた折れ線`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={box.left}
              y={box.top}
              width={box.right - box.left}
              height={box.bottom - box.top}
            />
          </clipPath>
        </defs>
        <path
          d={yDomain.ticks
            .map((tick) => `M${box.left} ${yOf(tick, yDomain, box)}H${box.right}`)
            .join(' ')}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <path
          d={`M${box.left} ${box.axisTop}V${box.bottom}H${box.right}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />
        <g fill="currentColor">
          {yDomain.ticks.map((tick) => (
            <text key={tick} x={box.labelX} y={yOf(tick, yDomain, box) + 4}>
              {formatTick(tick, yDomain)}
            </text>
          ))}
          {xDomain.ticks.map((tick, index) => (
            <text key={tick} x={xOf(tick, xDomain, box) + (index === 0 ? -2 : -8)} y={box.labelY}>
              {formatXTick(tick, xDomain)}
            </text>
          ))}
        </g>
        <g clipPath={`url(#${clipId})`}>
          {runs.map((run) => {
            const dimmed = highlightedJobId !== null && highlightedJobId !== run.jobId
            const lifted = highlightedJobId !== null && highlightedJobId === run.jobId
            return (
              <g key={run.jobId}>
                {smooth > 0 ? (
                  <polyline
                    points={toPolyline(run.raw)}
                    fill="none"
                    stroke={colorOf(run.color)}
                    strokeWidth={1.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={dimmed ? 0.08 : 0.25}
                  />
                ) : null}
                <polyline
                  data-job={run.label}
                  points={toPolyline(run.points)}
                  fill="none"
                  stroke={colorOf(run.color)}
                  strokeWidth={lifted ? 3 : 1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={run.dashed === true ? '5 3' : undefined}
                  opacity={dimmed ? 0.2 : 1}
                  className="transition-[opacity,stroke-width] duration-100"
                />
              </g>
            )
          })}
          {latestPoint === undefined || firstRun === undefined ? null : (
            <g pointerEvents="none">
              <line
                x1={latestPoint.x}
                x2={latestPoint.x}
                y1={box.axisTop}
                y2={box.bottom}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={latestPoint.x}
                cy={latestPoint.y}
                r={3}
                fill="var(--background)"
                stroke={colorOf(firstRun.color)}
                strokeWidth={2}
              />
            </g>
          )}
          {hover === null ? null : (
            <circle
              cx={hover.point.x}
              cy={hover.point.y}
              r={3.5}
              fill="var(--background)"
              stroke={colorOf(hover.run.color)}
              strokeWidth={2}
              pointerEvents="none"
            />
          )}
        </g>
        {drag === null ? null : (
          <rect
            x={Math.min(drag.x0, drag.x1)}
            y={Math.min(drag.y0, drag.y1)}
            width={Math.abs(drag.x1 - drag.x0)}
            height={Math.abs(drag.y1 - drag.y0)}
            fill="color-mix(in oklch, var(--primary) 12%, transparent)"
            stroke="var(--primary)"
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
      </svg>
      {hover === null || drag !== null ? null : (
        <div
          role="status"
          className="pointer-events-none absolute rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-[0_4px_12px_rgb(0_0_0/0.08)]"
          style={{ left: hover.point.x + 16, top: hover.point.y - 40 }}
        >
          <div className="font-semibold">{hover.run.label}</div>
          <div className="font-mono">
            step {hover.point.step.toLocaleString('en-US')} · {formatHoverValue(hover.point.value)}
          </div>
        </div>
      )}
    </div>
  )
}
