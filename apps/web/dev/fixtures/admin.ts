// User management: GET/POST /api/admin/users and PATCH /api/admin/users/:id
// (designs/pages/admin.html).
//
// The mock's list is its own cast (伊藤 陽菜, 渡辺 湊 ... with e-mail
// addresses), not the members of users.html, so the rows are kept here
// rather than derived from users.ts. The wire type has no total, so the
// first page just signals that a next one exists. The signed-in user is the
// only admin, so demoting them answers 409 like the real API.
import {
  type AdminCreateUserRequest,
  type AdminUpdateUserRequest,
  HANDLE_PATTERN,
  ROLES,
  type Role,
  type UserWithEmail,
} from '../../src/shared/types'
import { ME } from './me'
import { apiError, type FixtureHandler, json, notFound, paginate } from './respond'

const account = (
  handle: string,
  displayName: string,
  email: string,
  role: Role,
  createdAt: string,
): UserWithEmail => ({
  id: `usr_${handle}`,
  handle,
  display_name: displayName,
  avatar_url: null,
  role,
  created_at: createdAt,
  cf_access_email: email,
})

/** The eight rows of admin.html, in its order. */
const LISTED: readonly UserWithEmail[] = [
  ME,
  account('yuto_s', '佐藤 悠斗', 'yuto.sato@example.com', 'user', '2026-08-02T09:00:00Z'),
  account('aoi_ml', '鈴木 葵', 'aoi.suzuki@example.com', 'user', '2026-08-03T09:00:00Z'),
  account('ren_t', '高橋 蓮', 'ren.takahashi@example.com', 'user', '2026-08-04T09:00:00Z'),
  account('hina_ito', '伊藤 陽菜', 'hina.ito@example.com', 'user', '2026-08-05T09:00:00Z'),
  account('minato_w', '渡辺 湊', 'minato.watanabe@example.com', 'user', '2026-08-06T09:00:00Z'),
  account('yui_y', '山本 結衣', 'yui.yamamoto@example.com', 'user', '2026-08-07T09:00:00Z'),
  account('sho_n', '中村 翔', 'sho.nakamura@example.com', 'user', '2026-08-08T09:00:00Z'),
]

/** Past the first page; not drawn in the mock. */
const MORE: readonly UserWithEmail[] = [
  account('daiki_k', '小林 大輝', 'daiki.kobayashi@example.com', 'user', '2026-08-09T09:00:00Z'),
  account('mio_kato', '加藤 美緒', 'mio.kato@example.com', 'user', '2026-08-10T09:00:00Z'),
  account('kaito_y', '吉田 海斗', 'kaito.yoshida@example.com', 'user', '2026-08-11T09:00:00Z'),
  account('rio_y', '山田 莉緒', 'rio.yamada@example.com', 'user', '2026-08-12T09:00:00Z'),
]

const ACCOUNTS: readonly UserWithEmail[] = [...LISTED, ...MORE]

export const listAdminUsers: FixtureHandler = ({ url }) =>
  json(paginate(ACCOUNTS, url, LISTED.length))

const isRole = (value: unknown): value is Role => ROLES.some((role) => role === value)

const isCreateRequest = (value: unknown): value is AdminCreateUserRequest =>
  typeof value === 'object' &&
  value !== null &&
  'cf_access_email' in value &&
  typeof value.cf_access_email === 'string' &&
  value.cf_access_email.includes('@') &&
  'handle' in value &&
  typeof value.handle === 'string' &&
  HANDLE_PATTERN.test(value.handle) &&
  'display_name' in value &&
  typeof value.display_name === 'string' &&
  value.display_name !== '' &&
  'role' in value &&
  isRole(value.role)

/** Answers like a create (201) but keeps nothing: the fixtures are read-only. */
export const createAdminUser: FixtureHandler = async ({ json: body }) => {
  const request = await body()
  if (!isCreateRequest(request)) {
    return apiError(400, 'validation_error', 'cf_access_email, handle, display_name, role')
  }
  const taken = ACCOUNTS.some(
    (row) => row.handle === request.handle || row.cf_access_email === request.cf_access_email,
  )
  if (taken) {
    return apiError(409, 'conflict', 'handle or cf_access_email is already in use')
  }
  return json(
    account(
      request.handle,
      request.display_name,
      request.cf_access_email,
      request.role,
      '2026-09-24T14:32:00Z',
    ),
    201,
  )
}

const isUpdateRequest = (value: unknown): value is AdminUpdateUserRequest =>
  typeof value === 'object' && value !== null && (!('role' in value) || isRole(value.role))

export const updateAdminUser: FixtureHandler = async ({ params, json: body }) => {
  const target = ACCOUNTS.find((row) => row.id === params.user_id)
  if (target === undefined) {
    return notFound(`user ${params.user_id}`)
  }
  const request = await body()
  if (!isUpdateRequest(request)) {
    return apiError(400, 'validation_error', 'role must be admin or user')
  }
  const admins = ACCOUNTS.filter((row) => row.role === 'admin')
  if (request.role === 'user' && target.role === 'admin' && admins.length <= 1) {
    return apiError(409, 'conflict', 'cannot demote the last admin')
  }
  return json(request.role === undefined ? target : { ...target, role: request.role })
}
