import { createFileRoute } from '@tanstack/react-router'
import SettingsProfilePage from '../../pages/settings-profile'

export const Route = createFileRoute('/_app/settings/profile')({
  component: SettingsProfilePage,
})
