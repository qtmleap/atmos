"""一時的な失敗に対する再試行（指数バックオフ＋ジッタ）。

再試行の対象はネットワーク層のエラー（`httpx.TransportError`: 接続エラー・
タイムアウト）と、一時的とみなせるHTTPステータス（408, 429, 500, 502, 503, 504）。
429・503は`Retry-After`ヘッダ（秒数）があればその通りに待つ。それ以外の4xx
（400/401/404/413等）はリクエスト自体が誤っている、またはやり直しても結果が
変わらないため再試行しない。
"""

from __future__ import annotations

import logging
import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import TypeVar

import httpx

logger = logging.getLogger("atmos")

_T = TypeVar("_T")

_RETRYABLE_STATUS_CODES = frozenset({408, 429, 500, 502, 503, 504})
_HONORS_RETRY_AFTER = frozenset({429, 503})


@dataclass(frozen=True)
class RetryConfig:
    """再試行の回数・待ち時間の上限と、待機に使う関数。

    `sleep`はテストで待機時間を差し替えるための引数で、通常利用では既定の
    `time.sleep`のままでよい。
    """

    max_retries: int = 5
    initial_delay: float = 0.5
    max_delay: float = 30.0
    sleep: Callable[[float], None] = time.sleep

    def __post_init__(self) -> None:
        if self.max_retries < 0:
            raise ValueError("max_retries は0以上である必要があります")
        if self.initial_delay <= 0:
            raise ValueError("initial_delay は正の値である必要があります")
        if self.max_delay <= 0:
            raise ValueError("max_delay は正の値である必要があります")


def _retry_after_seconds(response: httpx.Response) -> float | None:
    """`Retry-After`ヘッダ（秒数のみ対応）を読む。無い、または秒数として読めなければ`None`。"""
    value = response.headers.get("retry-after")
    if value is None:
        return None
    try:
        return max(float(value), 0.0)
    except ValueError:
        # HTTP日付形式のRetry-Afterには対応しない（このSDKが話す相手のサーバーは
        # 秒数のみを送る想定）。その場合は通常の指数バックオフにフォールバックする。
        return None


def _backoff_delay(attempt: int, config: RetryConfig) -> float:
    """指数バックオフ＋ジッタの待機秒数を返す（`attempt`は0始まり）。"""
    upper = min(config.initial_delay * (2**attempt), config.max_delay)
    return random.uniform(0, upper)


def _delay_for(exc: Exception, attempt: int, config: RetryConfig) -> float | None:
    """再試行すべきでなければ`None`、すべきなら待機秒数を返す。"""
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status not in _RETRYABLE_STATUS_CODES:
            return None
        if status in _HONORS_RETRY_AFTER:
            retry_after = _retry_after_seconds(exc.response)
            if retry_after is not None:
                return retry_after
        return _backoff_delay(attempt, config)
    if isinstance(exc, httpx.TransportError):
        return _backoff_delay(attempt, config)
    return None


def call_with_retry(fn: Callable[[], _T], config: RetryConfig, *, label: str) -> _T:
    """`fn()`を呼び、一時的な失敗であれば`config`に従って再試行してから結果を返す。

    再試行対象外のエラー、または`max_retries`回再試行しても失敗した場合は、最後に
    起きた例外をそのまま送出する。
    """
    attempt = 0
    while True:
        try:
            return fn()
        except Exception as exc:
            if attempt >= config.max_retries:
                raise
            delay = _delay_for(exc, attempt, config)
            if delay is None:
                raise
            attempt += 1
            logger.warning(
                "atmos: %s failed (attempt %d/%d), retrying in %.1fs: %s",
                label,
                attempt,
                config.max_retries,
                delay,
                exc,
            )
            config.sleep(delay)
