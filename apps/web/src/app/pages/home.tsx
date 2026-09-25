// / — the project index (designs/pages/projects.html): heading, search and
// filters, the ruled table, the pager and a note about what is visible.
import { ListFooter } from '../components/common/list-footer'
import { ListToolbar } from '../components/common/list-toolbar'
import { LoadingRows } from '../components/common/loading-rows'
import { CreateProjectDialog } from '../components/project/create-project-dialog'
import { ProjectTable } from '../components/project/project-table'
import { ProjectsEmptyState } from '../components/project/projects-empty-state'
import { EmptyState, EmptyStateDescription } from '../components/ui/empty-state'
import { NativeSelect, NativeSelectOption } from '../components/ui/native-select'
import { useCreateProject } from '../hooks/use-create-project'
import { useCurrentUser } from '../hooks/use-current-user'
import {
  ALL,
  isVisibilityFilter,
  useProjectFilters,
  useProjects,
  visibilityFilterOptions,
} from '../hooks/use-projects'
import { homeListNote } from '../lib/visibility-note'

export default function HomePage() {
  const list = useProjects()
  const { user } = useCurrentUser()
  const { filters, setQuery, setVisibility, setOwner, owners, visible } = useProjectFilters(
    list.items,
  )
  const create = useCreateProject()
  const empty = !list.initial && list.items.length === 0 && list.error === null
  const filteredOut = !list.initial && list.items.length > 0 && visible.length === 0

  return (
    <div className="mx-auto max-w-[1600px] px-8 pt-4 pb-6">
      <header className="grid gap-4 border-b py-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl leading-8">プロジェクト</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">チームのワークスペース</span>
            {user === null ? null : (
              <CreateProjectDialog
                open={create.open}
                onOpenChange={create.onOpenChange}
                form={create.form}
                onChange={create.onChange}
                submitting={create.submitting}
                error={create.error}
                onSubmit={create.submit}
              />
            )}
          </div>
        </div>
        <p className="leading-[22px] text-muted-foreground">
          音声合成と画像生成の実験を、プロジェクトごとに。
        </p>
      </header>

      {empty ? null : (
        <ListToolbar
          label="プロジェクトの検索と絞り込み"
          searchLabel="プロジェクトを検索"
          placeholder="プロジェクトを検索…"
          value={filters.query}
          onChange={setQuery}
          note="最終更新が新しい順 · 日時は UTC"
        >
          <NativeSelect
            aria-label="公開範囲"
            className="w-44"
            value={filters.visibility}
            onChange={(event) => {
              if (isVisibilityFilter(event.target.value)) {
                setVisibility(event.target.value)
              }
            }}
          >
            {visibilityFilterOptions(user !== null).map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="所有者"
            className="w-44"
            value={filters.owner}
            onChange={(event) => setOwner(event.target.value)}
          >
            <NativeSelectOption value={ALL}>すべての所有者</NativeSelectOption>
            {owners.map((owner) => (
              <NativeSelectOption key={owner.handle} value={owner.handle}>
                {owner.display_name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </ListToolbar>
      )}

      {list.initial ? <LoadingRows /> : null}

      {empty ? (
        <ProjectsEmptyState onCreate={user === null ? null : () => create.onOpenChange(true)} />
      ) : null}

      {filteredOut ? (
        <EmptyState>
          <h3>一致するプロジェクトがありません</h3>
          <EmptyStateDescription>検索語や絞り込みを変えてみてください。</EmptyStateDescription>
        </EmptyState>
      ) : null}

      {visible.length > 0 ? <ProjectTable projects={visible} /> : null}

      {list.initial || empty ? null : (
        <ListFooter
          noun="一覧"
          count={visible.length}
          hasMore={list.hasMore}
          loading={list.loading}
          error={list.error}
          onLoadMore={list.loadMore}
          onRetry={list.retry}
        />
      )}

      {empty ? null : (
        <p className="pt-3 text-xs text-muted-foreground">{homeListNote(user !== null)}</p>
      )}
    </div>
  )
}
