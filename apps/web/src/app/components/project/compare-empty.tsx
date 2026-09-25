// The comparison with nothing to draw (project-jobs-compare-unselected.html
// and project-jobs-compare-no-metrics.html): no job selected, or selected
// jobs without a single metric yet.
import type { SelectedJobRow } from '../../lib/compare-selection'
import { jobDisplayName, STATUS_LABELS } from '../../lib/format'
import { formatStep } from '../../lib/metrics'
import { WidgetHeader } from '../job/widget-header'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { Status } from '../ui/status'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

export function CompareUnselected({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <section aria-label="選んだジョブのメトリクス比較">
      <EmptyState>
        <h2>比較するジョブが選ばれていません</h2>
        <Button variant="outline" type="button" aria-haspopup="dialog" onClick={onOpenDrawer}>
          ジョブを選ぶ
        </Button>
      </EmptyState>
    </section>
  )
}

export function CompareNoMetrics({ rows }: { rows: SelectedJobRow[] }) {
  return (
    <>
      <section aria-label="選択中のジョブ">
        <WidgetHeader level={2} title="選択中のジョブ" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">ジョブ名</TableHead>
              <TableHead scope="col">状態</TableHead>
              <TableHead scope="col">最終受信ステップ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ job, lastStep }) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono">{jobDisplayName(job)}</TableCell>
                <TableCell>
                  <Status status={job.status}>{STATUS_LABELS[job.status]}</Status>
                </TableCell>
                <TableCell>{lastStep === null ? '—' : formatStep(lastStep)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section aria-label="選んだジョブのメトリクス比較">
        <EmptyState>
          <h2>比較できるメトリクスはありません</h2>
        </EmptyState>
      </section>
    </>
  )
}
