// Routing table of the fixture API: method + path pattern -> handler. Paths
// mirror src/api/app.ts; `:name` segments land in `request.params`. Anything
// under /api that is not listed answers 404 like the real Worker does.
import { createAdminUser, listAdminUsers, updateAdminUser } from './admin'
import {
  deleteJob,
  finishJob,
  getJob,
  getMediaFile,
  listLogs,
  listMedia,
  listMetrics,
  updateJob,
} from './job-detail'
import { listJobs } from './jobs'
import { getMe } from './me'
import { createProject, deleteProject, getProject, listProjects, updateProject } from './projects'
import { apiError, type FixtureHandler, type FixtureRequest, type FixtureResponse } from './respond'
import { getTokenStatus, issueToken, revokeToken, updateAvatar, updateProfile } from './settings'
import { getSetup, postSetup } from './setup'
import { getUser, getUserAvatar, listUserProjects, listUsers } from './users'

export type { FixtureRequest, FixtureResponse } from './respond'

interface Route {
  method: string
  pattern: string
  handler: FixtureHandler
}

const JOB = '/api/projects/:project_id/jobs/:job_id'

export const ROUTES: readonly Route[] = [
  { method: 'GET', pattern: '/api/me', handler: getMe },
  { method: 'GET', pattern: '/api/setup', handler: getSetup },
  { method: 'POST', pattern: '/api/setup', handler: postSetup },

  { method: 'GET', pattern: '/api/admin/users', handler: listAdminUsers },
  { method: 'POST', pattern: '/api/admin/users', handler: createAdminUser },
  {
    method: 'PATCH',
    pattern: '/api/admin/users/:user_id',
    handler: updateAdminUser,
  },

  { method: 'GET', pattern: '/api/users', handler: listUsers },
  { method: 'GET', pattern: '/api/users/:handle', handler: getUser },
  {
    method: 'GET',
    pattern: '/api/users/:handle/projects',
    handler: listUserProjects,
  },
  {
    method: 'GET',
    pattern: '/api/users/:handle/avatar',
    handler: getUserAvatar,
  },

  { method: 'PATCH', pattern: '/api/settings/profile', handler: updateProfile },
  { method: 'PUT', pattern: '/api/settings/avatar', handler: updateAvatar },
  { method: 'GET', pattern: '/api/settings/tokens', handler: getTokenStatus },
  { method: 'POST', pattern: '/api/settings/tokens', handler: issueToken },
  { method: 'DELETE', pattern: '/api/settings/tokens', handler: revokeToken },

  { method: 'GET', pattern: '/api/projects', handler: listProjects },
  { method: 'POST', pattern: '/api/projects', handler: createProject },
  { method: 'GET', pattern: '/api/projects/:project_id', handler: getProject },
  { method: 'PATCH', pattern: '/api/projects/:project_id', handler: updateProject },
  { method: 'DELETE', pattern: '/api/projects/:project_id', handler: deleteProject },
  {
    method: 'GET',
    pattern: '/api/projects/:project_id/jobs',
    handler: listJobs,
  },
  { method: 'GET', pattern: JOB, handler: getJob },
  { method: 'PATCH', pattern: JOB, handler: updateJob },
  { method: 'DELETE', pattern: JOB, handler: deleteJob },
  { method: 'POST', pattern: `${JOB}/finish`, handler: finishJob },
  { method: 'GET', pattern: `${JOB}/metrics`, handler: listMetrics },
  { method: 'GET', pattern: `${JOB}/logs`, handler: listLogs },
  { method: 'GET', pattern: `${JOB}/media`, handler: listMedia },
  { method: 'GET', pattern: `${JOB}/media/:media_id`, handler: getMediaFile },
]

/** `params` when `pathname` fits `pattern` segment by segment, otherwise null. */
export const matchPath = (pattern: string, pathname: string): Record<string, string> | null => {
  const expected = pattern.split('/')
  const actual = pathname.replace(/\/+$/, '').split('/')
  if (expected.length !== actual.length) {
    return null
  }
  const params: Record<string, string> = {}
  const fits = expected.every((segment, index) => {
    const value = actual[index]
    if (value === undefined) {
      return false
    }
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(value)
      return value !== ''
    }
    return segment === value
  })
  return fits ? params : null
}

/** Answers one /api request from the fixtures. */
export const handleFixtureRequest = async (
  request: Omit<FixtureRequest, 'params'>,
): Promise<FixtureResponse> => {
  const method = request.method === 'HEAD' ? 'GET' : request.method
  const matches = ROUTES.map((route) => ({
    route,
    params: matchPath(route.pattern, request.url.pathname),
  })).filter((entry) => entry.params !== null)
  const hit = matches.find((entry) => entry.route.method === method)
  if (hit === undefined || hit.params === null) {
    return matches.length > 0
      ? apiError(404, 'not_found', `${request.method} is not supported by the dev fixtures here`)
      : apiError(404, 'not_found', 'no such API endpoint in the dev fixtures')
  }
  return hit.route.handler({ ...request, params: hit.params })
}
