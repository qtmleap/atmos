import { createFileRoute } from '@tanstack/react-router'
import UserProfilePage from '../../pages/user-profile'

export const Route = createFileRoute('/_app/users/$handle')({
  component: UserProfilePage,
})
