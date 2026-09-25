import { describe, expect, test } from 'bun:test'
import { ApiError } from '../../src/app/lib/api-client'
import { createCurrentUserStore } from '../../src/app/lib/current-user-store'
import type { UserWithEmail } from '../../src/shared/types'

const USER: UserWithEmail = {
  id: '00000000-0000-4000-8000-000000000001',
  handle: 'alice',
  display_name: 'Alice',
  avatar_url: null,
  role: 'admin',
  created_at: '2026-09-24T00:00:00.000Z',
  cf_access_email: 'alice@example.com',
}

describe('createCurrentUserStore', () => {
  test('starts loading and loads on the first subscriber', async () => {
    const store = createCurrentUserStore(async () => USER)
    expect(store.getSnapshot()).toEqual({ user: null, loading: true })
    const unsubscribe = store.subscribe(() => {})
    await store.load()
    expect(store.getSnapshot()).toEqual({ user: USER, loading: false })
    unsubscribe()
  })

  test('401 means signed out and is not thrown', async () => {
    const store = createCurrentUserStore(async () => {
      throw new ApiError(401, 'unauthenticated', 'authentication required')
    })
    await store.load()
    expect(store.getSnapshot()).toEqual({ user: null, loading: false })
  })

  test('shares one request between concurrent loads', async () => {
    const calls: number[] = []
    const store = createCurrentUserStore(async () => {
      calls.push(1)
      return USER
    })
    await Promise.all([store.load(), store.load(), store.load()])
    expect(calls.length).toBe(1)
  })

  test('a later load (refetch) notifies subscribers with the new user', async () => {
    const users = [USER, { ...USER, display_name: 'Alice B' }]
    const store = createCurrentUserStore(async () => {
      const next = users.shift()
      if (next === undefined) {
        throw new Error('no more users')
      }
      return next
    })
    const seen: Array<string | null> = []
    store.subscribe(() => {
      const { user } = store.getSnapshot()
      seen.push(user === null ? null : user.display_name)
    })
    await store.load()
    await store.load()
    expect(store.getSnapshot().user?.display_name).toBe('Alice B')
    expect(seen.at(-1)).toBe('Alice B')
  })
})
