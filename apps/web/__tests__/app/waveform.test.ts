import { describe, expect, test } from 'bun:test'
import {
  computePeaks,
  playedRatio,
  seekTargetForKey,
  WAVE_BARS,
  wavePath,
} from '../../src/app/lib/waveform'

describe('waveform', () => {
  test('computePeaks takes the loudest sample of each slice over all channels', () => {
    const left = new Float32Array([0.1, -0.2, 0, 0, 0.5, 0.1])
    const right = new Float32Array([0, 0, -0.4, 0.1, 0, 0])
    const peaks = computePeaks([left, right], 3)
    for (const [index, expected] of [0.4, 0.8, 1].entries()) {
      expect(peaks[index]).toBeCloseTo(expected, 5)
    }
  })

  test('computePeaks keeps silence and no data flat', () => {
    expect(computePeaks([new Float32Array(10)], 4)).toEqual([0, 0, 0, 0])
    expect(computePeaks([])).toHaveLength(WAVE_BARS)
  })

  test('computePeaks gives every bar a sample when there are fewer samples than bars', () => {
    expect(computePeaks([new Float32Array([0.5, 1])], 4)).toEqual([0.5, 0.5, 1, 1])
  })

  test('wavePath draws one centred bar per peak, silence as a 2px tick', () => {
    expect(wavePath([0, 1])).toBe('M2 19v2M6 2v36')
  })

  test('playedRatio', () => {
    expect(playedRatio(2, 8)).toBe(0.25)
    expect(playedRatio(9, 8)).toBe(1)
    expect(playedRatio(3, Number.NaN)).toBe(0)
  })

  test('seekTargetForKey', () => {
    expect(seekTargetForKey('ArrowRight', 3, 8)).toBe(4)
    expect(seekTargetForKey('ArrowLeft', 0.5, 8)).toBe(0)
    expect(seekTargetForKey('PageUp', 5, 8)).toBe(8)
    expect(seekTargetForKey('End', 1, 8)).toBe(8)
    expect(seekTargetForKey('Home', 5, 8)).toBe(0)
    expect(seekTargetForKey('a', 5, 8)).toBeNull()
    expect(seekTargetForKey('ArrowRight', 0, Number.NaN)).toBeNull()
  })
})
