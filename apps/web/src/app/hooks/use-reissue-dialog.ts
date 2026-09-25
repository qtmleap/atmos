// Open state of the reissue confirmation on /settings/tokens lives in
// ?dialog=reissue (lib/token-search.ts), so the dialog can be linked to and the
// back button closes it.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import { parseReissueOpen } from '../lib/token-search'

export interface UseReissueDialogResult {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function useReissueDialog(): UseReissueDialogResult {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const open = parseReissueOpen(search.dialog)
  const onOpenChange = useCallback(
    (next: boolean) => {
      void navigate({
        to: '.',
        search: (current) => ({ ...current, dialog: next ? 'reissue' : undefined }),
        replace: true,
      })
    },
    [navigate],
  )
  return { open, onOpenChange }
}
