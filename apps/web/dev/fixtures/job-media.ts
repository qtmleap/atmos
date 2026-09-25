// The media of the baseline jobs in job-detail.ts: four assets logged together
// at the job's last step (mel/generated, mel/reference, alignment and
// sample/generated), and the files served for them.
import type { MediaAsset, MediaKind } from '../../src/shared/types'
import { VITS_PROJECT_ID } from './projects'
import { binary, type FixtureResponse, notFound } from './respond'

// The mock's thumbnails are inline SVG; the same drawings are served as the
// image files, with its light-theme CSS variables written out.
const MUTED = 'oklch(0.97 0 0)'
const CHART_1 = 'oklch(0.646 0.222 41.116)'
const CHART_2 = 'oklch(0.6 0.118 184.704)'
const CHART_3 = 'oklch(0.398 0.07 227.392)'

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 120" width="560" height="240"><rect width="280" height="120" fill="${MUTED}"/>${body}</svg>`

const IMAGES: Readonly<Record<string, string>> = {
  'mel/generated': svg(
    `<g stroke="${CHART_3}" stroke-width="8" opacity=".6"><path d="M16 95V70M30 100V50M44 100V30M58 105V55M72 100V22M86 96V42M100 105V55M114 103V30M128 106V46M142 105V20M156 100V35M170 100V50M184 104V60M198 103V40M212 99V53M226 100V30M240 105V60M254 100V80"/></g><g stroke="${CHART_1}" stroke-width="3" fill="none"><path d="M14 87 44 80 74 85 104 77 134 80 164 73 194 78 224 70 258 84M14 70 44 63 74 67 104 58 134 63 164 55 194 61 224 52 258 67"/></g>`,
  ),
  'mel/reference': svg(
    `<g stroke="${CHART_3}" stroke-width="8" opacity=".6"><path d="M16 95V75M30 100V55M44 100V34M58 105V50M72 100V25M86 96V39M100 105V50M114 103V35M128 106V40M142 105V25M156 100V33M170 100V52M184 104V55M198 103V43M212 99V50M226 100V36M240 105V63M254 100V76"/></g><g stroke="${CHART_2}" stroke-width="3" fill="none"><path d="M14 86 44 81 74 83 104 78 134 79 164 74 194 77 224 72 258 82M14 69 44 64 74 65 104 60 134 61 164 56 194 59 224 54 258 65"/></g>`,
  ),
  alignment: svg(
    `<g fill="${CHART_3}"><rect x="20" y="90" width="30" height="10"/><rect x="48" y="80" width="25" height="10"/><rect x="70" y="70" width="40" height="10"/><rect x="108" y="60" width="25" height="10"/><rect x="130" y="50" width="40" height="10"/><rect x="168" y="40" width="30" height="10"/><rect x="195" y="30" width="36" height="10"/><rect x="229" y="20" width="30" height="10"/></g>`,
  ),
}

const SAMPLE_RATE = 22050
/** "0:00 / 0:08" */
const AUDIO_SECONDS = 8

/** A silent 16-bit mono WAV of the mock's length, so the player shows 0:08. */
const silentWav = (): Uint8Array => {
  const dataBytes = SAMPLE_RATE * AUDIO_SECONDS * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string) => {
    for (const [index, char] of [...text].entries()) {
      view.setUint8(offset + index, char.charCodeAt(0))
    }
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  return new Uint8Array(buffer)
}

const WAV = silentWav()

/** id, kind, label, content type, size in bytes */
type AssetSpec = readonly [id: string, kind: MediaKind, label: string, type: string, size: number]

const BASELINE_ASSETS: readonly AssetSpec[] = [
  ['med_mel_generated', 'image', 'mel/generated', 'image/png', 48213],
  ['med_mel_reference', 'image', 'mel/reference', 'image/png', 47890],
  ['med_alignment', 'image', 'alignment', 'image/png', 21504],
  ['med_sample_generated', 'audio', 'sample/generated', 'audio/wav', WAV.byteLength],
]

/** The four baseline assets of `jobId`, all logged at `step` at time `at`. */
export const baselineMedia = (jobId: string, step: number, at: string): MediaAsset[] =>
  BASELINE_ASSETS.map(([id, kind, label, contentType, size]) => ({
    id,
    job_id: jobId,
    step,
    kind,
    label,
    content_type: contentType,
    size,
    url: `/api/projects/${VITS_PROJECT_ID}/jobs/${jobId}/media/${id}`,
    logged_at: at,
  }))

/** The file of `found`; 404 when there is no drawing for its label. */
export const mediaFile = (found: MediaAsset): FixtureResponse => {
  if (found.kind === 'audio') {
    return binary('audio/wav', WAV)
  }
  const drawing = IMAGES[found.label]
  return drawing === undefined ? notFound(`media ${found.id}`) : binary('image/svg+xml', drawing)
}
