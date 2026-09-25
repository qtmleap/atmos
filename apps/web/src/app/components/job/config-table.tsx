import { useMemo } from 'react'
import { type ConfigEntry, configEntries } from '../../lib/config'
import { cn } from '../../lib/utils'
import { EmptyState, EmptyStateDescription } from '../ui/empty-state'

const valueClass = (entry: ConfigEntry): string =>
  entry.kind === 'null' ? 'text-muted-foreground' : entry.kind === 'number' ? 'tabular-nums' : ''

export interface KeyValueRow {
  key: string
  value: string
  valueClassName?: string
}

/**
 * The settings sheet's ruled table: key on the left, value right-aligned,
 * 11px mono rows of 40px ruled below. Shared by the config and the run info.
 */
export function KeyValueTable({ caption, rows }: { caption: string; rows: KeyValueRow[] }) {
  return (
    <table className="w-full border-collapse font-mono text-[11px]">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b">
            <th
              scope="row"
              className="h-10 py-2.5 pr-3 text-left align-middle font-medium [overflow-wrap:anywhere]"
            >
              {row.key}
            </th>
            <td
              className={cn(
                'py-2.5 text-right align-middle [overflow-wrap:anywhere]',
                row.valueClassName,
              )}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The config as a KeyValueTable. Nested values are shown as one-line JSON. */
export function ConfigTable({ config }: { config: Record<string, unknown> }) {
  const rows = useMemo(
    () =>
      configEntries(config).map((entry) => ({
        key: entry.key,
        value: entry.plain,
        valueClassName: valueClass(entry),
      })),
    [config],
  )
  if (rows.length === 0) {
    return <p className="py-3 text-xs text-muted-foreground">設定は記録されていません。</p>
  }
  return <KeyValueTable caption="学習ハイパーパラメータ" rows={rows} />
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
