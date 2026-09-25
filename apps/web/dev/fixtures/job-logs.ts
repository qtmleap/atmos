// The log lines of the baseline jobs in job-detail.ts, as the mocks print them.
import type { LogLine } from '../../src/shared/types'

export type LogSpec = readonly [time: string, stream: LogLine['stream'], message: string]

export const RUNNING_LOGS: readonly LogSpec[] = [
  ['09:42:00.125', 'stdout', '[eval] validation started: 128 samples'],
  ['09:42:08.731', 'stdout', '[eval] step=48000 val/loss=0.2108'],
  ['09:42:12.306', 'stdout', '[media] uploaded mel/generated, sample/generated'],
  ['09:42:18.092', 'stdout', '[train] step=48000 loss=0.1824 lr=0.0001200 grad_norm=1.842'],
]

export const FAILED_LOGS: readonly LogSpec[] = [
  ...RUNNING_LOGS,
  ['09:42:23.804', 'stdout', '[train] epoch=156 step=48100 batch_size=32'],
  ['09:42:24.016', 'stderr', 'Traceback (most recent call last):'],
  ['09:42:24.016', 'stderr', '  File "/workspace/vits/train.py", line 287, in train_and_evaluate'],
  ['09:42:24.016', 'stderr', '    loss_gen_all.backward()'],
  [
    '09:42:24.017',
    'stderr',
    '  File "/opt/venv/lib/python3.11/site-packages/torch/_tensor.py", line 581, in backward',
  ],
  [
    '09:42:24.017',
    'stderr',
    '    torch.autograd.backward(self, gradient, retain_graph, create_graph)',
  ],
  [
    '09:42:24.018',
    'stderr',
    'torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 256.00 MiB.',
  ],
  [
    '09:42:24.018',
    'stderr',
    'GPU 0 has a total capacity of 23.69 GiB of which 112.25 MiB is free.',
  ],
  [
    '09:42:24.018',
    'stderr',
    'Including non-PyTorch memory, this process has 23.58 GiB memory in use.',
  ],
  ['09:42:24.124', 'stdout', '[atmos] run finished: status=failed'],
]

export const FINISHED_LOGS: readonly LogSpec[] = [
  ['21:29:00.125', 'stdout', '[eval] validation started: 128 samples'],
  ['21:29:08.731', 'stdout', '[eval] step=200000 val/loss=0.2108'],
  [
    '21:29:12.306',
    'stdout',
    '[media] uploaded mel/generated, mel/reference, alignment, sample/generated; step=200000',
  ],
  ['21:29:18.092', 'stdout', '[train] step=200000 loss=0.1824 lr=0.0001200 grad_norm=1.842'],
  ['21:30:00.000', 'stdout', '[train] completed: step=200000 max_steps=200000'],
]

export const toLogLines = (jobId: string, specs: readonly LogSpec[]): LogLine[] =>
  specs.map(([time, stream, message], index) => ({
    id: String(index + 1),
    job_id: jobId,
    stream,
    message,
    logged_at: `2026-09-24T${time}Z`,
  }))
