// Per-resource OGP tags for the SPA (docs/PLAN.md §6).
//
// For GET /projects/:project_id, /projects/:project_id/jobs/:job_id and
// /users/:handle the Worker fetches index.html from the ASSETS binding, looks
// the resource up in D1 and rewrites <title> and the og:/twitter: <meta> tags
// before returning it, so link unfurlers (Slack etc.) show the real name. Every
// other request falls through to `next()`.
//
// Link unfurlers are anonymous, so only public projects expose their name.
// A private project, a missing resource or a D1 failure gets the plain
// index.html: the SPA itself decides what to show.
import { and, eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { type Db, jobs, projects, users } from '#schema'
import { type AppEnv, getPlatform } from '../platform/context'
import type { StaticAssets } from '../platform/types'

export const SITE_NAME = 'atmos'

export interface OgpMeta {
  title: string
  description: string
  /** Absolute URL. */
  image: string | null
}

type OgpTarget =
  | { kind: 'project'; projectId: string }
  | { kind: 'job'; projectId: string; jobId: string }
  | { kind: 'user'; handle: string }

const PROJECT_PATH = /^\/projects\/([^/]+)\/?$/
const JOB_PATH = /^\/projects\/([^/]+)\/jobs\/([^/]+)\/?$/
const USER_PATH = /^\/users\/([^/]+)\/?$/

const decodeSegment = (segment: string | undefined): string | null => {
  if (segment === undefined) {
    return null
  }
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/** Which OGP page `pathname` is, or null when it is not one of them. */
export const matchOgpTarget = (pathname: string): OgpTarget | null => {
  const job = JOB_PATH.exec(pathname)
  if (job !== null) {
    const projectId = decodeSegment(job[1])
    const jobId = decodeSegment(job[2])
    return projectId === null || jobId === null ? null : { kind: 'job', projectId, jobId }
  }
  const project = PROJECT_PATH.exec(pathname)
  if (project !== null) {
    const projectId = decodeSegment(project[1])
    return projectId === null ? null : { kind: 'project', projectId }
  }
  const user = USER_PATH.exec(pathname)
  if (user !== null) {
    const handle = decodeSegment(user[1])
    return handle === null ? null : { kind: 'user', handle }
  }
  return null
}

const lookupMeta = async (db: Db, target: OgpTarget, origin: string): Promise<OgpMeta | null> => {
  switch (target.kind) {
    case 'project': {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, target.projectId), eq(projects.visibility, 'public')),
      })
      return project === undefined
        ? null
        : { title: project.name, description: `${project.name} on ${SITE_NAME}`, image: null }
    }
    case 'job': {
      const rows = await db
        .select({ projectName: projects.name, jobName: jobs.name })
        .from(jobs)
        .innerJoin(projects, eq(jobs.projectId, projects.id))
        .where(
          and(
            eq(jobs.id, target.jobId),
            eq(projects.id, target.projectId),
            eq(projects.visibility, 'public'),
          ),
        )
        .limit(1)
      const row = rows[0]
      if (row === undefined) {
        return null
      }
      const title = row.jobName === null ? row.projectName : `${row.jobName} · ${row.projectName}`
      return { title, description: `${row.projectName} on ${SITE_NAME}`, image: null }
    }
    case 'user': {
      const user = await db.query.users.findFirst({ where: eq(users.handle, target.handle) })
      if (user === undefined) {
        return null
      }
      const image =
        user.avatarKey === null
          ? null
          : new URL(`/api/users/${encodeURIComponent(user.handle)}/avatar`, origin).toString()
      return {
        title: user.displayName,
        description: `@${user.handle} on ${SITE_NAME}`,
        image,
      }
    }
  }
}

export const escapeHtmlAttribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** The <meta> tags appended to <head>. */
export const renderOgpTags = (meta: OgpMeta, url: string): string => {
  const tags: Array<[attribute: 'property' | 'name', key: string, content: string]> = [
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:type', 'website'],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:url', url],
    ['name', 'description', meta.description],
    ['name', 'twitter:card', meta.image === null ? 'summary' : 'summary_large_image'],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
  ]
  if (meta.image !== null) {
    tags.push(['property', 'og:image', meta.image], ['name', 'twitter:image', meta.image])
  }
  return tags
    .map(
      ([attribute, key, content]) =>
        `<meta ${attribute}="${escapeHtmlAttribute(key)}" content="${escapeHtmlAttribute(content)}">`,
    )
    .join('')
}

/** Rewrites an HTML response: sets <title>, drops existing og:/twitter:/description tags, appends new ones. */
export const rewriteHtmlWithOgp = (html: Response, meta: OgpMeta, url: string): Response => {
  const rewritten = new HTMLRewriter()
    .on('title', {
      element(element) {
        element.setInnerContent(`${meta.title} | ${SITE_NAME}`)
      },
    })
    .on('meta[property^="og:"], meta[name^="twitter:"], meta[name="description"]', {
      element(element) {
        element.remove()
      },
    })
    .on('head', {
      element(element) {
        element.append(renderOgpTags(meta, url), { html: true })
      },
    })
    .transform(html)
  const headers = new Headers(rewritten.headers)
  // The body now depends on D1, so the asset's validators no longer describe it.
  headers.delete('ETag')
  headers.delete('Content-Length')
  headers.set('Cache-Control', 'no-cache')
  return new Response(rewritten.body, { status: rewritten.status, headers })
}

/** index.html of the SPA, fetched through the static assets (the ASSETS binding on Cloudflare). */
export const fetchIndexHtml = (assets: StaticAssets, requestUrl: string): Promise<Response> =>
  assets.fetch(new Request(new URL('/', requestUrl), { method: 'GET' }))

export const ogpMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const target = c.req.method === 'GET' ? matchOgpTarget(c.req.path) : null
  if (target === null) {
    await next()
    return
  }
  const platform = getPlatform(c)
  const html = await fetchIndexHtml(platform.assets, c.req.url)
  const contentType = html.headers.get('Content-Type')
  if (!html.ok || contentType === null || !contentType.startsWith('text/html')) {
    return html
  }
  const url = new URL(c.req.url)
  const meta = await lookupMeta(platform.db, target, url.origin).catch((error: unknown) => {
    console.error('OGP lookup failed', error)
    return null
  })
  if (meta === null) {
    return html
  }
  return rewriteHtmlWithOgp(html, meta, `${url.origin}${url.pathname}`)
}
