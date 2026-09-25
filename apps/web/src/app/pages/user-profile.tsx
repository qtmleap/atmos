// /users/:handle — own or someone else's profile, plus the projects they own
// (designs/pages/user-profile.html, docs/SPEC.md §4).
import { FolderIcon } from 'lucide-react'
import type { Project } from '@/shared/types'
import { ListFooter } from '../components/common/list-footer'
import { LoadingRows } from '../components/common/loading-rows'
import { EmptyState, EmptyStateDescription, ErrorCode } from '../components/ui/empty-state'
import { OwnedProjectList } from '../components/user/owned-project-list'
import { ProfileBreadcrumb, ProfileHeading } from '../components/user/profile-header'
import { useCurrentUser } from '../hooks/use-current-user'
import { usePagedList } from '../hooks/use-paged-list'
import { useRequiredParam } from '../hooks/use-required-param'
import { useUser } from '../hooks/use-user'
import { profileListNote, profileViewer } from '../lib/visibility-note'

const PROJECTS_PAGE_SIZE = 20

const PAGE = 'mx-auto max-w-[1600px] px-8 pt-8 pb-6'

export default function UserProfilePage() {
  const handle = useRequiredParam('handle')
  const { user: currentUser } = useCurrentUser()
  return (
    <UserProfileContent
      handle={handle}
      isOwnProfile={currentUser !== null && currentUser.handle === handle}
      signedIn={currentUser !== null}
    />
  )
}

function UserProfileContent({
  handle,
  isOwnProfile,
  signedIn,
}: {
  handle: string
  isOwnProfile: boolean
  signedIn: boolean
}) {
  const { user, loading, error } = useUser(handle)
  const projects = usePagedList<Project>(
    `/api/users/${encodeURIComponent(handle)}/projects`,
    PROJECTS_PAGE_SIZE,
  )

  if (loading) {
    return (
      <div className={PAGE}>
        <LoadingRows />
      </div>
    )
  }

  if (error !== null || user === null) {
    return (
      <div className={PAGE}>
        <EmptyState>
          <ErrorCode>404</ErrorCode>
          <h3>ユーザーを表示できません</h3>
          <EmptyStateDescription role="alert">
            {error === null ? '見つかりませんでした。' : error}
          </EmptyStateDescription>
        </EmptyState>
      </div>
    )
  }

  const empty = !projects.initial && projects.items.length === 0 && projects.error === null

  return (
    <div className={PAGE}>
      <ProfileBreadcrumb user={user} />
      <ProfileHeading user={user} editable={isOwnProfile} />

      <section aria-labelledby="owned-projects">
        <div className="flex items-center justify-between pt-7 pb-5">
          <div className="grid gap-2">
            <h2 id="owned-projects">所有するプロジェクト</h2>
            <p className="leading-[22px] text-muted-foreground">
              {user.display_name}さんが所有するプロジェクトです。
            </p>
          </div>
          {projects.initial ? null : (
            <span className="text-xs text-muted-foreground">{projects.items.length}件表示</span>
          )}
        </div>

        {projects.initial ? <LoadingRows /> : null}

        {empty ? (
          <EmptyState className="border-t">
            <FolderIcon aria-hidden="true" />
            <h3>プロジェクトがありません。</h3>
            <EmptyStateDescription>
              {user.display_name}さんが所有するプロジェクトはまだありません。
            </EmptyStateDescription>
          </EmptyState>
        ) : null}

        {projects.items.length > 0 ? <OwnedProjectList projects={projects.items} /> : null}

        {projects.initial ? null : (
          <ListFooter
            noun="プロジェクト"
            count={projects.items.length}
            hasMore={projects.hasMore}
            loading={projects.loading}
            error={projects.error}
            onLoadMore={projects.loadMore}
            onRetry={projects.retry}
            className="pt-4"
          />
        )}

        <p className="pt-4 text-xs text-muted-foreground">
          {profileListNote(profileViewer(signedIn, isOwnProfile))}
        </p>
      </section>
    </div>
  )
}
