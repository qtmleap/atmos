import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { useTheme } from '../../hooks/use-theme'
import { THEME_PREFERENCES, type ThemePreference } from '../../lib/theme'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

export interface ThemeToggleProps {
  value: ThemePreference
  onChange: (preference: ThemePreference) => void
}

const preferenceIcons = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
} satisfies Record<ThemePreference, typeof MonitorIcon>

/**
 * The ghost icon button at the right of the header: opens a menu of system,
 * light, dark. Presentational; the header and the catalog both use
 * ConnectedThemeToggle below.
 */
export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  const content = useIntlayer('theme-select')
  const TriggerIcon = preferenceIcons[value]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${content.label.value}: ${content[value].value}`}
        >
          <TriggerIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEME_PREFERENCES.map((preference) => {
          const PreferenceIcon = preferenceIcons[preference]
          const current = preference === value
          return (
            <DropdownMenuItem
              key={preference}
              aria-current={current ? 'true' : undefined}
              aria-label={
                current
                  ? `${content.label.value}: ${content[preference].value}${content.selected.value}`
                  : undefined
              }
              onSelect={() => onChange(preference)}
            >
              <PreferenceIcon aria-hidden="true" />
              {content[preference].value}
              {current ? (
                <span className="ml-auto">
                  <CheckIcon aria-hidden="true" />
                </span>
              ) : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** ThemeToggle wired to the shared theme store. */
export function ConnectedThemeToggle() {
  const { preference, setPreference } = useTheme()
  return <ThemeToggle value={preference} onChange={setPreference} />
}
