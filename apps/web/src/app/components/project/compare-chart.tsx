// One metric of the comparison, every selected job as a coloured line
// (project-jobs-compare.html `.metric-chart`). The SVG is the mock's 460x160
// drawing stretched to its box; the geometry lives in hooks/use-compare-chart.ts.
import { memo } from 'react'
import {
  AXIS_TOP,
  CHART_HEIGHT,
  CHART_WIDTH,
  type ChartDomain,
  type ChartRun,
  formatStepTick,
  formatValueTick,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_RIGHT,
  toPolyline,
  useChartHover,
  X_LABEL_Y,
  xOf,
  xTicks,
  Y_LABEL_OFFSET,
  yOf,
  yTicks,
} from '../../hooks/use-compare-chart'

/** Line colours c1..c10 of the mock, in order of selection. */
export const RUN_COLORS: readonly string[] = [
  'oklch(0.55 0.2 260)',
  'oklch(0.65 0.2 35)',
  'oklch(0.6 0.13 165)',
  'oklch(0.55 0.22 330)',
  'oklch(0.45 0.02 260)',
  'oklch(0.72 0.15 85)',
  'oklch(0.6 0.12 220)',
  'oklch(0.5 0.15 140)',
  'oklch(0.62 0.19 5)',
  'oklch(0.5 0.17 295)',
]

export const runColor = (index: number): string => {
  const color = RUN_COLORS[index % RUN_COLORS.length]
  return color === undefined ? 'currentColor' : color
}

export interface CompareChartProps {
  metricKey: string
  runs: ChartRun[]
  domain: ChartDomain
  /** Right end of the x axis, in steps. */
  maxStep: number
}

const formatHoverValue = (value: number): string => {
  const magnitude = Math.abs(value)
  return magnitude > 0 && magnitude < 1e-2 ? value.toExponential(2) : value.toPrecision(4)
}

function CompareChartImpl({ metricKey, runs, domain, maxStep }: CompareChartProps) {
  const { hover, onPointerMove, onPointerLeave } = useChartHover(runs)
  const rules = yTicks(domain)
  const steps = xTicks(maxStep).ticks
  const gridPath = rules
    .map((value) => `M${PLOT_LEFT} ${yOf(value, domain)}H${PLOT_RIGHT}`)
    .join(' ')
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-center justify-between gap-4 border-b py-2">
        <h3 className="font-mono">{metricKey}</h3>
      </figcaption>
      <div className="relative">
        <svg
          className="block h-[248px] w-full overflow-visible font-mono text-[10px] text-muted-foreground"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${metricKey} の推移をジョブごとに重ねた折れ線`}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <path
            d={gridPath}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <path
            d={`M${PLOT_LEFT} ${AXIS_TOP}V${PLOT_BOTTOM}H${PLOT_RIGHT}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
          />
          <g fill="currentColor">
            {rules.map((value) => (
              <text key={value} x={4} y={yOf(value, domain) + Y_LABEL_OFFSET}>
                {formatValueTick(value, domain)}
              </text>
            ))}
            {steps.map((step, index) => (
              <text key={step} x={xOf(step, maxStep) + (index === 0 ? -2 : -8)} y={X_LABEL_Y}>
                {formatStepTick(step)}
              </text>
            ))}
          </g>
          {runs.map((run) => {
            const dimmed = hover !== null && hover.run.jobId !== run.jobId
            const lifted = hover !== null && hover.run.jobId === run.jobId
            return (
              <polyline
                key={run.jobId}
                data-job={run.label}
                points={toPolyline(run.points)}
                fill="none"
                stroke={runColor(run.color)}
                strokeWidth={lifted ? 3 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={dimmed ? 0.2 : 1}
                className="transition-[opacity,stroke-width] duration-100"
              />
            )
          })}
          {hover === null ? null : (
            <circle
              cx={hover.point.x}
              cy={hover.point.y}
              r={3.5}
              fill="var(--background)"
              stroke={runColor(hover.run.color)}
              strokeWidth={2}
              pointerEvents="none"
            />
          )}
        </svg>
        {hover === null ? null : (
          <div
            role="status"
            className="pointer-events-none absolute rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-[0_4px_12px_rgb(0_0_0/0.08)]"
            style={{
              left: `calc(${(hover.point.x / CHART_WIDTH) * 100}% + 16px)`,
              top: `calc(${((hover.point.y - 6) / CHART_HEIGHT) * 100}% - 34px)`,
            }}
          >
            <div className="font-semibold">{hover.run.label}</div>
            <div className="font-mono">
              step {hover.point.step.toLocaleString('en-US')} ·{' '}
              {formatHoverValue(hover.point.value)}
            </div>
          </div>
        )}
      </div>
    </figure>
  )
}

/** Memoized: a hover in one chart must not redraw the others. */
export const CompareChart = memo(CompareChartImpl)
