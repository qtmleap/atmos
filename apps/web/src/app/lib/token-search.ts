// URL state of /settings/tokens.
//
// `?dialog=reissue` opens the "トークンを発行し直しますか？" confirmation
// (designs/pages/settings-tokens-reissue.html), the same way ?new=1 opens the
// new-project dialog (project-search.ts). The router's search codec runs values
// through JSON.parse, which leaves the bare word `reissue` as a string.
//
// `devTokenPreview` is for the dev fixture API only (dev/fixtures/settings.ts):
// the plaintext right after issuing and the notice right after revoking exist
// only as the answer to a POST or DELETE, so `?scenario=issued` and
// `?scenario=revoked` replay that request once the page has loaded.
import { z } from 'zod'

export const tokensSearchSchema = z.object({
  dialog: z.literal('reissue').optional().catch(undefined),
})

export type TokensSearch = z.infer<typeof tokensSearchSchema>

export const parseReissueOpen = (value: string | undefined): boolean => value === 'reissue'

export type TokenPreviewAction = 'issue' | 'revoke'

/** The request `?scenario=` replays under the dev fixture API, or null. */
export const devTokenPreview = (search: string): TokenPreviewAction | null => {
  const scenario = new URLSearchParams(search).get('scenario')
  if (scenario === 'issued') {
    return 'issue'
  }
  if (scenario === 'revoked') {
    return 'revoke'
  }
  return null
}
