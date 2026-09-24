import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/** Distance from the bottom (px) still counted as "at the bottom". */
const STICKY_PX = 24

export const isNearBottom = (el: {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}): boolean => el.scrollHeight - el.scrollTop - el.clientHeight <= STICKY_PX

/**
 * Keeps a scroll box pinned to its bottom while new content arrives, like
 * `tail -f`, until the user scrolls up. Content prepended at the top (older
 * lines) keeps the visible lines in place.
 */
export function useFollowScroll<E extends HTMLElement>(firstKey: string | undefined, size: number) {
  const ref = useRef<E>(null)
  const [following, setFollowing] = useState(true)
  // What the box held at the last layout. `size` changes when lines are
  // appended (the first key stays the same), which also needs a re-pin.
  const previous = useRef({ firstKey, size, scrollHeight: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }
    const before = previous.current
    if (following) {
      element.scrollTop = element.scrollHeight
    } else if (before.firstKey !== undefined && before.firstKey !== firstKey) {
      element.scrollTop += element.scrollHeight - before.scrollHeight
    }
    previous.current = { firstKey, size, scrollHeight: element.scrollHeight }
  }, [firstKey, size, following])

  const onScroll = useCallback(() => {
    const element = ref.current
    if (element !== null) {
      setFollowing(isNearBottom(element))
    }
  }, [])

  const jumpToBottom = useCallback(() => setFollowing(true), [])

  return { ref, following, onScroll, jumpToBottom }
}
