// Tabs pinned to one state for the catalog. They are real Radix tabs; the
// focus sample is marked with data-preview so it shows the focus ring.
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { SampleCaption } from './catalog-section'

const tabs = [
  { value: 'metrics', label: 'メトリクス' },
  { value: 'config', label: '設定' },
  { value: 'images', label: '画像' },
  { value: 'audio', label: '音声' },
  { value: 'logs', label: 'ログ' },
]

export interface StaticTabsProps {
  caption: string
  label: string
  value: string
  focus?: string
  disabled: string[]
  panel: string
}

export function StaticTabs({ caption, label, value, focus, disabled, panel }: StaticTabsProps) {
  return (
    <Tabs value={value}>
      <SampleCaption>{caption}</SampleCaption>
      <TabsList aria-label={label}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={disabled.includes(tab.value)}
            data-preview={tab.value === focus ? 'focus' : undefined}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={value}>
        <p className="text-xs text-muted-foreground">{panel}</p>
      </TabsContent>
    </Tabs>
  )
}
