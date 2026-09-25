/** Which top-level section a path belongs to, for the header's aria-current. */
export type NavSection = 'projects' | 'users' | null

export function navSectionOf(pathname: string): NavSection {
  if (pathname === '/' || pathname.startsWith('/projects/')) {
    return 'projects'
  }
  if (pathname === '/users' || pathname.startsWith('/users/')) {
    return 'users'
  }
  return null
}
