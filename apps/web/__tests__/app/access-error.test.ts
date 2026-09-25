import { describe, expect, test } from 'bun:test'
import { accessErrorKind, accessErrorText, splitAround } from '../../src/app/lib/access-error'
import { ApiError, errorStatus } from '../../src/app/lib/api-client'
import { homeListNote, profileListNote, profileViewer } from '../../src/app/lib/visibility-note'

describe('accessErrorKind', () => {
  test('maps 401, 403 and 404 to full-page errors', () => {
    expect(accessErrorKind(401)).toBe('signin')
    expect(accessErrorKind(403)).toBe('forbidden')
    expect(accessErrorKind(404)).toBe('not-found')
  })

  test('leaves other failures inline', () => {
    expect(accessErrorKind(500)).toBeNull()
    expect(accessErrorKind(null)).toBeNull()
  })
})

describe('accessErrorText', () => {
  test('names what was not found', () => {
    expect(accessErrorText('not-found', 'project').title).toBe('プロジェクトが見つかりません')
    expect(accessErrorText('not-found', 'job').title).toBe('ジョブが見つかりません')
  })

  test('links the project list only on the not-found page', () => {
    const text = accessErrorText('not-found', 'project')
    expect(text.linked).toBe('プロジェクト一覧')
    expect(text.description).toContain('プロジェクト一覧')
    expect(accessErrorText('signin', 'project').linked).toBeUndefined()
    expect(accessErrorText('forbidden', 'project').code).toBe('403')
  })
})

describe('splitAround', () => {
  test('cuts around the first match', () => {
    expect(splitAround('あいうえお', 'うえ')).toEqual(['あい', 'うえ', 'お'])
  })

  test('returns null when the part is absent', () => {
    expect(splitAround('あいう', 'か')).toBeNull()
  })
})

describe('errorStatus', () => {
  test('reads the status of an ApiError only', () => {
    expect(errorStatus(new ApiError(403, 'forbidden', 'x'))).toBe(403)
    expect(errorStatus(new TypeError('network'))).toBeNull()
  })
})

describe('visibility notes', () => {
  test('signed-out visitors see public projects only', () => {
    expect(homeListNote(false)).toBe('公開プロジェクトのみ表示しています。')
    expect(profileListNote(profileViewer(false, false))).toBe(
      '公開プロジェクトのみ表示しています。',
    )
  })

  test('another member sees public and members-only projects', () => {
    expect(profileViewer(true, false)).toBe('member')
    expect(profileListNote('member')).toBe('公開・メンバー限定のプロジェクトを表示しています。')
  })

  test('the owner sees every visibility', () => {
    expect(profileViewer(true, true)).toBe('self')
    expect(profileListNote('self')).toContain('非公開')
  })
})
