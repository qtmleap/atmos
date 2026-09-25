import { Link } from '@tanstack/react-router'
import { ChevronDownIcon } from 'lucide-react'
import type { UserWithEmail } from '@/shared/types'
import { ACCESS_LOGOUT_PATH, useLogout } from '../../hooks/use-logout'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Skeleton } from '../ui/skeleton'

export interface UserMenuProps {
  user: UserWithEmail | null
  loading: boolean
}

/**
 * The account at the right of the header: display name, avatar, and a ghost
 * chevron button that opens the menu. Signed out, a sign-in link instead.
 * Sign-in is a full page load of a page Cloudflare Access protects
 * (docs/PLAN.md §3.1), so Access can redirect to its login; a client-side
 * route change would never reach Access.
 */
export function UserMenu({ user, loading }: UserMenuProps) {
  const logout = useLogout()
  if (loading) {
    return <Skeleton className="size-8 rounded-full" />
  }
  if (user === null) {
    return (
      <Button asChild>
        <a href="/settings/profile">ログイン</a>
      </Button>
    )
  }
  return (
    <>
      <span className="text-xs">{user.display_name}</span>
      <Avatar role="img" aria-label={`${user.display_name}のアバター`}>
        {user.avatar_url === null ? null : <AvatarImage src={user.avatar_url} alt="" />}
        <AvatarFallback>{user.display_name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="ユーザーメニュー">
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p>{user.display_name}</p>
            <p className="font-mono text-xs font-normal text-muted-foreground">@{user.handle}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/users/$handle" params={{ handle: user.handle }}>
              プロフィール
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings/profile">プロフィール設定</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings/tokens">アクセストークン</Link>
          </DropdownMenuItem>
          {user.role === 'admin' ? (
            <DropdownMenuItem asChild>
              <Link to="/admin">管理</Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a
              href={ACCESS_LOGOUT_PATH}
              onClick={(event) => {
                event.preventDefault()
                logout()
              }}
            >
              ログアウト
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
