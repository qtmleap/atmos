// Tabs pinned to one state for the catalog. They are real Radix tabs with the
// same sections, labels and order as the job detail page (JobSections).
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'

const tabs = [
  { value: 'metrics', label: 'メトリクス' },
  { value: 'media', label: '画像・音声' },
  { value: 'logs', label: 'ログ' },
]

export interface StaticTabsProps {
  label: string
  value: string
}

export function StaticTabs({ label, value }: StaticTabsProps) {
  return (
    <Tabs value={value}>
      <TabsList aria-label={label}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={value} />
    </Tabs>
  )
}
