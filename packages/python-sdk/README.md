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

`with`文で使うと、正常終了時は`finish("finished")`、例外で抜けた場合は
`finish("failed")`が自動的に呼ばれ、元の例外はそのまま伝播する。

```python
with wb.init(project="my-project") as run:
    run.log({"loss": 0.1}, step=1)
    train()  # ここで例外が飛んでもfinish("failed")が呼ばれてから伝播する
```

## 接続先の指定

`api_url`・`token`は`wb.init()`の引数（`api_url=`/`token=`）を優先し、未指定なら環境変数
`ATMOS_API_URL`/`ATMOS_TOKEN`を使う。どちらも得られない場合は`ValueError`を送出する。

```bash
export ATMOS_API_URL="https://atmos.example.com"
export ATMOS_TOKEN="xxxxx"  # /settings/tokens で発行したアクセストークン
```

## 公開API

- `atmos.init(project, *, name=None, config=None, visibility="private", api_url=None, token=None, flush_interval=5.0, batch_size=100, max_retries=5, retry_initial_delay=0.5, retry_max_delay=30.0) -> Run`
  - `project`のget-or-create（`POST /api/projects`）→ job作成（`POST /api/projects/:project_id/jobs`）を行い`Run`を返す。
  - `visibility`は`"public"`・`"internal"`・`"private"`のいずれか。projectを新規作成するときの公開範囲で、
    同名のprojectが既にあればそちらを使い、公開範囲は変更しない。それ以外の値は`ValueError`。
    既存projectの公開範囲が指定した`visibility`と異なる場合は警告ログを出す
    （変更したい場合はWebの設定から行う）。
  - `max_retries`/`retry_initial_delay`/`retry_max_delay`で一時的な失敗への再試行の
    回数・待ち時間の上限を変更できる（詳細は後述）。
- `Run.log(metrics: dict[str, float], step: int) -> None`
- `Run.log_image(label: str, path, step: int) -> None`
- `Run.log_audio(label: str, path, step: int) -> None`
- `Run.log_text(message: str, stream: Literal["stdout", "stderr"] = "stdout") -> None`
- `Run.log_handler() -> logging.Handler` — 標準`logging`と連携するハンドラ
- `Run.finish(status: Literal["finished", "failed"] = "finished") -> None`
- `Run.project_id` / `Run.job_id` — プロパティ
- `Run`は`with`文（context manager）に対応する。`__enter__`は`self`を返し、
  `__exit__`はブロックを正常に抜ければ`finish("finished")`、例外で抜ければ
  `finish("failed")`を呼ぶ（後者で`finish()`自体が失敗しても警告ログに留めて
  元の例外は隠さない）。

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
- **一時的な失敗は自動的に再試行する**（`src/atmos/_retry.py`）: 接続エラー・
  タイムアウト（`httpx.TransportError`）と、一時的とみなせるHTTPステータス
  （408, 429, 500, 502, 503, 504）は指数バックオフ＋ジッタで再試行する
  （429・503は`Retry-After`ヘッダ（秒）があればそれに従う）。それ以外の4xx
  （400/401/404/413等）はやり直しても結果が変わらないため再試行しない。
  回数・待ち時間の上限は`atmos.init()`の`max_retries`/`retry_initial_delay`/
  `retry_max_delay`引数で変更できる（既定は最大5回、初回0.5秒、上限30秒）。
  対象はmetrics/logsの送信、mediaアップロード、`finish`のPOST、`init()`での
  project/job作成。
- **再試行を使い切った塊の扱い**: `log()`/`log_text()`のバックグラウンド
  送信（定期flush・件数flush）で再試行を使い切った塊は、破棄せずバッファの
  先頭へ戻し次回のflushで再送を試みる（`BackgroundFlusher`、
  `src/atmos/_buffering.py`）。ただし際限なく溜まり続けないよう
  `MAX_BUFFERED_ITEMS`（既定10万件）を上限に古いものから捨てる（捨てた場合は
  警告する）。一方`finish()`が呼ぶ最終flushだけは、再試行を使い切ると
  これまで通り例外として送出する（戻さない）。
- **プロセス終了時の後始末**: `finish()`を呼び忘れてプロセスが終了した場合に
  備え、`atexit`で未finishの`Run`を片付ける。未捕捉例外（`KeyboardInterrupt`
  を含む）でプロセスが終了していれば`failed`、そうでなければ`finished`として
  `finish()`を呼ぶ。未捕捉例外の有無は`sys.excepthook`を連鎖させて記録する
  （既存のフックは必ず呼ぶ）。この後始末が失敗しても警告ログに留める。
- **content_typeの推定**: `mimetypes`標準ライブラリでファイル名から推定する。
  環境によっては`.wav`が`audio/x-wav`と推定されるため、`docs/SPEC.md`が
  要求する`audio/wav`へ正規化してから許可リストと突き合わせる
  （`src/atmos/_media.py`）。許可されていない拡張子は`ValueError`を送出する。
- **ファイルサイズの上限**: 1ファイル2048KB（2,097,152バイト）まで。サーバーと同じ上限を
  送信前に確かめ、超えていれば`ValueError`を送出する（アップロードしてから413で断られるのを避ける）。
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
- **再試行によりmetrics/logsが重複することがある**: サーバー側は
  `(job_id, key, step)`や`(job_id, step)`での重複排除を行わない単純な`INSERT`
  （`apps/web/src/api/routes/metrics.ts`・`logs.ts`）のため、サーバーへの到達後に
  レスポンスだけ失われた場合など、同じ内容を再試行すると同じ内容の行が二重に
  記録される可能性がある。SDK側は冪等性キーを持たない。
- **`sys.excepthook`はプロセス全体で1回だけ差し替わる**: `atmos`を`import`した
  時点で、未捕捉例外を記録するためのフックに差し替わる（元のフックは必ず
  呼ぶので既存の動作は変わらない）。

## テスト

```
cd packages/python-sdk
uv sync
uv run pytest
```

HTTPは実サーバーを立てず、`tests/_support.py`の`RecordingTransport`
（`httpx.BaseTransport`を実装したテスト専用トランスポート）でモックしている。
