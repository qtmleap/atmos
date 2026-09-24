// Wire-shape conversions from DB rows (docs/SCHEMA.md) to the response types
// of docs/SPEC.md §1 (shared/types.ts). Kept next to the route files that
// need them; nothing here talks to D1/R2 itself.
import type { ProjectRow, UserRow } from '../../db/schema'
import type { Project, ProjectOwner, User, UserWithEmail } from '../../shared/types'
import { toIsoString } from './ids'

/** `/api/users/:handle/avatar` path for a handle, independent of whether an avatar exists. */
export const avatarPath = (handle: string): string =>
  `/api/users/${encodeURIComponent(handle)}/avatar`

/** `User.avatar_url`: null when the row has no `avatar_key`. */
export const avatarUrl = (user: Pick<UserRow, 'handle' | 'avatarKey'>): string | null =>
  user.avatarKey === null ? null : avatarPath(user.handle)

export const toUser = (row: UserRow): User => ({
  id: row.id,
  handle: row.handle,
  display_name: row.displayName,
  avatar_url: avatarUrl(row),
  role: row.role,
  created_at: toIsoString(row.createdAt),
})

export const toUserWithEmail = (row: UserRow): UserWithEmail => ({
  ...toUser(row),
  cf_access_email: row.cfAccessEmail,
})

export const toProjectOwner = (owner: UserRow): ProjectOwner => ({
  id: owner.id,
  handle: owner.handle,
  display_name: owner.displayName,
})

export const toProject = (row: ProjectRow, owner: UserRow): Project => ({
  id: row.id,
  name: row.name,
  visibility: row.visibility,
  owner: toProjectOwner(owner),
  created_at: toIsoString(row.createdAt),
})
