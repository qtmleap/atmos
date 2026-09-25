import { afterEach, describe, expect, test } from 'bun:test'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IntlayerProvider } from 'react-intlayer'
import { ThemeToggle } from '../../src/app/components/layout/theme-toggle'
import { useTheme } from '../../src/app/hooks/use-theme'
import {
  createThemeStore,
  type DarkMediaQuery,
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeEnvironment,
  type ThemePreference,
} from '../../src/app/lib/theme'
import { installFetch, restoreFetch } from './fetch-stub'
import { primeCurrentUser } from './prime-current-user'
import { renderRoute } from './render-route'

afterEach(() => {
  cleanup()
  restoreFetch()
  document.documentElement.classList.remove('dark')
})

/** In-memory localStorage; `throwing` makes both calls fail as a locked-down page would. */
const fakeStorage = (initial: Record<string, string> = {}, throwing = false) => {
  const items = new Map(Object.entries(initial))
  return {
    items,
    storage: {
      getItem: (key: string) => {
        if (throwing) {
          throw new Error('storage disabled')
        }
        const value = items.get(key)
        return value === undefined ? null : value
      },
      setItem: (key: string, value: string) => {
        if (throwing) {
          throw new Error('storage disabled')
        }
        items.set(key, value)
      },
    },
  }
}

/** A prefers-color-scheme query the test can flip. */
const fakeMedia = (matches: boolean) => {
  const listeners = new Set<(event: { matches: boolean }) => void>()
  const media: DarkMediaQuery & { matches: boolean } = {
    matches,
    addEventListener: (_type, listener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener)
    },
  }
  return {
    media,
    listeners,
    change: (next: boolean) => {
      media.matches = next
      for (const listener of listeners) {
        listener({ matches: next })
      }
    },
  }
}

/** A detached <html> so the tests never touch the real document. */
const environment = (
  overrides: Partial<Omit<ThemeEnvironment, 'root'>> = {},
): ThemeEnvironment & { root: HTMLElement } => ({
  storage: fakeStorage().storage,
  media: fakeMedia(false).media,
  ...overrides,
  root: document.createElement('html'),
})

describe('parseThemePreference', () => {
  test('accepts the three known values', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
  })

  test('falls back to system for anything else', () => {
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference('')).toBe('system')
    expect(parseThemePreference('blue')).toBe('system')
    expect(parseThemePreference(42)).toBe('system')
  })
})

describe('resolveTheme', () => {
  test('system follows the OS, the others do not', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('createThemeStore', () => {
  test('defaults to system and resolves from the OS', () => {
    const light = createThemeStore(environment({ media: fakeMedia(false).media }))
    expect(light.getSnapshot()).toEqual({ preference: 'system', resolved: 'light' })
    const dark = createThemeStore(environment({ media: fakeMedia(true).media }))
    expect(dark.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' })
  })

  test('reads a stored preference and ignores an invalid one', () => {
    const stored = createThemeStore(
      environment({ storage: fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }).storage }),
    )
    expect(stored.getSnapshot()).toEqual({ preference: 'dark', resolved: 'dark' })
    const invalid = createThemeStore(
      environment({ storage: fakeStorage({ [THEME_STORAGE_KEY]: 'sepia' }).storage }),
    )
    expect(invalid.getSnapshot()).toEqual({ preference: 'system', resolved: 'light' })
  })

  test('switching persists the preference, not the resolved theme, and sets the class', () => {
    const { storage, items } = fakeStorage()
    const env = environment({ storage, media: fakeMedia(true).media })
    const store = createThemeStore(env)
    const seen: ThemePreference[] = []
    const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot().preference))
    expect(env.root.classList.contains('dark')).toBe(true)

    store.setPreference('light')
    expect(items.get(THEME_STORAGE_KEY)).toBe('light')
    expect(store.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' })
    expect(env.root.classList.contains('dark')).toBe(false)

    store.setPreference('system')
    expect(items.get(THEME_STORAGE_KEY)).toBe('system')
    expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' })
    expect(env.root.classList.contains('dark')).toBe(true)
    expect(seen).toEqual(['light', 'system'])
    unsubscribe()
  })

  test('follows an OS change only while the preference is system', () => {
    const os = fakeMedia(false)
    const env = environment({ media: os.media })
    const store = createThemeStore(env)
    const unsubscribe = store.subscribe(() => {})
    expect(os.listeners.size).toBe(1)

    os.change(true)
    expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' })
    expect(env.root.classList.contains('dark')).toBe(true)

    store.setPreference('light')
    expect(os.listeners.size).toBe(0)
    os.change(false)
    os.change(true)
    expect(store.getSnapshot()).toEqual({ preference: 'light', resolved: 'light' })

    store.setPreference('system')
    expect(os.listeners.size).toBe(1)
    expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' })

    unsubscribe()
    expect(os.listeners.size).toBe(0)
  })

  test('catches up with an OS change that happened while nobody was subscribed', () => {
    const os = fakeMedia(false)
    const env = environment({ media: os.media })
    const store = createThemeStore(env)
    store.subscribe(() => {})()
    expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'light' })

    os.media.matches = true
    const unsubscribe = store.subscribe(() => {})
    expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'dark' })
    expect(env.root.classList.contains('dark')).toBe(true)
    unsubscribe()
  })

  test('does not listen before the first subscriber', () => {
    const os = fakeMedia(false)
    createThemeStore(environment({ media: os.media }))
    expect(os.listeners.size).toBe(0)
  })

  test('works without storage or matchMedia', () => {
    const store = createThemeStore(environment({ storage: null, media: null }))
    expect(store.getSnapshot()).toEqual({ preference: 'system', resolved: 'light' })
    const unsubscribe = store.subscribe(() => {})
    store.setPreference('dark')
    expect(store.getSnapshot()).toEqual({ preference: 'dark', resolved: 'dark' })
    unsubscribe()
  })

  test('survives a storage that throws', () => {
    const store = createThemeStore(environment({ storage: fakeStorage({}, true).storage }))
    expect(store.getSnapshot().preference).toBe('system')
    expect(() => store.setPreference('dark')).not.toThrow()
    expect(store.getSnapshot()).toEqual({ preference: 'dark', resolved: 'dark' })
  })
})

describe('useTheme', () => {
  test('re-renders on setPreference and on an OS change in system mode', () => {
    const os = fakeMedia(false)
    const store = createThemeStore(environment({ media: os.media }))
    const { result } = renderHook(() => useTheme(store))
    expect(result.current.resolved).toBe('light')

    act(() => os.change(true))
    expect(result.current.resolved).toBe('dark')

    act(() => result.current.setPreference('light'))
    expect(result.current.preference).toBe('light')
    expect(result.current.resolved).toBe('light')
  })
})

describe('ThemeToggle', () => {
  test('shows the Monitor icon and label by default (system)', () => {
    render(
      <IntlayerProvider>
        <ThemeToggle value="system" onChange={() => {}} />
      </IntlayerProvider>,
    )
    expect(screen.getByRole('button', { name: '表示テーマ: システム' })).toBeInTheDocument()
  })

  test('opens a menu listing the three preferences with the current one marked', async () => {
    render(
      <IntlayerProvider>
        <ThemeToggle value="dark" onChange={() => {}} />
      </IntlayerProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: '表示テーマ: ダーク' }))
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['システム', 'ライト', 'ダーク'])
    expect(items[2]).toHaveAttribute('aria-current', 'true')
    expect(items[2]).toHaveAttribute('aria-label', '表示テーマ: ダーク（選択中）')
    expect(items[0]).not.toHaveAttribute('aria-current')
    expect(items[0]).not.toHaveAttribute('aria-label')
    expect(items[1]).not.toHaveAttribute('aria-current')
    expect(items[1]).not.toHaveAttribute('aria-label')
  })

  test('choosing an item reports the change and closes the menu', async () => {
    const chosen: ThemePreference[] = []
    render(
      <IntlayerProvider>
        <ThemeToggle value="system" onChange={(preference) => chosen.push(preference)} />
      </IntlayerProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: '表示テーマ: システム' }))
    expect(
      await screen.findByRole('menuitem', { name: '表示テーマ: システム（選択中）' }),
    ).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'ライト' }))
    expect(chosen).toEqual(['light'])
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('AppHeader', () => {
  test('shows the theme toggle signed out and on /setup', async () => {
    installFetch({})
    await primeCurrentUser()
    await renderRoute('/')
    expect(await screen.findByRole('button', { name: '表示テーマ: システム' })).toBeInTheDocument()
    cleanup()

    await renderRoute('/setup')
    expect(await screen.findByRole('button', { name: '表示テーマ: システム' })).toBeInTheDocument()
    expect(screen.getByText('初回セットアップ')).toBeInTheDocument()
  })

  test('choosing a theme in the menu toggles the dark class on <html>', async () => {
    installFetch({})
    await primeCurrentUser()
    await renderRoute('/')
    await userEvent.click(await screen.findByRole('button', { name: '表示テーマ: システム' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'ダーク' }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await userEvent.click(await screen.findByRole('button', { name: '表示テーマ: ダーク' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'ライト' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    await userEvent.click(await screen.findByRole('button', { name: '表示テーマ: ライト' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'システム' }))
  })
})
