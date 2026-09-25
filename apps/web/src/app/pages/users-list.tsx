// /users — team member list (designs/pages/users.html, docs/SPEC.md §4):
// heading, a search box over the loaded rows, the ruled rows and the pager.
import { UsersIcon } from 'lucide-react'
import { ListFooter } from '../components/common/list-footer'
import { ListToolbar } from '../components/common/list-toolbar'
import { LoadingRows } from '../components/common/loading-rows'
import { EmptyState, EmptyStateDescription } from '../components/ui/empty-state'
import { MemberList } from '../components/user/member-list'
import { useUserSearch, useUsers } from '../hooks/use-users'

export default function UsersListPage() {
  const list = useUsers()
  const { query, setQuery, visible } = useUserSearch(list.items)
  const empty = !list.initial && list.items.length === 0 && list.error === null
  const filteredOut = !list.initial && list.items.length > 0 && visible.length === 0

  return (
    <div className="mx-auto max-w-[1600px] px-8 pt-4 pb-6">
      <header className="grid gap-4 border-b py-6">
        <h1 className="text-2xl leading-8">メンバー</h1>
        <p className="leading-[22px] text-muted-foreground">
          チームのメンバーと、それぞれのプロジェクトを見つけましょう。
        </p>
      </header>

      <ListToolbar
        searchLabel="表示名・ハンドルで検索"
        searchWidth="wide"
        value={query}
        onChange={setQuery}
        note={list.initial ? null : `${visible.length}件表示`}
        className="justify-between gap-4 py-5"
      />

      {list.initial ? <LoadingRows /> : null}

      {empty ? (
        <EmptyState>
          <UsersIcon aria-hidden="true" />
          <h3>メンバーがいません。</h3>
          <EmptyStateDescription>
            管理者がメンバーを登録すると、ここに表示されます。
          </EmptyStateDescription>
        </EmptyState>
      ) : null}

      {filteredOut ? (
        <EmptyState>
          <h3>一致するメンバーがいません</h3>
          <EmptyStateDescription>表示名かハンドルの一部で検索してください。</EmptyStateDescription>
        </EmptyState>
      ) : null}

      {visible.length > 0 ? <MemberList users={visible} /> : null}

      {list.initial ? null : (
        <ListFooter
          noun="メンバー"
          count={visible.length}
          hasMore={list.hasMore}
          loading={list.loading}
          error={list.error}
          onLoadMore={list.loadMore}
          onRetry={list.retry}
          className="pt-4"
        />
      )}
    </div>
  )
}
