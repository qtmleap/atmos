// URL state of the comparison chart controls (lib/job-filter.ts `run`,
// `smooth`, `logx`, `logy`, `size`, `chart`): the job-name filter, the
// smoothing weight, the two log toggles, the display size and the metric
// open fullscreen (components/project/chart-dialog.tsx). Every setter merges
// into the search params in place with replace:true (the same pattern as
// hooks/use-compare-jobs.ts `update`), so typing in the filter box does not
// spam browser history.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import {
  type ChartSize,
  type JobsSearch,
  parseChartSize,
  parseLogScale,
  parseSmoothing,
} from '../lib/job-filter'

export interface ChartView {
  run: string
  setRun: (value: string) => void
  smooth: number
  setSmooth: (value: number) => void
  logX: boolean
  setLogX: (value: boolean) => void
  logY: boolean
  setLogY: (value: boolean) => void
  size: ChartSize
  setSize: (value: ChartSize) => void
  /** Metric key open fullscreen, or undefined when the dialog is closed. */
  chart: string | undefined
  openChart: (key: string) => void
  closeChart: () => void
}

export function useChartView(): ChartView {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })

  const update = useCallback(
    (change: Partial<JobsSearch>) => {
      void navigate({
        to: '.',
        search: (current) => ({ ...current, ...change }),
        replace: true,
        state: true,
      })
    },
    [navigate],
  )

  const setRun = useCallback(
    (value: string) => update({ run: value === '' ? undefined : value }),
    [update],
  )
  const setSmooth = useCallback(
    (value: number) => update({ smooth: value <= 0 ? undefined : value }),
    [update],
  )
  const setLogX = useCallback((value: boolean) => update({ logx: value ? 1 : undefined }), [update])
  const setLogY = useCallback((value: boolean) => update({ logy: value ? 1 : undefined }), [update])
  const setSize = useCallback(
    (value: ChartSize) => update({ size: value === 'm' ? undefined : value }),
    [update],
  )
  const openChart = useCallback((key: string) => update({ chart: key }), [update])
  const closeChart = useCallback(() => update({ chart: undefined }), [update])

  return {
    run: search.run === undefined ? '' : search.run,
    setRun,
    smooth: parseSmoothing(search.smooth),
    setSmooth,
    logX: parseLogScale(search.logx),
    setLogX,
    logY: parseLogScale(search.logy),
    setLogY,
    size: parseChartSize(search.size),
    setSize,
    chart: search.chart,
    openChart,
    closeChart,
  }
}
