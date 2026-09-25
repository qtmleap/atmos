// Dictionary of ThemeToggle (intlayer.config.ts). The file keeps its old
// name; only the component and export names changed.
import { type Dictionary, t } from 'intlayer'

const themeSelectContent = {
  key: 'theme-select',
  content: {
    label: t({ ja: '表示テーマ', en: 'Theme' }),
    system: t({ ja: 'システム', en: 'System' }),
    light: t({ ja: 'ライト', en: 'Light' }),
    dark: t({ ja: 'ダーク', en: 'Dark' }),
    selected: t({ ja: '（選択中）', en: ' (selected)' }),
  },
} satisfies Dictionary

export default themeSelectContent
