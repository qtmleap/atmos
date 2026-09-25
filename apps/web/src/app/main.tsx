// SPA entry point (index.html). The Worker entry is src/api/index.ts.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Same families as docs/mock-diff/designs/_shared/atmos.css, served from
// node_modules instead of Google Fonts. Imported here rather than through
// `@import` in globals.css: there Tailwind inlines them and has to rebase
// their `url(./files/...)`, which on the CI runner left every url unresolved,
// so the deployed CSS pointed at index.html and no face loaded. As modules of
// their own, Vite resolves each url against its own file.
import '@fontsource/ibm-plex-sans-jp/400.css'
import '@fontsource/ibm-plex-sans-jp/500.css'
import '@fontsource/ibm-plex-sans-jp/600.css'
import '@fontsource/ibm-plex-sans-jp/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './globals.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('index.html has no #root element')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
