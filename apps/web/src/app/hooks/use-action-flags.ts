// Open state of a heading's "…" menu and the dialogs it opens, kept in the
// URL (lib/manage-search.ts) so each can be linked to and the back button
// closes it. Picking a menu item closes the menu and opens its dialog in one
// navigation.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import { parseFlag } from '../lib/manage-search'

export interface ActionFlags<K extends string> {
  isOpen: (key: K) => boolean
  setOpen: (key: K, open: boolean) => void
  /** Closes the menu and opens `key`. */
  openFromMenu: (key: K) => void
}

export function useActionFlags<K extends string>(): ActionFlags<K> {
  const navigate = useNavigate()
  const search: Record<string, unknown> = useSearch({ strict: false })
  const isOpen = useCallback((key: K) => parseFlag(search[key]), [search])
  const setOpen = useCallback(
    (key: K, open: boolean) => {
      void navigate({
        to: '.',
        search: (current) => ({ ...current, [key]: open ? 1 : undefined }),
        replace: true,
      })
    },
    [navigate],
  )
  const openFromMenu = useCallback(
    (key: K) => {
      void navigate({
        to: '.',
        search: (current) => ({ ...current, menu: undefined, [key]: 1 }),
        replace: true,
      })
    },
    [navigate],
  )
  return { isOpen, setOpen, openFromMenu }
}
