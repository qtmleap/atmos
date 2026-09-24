import type { LiveConnection } from '../../hooks/use-job-live'
import { StatusDot } from '../ui/status'

export const CONNECTION_LABELS: Readonly<Record<LiveConnection, string | null>> = {
  off: null,
  connecting: 'ライブ接続中',
  open: 'ライブ更新中',
  reconnecting: '再接続を待っています',
  ended: null,
}

/** A pulsing dot and a short label (12px), e.g. "ライブ更新中". */
export function LiveIndicator({ children }: { children: React.ReactNode }) {
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      <StatusDot pulse />
      {children}
    </span>
  )
}

/** The indicator for a live connection state, or nothing when there is none. */
export function ConnectionIndicator({ connection }: { connection: LiveConnection }) {
  const label = CONNECTION_LABELS[connection]
  return label === null ? null : <LiveIndicator>{label}</LiveIndicator>
}
