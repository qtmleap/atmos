// Row factories for integration tests. Each returns the inserted row.
import { generateAccessToken, hashAccessToken } from '../../src/api/lib/auth'
import { newId, now } from '../../src/api/lib/ids'
import {
  accessTokens,
  createDb,
  type JobRow,
  jobs,
  type ProjectRow,
  projects,
  type UserRow,
  users,
} from '../../src/db/schema'

const counter = { value: 0 }
const nextSuffix = (): string => {
  counter.value += 1
  return `${counter.value}`
}

export const insertUser = async (
  d1: D1Database,
  overrides: Partial<UserRow> = {},
): Promise<UserRow> => {
  const suffix = nextSuffix()
  const row: UserRow = {
    id: newId(),
    handle: `user${suffix}`,
    displayName: `User ${suffix}`,
    avatarKey: null,
    cfAccessEmail: `user${suffix}@example.com`,
    role: 'user',
    createdAt: now(),
    ...overrides,
  }
  await createDb(d1).insert(users).values(row)
  return row
}

export const insertProject = async (
  d1: D1Database,
  owner: UserRow,
  overrides: Partial<ProjectRow> = {},
): Promise<ProjectRow> => {
  const row: ProjectRow = {
    id: newId(),
    name: `project ${nextSuffix()}`,
    visibility: 'public',
    ownerId: owner.id,
    createdAt: now(),
    ...overrides,
  }
  await createDb(d1).insert(projects).values(row)
  return row
}

export const insertJob = async (
  d1: D1Database,
  project: ProjectRow,
  overrides: Partial<JobRow> = {},
): Promise<JobRow> => {
  const row: JobRow = {
    id: newId(),
    projectId: project.id,
    name: null,
    status: 'running',
    config: {},
    createdBy: project.ownerId,
    startedAt: now(),
    finishedAt: null,
    ...overrides,
  }
  await createDb(d1).insert(jobs).values(row)
  return row
}

/** Issues a token for `user` and returns its plaintext. */
export const insertAccessToken = async (
  d1: D1Database,
  user: UserRow,
  options: { revoked?: boolean } = {},
): Promise<string> => {
  const token = generateAccessToken()
  await createDb(d1)
    .insert(accessTokens)
    .values({
      id: newId(),
      userId: user.id,
      tokenHash: await hashAccessToken(token),
      issuedAt: now(),
      revokedAt: options.revoked === true ? now() : null,
    })
  return token
}
