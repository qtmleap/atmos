"""標準`logging`モジュールをatmosのログ送信に橋渡しするハンドラ。"""

from __future__ import annotations

import logging
import threading
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from atmos._run import Run

# このハンドラ自身の送信処理が出すログ（SDKの警告、httpx/httpcoreのリクエストログ）。
# これらを取り込むと、送信するたびに次のログ行が生まれ、rootロガーに付けた場合は
# `finish()`後の警告を経由して無限再帰になるため、無条件で除外する。
_EXCLUDED_LOGGER_PREFIXES = ("atmos", "httpx", "httpcore")


def _is_excluded(name: str) -> bool:
    return any(
        name == prefix or name.startswith(prefix + ".")
        for prefix in _EXCLUDED_LOGGER_PREFIXES
    )


class RunLogHandler(logging.Handler):
    """`Run.log_handler()`が返す`logging.Handler`実装。

    `WARNING`以上は`stream="stderr"`、それ未満は`stream="stdout"`として
    `Run.log_text()`へ橋渡しする。`atmos`・`httpx`・`httpcore`ロガーからの記録は
    取り込まない。また`emit`中に同じスレッドから再入した記録も捨てる
    （ロガー名による除外をすり抜けた場合の二重の安全策）。
    """

    def __init__(self, run: Run) -> None:
        super().__init__()
        self._run = run
        self._local = threading.local()

    def emit(self, record: logging.LogRecord) -> None:
        if _is_excluded(record.name):
            return
        if getattr(self._local, "emitting", False):
            return
        self._local.emitting = True
        try:
            message = self.format(record)
            stream: Literal["stdout", "stderr"] = (
                "stderr" if record.levelno >= logging.WARNING else "stdout"
            )
            self._run.log_text(message, stream=stream)
        except Exception:  # noqa: BLE001 - logging.Handler規約通りhandleErrorに委譲する
            self.handleError(record)
        finally:
            self._local.emitting = False
