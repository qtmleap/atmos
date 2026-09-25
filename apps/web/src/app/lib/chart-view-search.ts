// The URL fields of the comparison chart controls
// (components/project/chart-controls.tsx, hooks/use-chart-view.ts): the
// job-name/metric filter, the smoothing weight, the two log toggles, the
// display size and the metric open fullscreen. Shared by
// lib/job-filter.ts's `jobsSearchSchema` (the comparison view) and
// lib/manage-search.ts's `jobSearchSchema` (the job detail chart), in its
// own file so neither of those has to import the other for it.
import { z } from 'zod'

/** Chart display size (project-jobs-compare.html `.chart-controls-size`); absent means "m". */
export const CHART_SIZES = ['s', 'm', 'l'] as const

export type ChartSize = (typeof CHART_SIZES)[number]

/** The chart-control fields shared by `jobsSearchSchema` and `jobSearchSchema`. */
export const chartViewSearchShape = {
  run: z.string().nonempty().optional().catch(undefined),
  smooth: z.number().min(0).max(0.99).optional().catch(undefined),
  logx: z.literal(1).optional().catch(undefined),
  logy: z.literal(1).optional().catch(undefined),
  size: z.enum(CHART_SIZES).optional().catch(undefined),
  chart: z.string().nonempty().optional().catch(undefined),
}
