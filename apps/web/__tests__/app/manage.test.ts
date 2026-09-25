import { describe, expect, test } from 'bun:test'
import {
  canManage,
  deleteConfirmed,
  jobDeleteDescription,
  projectDeleteDescription,
  validateEditProjectForm,
  validateRenameJobForm,
} from '../../src/app/lib/manage'

describe('canManage', () => {
  test('the owner can manage', () => {
    expect(canManage({ id: 'u1', role: 'user' }, 'u1')).toBe(true)
  })

  test('an admin can manage regardless of ownership', () => {
    expect(canManage({ id: 'u2', role: 'admin' }, 'u1')).toBe(true)
  })

  test('another signed-in user cannot manage', () => {
    expect(canManage({ id: 'u2', role: 'user' }, 'u1')).toBe(false)
  })

  test('a signed-out visitor cannot manage', () => {
    expect(canManage(null, 'u1')).toBe(false)
  })

  test('an unknown owner (project still loading) is not manageable', () => {
    expect(canManage({ id: 'u1', role: 'user' }, undefined)).toBe(false)
  })
})

describe('validateEditProjectForm', () => {
  test('trims the name and keeps the visibility', () => {
    expect(
      validateEditProjectForm({
        name: '  voice-synthesis  ',
        visibility: 'private',
      }),
    ).toEqual({
      success: true,
      data: { name: 'voice-synthesis', visibility: 'private' },
    })
  })

  test('rejects an empty (or whitespace-only) name', () => {
    expect(validateEditProjectForm({ name: '   ', visibility: 'public' })).toEqual({
      success: false,
      message: 'プロジェクト名を入力してください',
    })
  })
})

describe('validateRenameJobForm', () => {
  test('trims the name', () => {
    expect(validateRenameJobForm('  vits-baseline-042  ')).toEqual({
      success: true,
      data: { name: 'vits-baseline-042' },
    })
  })

  test('rejects an empty (or whitespace-only) name', () => {
    expect(validateRenameJobForm('   ')).toEqual({
      success: false,
      message: 'ジョブ名を入力してください',
    })
  })
})

describe('deleteConfirmed', () => {
  test('only the exact name enables deletion', () => {
    expect(deleteConfirmed('日本語音声合成 / VITS', '日本語音声合成 / VITS')).toBe(true)
    expect(deleteConfirmed('日本語音声合成', '日本語音声合成 / VITS')).toBe(false)
    expect(deleteConfirmed('', '日本語音声合成 / VITS')).toBe(false)
  })
})

describe('projectDeleteDescription', () => {
  test('includes the job count when known', () => {
    expect(projectDeleteDescription('日本語音声合成 / VITS', 12)).toBe(
      '日本語音声合成 / VITS と、その中のジョブ 12 件のメトリクス・ログ・メディアをすべて削除します。元に戻せません。',
    )
  })

  test('leaves the count out while the API does not send it', () => {
    expect(projectDeleteDescription('日本語音声合成 / VITS', undefined)).toBe(
      '日本語音声合成 / VITS と、その中のジョブのメトリクス・ログ・メディアをすべて削除します。元に戻せません。',
    )
  })
})

describe('jobDeleteDescription', () => {
  test('names the job', () => {
    expect(jobDeleteDescription('vits-baseline-042')).toBe(
      'vits-baseline-042 のメトリクス・ログ・メディアをすべて削除します。元に戻せません。',
    )
  })
})
