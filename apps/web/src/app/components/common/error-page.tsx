// Full-page errors (designs/pages/signin-required.html, forbidden.html and
// not-found.html): a large status code, a heading, one sentence and the ways
// out, left-aligned under the breadcrumb and set apart by space only.
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  type AccessErrorKind,
  type AccessErrorSubject,
  accessErrorText,
  splitAround,
} from '../../lib/access-error'
import { ProjectBreadcrumb } from '../project/project-header'
import { Button } from '../ui/button'
import { ErrorCode } from '../ui/empty-state'

export interface ErrorPageProps {
  code: string
  title: ReactNode
  description: ReactNode
  actions?: ReactNode
}

export function ErrorPage({ code, title, description, actions }: ErrorPageProps) {
  return (
    <section className="grid justify-items-start gap-3 py-12">
      <ErrorCode>{code}</ErrorCode>
      <h1 className="text-2xl leading-8">{title}</h1>
      <p className="leading-[22px] text-muted-foreground">{description}</p>
      {actions === undefined ? null : <div className="mt-2 flex gap-2">{actions}</div>}
    </section>
  )
}

/** "…、プロジェクト一覧に戻ってください。" with the list name as a link. */
export function ProjectListSentence({
  before,
  link,
  after,
}: {
  before: ReactNode
  link: ReactNode
  after: ReactNode
}) {
  return (
    <>
      {before}
      <Link to="/" className="underline underline-offset-4">
        {link}
      </Link>
      {after}
    </>
  )
}

const BackToList = () => (
  <Button variant="outline" asChild>
    <Link to="/">プロジェクト一覧へ戻る</Link>
  </Button>
)

export interface AccessErrorPageProps {
  kind: AccessErrorKind
  subject: AccessErrorSubject
  projectId: string
}

/** A project (or one of its jobs) that could not be shown: 401, 403 or 404. */
export function AccessErrorPage({ kind, subject, projectId }: AccessErrorPageProps) {
  const text = accessErrorText(kind, subject)
  const parts = text.linked === undefined ? null : splitAround(text.description, text.linked)
  const description =
    parts === null ? (
      text.description
    ) : (
      <ProjectListSentence before={parts[0]} link={parts[1]} after={parts[2]} />
    )
  let actions: ReactNode
  if (kind === 'signin') {
    actions = (
      <>
        <Button asChild>
          <a href="/settings/profile">ログイン</a>
        </Button>
        <BackToList />
      </>
    )
  } else if (kind === 'forbidden') {
    actions = <BackToList />
  }
  return (
    <>
      <ProjectBreadcrumb current={projectId} mono />
      <ErrorPage code={text.code} title={text.title} description={description} actions={actions} />
    </>
  )
}
