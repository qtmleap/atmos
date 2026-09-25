// Job widgets on sample data (docs/mock-diff/designs/components/run-widgets.html):
// the real components from components/job, fed the mock's numbers and states.
// Nothing here talks to the API; the audio rows are shown mid-state without
// a clip behind them.
import { PauseIcon, PlayIcon, Volume2Icon } from 'lucide-react'
import type { LogLine, MediaAsset } from '@/shared/types'
import {
  AudioCell,
  AudioGrid,
  AudioHead,
  AudioInfo,
  AudioTime,
  AudioWave,
} from '../../components/job/audio-list'
import { ConfigPairs } from '../../components/job/config-table'
import {
  Gallery,
  GalleryCaption,
  GalleryPlaceholder,
  GalleryThumb,
} from '../../components/job/image-gallery'
import { LiveIndicator } from '../../components/job/live-indicator'
import { LogLines } from '../../components/job/log-lines'
import {
  MetricFigure,
  MetricFigureEmpty,
  MetricFigureLoading,
} from '../../components/job/metric-charts'
import { RangeInput, StepSlider } from '../../components/job/step-slider'
import { WidgetHeader } from '../../components/job/widget-header'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription } from '../../components/ui/empty-state'
import { Label } from '../../components/ui/label'
import { Separator } from '../../components/ui/separator'
import { Switch } from '../../components/ui/switch'
import { niceDomain } from '../../lib/chart-scale'
import type { JobChart, JobChartLine } from '../../lib/job-metric-view'
import { type MetricChartSpec, type MetricSeries, seriesColor } from '../../lib/metrics'
import { CatalogPage, SampleCaption, Specimen } from './catalog-section'
import { SAMPLE_PEAKS_GENERATED, SAMPLE_PEAKS_REFERENCE } from './sample-waves'

// ---------------------------------------------------------------------------
// Sample data: the mock's SVG polylines read back into values.
// ---------------------------------------------------------------------------

const LAST_STEP = 48000
const LAST_AT = '2026-09-24T09:42:18Z'
const CHART_HEIGHT = 180

interface Polyline {
  points: string
  /** Pixel x of step 0 and of `LAST_STEP`. */
  x: readonly [number, number]
  /** Pixel y of `lo` and of `hi`. */
  y: readonly [number, number]
  value: readonly [lo: number, hi: number]
}

const readSeries = (key: string, latest: number, { points, x, y, value }: Polyline) => {
  const pairs = points.split(' ').map((pair) => {
    const [px = 0, py = 0] = pair.split(',').map(Number)
    return {
      step: Math.round(((px - x[0]) / (x[1] - x[0])) * LAST_STEP),
      value: value[0] + ((y[0] - py) / (y[0] - y[1])) * (value[1] - value[0]),
    }
  })
  const last = pairs.at(-1)
  const values = pairs.map((point) => point.value)
  const series: MetricSeries = {
    key,
    points: pairs.map((point) => (point === last ? { ...point, value: latest } : point)),
    latest: { step: LAST_STEP, value: latest },
    min: Math.min(...values, latest),
    max: Math.max(...values, latest),
  }
  return series
}

const LOSS_FRAME = { x: [44, 440], y: [144, 24], value: [0.1, 1.0] } as const

const TRAIN_LOSS = readSeries('train/loss', 0.1824, {
  ...LOSS_FRAME,
  points:
    '44,35 61,48 78,43 94,64 110,60 127,82 144,78 160,94 177,90 193,102 210,98 226,111 243,107 259,118 276,114 292,124 309,119 325,127 342,124 358,130 375,126 391,132 408,130 424,134 440,133',
})
const TRAIN_LOSS_SMOOTH = readSeries('train/loss', 0.1824, {
  ...LOSS_FRAME,
  points:
    '44,35 77,49 110,60 143,79 176,90 209,98 242,107 275,114 308,119 341,124 374,126 407,130 440,133',
})
const VAL_LOSS = readSeries('val/loss', 0.2108, {
  ...LOSS_FRAME,
  points:
    '44,27 77,40 110,49 143,68 176,78 209,89 242,96 275,106 308,113 341,118 374,121 407,126 440,129',
})
const LR = readSeries('lr', 1.2e-4, {
  points:
    '52,144 84,24 116,25 148,29 180,35 212,43 244,52 276,62 308,73 340,81 372,87 404,93 440,96',
  x: [52, 440],
  y: [144, 24],
  value: [0, 3e-4],
})
const GRAD_NORM = readSeries('grad_norm', 1.842, {
  points:
    '44,40 64,80 84,56 104,95 124,73 144,90 164,102 184,75 204,98 224,105 244,92 264,108 284,101 304,109 324,96 344,110 364,102 384,111 404,106 424,110 440,107',
  x: [44, 440],
  y: [144, 24],
  value: [0, 6],
})

const single = (series: MetricSeries): MetricChartSpec => ({
  id: series.key,
  title: series.key,
  mono: true,
  series: [series],
})

const PAIR: MetricChartSpec = {
  id: 'pair:loss',
  title: '学習・検証損失',
  mono: false,
  series: [TRAIN_LOSS_SMOOTH, VAL_LOSS],
}

/** MetricFigure now draws through ChartSvg (lib/job-metric-view.ts `JobChart`) rather than a spec directly, so the catalog's static specs need a domain and per-line colours too. */
const toChartLines = (spec: MetricChartSpec): JobChartLine[] =>
  spec.series.length > 1
    ? spec.series.map((item, index) => ({
        key: item.key,
        color: index,
        dashed: index === 1,
        raw: item.points,
        smoothed: item.points,
      }))
    : spec.series.map((item) => ({
        key: item.key,
        color: seriesColor(item.key),
        dashed: false,
        raw: item.points,
        smoothed: item.points,
      }))

const toChart = (spec: MetricChartSpec): JobChart => {
  const steps = spec.series.flatMap((item) => item.points.map((point) => point.step))
  const values = spec.series.flatMap((item) => item.points.map((point) => point.value))
  return {
    id: spec.id,
    title: spec.title,
    mono: spec.mono,
    spec,
    lines: toChartLines(spec),
    xDomain: niceDomain(Math.min(...steps), Math.max(...steps), 'linear'),
    yDomain: niceDomain(Math.min(...values), Math.max(...values), 'linear'),
  }
}

const CONFIG = {
  model: 'vits',
  learning_rate: 0.0003,
  batch_size: 32,
  seed: 42,
  mixed_precision: true,
  speakers: ['speaker_01', 'speaker_02'],
  optimizer: { name: 'AdamW', betas: [0.8, 0.99] },
  resume_from: null,
}

const IMAGE_BASE = '/api/projects/prj_vits/jobs/job_vits_baseline_042/media'

const image = (id: string, label: string): MediaAsset => ({
  id,
  job_id: 'job_vits_baseline_042',
  step: LAST_STEP,
  kind: 'image',
  label,
  content_type: 'image/png',
  size: 48213,
  url: `${IMAGE_BASE}/${id}`,
  logged_at: '2026-09-24T09:42:12.306Z',
})

const IMAGES = [
  image('med_mel_generated', 'mel/generated'),
  image('med_mel_reference', 'mel/reference'),
  image('med_alignment', 'alignment'),
]

type LogSpec = readonly [time: string, stream: LogLine['stream'], message: string]

const LOG_SPECS: readonly LogSpec[] = [
  ['09:41:56.000', 'stdout', '[train] step=47900 loss=0.1841 lr=0.0001204'],
  ['09:42:00.125', 'stdout', '[eval] validation started: 128 samples'],
  ['09:42:01.042', 'stderr', 'UserWarning: audio peak exceeds 1.0; clipping sample_017'],
  ['09:42:08.731', 'stdout', '[eval] step=48000 val/loss=0.2108'],
  ['09:42:12.306', 'stdout', '[media] uploaded mel/generated, sample/generated'],
  ['09:42:18.092', 'stdout', '[train] step=48000 loss=0.1824 grad_norm=1.842'],
]

const LOGS: LogLine[] = LOG_SPECS.map(([time, stream, message], index) => ({
  id: String(index + 1),
  job_id: 'job_vits_baseline_042',
  stream,
  message,
  logged_at: `2026-09-24T${time}Z`,
}))

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const noop = () => undefined

export default function RunWidgetsCatalog() {
  return (
    <CatalogPage
      slug="run-widgets"
      eyebrow="COMPONENTS / 06"
      title="ジョブ部品"
      description="音声合成 v4 / vits-baseline-042 の見本データ。チャート・メディア・ログは外部通信を行わない静止表示です。"
      footer={['atmos · コンポーネント層 / 日時はUTC', '06 / 07 · ジョブ部品']}
    >
      <Specimen
        title="メトリクス"
        codes={['.metric-grid / .metric-chart', '.chart-svg / .chart-legend']}
        note="components/project/chart-svg.tsx を共用。各チャートは見出しと罫線のみで区切ります。"
        className="grid grid-cols-2 gap-x-8 gap-y-6"
      >
        <MetricFigure
          chart={toChart(single(TRAIN_LOSS))}
          heightClassName="h-[180px]"
          smooth={0}
          subtitle="単系列 · step 48,000"
          live={false}
          lastReceivedAt={LAST_AT}
        />
        <MetricFigure
          chart={toChart(PAIR)}
          heightClassName="h-[180px]"
          smooth={0}
          subtitle="複数系列 · 同一ジョブ"
          live
          lastReceivedAt={LAST_AT}
        />
        <MetricFigure
          chart={toChart(single(LR))}
          heightClassName="h-[180px]"
          smooth={0}
          subtitle="単系列 · step 48,000"
          live={false}
          lastReceivedAt={LAST_AT}
        />
        <MetricFigure
          chart={toChart(single(GRAD_NORM))}
          heightClassName="h-[180px]"
          smooth={0}
          subtitle="単系列 · step 48,000"
          live={false}
          lastReceivedAt={LAST_AT}
        />
        <MetricFigureLoading title="val/loss" height={CHART_HEIGHT} />
        <MetricFigureEmpty title="val/accuracy" height={CHART_HEIGHT} />
      </Specimen>
      <Specimen
        title="設定"
        codes={['.config-table / .config-pair']}
        note="configのキーと値。数値・文字列・配列・真偽値・nullを区別します。"
        className="grid grid-cols-2 gap-6"
      >
        <div>
          <WidgetHeader title="ジョブ設定" aside={<Badge variant="outline">読み取り専用</Badge>} />
          <ConfigPairs config={CONFIG} />
        </div>
        <div>
          <WidgetHeader
            title="設定なし"
            aside={<code className="text-xs text-muted-foreground">{'{}'}</code>}
          />
          <ConfigPairs config={{}} />
        </div>
      </Specimen>
      <Specimen
        title="画像ギャラリー"
        codes={['.gallery / .gallery-thumb', '.step-slider / .slider']}
        note="インラインSVGによる生成画像の見本。stepとlabelを併記。スライダーと画像は連動しません。"
      >
        <WidgetHeader
          title="画像"
          aside={<span className="text-xs text-muted-foreground">step 48,000 · 3件</span>}
        />
        <StepSlider
          id="image-step"
          label="step"
          steps={[0, 12000, 24000, 36000, 48000, 60000]}
          value={48000}
          onChange={noop}
          readout="48,000 / 60,000"
        />
        <Gallery>
          {IMAGES.map((asset) => (
            <GalleryThumb key={asset.id} asset={asset} onOpen={noop} />
          ))}
        </Gallery>
        <Gallery>
          <figure>
            <GalleryPlaceholder busy>画像を読み込み中…</GalleryPlaceholder>
            <GalleryCaption label="mel/generated" note="step 36,000" />
          </figure>
          <figure>
            <GalleryPlaceholder>
              <span>画像を読み込めませんでした</span>
              <Button variant="outline">再試行</Button>
            </GalleryPlaceholder>
            <GalleryCaption label="alignment" note="step 36,000" />
          </figure>
          <div className="grid gap-4">
            <SampleCaption>step未受信</SampleCaption>
            <Label htmlFor="image-step-disabled" className="text-muted-foreground">
              stepを選択できません
            </Label>
            <RangeInput id="image-step-disabled" min={0} max={60000} value={0} disabled readOnly />
            <span className="text-xs text-muted-foreground">画像の受信後に選択できます。</span>
          </div>
        </Gallery>
      </Specimen>
      <Specimen
        title="音声プレイヤー"
        codes={['.audio-grid / .audio-cell / .audio-wave']}
        note="停止・再生中・波形の読み込み中。波形は音声から描き、再生済みの部分を濃く塗る。波形を押すとその位置へ移る。"
      >
        <WidgetHeader
          title="音声"
          aside={<span className="text-xs text-muted-foreground">step 48,000</span>}
        />
        <AudioGrid>
          <AudioCell>
            <AudioHead>
              <Button variant="outline" size="icon" aria-label="sample/generatedを再生（見本）">
                <PlayIcon />
              </Button>
              <AudioInfo label="sample/generated" note="step 48,000 · audio/wav" />
              <AudioTime>0:00 / 0:08</AudioTime>
              <Button variant="ghost" size="icon" aria-label="sample/generatedの音量">
                <Volume2Icon />
              </Button>
            </AudioHead>
            <AudioWave
              label="sample/generated"
              peaks={SAMPLE_PEAKS_GENERATED}
              position={0}
              duration={8}
            />
          </AudioCell>
          <AudioCell>
            <AudioHead>
              <Button
                variant="outline"
                size="icon"
                data-preview="focus"
                aria-label="sample/referenceを一時停止（見本）"
              >
                <PauseIcon />
              </Button>
              <AudioInfo label="sample/reference" note="step 48,000 · 再生中" />
              <AudioTime>0:03 / 0:08</AudioTime>
              <Button variant="ghost" size="icon" aria-label="sample/referenceの音量">
                <Volume2Icon />
              </Button>
            </AudioHead>
            <AudioWave
              label="sample/reference"
              peaks={SAMPLE_PEAKS_REFERENCE}
              position={3}
              duration={8}
            />
          </AudioCell>
          <AudioCell busy>
            <AudioHead>
              <Button variant="outline" size="icon" disabled aria-label="sample/speaker_02を再生">
                <PlayIcon />
              </Button>
              <AudioInfo label="sample/speaker_02" note="step 48,000 · 波形を読み込み中" />
              <AudioTime>— / —</AudioTime>
            </AudioHead>
            <AudioWave label="sample/speaker_02" peaks={null} position={0} duration={Number.NaN} />
          </AudioCell>
        </AudioGrid>
      </Specimen>
      <Specimen
        title="ログビューア"
        codes={['.log-viewer / .log-line', '.log-stderr / .live-indicator']}
        note="時刻はUTC。stdoutとstderrは色とラベルの両方で区別。"
      >
        <WidgetHeader
          title="ログ"
          aside={
            <div className="flex items-center gap-3">
              <LiveIndicator>追従中</LiveIndicator>
              <Switch id="follow-logs" defaultChecked />
              <Label htmlFor="follow-logs">自動追従</Label>
            </div>
          }
        />
        <div className="flex items-center justify-between gap-4 py-3">
          <Button variant="outline">過去のログを読み込む</Button>
          <span className="text-xs text-muted-foreground">09:41:56 より前</span>
        </div>
        <LogLines lines={LOGS} aria-label="ジョブログの静止見本" />
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-xs text-muted-foreground">
            最新のログを表示 · 最終受信 09:42:18 UTC
          </span>
          <span className="text-xs text-muted-foreground">stdout / stderr</span>
        </div>
        <Separator />
        <div className="flex items-center gap-3 py-4">
          <Button variant="outline" disabled aria-busy="true">
            過去のログを読み込み中…
          </Button>
          <span className="text-xs text-muted-foreground">読み込み中の見本</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            追従停止中 · 過去のログを表示しています
          </span>
          <Button variant="secondary">最新のログへ</Button>
        </div>
        <EmptyState>
          <h3>ログはまだありません</h3>
          <EmptyStateDescription>SDKから送信されたログをここに表示します。</EmptyStateDescription>
        </EmptyState>
      </Specimen>
    </CatalogPage>
  )
}
