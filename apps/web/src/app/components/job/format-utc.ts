// The run page shows every instant in UTC, as the mocks do (the SDK logs in
// UTC and runs are compared across time zones). lib/format.ts formats in
// local time for the lists; these are the UTC forms the job widgets use.
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/** `2026年9月24日 06:00:00 UTC` */
export const formatUtcDateTime = (iso: string): string =>
  dayjs.utc(iso).format('YYYY年M月D日 HH:mm:ss [UTC]')

/** `09:42:18 UTC` */
export const formatUtcClock = (iso: string): string => dayjs.utc(iso).format('HH:mm:ss [UTC]')

/** `09:42:00.125`, for log lines. */
export const formatUtcClockMs = (iso: string): string => dayjs.utc(iso).format('HH:mm:ss.SSS')
