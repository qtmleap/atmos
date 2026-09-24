// An opened account menu drawn in the page flow for the catalog. Radix only
// renders menu content while open and portals it, so the specimen reuses the
// menu's shared classes on plain elements instead.
import type * as React from 'react'
import { dropdownMenuStyles } from '../../components/ui/dropdown-menu'
import { cn } from '../../lib/utils'

export interface StaticMenuItem {
  label: string
  preview?: 'hover' | 'focus'
  disabled?: boolean
  icon?: React.ReactNode
}

export interface StaticMenuProps {
  id?: string
  label: string
  name: string
  handle: string
  items: StaticMenuItem[]
  footer: StaticMenuItem
  className?: string
}

function MenuItem({ item }: { item: StaticMenuItem }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      data-disabled={item.disabled === true ? '' : undefined}
      data-highlighted={item.preview === 'hover' ? '' : undefined}
      data-preview={item.preview === 'focus' ? 'focus' : undefined}
      className={dropdownMenuStyles.item}
    >
      {item.icon}
      {item.label}
    </button>
  )
}

export function StaticMenu({ id, label, name, handle, items, footer, className }: StaticMenuProps) {
  return (
    <div
      id={id}
      role="menu"
      aria-label={label}
      className={cn(dropdownMenuStyles.content, className)}
    >
      <div className={dropdownMenuStyles.label}>
        <p>{name}</p>
        <p className="font-mono text-xs font-normal text-muted-foreground">@{handle}</p>
      </div>
      <hr className={cn(dropdownMenuStyles.separator, 'border-0')} />
      {items.map((item) => (
        <MenuItem key={item.label} item={item} />
      ))}
      <hr className={cn(dropdownMenuStyles.separator, 'border-0')} />
      <MenuItem item={footer} />
    </div>
  )
}
