import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, PencilIcon } from 'lucide-react'
import type { User } from '@/shared/types'
import { Button } from '../ui/button'

/** "メンバー › 名前" above the profile (the mock's `.breadcrumb`). */
export function ProfileBreadcrumb({ user }: { user: User }) {
  return (
    <nav aria-label="パンくず">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <li className="inline-flex items-center gap-2">
          <Link to="/users" className="hover:underline hover:underline-offset-4">
            メンバー
          </Link>
          <ChevronRightIcon aria-hidden="true" className="size-4" />
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-current="page" className="text-foreground">
            {user.display_name}
          </span>
        </li>
      </ol>
    </nav>
  )
}

/**
 * The profile heading of user-profile.html: a 64px avatar, the display name
 * over the handle, and (on your own page) the edit button at the right.
 * The avatar is a plain element because the Avatar component has no 64px size.
 */
export function ProfileHeading({ user, editable }: { user: User; editable: boolean }) {
  return (
    <header className="flex items-center gap-5 border-b py-8">
      <span
        role="img"
        aria-label={`${user.display_name}のアバター`}
        className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-medium"
      >
        {user.avatar_url === null ? (
          user.display_name.slice(0, 1)
        ) : (
          <img src={user.avatar_url} alt="" className="size-full object-cover" />
        )}
      </span>
      <div className="grid gap-2">
        <h1 className="text-2xl leading-8">{user.display_name}</h1>
        <p className="font-mono text-muted-foreground">@{user.handle}</p>
      </div>
      {editable ? (
        <Button variant="outline" asChild className="ml-auto">
          <Link to="/settings/profile">
            <PencilIcon aria-hidden="true" />
            プロフィールを編集
          </Link>
        </Button>
      ) : null}
    </header>
  )
}
