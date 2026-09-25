// A project with no job yet (designs/pages/project-jobs-empty.html): where to
// set up the access token, and the few SDK lines that start the first job.
import { Link } from '@tanstack/react-router'
import { KeyRoundIcon, PlayIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { EmptyState, EmptyStateDescription } from '../ui/empty-state'

/** The SDK snippet for `projectName` (packages/python-sdk/README.md). */
export const sdkFirstJobExample = (projectName: string): string =>
  [
    'import atmos',
    '',
    `run = atmos.init(project=${JSON.stringify(projectName)})`,
    'run.log({"loss": 0.42}, step=1)',
    'run.finish()',
  ].join('\n')

export function JobsEmptyState({ projectName }: { projectName: string }) {
  return (
    <>
      <EmptyState>
        <PlayIcon aria-hidden="true" />
        <h2>ジョブはまだありません</h2>
        <EmptyStateDescription>
          SDK でこのプロジェクトのジョブを開始すると、ここに表示されます。
        </EmptyStateDescription>
        <Button variant="outline" asChild>
          <Link to="/settings/tokens">
            <KeyRoundIcon aria-hidden="true" />
            アクセストークンを設定
          </Link>
        </Button>
      </EmptyState>
      <section aria-labelledby="sdk-first-job-title" className="grid gap-4">
        <h3 id="sdk-first-job-title">SDK から送信する</h3>
        <pre className="overflow-x-auto bg-muted p-4 font-mono text-xs leading-6">
          <code>{sdkFirstJobExample(projectName)}</code>
        </pre>
      </section>
    </>
  )
}
