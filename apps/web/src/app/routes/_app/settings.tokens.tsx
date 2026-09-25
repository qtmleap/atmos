// /settings/tokens, and with `?dialog=reissue` the reissue confirmation
// (lib/token-search.ts).
import { createFileRoute } from '@tanstack/react-router'
import { tokensSearchSchema } from '../../lib/token-search'
import SettingsTokensPage from '../../pages/settings-tokens'

export const Route = createFileRoute('/_app/settings/tokens')({
  validateSearch: tokensSearchSchema,
  component: SettingsTokensPage,
})
