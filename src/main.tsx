import '@fontsource/young-serif/400.css'
import '@fontsource/atkinson-hyperlegible-next/400.css'
import '@fontsource/atkinson-hyperlegible-next/600.css'
import '@fontsource/atkinson-hyperlegible-next/700.css'
import './i18n'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './ui/ErrorBoundary'

// Errors outside React (startup, promises) are written to the screen for testers.
function showFatal(message: string) {
  const el =
    document.getElementById('fatal') ?? document.body.appendChild(document.createElement('pre'))
  el.id = 'fatal'
  el.setAttribute(
    'style',
    'position:fixed;inset:auto 0 0 0;max-height:50vh;overflow:auto;margin:0;padding:12px;background:#fff;color:#b3261e;font:12px monospace;white-space:pre-wrap;z-index:99999',
  )
  el.textContent =
    (el.textContent
      ? el.textContent + '\n\n'
      : 'Music Reader error. Screenshot this for Casey.\n\n') + message
}
window.addEventListener('error', (e) => showFatal(String(e.error?.stack ?? e.message)))
window.addEventListener('unhandledrejection', (e) =>
  showFatal(String((e.reason as Error)?.stack ?? e.reason)),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
