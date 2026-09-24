// Dictionary of NotFound (intlayer.config.ts): the first page to go through
// Intlayer; the rest of the app still has its Japanese inline.
import { type Dictionary, t } from 'intlayer'

const notFoundContent = {
  key: 'not-found',
  content: {
    title: t({ ja: 'ページが見つかりません', en: 'Page not found' }),
    before: t({ ja: 'アドレスを確かめるか、', en: 'Check the address or go back to the ' }),
    link: t({ ja: 'プロジェクト一覧', en: 'project list' }),
    after: t({ ja: 'に戻ってください。', en: '.' }),
  },
} satisfies Dictionary

export default notFoundContent
