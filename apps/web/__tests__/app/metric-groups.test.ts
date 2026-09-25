import { describe, expect, test } from 'bun:test'
import {
  groupMetricKeys,
  metricGroupLabel,
  OTHER_GROUP_LABEL,
} from '../../src/app/lib/metric-groups'

describe('groupMetricKeys', () => {
  test('no keys', () => {
    expect(groupMetricKeys([])).toEqual([])
  })

  test('groups by the text before the first slash, in order of first appearance', () => {
    const groups = groupMetricKeys(['train/loss', 'val/loss', 'train/acc', 'val/acc'])
    expect(groups).toEqual([
      { prefix: 'train', keys: ['train/loss', 'train/acc'] },
      { prefix: 'val', keys: ['val/loss', 'val/acc'] },
    ])
  })

  test('a key without a slash, or starting with one, has no prefix', () => {
    const groups = groupMetricKeys(['lr', '/leading', 'train/loss'])
    expect(groups.map((g) => g.prefix)).toEqual(['train', null])
    expect(groups.find((g) => g.prefix === null)?.keys).toEqual(['lr', '/leading'])
  })

  test('the no-prefix group is placed last', () => {
    const groups = groupMetricKeys(['lr', 'train/loss', 'grad_norm'])
    expect(groups.map((g) => g.prefix)).toEqual(['train', null])
    expect(groups.find((g) => g.prefix === null)?.keys).toEqual(['lr', 'grad_norm'])
  })

  test('the no-prefix group is omitted when there are no such keys', () => {
    const groups = groupMetricKeys(['train/loss', 'val/loss'])
    expect(groups.some((g) => g.prefix === null)).toBe(false)
  })

  test('all keys share one implicit group when none has a prefix', () => {
    expect(groupMetricKeys(['loss', 'acc'])).toEqual([{ prefix: null, keys: ['loss', 'acc'] }])
  })

  test('a nested key groups by its first segment only', () => {
    const groups = groupMetricKeys(['train/loss/mean', 'train/loss/std'])
    expect(groups).toEqual([{ prefix: 'train', keys: ['train/loss/mean', 'train/loss/std'] }])
  })
})

describe('metricGroupLabel', () => {
  test('the prefix, or the "other" label with none', () => {
    expect(metricGroupLabel({ prefix: 'train', keys: [] })).toBe('train')
    expect(metricGroupLabel({ prefix: null, keys: [] })).toBe(OTHER_GROUP_LABEL)
  })
})
