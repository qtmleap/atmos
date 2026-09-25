import { useSyncExternalStore } from 'react'
import {
  browserThemeEnvironment,
  createThemeStore,
  type ThemePreference,
  type ThemeState,
  type ThemeStore,
} from '../lib/theme'

const store = createThemeStore(browserThemeEnvironment())

/**
 * The colour theme preference and what it resolves to. Every caller shares
 * one store, so the selector in the header and any other reader agree; the
 * `dark` class on <html> follows the resolved theme. Pass a store only in
 * tests.
 */
export function useTheme(source: ThemeStore = store): ThemeState & {
  setPreference: (preference: ThemePreference) => void
} {
  const state = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
  return {
    preference: state.preference,
    resolved: state.resolved,
    setPreference: source.setPreference,
  }
}
