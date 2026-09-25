from __future__ import annotations

from collections.abc import Callable

import httpx
import pytest

from atmos._retry import RetryConfig, call_with_retry
from atmos._run import Run
from tests._support import RecordingTransport

PROJECT_ID = "p1"
JOB_ID = "j1"
METRICS_PATH = f"/api/projects/{PROJECT_ID}/jobs/{JOB_ID}/metrics"
FINISH_PATH = f"/api/projects/{PROJECT_ID}/jobs/{JOB_ID}/finish"


def _fake_sleep() -> tuple[list[float], Callable[[float], None]]:
    """実際には待たない`sleep`と、渡された待機秒数の記録先を返す。"""
    delays: list[float] = []
    return delays, delays.append


def _status_error(
    status: int, *, headers: dict[str, str] | None = None
) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "http://testserver/x")
    response = httpx.Response(status, request=request, headers=headers or {})
    return httpx.HTTPStatusError(f"status {status}", request=request, response=response)


def _connect_error() -> httpx.ConnectError:
    return httpx.ConnectError(
        "boom", request=httpx.Request("POST", "http://testserver/x")
    )


# --- RetryConfig -------------------------------------------------------------


def test_retry_config_rejects_negative_max_retries() -> None:
    with pytest.raises(ValueError, match="max_retries"):
        RetryConfig(max_retries=-1)


def test_retry_config_rejects_non_positive_delays() -> None:
    with pytest.raises(ValueError, match="initial_delay"):
        RetryConfig(initial_delay=0)
    with pytest.raises(ValueError, match="max_delay"):
        RetryConfig(max_delay=0)


# --- call_with_retry: 成功・打ち切り -------------------------------------------


def test_call_with_retry_succeeds_after_transient_transport_errors() -> None:
    delays, sleep = _fake_sleep()
    attempts = 0

    def flaky() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise _connect_error()
        return "ok"

    config = RetryConfig(max_retries=5, initial_delay=1.0, max_delay=10.0, sleep=sleep)
    assert call_with_retry(flaky, config, label="test") == "ok"
    assert attempts == 3
    assert len(delays) == 2


def test_call_with_retry_gives_up_after_max_retries() -> None:
    delays, sleep = _fake_sleep()
    attempts = 0

    def always_fails() -> str:
        nonlocal attempts
        attempts += 1
        raise _connect_error()

    config = RetryConfig(max_retries=2, initial_delay=0.01, max_delay=0.1, sleep=sleep)
    with pytest.raises(httpx.ConnectError):
        call_with_retry(always_fails, config, label="test")

    assert attempts == 3  # 初回 + 2回の再試行
    assert len(delays) == 2


def test_call_with_retry_succeeds_on_first_try_without_sleeping() -> None:
    delays, sleep = _fake_sleep()
    config = RetryConfig(sleep=sleep)

    assert call_with_retry(lambda: "ok", config, label="test") == "ok"
    assert delays == []


# --- call_with_retry: 4xxは再試行しない ----------------------------------------


@pytest.mark.parametrize("status", [400, 401, 404, 413])
def test_call_with_retry_does_not_retry_non_retryable_4xx(status: int) -> None:
    delays, sleep = _fake_sleep()
    attempts = 0

    def fails() -> str:
        nonlocal attempts
        attempts += 1
        raise _status_error(status)

    config = RetryConfig(sleep=sleep)
    with pytest.raises(httpx.HTTPStatusError):
        call_with_retry(fails, config, label="test")

    assert attempts == 1
    assert delays == []


# --- call_with_retry: 対象のステータス/接続エラーは再試行する ---------------------


@pytest.mark.parametrize("status", [408, 429, 500, 502, 503, 504])
def test_call_with_retry_retries_retryable_statuses(status: int) -> None:
    delays, sleep = _fake_sleep()
    attempts = 0

    def flaky() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            raise _status_error(status)
        return "ok"

    config = RetryConfig(initial_delay=0.01, max_delay=0.1, sleep=sleep)
    assert call_with_retry(flaky, config, label="test") == "ok"
    assert attempts == 2
    assert len(delays) == 1


# --- Retry-After --------------------------------------------------------------


@pytest.mark.parametrize("status", [429, 503])
def test_call_with_retry_honors_retry_after_header(status: int) -> None:
    delays, sleep = _fake_sleep()
    attempts = 0

    def flaky() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            raise _status_error(status, headers={"Retry-After": "3"})
        return "ok"

    # initial_delay/max_delayを大きくしても、Retry-Afterが優先されることを確認する。
    config = RetryConfig(initial_delay=100.0, max_delay=200.0, sleep=sleep)
    assert call_with_retry(flaky, config, label="test") == "ok"
    assert delays == [3.0]


def test_call_with_retry_falls_back_to_backoff_when_retry_after_is_missing() -> None:
    delays, sleep = _fake_sleep()
    attempts = 0

    def flaky() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            raise _status_error(429)
        return "ok"

    config = RetryConfig(initial_delay=0.01, max_delay=0.1, sleep=sleep)
    assert call_with_retry(flaky, config, label="test") == "ok"
    assert len(delays) == 1
    assert 0 <= delays[0] <= 0.1


def test_call_with_retry_ignores_retry_after_for_other_retryable_statuses() -> None:
    delays, sleep = _fake_sleep()
    attempts = 0

    def flaky() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            # 500はRetry-Afterを見ない（429/503のみ対象）。
            raise _status_error(500, headers={"Retry-After": "99"})
        return "ok"

    config = RetryConfig(initial_delay=0.01, max_delay=0.1, sleep=sleep)
    assert call_with_retry(flaky, config, label="test") == "ok"
    assert len(delays) == 1
    assert delays[0] != 99.0


# --- Run経由の結合テスト: 再試行が実際の送信に配線されていること -------------------


def test_run_retries_transient_metrics_failures_then_succeeds() -> None:
    transport = RecordingTransport()
    transport.fail("POST", METRICS_PATH, times=2)
    transport.respond("POST", METRICS_PATH, httpx.Response(202, json={"accepted": 1}))
    transport.respond(
        "POST",
        FINISH_PATH,
        httpx.Response(200, json={"id": JOB_ID, "status": "finished"}),
    )
    _, sleep = _fake_sleep()
    client = httpx.Client(base_url="http://testserver", transport=transport)
    run = Run(
        client=client,
        project_id=PROJECT_ID,
        job_id=JOB_ID,
        flush_interval=60.0,
        batch_size=100,
        retry_config=RetryConfig(initial_delay=0.01, max_delay=0.1, sleep=sleep),
    )
    run.log({"loss": 0.1}, step=1)
    run.finish()

    metrics_requests = [r for r in transport.requests if r.path == METRICS_PATH]
    assert len(metrics_requests) == 1
    assert metrics_requests[0].json == {
        "metrics": [{"step": 1, "key": "loss", "value": 0.1}]
    }


def test_run_carries_over_a_failed_metrics_chunk_after_retries_are_exhausted() -> None:
    transport = RecordingTransport()
    # 1回目のflush: 初回+1回の再試行(合計2回)がともに失敗し、再試行を使い切る。
    # 2回目のflush: 1回目の失敗+1回の再試行が成功する。
    transport.fail("POST", METRICS_PATH, times=3)
    transport.respond("POST", METRICS_PATH, httpx.Response(202, json={"accepted": 1}))
    _, sleep = _fake_sleep()
    client = httpx.Client(base_url="http://testserver", transport=transport)
    run = Run(
        client=client,
        project_id=PROJECT_ID,
        job_id=JOB_ID,
        flush_interval=60.0,
        batch_size=10_000,
        retry_config=RetryConfig(
            max_retries=1, initial_delay=0.001, max_delay=0.01, sleep=sleep
        ),
    )
    try:
        run.log({"loss": 0.1}, step=1)
        run._flusher.flush(raise_on_error=False)
        # 再試行を使い切ってもデータは失われず、バッファの先頭へ戻される。
        assert run._flusher._metrics == [{"step": 1, "key": "loss", "value": 0.1}]

        run.log({"loss": 0.2}, step=2)
        run._flusher.flush(raise_on_error=False)
        assert run._flusher._metrics == []
    finally:
        run._flusher.stop()
        run._client.close()

    metrics_requests = [r for r in transport.requests if r.path == METRICS_PATH]
    assert len(metrics_requests) == 1
    assert metrics_requests[0].json == {
        "metrics": [
            {"step": 1, "key": "loss", "value": 0.1},
            {"step": 2, "key": "loss", "value": 0.2},
        ]
    }
