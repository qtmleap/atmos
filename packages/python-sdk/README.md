# atmos

wandb代替の実験管理ツール「atmos」用の軽量Python SDK。`docs/PLAN.md` 7節・`docs/SPEC.md`（2, 6〜10節）に対応する。

## インストール

```
uv add atmos  # またはgit経由でのインストール（社内配布のみのためPyPIには出さない）
```

## 使い方

```python
import atmos as wb

run = wb.init(project="my-project", name="exp1", config={"lr": 1e-3})
run.log({"loss": 0.1, "acc": 0.95}, step=1)
run.log_image("sample", "path/to/img.png", step=1)
run.log_audio("sample", "path/to/audio.wav", step=1)
run.log_text("epoch 1 done")

import logging

logging.getLogger().addHandler(run.log_handler())  # 標準loggingの出力もログとして送信

run.finish()
```

## 接続先の指定

`api_url`・`token`は`wb.init()`の引数（`api_url=`/`token=`）を優先し、未指定なら環境変数
`ATMOS_API_URL`/`ATMOS_TOKEN`を使う。どちらも得られない場合は`ValueError`を送出する。

```bash
export ATMOS_API_URL="https://atmos.example.com"
export ATMOS_TOKEN="xxxxx"  # /settings/tokens で発行したアクセストークン
```

## 公開API

- `atmos.init(project, *, name=None, config=None, api_url=None, token=None, flush_interval=5.0, batch_size=100) -> Run`
  - `project`のget-or-create（`POST /api/projects`）→ job作成（`POST /api/projects/:project_id/jobs`）を行い`Run`を返す。
- `Run.log(metrics: dict[str, float], step: int) -> None`
- `Run.log_image(label: str, path, step: int) -> None`
- `Run.log_audio(label: str, path, step: int) -> None`
- `Run.log_text(message: str, stream: Literal["stdout", "stderr"] = "stdout") -> None`
- `Run.log_handler() -> logging.Handler` — 標準`logging`と連携するハンドラ
- `Run.finish(status: Literal["finished", "failed"] = "finished") -> None`
- `Run.project_id` / `Run.job_id` — プロパティ

## 設計判断

- **バッファとflush条件**: `log()`・`log_text()`は`Run`内部のバッファに積むだけで、
  バックグラウンドスレッドが`flush_interval`秒（デフォルト5秒）ごと、または
  バッファが`batch_size`件（デフォルト100件）に達した時点のどちらか早い方で
  まとめて送信する。件数閾値に達した通知はユーザースレッドから
  `threading.Event.set()`で即座にバックグラウンドスレッドへ伝えるが、
  実際のHTTP送信は常にバックグラウンドスレッド側で行うため`log()`自体は
  ネットワーク待ちでブロックしない。
- **`log_image`/`log_audio`は即時送信**: メトリクス・ログと異なりファイルI/Oを
  伴うため、呼び出したその場でアップロードする（バッファに積んで後から失敗を
  知るより、呼び出しタイミングでの失敗を優先する設計）。
- **失敗時の扱い**: 学習ループをクラッシュさせないことを最優先し、`log()`・
  `log_text()`・`log_image()`・`log_audio()`の送信失敗（ネットワークエラー・
  4xx/5xx）は`logging.getLogger("atmos")`への警告ログに留め、例外は投げない。
  一方`finish()`はバッファの最終flushと`finish`エンドポイント呼び出しの失敗を
  例外として送出する。`finish()`はrunの結末を確定させる最後の呼び出しであり、
  失敗を握りつぶすとrunが`running`のまま取り残されたことにユーザーが気付けない
  ため、ここだけは例外を伝播させる。
- **リトライは行わない**: v1では単純さを優先し、送信失敗時の自動リトライは
  実装していない（失敗した分のバッファは破棄される）。将来的にリトライが
  必要になった場合は`BackgroundFlusher`（`src/atmos/_buffering.py`）に
  閉じ込めて追加できる。
- **content_typeの推定**: `mimetypes`標準ライブラリでファイル名から推定する。
  環境によっては`.wav`が`audio/x-wav`と推定されるため、`docs/SPEC.md`が
  要求する`audio/wav`へ正規化してから許可リストと突き合わせる
  （`src/atmos/_media.py`）。許可されていない拡張子は`ValueError`を送出する。
- **`transport`引数**: `atmos.init(..., transport=...)`で`httpx.BaseTransport`
  （`httpx.MockTransport`等）を注入できる。主にテスト用の入口で、通常利用では
  指定不要。

## 既知の制約（並行性まわり）

- **`Run`は1つのスレッドから順に呼び出す前提**: `PLAN.md`のサンプルコードと同じ、
  単一スレッドの学習ループから`log()`→…→`finish()`と順に呼ぶ使い方を想定している。
  複数スレッドから同時に`log()`/`log_image()`/`finish()`を呼ぶことは想定しておらず、
  同期は取っていない（例えば`finish()`実行中に別スレッドから`log()`を呼ぶと、
  送信済みのバッファに追加されずデータが失われる可能性がある）。
- **`finish()`とバックグラウンドの定期flushが極めて稀に競合しうる**: `finish()`は
  `BackgroundFlusher.stop()`でバックグラウンドスレッドを止めてから最後の
  `flush(raise_on_error=True)`を行うことで、通常の利用パターン（`flush_interval`が
  数秒程度で、`finish()`呼び出しと定期flushのタイミングが一致しない）では送信失敗を
  確実に`finish()`まで伝播させる。ただし、定期flushの発火と`finish()`呼び出しが
  ごく僅かな時間差で重なった場合、定期flush側（`raise_on_error=False`）が最後の
  バッチを先に取り出して送信・失敗を警告ログに留めてしまい、後続の`finish()`側の
  flushが空バッファを見て「成功」扱いになることが理論上ありうる
  （`src/atmos/_buffering.py`の`BackgroundFlusher`参照）。`flush_interval`を極端に
  短くしない限り実運用で起きる可能性は低いが、完全にゼロではない既知のトレードオフ
  として残す。
- **httpx.Clientの既定タイムアウトにより無限ブロックはしない**: `stop()`の
  `thread.join()`にはタイムアウトを設けているが、仮にバックグラウンド側が送信中に
  タイムアウトしても、`httpx.Client`自体の既定タイムアウト（各操作5秒）により
  リクエストはいずれ完了・失敗するため、`finish()`が永久にハングすることはない。

## テスト

```
cd packages/python-sdk
uv sync
uv run pytest
```

HTTPは実サーバーを立てず、`tests/_support.py`の`RecordingTransport`
（`httpx.BaseTransport`を実装したテスト専用トランスポート）でモックしている。
