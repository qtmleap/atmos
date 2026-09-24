// Frame shared by /settings/profile and /settings/tokens
// (designs/pages/settings-profile.html, settings-tokens.html): the page
// header, then a 216px menu and a 640px content column 48px apart.

import { Link } from '@tanstack/react-router'
import { KeyRoundIcon, UserIcon } from 'lucide-react'
import type * as React from 'react'

export type SettingsSection = 'profile' | 'tokens'

const menu = [
  { section: 'profile', to: '/settings/profile', label: 'プロフィール', Icon: UserIcon },
  { section: 'tokens', to: '/settings/tokens', label: 'アクセストークン', Icon: KeyRoundIcon },
] as const

export interface SettingsShellProps {
  current: SettingsSection
  children: React.ReactNode
}

export function SettingsShell({ current, children }: SettingsShellProps) {
  return (
    <div className="mx-auto max-w-[1312px] px-8 pt-4 pb-6">
      <header className="grid gap-4 border-b py-6">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight">設定</h1>
        <p className="leading-[22px] text-muted-foreground">
          プロフィールとアクセストークンを管理します。
        </p>
      </header>
      <div className="grid grid-cols-[216px_minmax(0,640px)] gap-12 pt-8">
        <nav aria-label="設定メニュー" className="grid content-start gap-1">
          {menu.map(({ section, to, label, Icon }) => (
            <Link
              key={section}
              to={to}
              aria-current={current === section ? 'page' : undefined}
              className="flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:bg-accent [&_svg]:size-4 [&_svg]:shrink-0"
            >
              <Icon aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  )
}

/** Sign-in gate text shared by the two settings pages. */
export function SettingsSignedOut() {
  return (
    <div className="px-4 py-16 sm:px-6">
      <h1 className="text-lg font-semibold">サインインが必要です</h1>
    </div>
  )
}
