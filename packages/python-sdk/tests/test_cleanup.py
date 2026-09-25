from __future__ import annotations

import logging
import sys

import httpx
import pytest

from atmos import _run
from atmos._retry import RetryConfig
from atmos._run import Run
from tests._support import RecordingTransport

PROJECT_ID = "p1"
JOB_ID = "j1"
FINISH_PATH = f"/api/projects/{PROJECT_ID}/jobs/{JOB_ID}/finish"


def _make_run(transport: RecordingTransport) -> Run:
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
        flush_interval=60.0,
        batch_size=100,
        retry_config=RetryConfig(max_retries=0),
    )


def test_atexit_cleanup_finishes_unfinished_runs_as_finished_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(_run, "_had_uncaught_exception", False)
    transport = RecordingTransport()
    run = _make_run(transport)

    _run._atexit_cleanup()

    assert run._finished
    assert transport.requests[-1].path == FINISH_PATH
    assert transport.requests[-1].json == {"status": "finished"}


def test_atexit_cleanup_finishes_as_failed_after_an_uncaught_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(_run, "_had_uncaught_exception", True)
    transport = RecordingTransport()
    run = _make_run(transport)

    _run._atexit_cleanup()

    assert run._finished
    assert transport.requests[-1].path == FINISH_PATH
    assert transport.requests[-1].json == {"status": "failed"}


def test_atexit_cleanup_ignores_runs_already_finished(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(_run, "_had_uncaught_exception", False)
    transport = RecordingTransport()
    run = _make_run(transport)
    run.finish()
    request_count_before = len(transport.requests)

    _run._atexit_cleanup()  # 既にfinish済みなので何もしない

    assert len(transport.requests) == request_count_before


def test_atexit_cleanup_warns_instead_of_raising_when_finish_fails(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(_run, "_had_uncaught_exception", False)
    transport = RecordingTransport()
    transport.fail("POST", FINISH_PATH)
    run = _make_run(transport)

    with caplog.at_level(logging.WARNING, logger="atmos"):
        _run._atexit_cleanup()  # 例外を投げず警告に留める

    assert run._finished
    assert any("cleanup" in r.getMessage() for r in caplog.records)
    run._flusher.stop()
    run._client.close()


def test_excepthook_chain_records_uncaught_exception_and_calls_previous_hook(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(_run, "_had_uncaught_exception", False)
    called_with: list[type[BaseException]] = []
    monkeypatch.setattr(
        _run, "_previous_excepthook", lambda t, v, tb: called_with.append(t)
    )

    try:
        raise RuntimeError("boom")
    except RuntimeError:
        exc_type, exc_value, exc_tb = sys.exc_info()
        assert exc_type is not None
        assert exc_value is not None
        _run._record_uncaught_exception(exc_type, exc_value, exc_tb)

    assert _run._had_uncaught_exception is True
    assert called_with == [RuntimeError]


def test_sys_excepthook_is_replaced_with_the_recording_hook() -> None:
    # atmosをimportした時点でsys.excepthookが差し替わっている。
    assert sys.excepthook is _run._record_uncaught_exception
