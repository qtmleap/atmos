import { Link } from '@tanstack/react-router'
import type { User } from '@/shared/types'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'

/**
 * The member rows of users.html: each row is one link with the avatar, the
 * display name and the handle, 54px tall, ruled top and bottom.
 */
export function MemberList({ users }: { users: User[] }) {
  return (
    <div className="border-t">
      {users.map((user) => (
        <Link
          key={user.id}
          to="/users/$handle"
          params={{ handle: user.handle }}
          className="grid min-h-[54px] items-center border-b px-2 py-1.5 outline-none hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <div className="flex items-center gap-3">
            <Avatar aria-hidden="true">
              {user.avatar_url === null ? null : <AvatarImage src={user.avatar_url} alt="" />}
              <AvatarFallback>{user.display_name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium [overflow-wrap:anywhere]">{user.display_name}</p>
              <p className="font-mono text-xs text-muted-foreground">@{user.handle}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
