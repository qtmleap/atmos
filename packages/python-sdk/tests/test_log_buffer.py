from __future__ import annotations

import logging
from typing import Any

import httpx
import pytest

from atmos import _buffering
from atmos._buffering import BackgroundFlusher
from atmos._retry import RetryConfig
from atmos._run import Run
from tests._support import RecordingTransport

PROJECT_ID = "p1"
JOB_ID = "j1"
METRICS_PATH = f"/api/projects/{PROJECT_ID}/jobs/{JOB_ID}/metrics"
LOGS_PATH = f"/api/projects/{PROJECT_ID}/jobs/{JOB_ID}/logs"


def _make_run(
    transport: RecordingTransport, *, flush_interval: float, batch_size: int
) -> Run:
    transport.respond("POST", METRICS_PATH, httpx.Response(202, json={"accepted": 1}))
    transport.respond("POST", LOGS_PATH, httpx.Response(202, json={"accepted": 1}))
    client = httpx.Client(base_url="http://testserver", transport=transport)
    return Run(
        client=client,
        project_id=PROJECT_ID,
        job_id=JOB_ID,
        flush_interval=flush_interval,
        batch_size=batch_size,
        # このファイルのテストは再試行そのものではなくバッファ/flushの挙動を
        # 見るためのものなので、実際に待たされないよう再試行を無効にしておく
        # （再試行自体のテストは`test_retry.py`）。
        retry_config=RetryConfig(max_retries=0),
    )


def test_log_flushes_once_batch_size_is_reached() -> None:
    transport = RecordingTransport()
    run = _make_run(transport, flush_interval=10.0, batch_size=2)
    try:
        run.log({"loss": 0.1, "acc": 0.95}, step=1)

        requests = transport.wait_for(1, timeout=2.0)
        assert requests[0].path == METRICS_PATH
        assert requests[0].json == {
            "metrics": [
                {"step": 1, "key": "loss", "value": 0.1},
                {"step": 1, "key": "acc", "value": 0.95},
            ]
        }
    finally:
        run._flusher.stop()
        run._client.close()


def test_log_flushes_on_time_interval_even_below_batch_size() -> None:
    transport = RecordingTransport()
    run = _make_run(transport, flush_interval=0.05, batch_size=100)
    try:
        run.log({"loss": 0.1}, step=1)

        requests = transport.wait_for(1, timeout=2.0)
        assert requests[0].path == METRICS_PATH
        assert requests[0].json == {
            "metrics": [{"step": 1, "key": "loss", "value": 0.1}]
        }
    finally:
        run._flusher.stop()
        run._client.close()


def test_log_text_is_buffered_and_flushed_like_metrics() -> None:
    transport = RecordingTransport()
    run = _make_run(transport, flush_interval=0.05, batch_size=100)
    try:
        run.log_text("epoch 1 done")
        run.log_text("warning!", stream="stderr")

        requests = transport.wait_for(1, timeout=2.0)
        assert requests[0].path == LOGS_PATH
        assert requests[0].json == {
            "logs": [
                {"stream": "stdout", "message": "epoch 1 done"},
                {"stream": "stderr", "message": "warning!"},
            ]
        }
    finally:
        run._flusher.stop()
        run._client.close()


def test_send_failure_is_swallowed_and_does_not_crash_the_run() -> None:
    transport = RecordingTransport()
    transport.fail("POST", METRICS_PATH)
    run = _make_run(transport, flush_interval=0.05, batch_size=100)
    try:
        # 例外を投げないことを確認する（送信は失敗するが呼び出し側は気付かない）。
        run.log({"loss": 0.1}, step=1)

        # バックグラウンドスレッドが生きていて、次のログ送信は別エンドポイントなので成功する。
        run.log_text("still alive")
        requests = transport.wait_for(1, timeout=2.0)
        assert requests[0].path == LOGS_PATH
        assert run._flusher._thread.is_alive()
    finally:
        run._flusher.stop()
        run._client.close()


def test_log_drops_non_finite_values_and_keeps_the_rest(
    caplog: pytest.LogCaptureFixture,
) -> None:
    transport = RecordingTransport()
    run = _make_run(transport, flush_interval=60.0, batch_size=100)
    with caplog.at_level(logging.WARNING, logger="atmos"):
        run.log(
            {
                "loss": float("nan"),
                "acc": 0.5,
                "grad": float("inf"),
                "neg": float("-inf"),
            },
            step=3,
        )
    run.finish()

    metrics_requests = [r for r in transport.requests if r.path == METRICS_PATH]
    assert len(metrics_requests) == 1
    assert metrics_requests[0].json == {
        "metrics": [{"step": 3, "key": "acc", "value": 0.5}]
    }
    dropped = [r for r in caplog.records if "non-finite" in r.getMessage()]
    assert len(dropped) == 3


def test_log_drops_empty_key_and_keeps_the_rest(
    caplog: pytest.LogCaptureFixture,
) -> None:
    transport = RecordingTransport()
    run = _make_run(transport, flush_interval=60.0, batch_size=100)
    with caplog.at_level(logging.WARNING, logger="atmos"):
        run.log({"": 1.0, "acc": 0.5}, step=3)
    run.finish()

    metrics_requests = [r for r in transport.requests if r.path == METRICS_PATH]
    assert len(metrics_requests) == 1
    assert metrics_requests[0].json == {
        "metrics": [{"step": 3, "key": "acc", "value": 0.5}]
    }
    dropped = [r for r in caplog.records if "empty key" in r.getMessage()]
    assert len(dropped) == 1


def test_finish_flush_failure_preserves_the_first_error_when_metrics_and_logs_both_fail(
    caplog: pytest.LogCaptureFixture,
) -> None:
    transport = RecordingTransport()
    transport.fail("POST", METRICS_PATH)
    transport.fail("POST", LOGS_PATH)
    run = _make_run(transport, flush_interval=60.0, batch_size=100)
    run.log({"loss": 0.1}, step=1)
    run.log_text("hello")

    with (
        caplog.at_level(logging.WARNING, logger="atmos"),
        pytest.raises(httpx.ConnectError) as exc_info,
    ):
        run.finish()

    # metrics側のリクエストが先に失敗しているので、その例外が保持されて送出される。
    assert exc_info.value.request.url.path == METRICS_PATH

    # raise_on_error=Trueの経路でもmetrics/logsそれぞれの失敗について警告が出る。
    failed_warnings = [r for r in caplog.records if "failed to send" in r.getMessage()]
    assert len(failed_warnings) == 2


def test_log_text_drops_empty_message_and_keeps_the_rest(
    caplog: pytest.LogCaptureFixture,
) -> None:
    transport = RecordingTransport()
    run = _make_run(transport, flush_interval=60.0, batch_size=100)
    with caplog.at_level(logging.WARNING, logger="atmos"):
        run.log_text("")
        run.log_text("kept", stream="stderr")
    run.finish()

    logs_requests = [r for r in transport.requests if r.path == LOGS_PATH]
    assert len(logs_requests) == 1
    assert logs_requests[0].json == {"logs": [{"stream": "stderr", "message": "kept"}]}
    assert any("empty message" in r.getMessage() for r in caplog.records)


def test_flush_splits_more_than_1000_items_into_chunks() -> None:
    transport = RecordingTransport()
    # 件数でのflushが走らないようbatch_sizeを大きくし、finish()の1回で送らせる。
    run = _make_run(transport, flush_interval=60.0, batch_size=10_000)
    for step in range(2500):
        run.log({"loss": 0.1}, step=step)
        run.log_text(f"line {step}")
    run.finish()

    metrics_sizes = [
        len(r.json["metrics"])
        for r in transport.requests
        if r.path == METRICS_PATH and r.json is not None
    ]
    logs_sizes = [
        len(r.json["logs"])
        for r in transport.requests
        if r.path == LOGS_PATH and r.json is not None
    ]
    assert metrics_sizes == [1000, 1000, 500]
    assert logs_sizes == [1000, 1000, 500]
    steps = [
        item["step"]
        for r in transport.requests
        if r.path == METRICS_PATH and r.json is not None
        for item in r.json["metrics"]
    ]
    assert steps == list(range(2500))


def test_failed_chunk_does_not_stop_the_remaining_chunks() -> None:
    flusher = BackgroundFlusher(flush_interval=60.0, batch_size=10_000)
    sent: list[int] = []
    calls = 0

    def send(items: list[dict[str, Any]]) -> None:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("boom")
        sent.append(len(items))

    flusher.start(send_metrics=send, send_logs=send)
    try:
        for step in range(2100):
            flusher.add_metric({"step": step, "key": "loss", "value": 0.1})
        with pytest.raises(RuntimeError):
            flusher.flush(raise_on_error=True)
    finally:
        flusher.stop()

    assert sent == [1000, 100]


def test_background_flush_failure_requeues_the_chunk_for_the_next_flush() -> None:
    flusher = BackgroundFlusher(flush_interval=60.0, batch_size=10_000)
    attempts = 0
    received: list[list[dict[str, Any]]] = []

    def send(items: list[dict[str, Any]]) -> None:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("boom")
        received.append(items)

    flusher.start(send_metrics=send, send_logs=lambda items: None)
    try:
        flusher.add_metric({"step": 1, "key": "loss", "value": 0.1})
        flusher.flush(raise_on_error=False)  # 1回目: 失敗し、先頭へ戻される
        assert flusher._metrics == [{"step": 1, "key": "loss", "value": 0.1}]

        flusher.add_metric({"step": 2, "key": "loss", "value": 0.2})
        flusher.flush(
            raise_on_error=False
        )  # 2回目: 戻した分+新規分が時系列順に送られる
        assert received == [
            [
                {"step": 1, "key": "loss", "value": 0.1},
                {"step": 2, "key": "loss", "value": 0.2},
            ]
        ]
        assert flusher._metrics == []
    finally:
        flusher.stop()


def test_final_flush_does_not_requeue_failed_chunks() -> None:
    """`raise_on_error=True`（`Run.finish()`の最終flush）は失敗した塊を戻さない。"""
    flusher = BackgroundFlusher(flush_interval=60.0, batch_size=10_000)

    def always_fail(items: list[dict[str, Any]]) -> None:
        raise RuntimeError("boom")

    flusher.start(send_metrics=always_fail, send_logs=lambda items: None)
    try:
        flusher.add_metric({"step": 1, "key": "loss", "value": 0.1})
        with pytest.raises(RuntimeError):
            flusher.flush(raise_on_error=True)
        assert flusher._metrics == []
    finally:
        flusher.stop()


def test_requeued_items_are_capped_and_drop_the_oldest(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(_buffering, "MAX_BUFFERED_ITEMS", 3)
    flusher = BackgroundFlusher(flush_interval=60.0, batch_size=10_000)

    def always_fail(items: list[dict[str, Any]]) -> None:
        raise RuntimeError("boom")

    flusher.start(send_metrics=always_fail, send_logs=lambda items: None)
    try:
        for step in range(5):
            flusher.add_metric({"step": step, "key": "loss", "value": 0.1})
        with caplog.at_level(logging.WARNING, logger="atmos"):
            flusher.flush(raise_on_error=False)

        # 上限3件を超えた分は古い(step 0, 1)ものから捨てられ、新しい3件が残る。
        assert [item["step"] for item in flusher._metrics] == [2, 3, 4]
        assert any("exceeded" in r.getMessage() for r in caplog.records)
    finally:
        flusher.stop()
