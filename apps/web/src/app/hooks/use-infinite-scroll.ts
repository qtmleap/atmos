import { useEffect, useRef } from 'react'

/**
 * Calls `onReach` whenever the returned ref's element scrolls into view (with
 * a margin, so the next page is requested a little before the end). Without
 * IntersectionObserver (tests, old browsers) nothing happens and the caller's
 * "load more" button is the way forward.
 */
export function useInfiniteScroll<E extends Element>(onReach: () => void, enabled: boolean) {
  const ref = useRef<E>(null)
  const callback = useRef(onReach)
  callback.current = onReach

  useEffect(() => {
    const element = ref.current
    if (!enabled || element === null || typeof IntersectionObserver === 'undefined') {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          callback.current()
        }
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled])

  return ref
}
