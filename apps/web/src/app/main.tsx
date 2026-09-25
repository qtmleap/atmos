// SPA entry point (index.html). The Worker entry is src/api/index.ts.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
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
