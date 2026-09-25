// Colour theme: the preference the user picked (light, dark, or follow the
// OS) and the theme that results. The preference is what gets stored, so a
// "system" user keeps following the OS after it changes.
//
// The inline script in index.html paints the first frame from the same key
// and the same rules before React loads; keep the two in step.
import { z } from 'zod'

export const THEME_STORAGE_KEY = 'atmos-theme'

const themePreferenceSchema = z.enum(['system', 'light', 'dark'])

export type ThemePreference = z.infer<typeof themePreferenceSchema>
export type ResolvedTheme = 'light' | 'dark'

export const THEME_PREFERENCES: readonly ThemePreference[] = themePreferenceSchema.options

/** Anything but a known preference, including nothing stored, means "system". */
export const parseThemePreference = (raw: unknown): ThemePreference => {
  const parsed = themePreferenceSchema.safeParse(raw)
  return parsed.success ? parsed.data : 'system'
}

export const resolveTheme = (preference: ThemePreference, prefersDark: boolean): ResolvedTheme => {
  if (preference === 'system') {
    return prefersDark ? 'dark' : 'light'
  }
  return preference
}

export interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
}

/** The part of `matchMedia('(prefers-color-scheme: dark)')` the store uses. */
export interface DarkMediaQuery {
  readonly matches: boolean
  addEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void
  removeEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void
}

/** The browser pieces the store touches; each may be missing in a locked-down page. */
export interface ThemeEnvironment {
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  media: DarkMediaQuery | null
  /** The element that carries the `dark` class (`<html>`). */
  root: Element | null
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Reads window, document and localStorage, each behind a try/catch. */
export const browserThemeEnvironment = (): ThemeEnvironment => {
  const storage = (() => {
    try {
      return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
    } catch {
      return null
    }
  })()
  const media = (() => {
    try {
      return typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(DARK_QUERY) : null
    } catch {
      return null
    }
  })()
  const root = typeof document === 'undefined' ? null : document.documentElement
  return { storage, media, root }
}

export interface ThemeStore {
  getSnapshot: () => ThemeState
  /** Subscribes to changes; the OS is only watched while the preference is "system". */
  subscribe: (listener: () => void) => () => void
  setPreference: (preference: ThemePreference) => void
}

const readStored = (storage: ThemeEnvironment['storage']): ThemePreference => {
  if (storage === null) {
    return 'system'
  }
  try {
    return parseThemePreference(storage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

const writeStored = (storage: ThemeEnvironment['storage'], preference: ThemePreference) => {
  if (storage === null) {
    return
  }
  try {
    storage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Private mode or a full quota: the choice still applies for this page.
  }
}

const prefersDark = (media: DarkMediaQuery | null): boolean =>
  media === null ? false : media.matches

const applyToRoot = (root: Element | null, resolved: ResolvedTheme) => {
  if (root === null) {
    return
  }
  root.classList.toggle('dark', resolved === 'dark')
}

/**
 * One store per page. Reading the stored preference, following the OS and
 * setting the `dark` class all happen here, so the hook only subscribes.
 */
export const createThemeStore = (env: ThemeEnvironment): ThemeStore => {
  const listeners = new Set<() => void>()
  const initial = readStored(env.storage)
  const box: { state: ThemeState; watching: boolean } = {
    state: { preference: initial, resolved: resolveTheme(initial, prefersDark(env.media)) },
    watching: false,
  }

  const set = (state: ThemeState) => {
    box.state = state
    applyToRoot(env.root, state.resolved)
    for (const listener of listeners) {
      listener()
    }
  }

  const onMediaChange = (event: { matches: boolean }) => {
    set({ preference: 'system', resolved: resolveTheme('system', event.matches) })
  }

  // Old Safari has addListener only; a failure here just means the page
  // stops following the OS until the next load.
  const watch = () => {
    if (box.watching || env.media === null) {
      return
    }
    try {
      env.media.addEventListener('change', onMediaChange)
      box.watching = true
    } catch {
      box.watching = false
    }
  }

  const unwatch = () => {
    if (!box.watching || env.media === null) {
      return
    }
    try {
      env.media.removeEventListener('change', onMediaChange)
    } catch {
      // Nothing to undo if adding failed.
    }
    box.watching = false
  }

  const syncWatch = () => {
    if (listeners.size > 0 && box.state.preference === 'system') {
      watch()
    } else {
      unwatch()
    }
  }

  // The OS is only watched while someone is subscribed, so a "system" state
  // can go stale in between; re-resolve it before handing it out again.
  const refresh = () => {
    if (box.state.preference !== 'system') {
      return
    }
    const resolved = resolveTheme('system', prefersDark(env.media))
    if (resolved !== box.state.resolved) {
      box.state = { preference: 'system', resolved }
    }
  }

  return {
    getSnapshot: () => box.state,
    subscribe: (listener) => {
      listeners.add(listener)
      refresh()
      applyToRoot(env.root, box.state.resolved)
      syncWatch()
      return () => {
        listeners.delete(listener)
        syncWatch()
      }
    },
    setPreference: (next) => {
      const preference = parseThemePreference(next)
      writeStored(env.storage, preference)
      set({ preference, resolved: resolveTheme(preference, prefersDark(env.media)) })
      syncWatch()
    },
  }
}
