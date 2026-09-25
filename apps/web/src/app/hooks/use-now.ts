import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

/** Current time as an ISO string, refreshed every `intervalMs` while `active`. */
export function useNow(intervalMs: number, active: boolean): string {
  const [now, setNow] = useState(() => dayjs().toISOString())
  useEffect(() => {
    if (!active) {
      return
    }
    const timer = setInterval(() => setNow(dayjs().toISOString()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, active])
  return now
}
