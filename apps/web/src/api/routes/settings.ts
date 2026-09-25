// docs/SPEC.md §5 — Settings: profile, avatar upload, access tokens.
import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { accessTokens, users } from '#schema'
import { updateProfileRequestSchema } from '../../shared/schemas'
import {
  type AccessTokenCreated,
  type AccessTokenStatus,
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  type AvatarContentType,
  type UpdateAvatarResponse,
} from '../../shared/types'
import {
  accessTokenHint,
  generateAccessToken,
  hashAccessToken,
  requireAccessUser,
} from '../lib/auth'
import { ApiError, badRequest, conflict, notFound, payloadTooLarge, readJson } from '../lib/errors'
import { newId, now, toIsoString } from '../lib/ids'
import { avatarPath, toUserWithEmail } from '../lib/serialize'
import { type AppEnv, getPlatform } from '../platform/context'

export const settingsRoutes = new Hono<AppEnv>()

const isAvatarContentType = (value: string): value is AvatarContentType =>
  AVATAR_CONTENT_TYPES.some((allowed) => allowed === value)

settingsRoutes.patch('/settings/profile', async (c) => {
  const user = await requireAccessUser(getPlatform(c), c.req.raw)
  const body = await readJson(c.req.raw, updateProfileRequestSchema)
  const db = getPlatform(c).db

  if (body.handle !== undefined && body.handle !== user.handle) {
    const existing = await db.query.users.findFirst({
      where: eq(users.handle, body.handle),
    })
    if (existing !== undefined) {
      throw conflict('handle is already in use')
    }
  }

  const patch = {
    handle: body.handle === undefined ? user.handle : body.handle,
    displayName: body.display_name === undefined ? user.displayName : body.display_name,
  }
  await db.update(users).set(patch).where(eq(users.id, user.id))
  return c.json(toUserWithEmail({ ...user, ...patch }))
})

settingsRoutes.put('/settings/avatar', async (c) => {
  const user = await requireAccessUser(getPlatform(c), c.req.raw)
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    throw badRequest('a "file" field is required')
  }
  if (!isAvatarContentType(file.type)) {
    throw new ApiError(400, 'invalid_content_type', `unsupported content type: ${file.type}`)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength > AVATAR_MAX_BYTES) {
    throw payloadTooLarge('avatar exceeds the 2MB limit')
  }

  const key = `avatars/${user.id}`
  await getPlatform(c).storage.put(key, bytes, { contentType: file.type })
  if (user.avatarKey !== key) {
    await getPlatform(c).db.update(users).set({ avatarKey: key }).where(eq(users.id, user.id))
  }

  const response: UpdateAvatarResponse = { avatar_url: avatarPath(user.handle) }
  return c.json(response)
})

settingsRoutes.get('/settings/tokens', async (c) => {
  const user = await requireAccessUser(getPlatform(c), c.req.raw)
  const db = getPlatform(c).db

  const active = await db.query.accessTokens.findFirst({
    where: and(eq(accessTokens.userId, user.id), isNull(accessTokens.revokedAt)),
    orderBy: (row, { desc }) => desc(row.issuedAt),
  })

  const response: AccessTokenStatus = {
    active:
      active === undefined
        ? null
        : {
            id: active.id,
            issued_at: toIsoString(active.issuedAt),
            revoked_at: null,
            hint: active.tokenHint,
          },
  }
  return c.json(response)
})

settingsRoutes.post('/settings/tokens', async (c) => {
  const user = await requireAccessUser(getPlatform(c), c.req.raw)
  const issuedAt = now()

  const token = generateAccessToken()
  const row = {
    id: newId(),
    userId: user.id,
    tokenHash: await hashAccessToken(token),
    tokenHint: accessTokenHint(token),
    issuedAt,
    revokedAt: null,
  }
  // A new token supersedes whatever was active before. The revoke and the
  // insert run as one batch (one round trip, one transaction) so concurrent
  // requests cannot leave two active tokens behind.
  await getPlatform(c).batch((tx) => [
    tx
      .update(accessTokens)
      .set({ revokedAt: issuedAt })
      .where(and(eq(accessTokens.userId, user.id), isNull(accessTokens.revokedAt))),
    tx.insert(accessTokens).values(row),
  ])

  const response: AccessTokenCreated = {
    id: row.id,
    issued_at: toIsoString(row.issuedAt),
    revoked_at: null,
    hint: row.tokenHint,
    token,
  }
  return c.json(response, 201)
})

settingsRoutes.delete('/settings/tokens', async (c) => {
  const user = await requireAccessUser(getPlatform(c), c.req.raw)
  const db = getPlatform(c).db

  // Revoke every active token of the user, not just the first one found.
  const revoked = await db
    .update(accessTokens)
    .set({ revokedAt: now() })
    .where(and(eq(accessTokens.userId, user.id), isNull(accessTokens.revokedAt)))
    .returning({ id: accessTokens.id })
  if (revoked.length === 0) {
    throw notFound('no active access token')
  }
  return c.body(null, 204)
})
