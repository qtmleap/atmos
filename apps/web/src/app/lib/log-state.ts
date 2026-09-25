// Log viewer state (docs/SPEC.md §10). Lines are kept ordered by id whatever
// order a page arrives in, so the reducer does not depend on how the API
// orders a page without a cursor. Older lines are requested with
// `before=<smallest id held>`, newer ones with `after=<largest id held>`, and
// live lines are merged in by id, so overlaps are harmless.
import type { LogLine, Page } from '@/shared/types'
import { mergeBySerialId } from './serial-id'

export type LogRequest = 'initial' | 'older' | 'newer'

export interface LogState {
  lines: LogLine[]
  /** More lines may exist before the first one held. */
  hasOlder: boolean
  /** More lines may exist after the last one held (beyond what live delivers). */
  hasNewer: boolean
  loading: LogRequest | null
  error: string | null
}

export type LogAction =
  | { type: 'reset' }
  | { type: 'request'; request: LogRequest }
  | { type: 'page'; request: LogRequest; page: Page<LogLine> }
  | { type: 'live'; lines: LogLine[] }
  | { type: 'failure'; message: string }

export const initialLogState = (): LogState => ({
  lines: [],
  hasOlder: false,
  hasNewer: false,
  loading: 'initial',
  error: null,
})

export const logReducer = (state: LogState, action: LogAction): LogState => {
  switch (action.type) {
    case 'reset':
      return initialLogState()
    case 'request':
      return { ...state, loading: action.request, error: null }
    case 'page': {
      const more = action.page.next_cursor !== null
      const lines = mergeBySerialId(state.lines, action.page.items)
      switch (action.request) {
        case 'initial':
          // Which end a cursor-less page starts from is not specified, so a
          // next_cursor may mean more lines on either side; both are offered
          // and each side settles on its own first request.
          return { lines, hasOlder: more, hasNewer: more, loading: null, error: null }
        case 'older':
          return { ...state, lines, hasOlder: more, loading: null, error: null }
        case 'newer':
          return { ...state, lines, hasNewer: more, loading: null, error: null }
      }
      return state
    }
    case 'live':
      return { ...state, lines: mergeBySerialId(state.lines, action.lines) }
    case 'failure':
      return { ...state, loading: null, error: action.message }
  }
}

export const oldestLogId = (state: LogState): string | undefined => state.lines.at(0)?.id

export const newestLogId = (state: LogState): string | undefined => state.lines.at(-1)?.id

export type StreamFilter = 'all' | LogLine['stream']

export const STREAM_FILTERS: readonly StreamFilter[] = ['all', 'stdout', 'stderr']

/** Option labels of the stream select, in the mock's wording. */
export const STREAM_FILTER_LABELS: Readonly<Record<StreamFilter, string>> = {
  all: 'すべての出力',
  stdout: '標準出力のみ',
  stderr: '標準エラーのみ',
}

export const isStreamFilter = (value: string): value is StreamFilter =>
  STREAM_FILTERS.some((filter) => filter === value)

export const filterLogLines = (lines: LogLine[], filter: StreamFilter): LogLine[] =>
  filter === 'all' ? lines : lines.filter((line) => line.stream === filter)

// ---------------------------------------------------------------------------
// Failure summary
// ---------------------------------------------------------------------------

export interface FailureSummary {
  title: string
  /** `ステップ 48,100 · torch.OutOfMemoryError · 終了直前の stderr を表示しています。` */
  description: string
}

/** Python style: `torch.OutOfMemoryError: CUDA out of memory.`, `ValueError: x`. */
const EXCEPTION_LINE = /^([A-Za-z_][\w.]*(?:Error|Exception|Interrupt))(?::|\s|$)/
const STEP_IN_MESSAGE = /\bstep=(\d+)/

const KNOWN_TITLES: readonly (readonly [RegExp, string])[] = [
  [/OutOfMemoryError|CUDA out of memory/, 'GPU メモリ不足で学習が終了しました'],
  [/KeyboardInterrupt/, '手動で中断されました'],
  [/FileNotFoundError/, 'ファイルが見つからず学習が終了しました'],
]

const titleFor = (exception: string | null): string => {
  if (exception === null) {
    return '学習が失敗しました'
  }
  const known = KNOWN_TITLES.find(([pattern]) => pattern.test(exception))
  return known === undefined ? `${exception} で学習が終了しました` : known[1]
}

/**
 * What a failed job's alert says, read from the lines held: the last
 * exception named on stderr and the last step a stdout line mentioned.
 */
export const summarizeFailure = (lines: LogLine[]): FailureSummary => {
  const exception = lines.reduceRight<string | null>((found, line) => {
    if (found !== null || line.stream !== 'stderr') {
      return found
    }
    const match = EXCEPTION_LINE.exec(line.message.trim())
    return match === null || match[1] === undefined ? null : match[1]
  }, null)
  const step = lines.reduceRight<number | null>((found, line) => {
    if (found !== null || line.stream !== 'stdout') {
      return found
    }
    const match = STEP_IN_MESSAGE.exec(line.message)
    return match === null || match[1] === undefined ? null : Number(match[1])
  }, null)
  const hasStderr = lines.some((line) => line.stream === 'stderr')
  const parts = [
    step === null ? null : `ステップ ${step.toLocaleString('en-US')}`,
    exception,
    hasStderr ? '終了直前の stderr を表示しています。' : '終了時点のログを表示しています。',
  ].filter((part): part is string => part !== null)
  return { title: titleFor(exception), description: parts.join(' · ') }
}
