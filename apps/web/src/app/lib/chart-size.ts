// Chart display size (lib/job-filter.ts `ChartSize`, the `?size=` param):
// grid column count and pixel height per size, shared by the comparison view
// (components/project/compare-layout.tsx) and the job detail chart. The column
// classes are container queries: the parent carries `@container`, and a wide
// chart area fits a third column at the medium size. In the comparison view a
// group with fewer charts than columns gets only as many columns, so its
// charts widen to fill the row; the job detail keeps the columns and leaves
// the rest of the row empty (`jobChartGridColsClass`).
import type { ChartSize } from './job-filter'

const CHART_GRID_COLS_CLASS: Record<ChartSize, string> = {
  s: 'grid-cols-3',
  m: 'grid-cols-2 @6xl:grid-cols-3',
  l: 'grid-cols-1',
}

export function chartGridColsClass(size: ChartSize, count: number): string {
  if (size === 'l' || count <= 1) {
    return 'grid-cols-1'
  }
  if (count === 2) {
    return 'grid-cols-2'
  }
  return CHART_GRID_COLS_CLASS[size]
}

/** The job detail's columns: fixed by size, however few charts a group has. */
export function jobChartGridColsClass(size: ChartSize): string {
  return CHART_GRID_COLS_CLASS[size]
}

export const CHART_HEIGHT_CLASS: Record<ChartSize, string> = {
  s: 'h-[180px]',
  m: 'h-[248px]',
  l: 'h-[360px]',
}
