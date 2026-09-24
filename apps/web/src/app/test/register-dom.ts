// First bun test preload (bunfig.toml): a happy-dom window on globalThis.
// It must run before anything imports @testing-library/dom, whose `screen`
// binds to document.body at module load; setup.ts (the matchers) comes after.
//
// The Worker integration tests (__tests__/lib, miniflare) run in the same
// process and need Bun's own timers and networking: happy-dom's setTimeout
// returns no Node Timeout (miniflare calls `.unref()` on it) and its
// fetch/Request/Response are not the ones miniflare speaks. Those globals are
// put back after registering; component tests stub fetch themselves.
import { GlobalRegistrator } from '@happy-dom/global-registrator'

const KEEP_NATIVE = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'setImmediate',
  'clearImmediate',
  'queueMicrotask',
  'fetch',
  'Request',
  'Response',
  'Headers',
  'FormData',
  'Blob',
  'File',
  'URL',
  'URLSearchParams',
  'AbortController',
  'AbortSignal',
  'ReadableStream',
  'TextEncoder',
  'TextDecoder',
  'WebSocket',
] as const

const saved = KEEP_NATIVE.map(
  (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
)

GlobalRegistrator.register({ url: 'http://localhost/' })

for (const [key, descriptor] of saved) {
  if (descriptor !== undefined) {
    Object.defineProperty(globalThis, key, descriptor)
  }
}
