// Second bun test preload (bunfig.toml), after register-dom.ts: the jest-dom
// matchers on expect, for component tests with @testing-library/react.
import { expect } from 'bun:test'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)
