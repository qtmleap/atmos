import { describe, expect, test } from 'bun:test'
import {
  devTokenPreview,
  parseReissueOpen,
  tokensSearchSchema,
} from '../../src/app/lib/token-search'

describe('tokensSearchSchema', () => {
  test('keeps dialog=reissue and drops anything else', () => {
    expect(tokensSearchSchema.parse({ dialog: 'reissue' })).toEqual({ dialog: 'reissue' })
    expect(tokensSearchSchema.parse({ dialog: 'other' })).toEqual({ dialog: undefined })
    expect(tokensSearchSchema.parse({})).toEqual({})
  })

  test('parseReissueOpen is true only for reissue', () => {
    expect(parseReissueOpen('reissue')).toBe(true)
    expect(parseReissueOpen(undefined)).toBe(false)
  })
})

describe('devTokenPreview', () => {
  test('maps the issued and revoked scenarios to the request they replay', () => {
    expect(devTokenPreview('?scenario=issued')).toBe('issue')
    expect(devTokenPreview('?scenario=revoked')).toBe('revoke')
  })

  test('anything else replays nothing', () => {
    expect(devTokenPreview('')).toBeNull()
    expect(devTokenPreview('?scenario=none')).toBeNull()
    expect(devTokenPreview('?dialog=reissue')).toBeNull()
  })
})
