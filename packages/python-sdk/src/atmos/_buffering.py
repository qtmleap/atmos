"""バックグラウンドスレッドによるバッチ送信バッファ。

metrics・logsはユーザーの呼び出し（`Run.log()` / `Run.log_text()`）のたびに
サーバーへ送るとネットワーク往復が支配的になり学習ループを遅くしてしまうため、
一定間隔（時間）または一定件数のどちらか早い方に達した時点でまとめて送信する。

設計判断:
- 単一のバックグラウンドスレッドが `threading.Event` で待機し、`flush_interval`
  秒ごとに定期flushする。件数の閾値（`batch_size`）に達した場合は、追加した側
  （ユーザースレッド）が `Event.set()` でスレッドを即座に起こす。HTTP送信自体は
  常にバックグラウンドスレッド側で行うため、`Run.log()` はネットワーク待ちで
  ブロックしない。
- 定期flush・件数flushとも、送信失敗（ネットワークエラー・5xx等）は
  `raise_on_error=False` で行い、警告ログを出すだけで例外を投げない
  （学習ループをクラッシュさせないため）。一方 `Run.finish()` が呼ぶ最終flush
  だけは `raise_on_error=True` を指定し、失敗を呼び出し側に伝える。
- 実際の送信（`_flush_once`のバッファswap+HTTP送信）は`_flush_lock`で直列化する。
  これにより、バックグラウンドスレッドが送信中に`Run.finish()`側の明示的な
  `flush()`が同時に走って二重送信したり、送信中に呼び出し元が`httpx.Client`を
  closeしてしまったりする競合を避ける。`Run.finish()`は`stop()`で
  バックグラウンドスレッドを完全に停止させてから最後のflushを行う設計になっている
  （`_run.py`の`Run.finish()`を参照）。
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from typing import Any

logger = logging.getLogger("atmos")

_SendFn = Callable[[list[dict[str, Any]]], None]

# 1回のHTTPリクエストで送る件数の上限。サーバー側の`INGEST_METRICS_MAX_ITEMS`
# （`apps/web/src/shared/types.ts`）とlogsの同名の上限（`apps/web/src/api/routes/logs.ts`）が
# どちらも1000件なので、それに合わせる。
MAX_ITEMS_PER_REQUEST = 1000


class BackgroundFlusher:
    """metrics/logsのバッファを保持し、時間駆動・件数駆動でflushするスレッド。"""

    def __init__(self, *, flush_interval: float, batch_size: int) -> None:
        if flush_interval <= 0:
            raise ValueError("flush_interval は正の値である必要があります")
        if batch_size <= 0:
            raise ValueError("batch_size は正の値である必要があります")

        self._flush_interval = flush_interval
        self._batch_size = batch_size
        self._lock = threading.Lock()
        self._flush_lock = threading.Lock()
        self._metrics: list[dict[str, Any]] = []
        self._logs: list[dict[str, Any]] = []
        self._wake_event = threading.Event()
        self._stop_event = threading.Event()
        self._send_metrics: _SendFn | None = None
        self._send_logs: _SendFn | None = None
        self._thread = threading.Thread(
            target=self._run, name="atmos-flusher", daemon=True
        )

    def start(self, *, send_metrics: _SendFn, send_logs: _SendFn) -> None:
        self._send_metrics = send_metrics
        self._send_logs = send_logs
        self._thread.start()

    def add_metric(self, entry: dict[str, Any]) -> None:
        with self._lock:
            self._metrics.append(entry)
            should_wake = len(self._metrics) >= self._batch_size
        if should_wake:
            self._wake_event.set()

    def add_log(self, entry: dict[str, Any]) -> None:
        with self._lock:
            self._logs.append(entry)
            should_wake = len(self._logs) >= self._batch_size
        if should_wake:
            self._wake_event.set()

    def flush(self, *, raise_on_error: bool = False) -> None:
        """現在のバッファを即座に送信する。呼び出したスレッド上で同期的に行う。"""
        self._flush_once(raise_on_error=raise_on_error)

    def stop(self) -> None:
        """バックグラウンドスレッドを停止する（進行中のflushがあれば完了を待つ）。

        停止シグナルを見てから抜けるだけで、停止のために追加のflushは行わない
        （呼び出し元が`flush(raise_on_error=True)`で最後の1回を自分の責任で行える
        ようにするため。`Run.finish()`はこの順序に依存している）。
        """
        self._stop_event.set()
        self._wake_event.set()
        if self._thread.is_alive() and threading.current_thread() is not self._thread:
            self._thread.join(timeout=self._flush_interval + 1)

    def _run(self) -> None:
        while True:
            self._wake_event.wait(timeout=self._flush_interval)
            self._wake_event.clear()
            if self._stop_event.is_set():
                return
            self._flush_once(raise_on_error=False)

    def _flush_once(self, *, raise_on_error: bool) -> None:
        # `_flush_lock`は実際の送信を直列化する。バックグラウンドスレッドが送信中に
        # `Run.finish()`側の明示的なflush()が同時に走らないようにするため、送信中は
        # ここでブロックして待つ（バッファのswap自体は`_lock`で別途保護する）。
        with self._flush_lock:
            with self._lock:
                metrics, self._metrics = self._metrics, []
                logs, self._logs = self._logs, []

            error: Exception | None = None

            if metrics and self._send_metrics is not None:
                metrics_error = self._send(
                    self._send_metrics, metrics, "metrics", raise_on_error
                )
                # 最初に発生したエラー（metrics側）を保持する。両方送るのは変えず、
                # 後続のlogs側のエラーで上書きしないようにするだけ。
                error = error or metrics_error

            if logs and self._send_logs is not None:
                logs_error = self._send(self._send_logs, logs, "logs", raise_on_error)
                error = error or logs_error

            if error is not None:
                raise error

    @staticmethod
    def _send(
        send: _SendFn, items: list[dict[str, Any]], label: str, raise_on_error: bool
    ) -> Exception | None:
        """`items`を`MAX_ITEMS_PER_REQUEST`件ずつに分けて送る。

        サーバーは1リクエストあたりの件数上限を超えると413でバッチ全体を拒否するため、
        上限を超えないよう分割する。ある塊の送信に失敗しても残りの塊は送り続け、
        失敗した塊ごとに警告を出す。`raise_on_error=True`の場合はそれに加えて
        最初の失敗を呼び出し元へ返す（呼び出し元が再送出できるように）。
        """
        first_error: Exception | None = None
        for start in range(0, len(items), MAX_ITEMS_PER_REQUEST):
            chunk = items[start : start + MAX_ITEMS_PER_REQUEST]
            try:
                send(chunk)
            except (
                Exception
            ) as exc:  # 意図的に全例外を捕捉し警告(または呼び出し元への再送)に変換する
                # raise_on_error=Trueの場合でも失敗した痕跡が残るよう警告は必ず出す
                # （最初のエラーは呼び出し元へ再送する）。
                logger.warning(
                    "atmos: failed to send %d buffered %s",
                    len(chunk),
                    label,
                    exc_info=True,
                )
                if raise_on_error:
                    first_error = first_error or exc
        return first_error
