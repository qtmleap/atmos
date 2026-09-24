import { createFileRoute } from '@tanstack/react-router'
import UsersListPage from '../../pages/users-list'

export const Route = createFileRoute('/_app/users/')({
  component: UsersListPage,
})
