import { useMemo, useState } from 'react'
import type { Project, ProjectOwner, Visibility } from '@/shared/types'
import { VISIBILITY_LABELS } from '../lib/format'
import { type PagedList, usePagedList } from './use-paged-list'

export const PROJECTS_PAGE_SIZE = 50

/** `GET /api/projects`, newest first, page by page. */
export function useProjects(): PagedList<Project> {
  return usePagedList<Project>('/api/projects', PROJECTS_PAGE_SIZE)
}

/** Value of the visibility select; `all` is the "すべての公開範囲" option. */
export type VisibilityFilter = Visibility | 'all'

/** Value of the owner select: an owner handle, or `all` for "すべての所有者". */
export type OwnerFilter = string

export const ALL = 'all'

export interface ProjectFilters {
  query: string
  visibility: VisibilityFilter
  owner: OwnerFilter
}

export const isVisibilityFilter = (value: string): value is VisibilityFilter =>
  value === ALL || value === 'public' || value === 'internal' || value === 'private'

export interface VisibilityFilterOption {
  value: VisibilityFilter
  label: string
}

/**
 * The visibility select's options, in the order shown. Signed out, only
 * "公開" can be picked (the other tiers aren't visible to a signed-out
 * visitor anyway, docs/mock-diff/designs/pages/projects.html); signed in,
 * all three in 公開 → メンバー限定 → 非公開 order.
 */
export const visibilityFilterOptions = (signedIn: boolean): VisibilityFilterOption[] => {
  const options: VisibilityFilterOption[] = [
    { value: ALL, label: 'すべての公開範囲' },
    { value: 'public', label: VISIBILITY_LABELS.public },
  ]
  if (signedIn) {
    options.push(
      { value: 'internal', label: VISIBILITY_LABELS.internal },
      { value: 'private', label: VISIBILITY_LABELS.private },
    )
  }
  return options
}

/** Distinct owners of the loaded projects, in order of first appearance. */
export const ownersOf = (projects: readonly Project[]): ProjectOwner[] => {
  const seen = new Map<string, ProjectOwner>()
  for (const project of projects) {
    if (!seen.has(project.owner.handle)) {
      seen.set(project.owner.handle, project.owner)
    }
  }
  return [...seen.values()]
}

/** Loaded projects narrowed by the toolbar: name contains the query, plus the two selects. */
export const filterProjects = (
  projects: readonly Project[],
  filters: ProjectFilters,
): Project[] => {
  const needle = filters.query.trim().toLocaleLowerCase()
  return projects.filter(
    (project) =>
      (needle === '' || project.name.toLocaleLowerCase().includes(needle)) &&
      (filters.visibility === ALL || project.visibility === filters.visibility) &&
      (filters.owner === ALL || project.owner.handle === filters.owner),
  )
}

export interface ProjectFilterState {
  filters: ProjectFilters
  setQuery: (query: string) => void
  setVisibility: (visibility: VisibilityFilter) => void
  setOwner: (owner: OwnerFilter) => void
  owners: ProjectOwner[]
  visible: Project[]
}

/** Toolbar state for a project list, applied to the pages loaded so far. */
export function useProjectFilters(projects: readonly Project[]): ProjectFilterState {
  const [query, setQuery] = useState('')
  const [visibility, setVisibility] = useState<VisibilityFilter>(ALL)
  const [owner, setOwner] = useState<OwnerFilter>(ALL)
  const filters = useMemo(() => ({ query, visibility, owner }), [query, visibility, owner])
  const owners = useMemo(() => ownersOf(projects), [projects])
  const visible = useMemo(() => filterProjects(projects, filters), [projects, filters])
  return { filters, setQuery, setVisibility, setOwner, owners, visible }
}
