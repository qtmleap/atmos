import { useParams } from '@tanstack/react-router'

/**
 * A path parameter the route file guarantees (src/app/routes). Missing means
 * the page was mounted under the wrong route, which is a programming error.
 */
export function useRequiredParam(name: string): string {
  const params: Record<string, string | undefined> = useParams({ strict: false })
  const value = params[name]
  if (value === undefined) {
    throw new Error(`route parameter :${name} is missing`)
  }
  return value
}
