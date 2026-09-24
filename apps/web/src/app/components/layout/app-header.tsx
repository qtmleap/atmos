import { Link, useLocation } from '@tanstack/react-router'
import type * as React from 'react'
import type { UserWithEmail } from '@/shared/types'
import { type NavSection, navSectionOf } from './nav-sections'
import { UserMenu } from './user-menu'

const navItems = [
  { to: '/', label: 'プロジェクト', section: 'projects' },
  { to: '/users', label: 'メンバー', section: 'users' },
] as const

export interface AppHeaderBarProps {
  /** Section marked aria-current; null marks none. */
  current: NavSection
  /** Omit the sections entirely (first-run setup). */
  hideNav?: boolean
  navLabel?: string
  /** Right-hand side: name, avatar and menu button, or a sign-in button. */
  account: React.ReactNode
}

/**
 * The 64px ruled bar: lowercase logo, the two sections 24px apart at full
 * height, and the account pushed right with 8px gaps. Presentational, so the
 * component catalog can show it signed in, signed out and in each state.
 */
export function AppHeaderBar({
  current,
  hideNav = false,
  navLabel = 'メインメニュー',
  account,
}: AppHeaderBarProps) {
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-2 sm:gap-8 sm:px-6">
      <Link
        to="/"
        aria-label="atmos ホーム"
        className="text-xl leading-7 font-[650] tracking-[-0.04em] hover:underline hover:underline-offset-4"
      >
        atmos
      </Link>
      {hideNav ? null : (
        <nav aria-label={navLabel} className="flex h-full items-center gap-3 sm:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={current === item.section ? 'page' : undefined}
              className="flex h-full items-center text-sm text-muted-foreground hover:underline hover:underline-offset-4 aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-2">{account}</div>
    </header>
  )
}

export interface AppHeaderProps {
  user: UserWithEmail | null
  loading: boolean
}

/** The header every page gets, pinned to the top. */
export function AppHeader({ user, loading }: AppHeaderProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const isSetup = pathname === '/setup'
  return (
    <div className="sticky top-0 z-40">
      <AppHeaderBar
        current={navSectionOf(pathname)}
        hideNav={isSetup}
        account={
          isSetup ? (
            <span className="text-xs text-muted-foreground">初回セットアップ</span>
          ) : (
            <UserMenu user={user} loading={loading} />
          )
        }
      />
    </div>
  )
}
