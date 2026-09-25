// /admin — user and role management (docs/SPEC.md §3, designs/pages/admin.html).
// Gated on `useCurrentUser().user.role === "admin"`; the server's 403 is
// still the real enforcement, this is just so non-admins do not see the
// controls. The list is on the left, the create form on the right.
import { ShieldIcon } from 'lucide-react'
import { useState } from 'react'
import { CreateUserForm } from '../components/admin/create-user-form'
import { UserPager } from '../components/admin/user-pager'
import { UserTable, UserToolbar } from '../components/admin/user-table'
import { LoadingRows } from '../components/common/loading-rows'
import { Badge } from '../components/ui/badge'
import { type CreateUserFormInput, useAdminUsers } from '../hooks/use-admin-users'
import { useCurrentUser } from '../hooks/use-current-user'

const EMPTY_FORM: CreateUserFormInput = {
  cf_access_email: '',
  handle: '',
  display_name: '',
  role: 'user',
}

export default function AdminPage() {
  const { user: currentUser, loading: loadingCurrentUser } = useCurrentUser()
  const list = useAdminUsers()
  const [form, setForm] = useState<CreateUserFormInput>(EMPTY_FORM)

  if (loadingCurrentUser) {
    return <LoadingRows />
  }

  if (currentUser === null || currentUser.role !== 'admin') {
    return (
      <div className="px-4 py-16 sm:px-6">
        <h1 className="text-lg font-semibold">このページは管理者のみ利用できます</h1>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] px-8 pt-4 pb-6">
      <header className="grid gap-4 border-b py-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl leading-8 font-semibold tracking-tight">ユーザー管理</h1>
          <Badge variant="outline">
            <ShieldIcon aria-hidden="true" />
            管理者専用
          </Badge>
        </div>
        <p className="leading-[22px] text-muted-foreground">
          チームへのユーザー追加と、アクセス権限を管理します。
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_304px] gap-8 pt-7">
        <section aria-labelledby="users-title">
          <h2 id="users-title" className="text-xl leading-7 font-semibold tracking-tight">
            ユーザー一覧
          </h2>

          <UserToolbar
            query={list.query}
            onQueryChange={list.setQuery}
            roleFilter={list.roleFilter}
            onRoleFilterChange={list.setRoleFilter}
          />

          {list.initial || (list.loading && list.items.length === 0) ? <LoadingRows /> : null}

          {!list.initial && !list.loading && list.items.length === 0 && list.error === null ? (
            <p className="py-10 text-muted-foreground">ユーザーがいません。</p>
          ) : null}

          {list.items.length > 0 && list.visibleItems.length === 0 ? (
            <p className="py-10 text-muted-foreground">条件に合うユーザーがいません。</p>
          ) : null}

          {list.visibleItems.length > 0 ? (
            <UserTable
              users={list.visibleItems}
              currentUserId={currentUser.id}
              updatingUserId={list.updatingUserId}
              roleError={list.updateError}
              onRoleChange={(userId, role) => void list.updateRole(userId, role)}
            />
          ) : null}

          {list.initial ? null : (
            <UserPager
              canGoPrevious={list.canGoPrevious}
              canGoNext={list.canGoNext}
              loading={list.loading}
              error={list.error}
              onPrevious={list.goPrevious}
              onNext={list.goNext}
            />
          )}
        </section>

        <CreateUserForm
          form={form}
          onChange={setForm}
          creating={list.creating}
          error={list.createError}
          onSubmit={() => {
            void list.createUser(form).then((created) => {
              if (created) {
                setForm(EMPTY_FORM)
              }
            })
          }}
        />
      </div>
    </div>
  )
}
