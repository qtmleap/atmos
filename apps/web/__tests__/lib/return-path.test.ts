import { describe, expect, test } from 'bun:test'
import { safeReturnPath } from '../../src/shared/return-path'

describe('safeReturnPath', () => {
  test('keeps a path on this site, with its query', () => {
    expect(safeReturnPath('/')).toBe('/')
    expect(safeReturnPath('/projects/abc')).toBe('/projects/abc')
    expect(safeReturnPath('/projects/abc?tab=logs&x=1')).toBe('/projects/abc?tab=logs&x=1')
  })

  test('drops a fragment, which the server never receives', () => {
    expect(safeReturnPath('/projects/abc#top')).toBe('/projects/abc')
  })

  test('falls back to / when there is nothing to return to', () => {
    expect(safeReturnPath(undefined)).toBe('/')
    expect(safeReturnPath(null)).toBe('/')
    expect(safeReturnPath('')).toBe('/')
    expect(safeReturnPath('projects/abc')).toBe('/')
  })

  test('refuses anything that leaves this site', () => {
    for (const raw of [
      'https://evil.example/',
      'http://evil.example',
      '//evil.example',
      '//evil.example/path',
      '/\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      'javascript:alert(1)',
    ]) {
      expect(safeReturnPath(raw)).toBe('/')
    }
  })
})
