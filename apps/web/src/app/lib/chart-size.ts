// Chart display size (lib/job-filter.ts `ChartSize`, the `?size=` param):
// grid column count and pixel height per size, shared by the comparison view
// (components/project/compare-layout.tsx) and the job detail chart. The column
// classes are container queries: the parent carries `@container`, and a wide
// chart area fits a third column at the medium size.
import type { ChartSize } from './job-filter'

export const CHART_GRID_COLS_CLASS: Record<ChartSize, string> = {
  s: 'grid-cols-3',
  m: 'grid-cols-2 @6xl:grid-cols-3',
  l: 'grid-cols-1',
}

export const CHART_HEIGHT_CLASS: Record<ChartSize, string> = {
  s: 'h-[180px]',
  m: 'h-[248px]',
  l: 'h-[360px]',
}
