import { useState } from 'react'
import type { Job } from '@/shared/types'
import type { JobDetail } from '../../hooks/use-job-detail'
import { jobPhase, TOOLBAR_NOTES } from '../../lib/job-phase'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { LogViewer } from './log-viewer'
import { MediaPanel } from './media-panel'
import { MetricCharts } from './metric-charts'

export type Section = 'metrics' | 'media' | 'logs'

const SECTIONS: readonly Section[] = ['metrics', 'media', 'logs']

const SECTION_LABELS: Readonly<Record<Section, string>> = {
  metrics: 'メトリクス',
  media: '画像・音声',
  logs: 'ログ',
}

const isSection = (value: string): value is Section => SECTIONS.some((s) => s === value)

/** A failed job opens on its logs, where the error is; anything else on its charts. */
export const defaultSection = (job: Job): Section => (job.status === 'failed' ? 'logs' : 'metrics')

export interface JobSectionsProps {
  detail: JobDetail
  job: Job
}

/** The run's recorded data, one tab each, with the toolbar note on the right. */
export function JobSections({ detail, job }: JobSectionsProps) {
  const [section, setSection] = useState<Section>(() => defaultSection(job))
  const { metrics, images, audio, logs, lastReceivedAt } = detail
  const phase = jobPhase(job.status, lastReceivedAt)
  return (
    <Tabs value={section} onValueChange={(value) => isSection(value) && setSection(value)}>
      {/* Tabs already puts 8px below; 4px more makes the mock's 12px. */}
      <div className="mb-1 flex min-h-11 items-center justify-between gap-4">
        <TabsList aria-label="ジョブの詳細">
          {SECTIONS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {SECTION_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
        <span className="text-xs text-muted-foreground">{TOOLBAR_NOTES[phase]}</span>
      </div>
      <TabsContent value="metrics">
        <MetricCharts
          series={metrics.series}
          loading={metrics.loading}
          error={metrics.error}
          onRetry={metrics.retry}
          phase={phase}
          lastReceivedAt={lastReceivedAt}
        />
      </TabsContent>
      <TabsContent value="media">
        <MediaPanel images={images} audio={audio} config={job.config} />
      </TabsContent>
      <TabsContent value="logs">
        <LogViewer
          logs={logs}
          phase={phase}
          finishedAt={job.finished_at}
          lastReceivedAt={lastReceivedAt}
        />
      </TabsContent>
    </Tabs>
  )
}
