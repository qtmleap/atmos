from __future__ import annotations

import httpx
import pytest

from atmos._run import Run
from tests._support import RecordingTransport

PROJECT_ID = "p1"
JOB_ID = "j1"
METRICS_PATH = f"/api/projects/{PROJECT_ID}/jobs/{JOB_ID}/metrics"
FINISH_PATH = f"/api/projects/{PROJECT_ID}/jobs/{JOB_ID}/finish"


def _make_run(transport: RecordingTransport, *, flush_interval: float = 10.0) -> Run:
    transport.respond("POST", METRICS_PATH, httpx.Response(202, json={"accepted": 1}))
    transport.respond(
        "POST",
        FINISH_PATH,
        httpx.Response(200, json={"id": JOB_ID, "status": "finished"}),
    )
    client = httpx.Client(base_url="http://testserver", transport=transport)
    return Run(
        client=client,
        project_id=PROJECT_ID,
        job_id=JOB_ID,
        flush_interval=flush_interval,
        batch_size=100,
    )


def test_finish_flushes_buffer_before_calling_finish_endpoint() -> None:
    transport = RecordingTransport()
    # flush_intervalを長くして、finish()が明示的にflushすることだけを確認する。
    run = _make_run(transport, flush_interval=60.0)
    run.log({"loss": 0.1}, step=1)

    run.finish(status="finished")

    assert [r.path for r in transport.requests] == [METRICS_PATH, FINISH_PATH]
    assert transport.requests[1].json == {"status": "finished"}


def test_finish_is_idempotent() -> None:
    transport = RecordingTransport()
    run = _make_run(transport)

    run.finish()
    run.finish()

    assert [r.path for r in transport.requests] == [FINISH_PATH]


def test_finish_stops_background_thread() -> None:
    transport = RecordingTransport()
    run = _make_run(transport)

    run.finish()

    assert not run._flusher._thread.is_alive()


def test_log_after_finish_is_ignored_not_raised() -> None:
    transport = RecordingTransport()
    run = _make_run(transport)
    run.finish()

    # クラッシュしないことだけを確認する（サーバーには送られない）。
    run.log({"loss": 0.1}, step=1)
    run.log_text("too late")

    assert [r.path for r in transport.requests] == [FINISH_PATH]


def test_finish_raises_when_final_flush_fails() -> None:
    transport = RecordingTransport()
    transport.fail("POST", METRICS_PATH)
    run = _make_run(transport, flush_interval=60.0)
    run.log({"loss": 0.1}, step=1)

    with pytest.raises(httpx.HTTPError):
        run.finish()

    # 失敗時もスレッド停止・クライアントclose相当の後始末は行われる。
    assert not run._flusher._thread.is_alive()


def test_finish_raises_when_finish_endpoint_fails() -> None:
    transport = RecordingTransport()
    transport.fail("POST", FINISH_PATH)
    run = _make_run(transport)

    with pytest.raises(httpx.HTTPError):
        run.finish()


def test_finish_posts_finish_even_when_final_flush_fails() -> None:
    transport = RecordingTransport()
    transport.fail("POST", METRICS_PATH)
    run = _make_run(transport, flush_interval=60.0)
    run.log({"loss": 0.1}, step=1)

    # flushの失敗は呼び出し元に伝わるが、jobがrunningのまま残らないよう
    # finishエンドポイントへのPOSTは送られている。
    with pytest.raises(httpx.ConnectError):
        run.finish(status="failed")

    assert [r.path for r in transport.requests] == [FINISH_PATH]
    assert transport.requests[0].json == {"status": "failed"}


def test_finish_raises_finish_error_chained_to_flush_error() -> None:
    transport = RecordingTransport()
    transport.fail("POST", METRICS_PATH)
    transport.respond("POST", FINISH_PATH, httpx.Response(500, json={}))
    client = httpx.Client(base_url="http://testserver", transport=transport)
    run = Run(
        client=client,
        project_id=PROJECT_ID,
        job_id=JOB_ID,
        flush_interval=60.0,
        batch_size=100,
    )
    run.log({"loss": 0.1}, step=1)

    with pytest.raises(httpx.HTTPStatusError) as info:
        run.finish()

    assert isinstance(info.value.__cause__, httpx.ConnectError)
