import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { LogLine, Page } from '@/shared/types'
import { apiFetch, errorMessage, withQuery } from '../lib/api-client'
import { jobApiPath } from '../lib/job-paths'
import {
  initialLogState,
  type LogRequest,
  type LogState,
  logReducer,
  newestLogId,
  oldestLogId,
} from '../lib/log-state'
import { useBatched } from './use-batched'

export const LOGS_PAGE_SIZE = 200

export interface JobLogs extends LogState {
  loadOlder: () => void
  loadNewer: () => void
  pushLive: (line: LogLine) => void
  retry: () => void
}

/** `GET .../logs` with `before` / `after` cursors, plus live lines. */
export function useJobLogs(projectId: string, jobId: string): JobLogs {
  const [state, dispatch] = useReducer(logReducer, undefined, initialLogState)
  const stateRef = useRef(state)
  stateRef.current = state
  const generation = useRef(0)
  const inFlight = useRef(false)
  const basePath = jobApiPath(projectId, jobId, '/logs')

  const request = useCallback(
    async (kind: LogRequest, cursor: { before?: string; after?: string }) => {
      if (inFlight.current) {
        return
      }
      const gen = generation.current
      inFlight.current = true
      dispatch({ type: 'request', request: kind })
      try {
        const page = await apiFetch<Page<LogLine>>(
          withQuery(basePath, { limit: LOGS_PAGE_SIZE, ...cursor }),
        )
        if (gen === generation.current) {
          dispatch({ type: 'page', request: kind, page })
        }
      } catch (caught) {
        if (gen === generation.current) {
          dispatch({ type: 'failure', message: errorMessage(caught) })
        }
      } finally {
        if (gen === generation.current) {
          inFlight.current = false
        }
      }
    },
    [basePath],
  )

  useEffect(() => {
    generation.current += 1
    inFlight.current = false
    dispatch({ type: 'reset' })
    void request('initial', {})
    return () => {
      generation.current += 1
    }
  }, [request])

  const loadOlder = useCallback(() => {
    const before = oldestLogId(stateRef.current)
    void request(before === undefined ? 'initial' : 'older', { before })
  }, [request])

  const loadNewer = useCallback(() => {
    const after = newestLogId(stateRef.current)
    void request(after === undefined ? 'initial' : 'newer', { after })
  }, [request])

  const pushLive = useBatched<LogLine>(
    useCallback((lines) => dispatch({ type: 'live', lines }), []),
    250,
  )

  return { ...state, loadOlder, loadNewer, pushLive, retry: loadNewer }
}
