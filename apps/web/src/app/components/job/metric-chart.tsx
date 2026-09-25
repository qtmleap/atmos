// Small shared bits of the job page's metric charts
// (components/job/metric-charts.tsx): the design-unit y-axis width the
// mocks rule (kept for reference even though the chart itself now draws
// through components/project/chart-svg.tsx, an SVG-native replacement for
// the Recharts version this file used to hold), the three-colour palette
// (orange/teal/navy) and the legend beneath a chart.

/**
 * Y-axis width in design units, at the mock's 460×180 chart box. The mocks
 * rule 44px for labels like `0.7` but widen to 52px for the lr chart's
 * `1.5e-4`, so the axis follows the longest label rather than clipping it.
 */
const DESIGN_Y_AXIS_WIDTH = 44
const DESIGN_TICK_MARGIN = 4
/** Advance of one IBM Plex Mono glyph at the mock's 10px tick font, with a little slack. */
const DESIGN_TICK_CHAR = 6.25
/** Room left of the widest Y label, so it never touches the chart's edge. */
const DESIGN_Y_LABEL_PAD = 10

export const yAxisDesignWidth = (labels: readonly string[]): number => {
  const longest = labels.reduce((most, label) => Math.max(most, label.length), 0)
  return Math.max(
    DESIGN_Y_AXIS_WIDTH,
    Math.ceil(longest * DESIGN_TICK_CHAR + DESIGN_TICK_MARGIN + DESIGN_Y_LABEL_PAD),
  )
}

const LINE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'] as const

/** Palette slot colour, index wrapped: 0 orange, 1 teal (dashed), 2 navy. */
export const jobLineColor = (index: number): string => {
  const color = LINE_COLORS[index % LINE_COLORS.length]
  return color === undefined ? 'currentColor' : color
}

export interface ChartLine {
  key: string
  /** Index into the palette: 0 orange, 1 teal (dashed), 2 navy. */
  color: number
  dashed: boolean
}

/** The 12 × 3px key of a legend entry. */
export function LegendKey({ color }: { color: number }) {
  return (
    <span
      aria-hidden="true"
      className="h-[3px] w-3 shrink-0"
      style={{ background: jobLineColor(color) }}
    />
  )
}

/** Centred 12px legend under a chart. */
export function ChartLegend({ lines }: { lines: ChartLine[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
      {lines.map((line) => (
        <span key={line.key} className="inline-flex items-center gap-3">
          <LegendKey color={line.color} />
          <span className="font-mono">
            {line.key}
            {line.dashed ? ' · 破線' : ''}
          </span>
        </span>
      ))}
    </div>
  )
}
