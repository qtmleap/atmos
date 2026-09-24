import { useCallback, useEffect, useRef } from 'react'

/**
 * Collects items pushed one by one (live messages) and hands them to `flush`
 * in batches at most every `intervalMs`, so a burst of hundreds of metrics is
 * one state update instead of hundreds.
 */
export function useBatched<T>(flush: (items: T[]) => void, intervalMs: number): (item: T) => void {
  const buffer = useRef<T[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushRef = useRef(flush)
  flushRef.current = flush

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current)
      }
    },
    [],
  )

  return useCallback(
    (item: T) => {
      buffer.current.push(item)
      if (timer.current !== null) {
        return
      }
      timer.current = setTimeout(() => {
        timer.current = null
        const items = buffer.current
        buffer.current = []
        flushRef.current(items)
      }, intervalMs)
    },
    [intervalMs],
  )
}
