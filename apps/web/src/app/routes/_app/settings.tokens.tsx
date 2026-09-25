import { createFileRoute } from '@tanstack/react-router'
import SettingsTokensPage from '../../pages/settings-tokens'

export const Route = createFileRoute('/_app/settings/tokens')({
  component: SettingsTokensPage,
})
