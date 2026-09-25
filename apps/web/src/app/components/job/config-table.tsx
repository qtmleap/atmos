import { useMemo } from 'react'
import { type ConfigEntry, configEntries } from '../../lib/config'
import { EmptyState, EmptyStateDescription } from '../ui/empty-state'

const valueClass = (entry: ConfigEntry): string =>
  entry.kind === 'null' ? 'text-muted-foreground' : entry.kind === 'number' ? 'tabular-nums' : ''

/**
 * The sidebar's settings table: key on the left, value right-aligned, 11px
 * mono rows of 40px ruled below. Nested values are shown as one-line JSON.
 */
export function ConfigTable({ config }: { config: Record<string, unknown> }) {
  const entries = useMemo(() => configEntries(config), [config])
  if (entries.length === 0) {
    return <p className="py-3 text-xs text-muted-foreground">設定は記録されていません。</p>
  }
  return (
    <table className="w-full border-collapse font-mono text-[11px]">
      <caption className="sr-only">学習ハイパーパラメータ</caption>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.key} className="border-b">
            <th
              scope="row"
              className="h-10 py-2.5 pr-3 text-left align-middle font-medium [overflow-wrap:anywhere]"
            >
              {entry.key}
            </th>
            <td
              className={`py-2.5 text-right align-middle [overflow-wrap:anywhere] ${valueClass(entry)}`}
            >
              {entry.plain}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * The catalog's `.config-pair` list: JSON-typed values (strings quoted,
 * arrays and objects on one line) on a two-column ruled grid.
 */
export function ConfigPairs({ config }: { config: Record<string, unknown> }) {
  const entries = useMemo(() => configEntries(config), [config])
  if (entries.length === 0) {
    return (
      <EmptyState>
        <EmptyStateDescription>このジョブには設定が記録されていません。</EmptyStateDescription>
      </EmptyState>
    )
  }
  return (
    <dl className="m-0 font-mono text-xs">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className="grid grid-cols-[minmax(100px,40%)_minmax(0,1fr)] gap-4 border-b py-2.5"
        >
          <dt className="text-muted-foreground [overflow-wrap:anywhere]">{entry.key}</dt>
          <dd className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.json}</dd>
        </div>
      ))}
    </dl>
  )
}
