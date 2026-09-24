import { memo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  downsample,
  evenTicks,
  formatMetricShort,
  formatStep,
  formatStepShort,
  formatTicks,
  type MetricSeries,
  niceTicks,
} from '../../lib/metrics'

/** Points drawn per series; longer series are thinned for drawing only. */
const MAX_DRAWN_POINTS = 1000

/**
 * The mocks draw every chart in a 460 × 180 box and scale it uniformly, so a
 * 144px-high chart is 368px wide and centred. Positions below are that box's
 * coordinates times `scale = height / 180`.
 */
const DESIGN_WIDTH = 460
const DESIGN_HEIGHT = 180
const DESIGN_Y_AXIS_WIDTH = 44
const DESIGN_TOP = 24
const DESIGN_RIGHT = DESIGN_WIDTH - 440
const DESIGN_PLOT_BOTTOM = 144
const DESIGN_FONT = 10
const DESIGN_TICK_MARGIN = 4
/** Advance of one IBM Plex Mono glyph at `DESIGN_FONT`, with a little slack. */
const DESIGN_TICK_CHAR = 6.25
/** Room left of the widest Y label, so it never touches the chart's edge. */
const DESIGN_Y_LABEL_PAD = 10

/**
 * Y-axis width in design units. The mocks rule 44px for labels like `0.7` but
 * widen to 52px for the lr chart's `1.5e-4`, so the axis follows the longest
 * label rather than clipping it at the left edge.
 */
export const yAxisDesignWidth = (labels: readonly string[]): number => {
  const longest = labels.reduce((most, label) => Math.max(most, label.length), 0)
  return Math.max(
    DESIGN_Y_AXIS_WIDTH,
    Math.ceil(longest * DESIGN_TICK_CHAR + DESIGN_TICK_MARGIN + DESIGN_Y_LABEL_PAD),
  )
}

const LINE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'] as const

export interface ChartLine {
  series: MetricSeries
  /** Index into the palette: 0 orange, 1 teal (dashed), 2 navy. */
  color: number
  dashed: boolean
}

export interface MetricChartProps {
  lines: ChartLine[]
  /** CSS pixels; the mocks use 180 in the catalog and 144 on the run page. */
  height: number
  /** Marks the latest point of the first line, as the live charts do. */
  live: boolean
}

interface ChartRow {
  step: number
  [key: string]: number
}

/** Merges the lines into one row per step, `key` columns holding the values. */
const toRows = (lines: ChartLine[]): ChartRow[] => {
  const rows = new Map<number, ChartRow>()
  for (const line of lines) {
    for (const point of downsample(line.series.points, MAX_DRAWN_POINTS)) {
      const row = rows.get(point.step)
      if (row === undefined) {
        rows.set(point.step, { step: point.step, [line.series.key]: point.value })
      } else {
        row[line.series.key] = point.value
      }
    }
  }
  return [...rows.values()].sort((a, b) => a.step - b.step)
}

const tooltipValue = (value: unknown): string =>
  typeof value === 'number' ? formatMetricShort(value) : String(value)

function MetricChartImpl({ lines, height, live }: MetricChartProps) {
  const scale = height / DESIGN_HEIGHT
  const rows = toRows(lines)
  const first = lines[0]
  const minValue = Math.min(...lines.map((line) => line.series.min))
  const maxValue = Math.max(...lines.map((line) => line.series.max))
  const yTicks = niceTicks(minValue, maxValue)
  const formatYTick = formatTicks(yTicks)
  const yAxisWidth = yAxisDesignWidth(yTicks.map(formatYTick)) * scale
  const minStep = rows.at(0)?.step
  const maxStep = rows.at(-1)?.step
  const xTicks =
    minStep === undefined || maxStep === undefined ? [] : evenTicks(minStep, maxStep, 4)
  const firstTick = yTicks.at(0)
  const lastTick = yTicks.at(-1)
  const low = firstTick === undefined ? minValue : firstTick
  const high = lastTick === undefined ? maxValue : lastTick
  // A flat series still needs some height to sit in.
  const yDomain: [number, number] = low === high ? [low - 1, high + 1] : [low, high]
  const tick = { fontSize: DESIGN_FONT * scale, fill: 'var(--muted-foreground)' }
  const description = lines
    .map((line) => `${line.series.key} ${formatMetricShort(line.series.latest.value)}`)
    .join('、')

  return (
    <div
      className="mx-auto w-full font-mono"
      style={{ maxWidth: DESIGN_WIDTH * scale, height }}
      role="img"
      aria-label={`${description}（step ${first === undefined ? '' : formatStep(first.series.latest.step)} まで）`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: DESIGN_TOP * scale, right: DESIGN_RIGHT * scale, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="step"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={formatStepShort}
            tick={tick}
            tickLine={false}
            interval={0}
            tickMargin={DESIGN_TICK_MARGIN * scale}
            axisLine={{ stroke: 'var(--border)' }}
            height={(DESIGN_HEIGHT - DESIGN_PLOT_BOTTOM) * scale}
            label={{
              value: 'step',
              position: 'insideBottom',
              offset: 0,
              fontSize: DESIGN_FONT * scale,
              fill: 'var(--muted-foreground)',
            }}
          />
          <YAxis
            width={yAxisWidth}
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={formatYTick}
            tick={tick}
            tickLine={false}
            tickMargin={DESIGN_TICK_MARGIN * scale}
            axisLine={{ stroke: 'var(--border)' }}
            interval={0}
            allowDataOverflow
          />
          <Tooltip
            formatter={(value, name) => [tooltipValue(value), String(name)]}
            labelFormatter={(label) => `step ${formatStep(Number(label))}`}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
            }}
          />
          {lines.map((line) => (
            <Line
              key={line.series.key}
              type="linear"
              dataKey={line.series.key}
              stroke={LINE_COLORS[line.color % LINE_COLORS.length]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={line.dashed ? '5 3' : undefined}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          {live && first !== undefined ? (
            <ReferenceLine
              x={first.series.latest.step}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
            />
          ) : null}
          {live && first !== undefined ? (
            <ReferenceDot
              x={first.series.latest.step}
              y={first.series.latest.value}
              r={3}
              fill="var(--background)"
              stroke={LINE_COLORS[first.color % LINE_COLORS.length]}
              strokeWidth={2}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Memoized: a live update of one series must not redraw every other chart. */
export const MetricChart = memo(MetricChartImpl)

/** The 12 × 3px key of a legend entry. */
export function LegendKey({ color }: { color: number }) {
  return (
    <span
      aria-hidden="true"
      className="h-[3px] w-3 shrink-0"
      style={{ background: LINE_COLORS[color % LINE_COLORS.length] }}
    />
  )
}

/** Centred 12px legend under a chart. */
export function ChartLegend({ lines }: { lines: ChartLine[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
      {lines.map((line) => (
        <span key={line.series.key} className="inline-flex items-center gap-3">
          <LegendKey color={line.color} />
          <span className="font-mono">
            {line.series.key}
            {line.dashed ? ' · 破線' : ''}
          </span>
        </span>
      ))}
    </div>
  )
}
