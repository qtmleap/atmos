// Row specimens for /catalog/data-display: projects, jobs and members as
// ruled grid rows (.data-list / .data-row in the mock).
import { ChevronRightIcon, EllipsisIcon } from 'lucide-react'
import type * as React from 'react'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Status, Visibility } from '../../components/ui/status'
import { cn } from '../../lib/utils'

function DataRow({
  member = false,
  preview,
  children,
}: {
  member?: boolean
  preview?: 'hover'
  children: React.ReactNode
}) {
  return (
    <div
      data-preview={preview}
      className={cn(
        'grid min-h-[68px] items-center gap-4 border-b px-2 py-3 hover:bg-muted',
        member
          ? 'grid-cols-[minmax(0,1fr)_120px_160px_32px]'
          : 'grid-cols-[minmax(0,1fr)_120px_160px_120px_32px]',
      )}
    >
      {children}
    </div>
  )
}

function RowTitle({ mono = false, children }: { mono?: boolean; children: React.ReactNode }) {
  return (
    <p className={cn('font-medium [overflow-wrap:anywhere]', mono && 'font-mono')}>{children}</p>
  )
}

function RowMeta({ mono = false, children }: { mono?: boolean; children: React.ReactNode }) {
  return <p className={cn('text-xs text-muted-foreground', mono && 'font-mono')}>{children}</p>
}

const projects = [
  {
    name: '音声合成 v4',
    id: 'prj_7e2a90c1',
    isPublic: false,
    owner: '田中 美咲',
    created: '2026-09-18',
  },
  {
    name: 'shogi-nnue',
    id: 'prj_9b3d10f4',
    isPublic: true,
    owner: '佐藤 悠斗',
    created: '2026-09-12',
  },
]

export function ProjectRows() {
  return (
    <div className="border-t">
      {projects.map((project, index) => (
        <DataRow key={project.id} preview={index === 1 ? 'hover' : undefined}>
          <div>
            <RowTitle>{project.name}</RowTitle>
            <RowMeta mono>{project.id}</RowMeta>
          </div>
          <Visibility isPublic={project.isPublic}>
            {project.isPublic ? '公開' : '非公開'}
          </Visibility>
          <div className="flex items-center gap-3">
            <Avatar size="sm" aria-hidden="true">
              <AvatarFallback>{project.owner.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="text-xs">{project.owner}</span>
          </div>
          <time className="text-xs text-muted-foreground" dateTime={project.created}>
            {project.created}
          </time>
          <Button variant="ghost" size="icon" aria-label={`${project.name} の操作`}>
            <EllipsisIcon />
          </Button>
        </DataRow>
      ))}
    </div>
  )
}

const jobs = [
  {
    name: 'vits-baseline-042',
    mono: false,
    meta: '開始 2026-09-24 08:15 UTC',
    status: 'running',
    label: '実行中',
    duration: '06:17:00',
    end: '終了日時 —',
  },
  {
    name: 'vits-baseline-041',
    mono: false,
    meta: '開始 2026-09-23 10:00 UTC',
    status: 'finished',
    label: '完了',
    duration: '08:32:00',
    end: '終了 09-23 18:32',
  },
  {
    name: 'job_6f42c8a0',
    mono: true,
    meta: '名前未設定 · 開始 2026-09-23 09:00 UTC',
    status: 'failed',
    label: '失敗',
    duration: '00:18:00',
    end: '終了 09-23 09:18',
  },
] as const

export function JobRows() {
  return (
    <div className="border-t">
      {jobs.map((job) => (
        <DataRow key={job.name}>
          <div>
            <RowTitle mono={job.mono}>{job.name}</RowTitle>
            <RowMeta>{job.meta}</RowMeta>
          </div>
          <Status status={job.status} plainCheck>
            {job.label}
          </Status>
          <span className="font-mono text-xs">{job.duration}</span>
          <span className="text-xs text-muted-foreground">{job.end}</span>
          <Button variant="ghost" size="icon" aria-label={`${job.name} の詳細`}>
            <ChevronRightIcon />
          </Button>
        </DataRow>
      ))}
    </div>
  )
}

const members = [
  { name: '田中 美咲', handle: 'misaki_t', admin: true, you: true, joined: '2026-08-01' },
  { name: '佐藤 悠斗', handle: 'yuto_s', admin: false, you: false, joined: '2026-08-03' },
  { name: '鈴木 葵', handle: 'aoi_ml', admin: false, you: false, joined: '2026-08-05' },
]

export function MemberRows() {
  return (
    <div className="border-t">
      {members.map((member) => (
        <DataRow key={member.handle} member>
          <div className="flex items-center gap-3">
            <Avatar aria-hidden="true">
              <AvatarFallback>{member.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <RowTitle>
                {member.name}
                {member.you ? <span className="text-xs text-muted-foreground"> あなた</span> : null}
              </RowTitle>
              <RowMeta mono>@{member.handle}</RowMeta>
            </div>
          </div>
          <div>
            <Badge variant={member.admin ? 'default' : 'secondary'}>
              {member.admin ? '管理者' : '一般ユーザー'}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">参加 {member.joined}</span>
          <Button variant="ghost" size="icon" aria-label={`${member.name}のプロフィール`}>
            <ChevronRightIcon />
          </Button>
        </DataRow>
      ))}
    </div>
  )
}
