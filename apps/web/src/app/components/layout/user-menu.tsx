import { Link, useLocation } from '@tanstack/react-router'
import { ChevronDownIcon } from 'lucide-react'
import type { UserWithEmail } from '@/shared/types'
import { ACCESS_LOGOUT_PATH, useLogout } from '../../hooks/use-logout'
import { loginHref } from '../../lib/login-url'
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
  /**
   * The visitor is signed in at the identity provider but has no atmos user.
   * The login link would only bring them back to the same answer, so the menu
   * offers logging out (to pick another account) instead.
   */
  unregistered?: boolean
}

/**
 * The account at the right of the header: display name, avatar, and a ghost
 * chevron button that opens the menu. Signed out, a sign-in link instead,
 * which brings the visitor back to the page they are on (login-url.ts).
 */
export function UserMenu({ user, loading, unregistered = false }: UserMenuProps) {
  const logout = useLogout()
  const here = useLocation({ select: (location) => `${location.pathname}${location.searchStr}` })
  if (loading) {
    return <Skeleton className="size-8 rounded-full" />
  }
  if (user === null && unregistered) {
    return (
      <>
        <span className="text-xs text-muted-foreground">未登録のアカウント</span>
        <Button variant="outline" onClick={logout}>
          ログアウト
        </Button>
      </>
    )
  }
  if (user === null) {
    return (
      <Button asChild>
        <a href={loginHref(here)}>ログイン</a>
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
