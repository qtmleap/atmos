// The user list of /admin (designs/pages/admin.html): search and role filter
// above a three-column table whose last column is a role select per row.
// Presentational; state lives in useAdminUsers.
import { SearchIcon } from 'lucide-react'
import type { Role, UserWithEmail } from '@/shared/types'
import { ROLES } from '@/shared/types'
import {
  isRole,
  isRoleFilter,
  type RoleFilter,
  type RoleUpdateError,
} from '../../hooks/use-admin-users'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Input } from '../ui/input'
import { NativeSelect, NativeSelectOption } from '../ui/native-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

/** Role names as the list prints them. */
export const ROLE_NAMES: Record<Role, string> = { admin: 'admin', user: 'member' }

const ROLE_FILTER_LABELS: Record<RoleFilter, string> = {
  all: 'すべてのロール',
  admin: '管理者',
  user: 'メンバー',
}

export interface UserToolbarProps {
  query: string
  onQueryChange: (value: string) => void
  roleFilter: RoleFilter
  onRoleFilterChange: (value: RoleFilter) => void
}

export function UserToolbar({
  query,
  onQueryChange,
  roleFilter,
  onRoleFilterChange,
}: UserToolbarProps) {
  return (
    <div className="flex gap-3 pt-5 pb-4">
      <div className="relative flex-1">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="ユーザーを検索"
          placeholder="名前・ハンドル・メールアドレスで検索"
          className="pl-[34px]"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <NativeSelect
        aria-label="ロールで絞り込み"
        className="w-44"
        value={roleFilter}
        onChange={(event) => {
          if (isRoleFilter(event.target.value)) {
            onRoleFilterChange(event.target.value)
          }
        }}
      >
        {(['all', ...ROLES] satisfies RoleFilter[]).map((value) => (
          <NativeSelectOption key={value} value={value}>
            {ROLE_FILTER_LABELS[value]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

export interface UserTableProps {
  users: UserWithEmail[]
  /** Marked 「（自分）」 in the list. */
  currentUserId: string
  updatingUserId: string | null
  /** A refused role change, shown under that row's select. */
  roleError: RoleUpdateError | null
  onRoleChange: (userId: string, role: Role) => void
}

export function UserTable({
  users,
  currentUserId,
  updatingUserId,
  roleError,
  onRoleChange,
}: UserTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">ユーザー</TableHead>
          <TableHead scope="col">メールアドレス</TableHead>
          <TableHead scope="col">ロール</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const error = roleError?.userId === user.id ? roleError.message : null
          const errorId = `role-error-${user.id}`
          return (
            <TableRow key={user.id}>
              <TableCell className="py-[5px]">
                <div className="flex items-center gap-3">
                  <Avatar aria-hidden="true">
                    <AvatarImage
                      src={user.avatar_url === null ? undefined : user.avatar_url}
                      alt=""
                    />
                    <AvatarFallback>{user.display_name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p>
                      {user.display_name}
                      {user.id === currentUserId ? (
                        <span className="text-xs text-muted-foreground">（自分）</span>
                      ) : null}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">@{user.handle}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-[5px] text-xs">{user.cf_access_email}</TableCell>
              <TableCell className="py-[5px]">
                <Select
                  value={user.role}
                  disabled={updatingUserId === user.id}
                  onValueChange={(value) => {
                    if (isRole(value)) {
                      onRoleChange(user.id, value)
                    }
                  }}
                >
                  <SelectTrigger
                    className="w-[140px]"
                    aria-label={`${user.display_name}のロール`}
                    aria-invalid={error !== null ? true : undefined}
                    aria-describedby={error !== null ? errorId : undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_NAMES[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {error !== null ? (
                  <p id={errorId} role="alert" className="text-xs text-destructive">
                    {error}
                  </p>
                ) : null}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
