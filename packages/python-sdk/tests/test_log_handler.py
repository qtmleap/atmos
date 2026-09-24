from __future__ import annotations

import logging
import time

import httpx
import pytest

from atmos._log_handler import RunLogHandler
from atmos._run import Run
from tests._support import RecordingTransport

PROJECT_ID = "p1"
JOB_ID = "j1"
LOGS_PATH = f"/api/projects/{PROJECT_ID}/jobs/{JOB_ID}/logs"


def _make_run(transport: RecordingTransport) -> Run:
    transport.respond("POST", LOGS_PATH, httpx.Response(202, json={"accepted": 1}))
    client = httpx.Client(base_url="http://testserver", transport=transport)
    return Run(
        client=client,
        project_id=PROJECT_ID,
        job_id=JOB_ID,
        flush_interval=0.05,
        batch_size=100,
    )


def test_log_handler_routes_records_to_log_text() -> None:
    transport = RecordingTransport()
    run = _make_run(transport)
    logger = logging.getLogger("atmos-test-handler")
    logger.setLevel(logging.DEBUG)
    handler = run.log_handler()
    logger.addHandler(handler)
    try:
        logger.info("hello info")
        logger.warning("hello warning")

        entries: list[dict[str, str]] = []
        deadline = time.monotonic() + 2.0
        while len(entries) < 2 and time.monotonic() < deadline:
            time.sleep(0.02)
            entries = [
                entry
                for request in transport.requests
                if request.json is not None
                for entry in request.json["logs"]
            ]

        assert {"stream": "stdout", "message": "hello info"} in entries
        assert {"stream": "stderr", "message": "hello warning"} in entries
    finally:
        logger.removeHandler(handler)
        run._flusher.stop()
        run._client.close()


class _CountingHandler(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.DEBUG)
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


def test_root_logger_handler_does_not_recurse_during_finish(
    capsys: pytest.CaptureFixture[str],
) -> None:
    transport = RecordingTransport()
    run = _make_run(transport)
    root = logging.getLogger()
    previous_level = root.level
    root.setLevel(logging.INFO)
    handler = run.log_handler()
    counter = _CountingHandler()
    root.addHandler(handler)
    root.addHandler(counter)
    try:
        logging.getLogger("user-code").info("before finish")
        run.finish()
        # finish()後のログは「finish後に呼ばれた」警告になるが、再帰はしない。
        logging.getLogger("user-code").info("after finish")
    finally:
        root.removeHandler(handler)
        root.removeHandler(counter)
        root.setLevel(previous_level)

    captured = capsys.readouterr()
    assert "RecursionError" not in captured.err
    # 利用者の2行、httpxのリクエストログ数件、finish後の警告1件程度に収まる。
    assert len(counter.records) < 20
    after_finish_warnings = [
        r for r in counter.records if "called after finish" in r.getMessage()
    ]
    assert len(after_finish_warnings) == 1

    sent = [
        entry
        for request in transport.requests
        if request.path == LOGS_PATH and request.json is not None
        for entry in request.json["logs"]
    ]
    assert sent == [{"stream": "stdout", "message": "before finish"}]


def test_handler_ignores_sdk_and_http_client_loggers() -> None:
    transport = RecordingTransport()
    run = _make_run(transport)
    handler = run.log_handler()
    try:
        for name in ("atmos", "atmos._run", "httpx", "httpcore.connection"):
            handler.handle(
                logging.LogRecord(name, logging.WARNING, __file__, 1, "x", None, None)
            )
        assert run._flusher._logs == []

        # 名前が"atmos"で始まるだけの別ロガーは除外しない。
        handler.handle(
            logging.LogRecord(
                "atmospheric", logging.INFO, __file__, 1, "kept", None, None
            )
        )
        assert run._flusher._logs == [{"stream": "stdout", "message": "kept"}]
    finally:
        run._flusher.stop()
        run._client.close()


def test_handler_drops_reentrant_records() -> None:
    class _ReentrantRun:
        def __init__(self) -> None:
            self.messages: list[str] = []
            self.handler: logging.Handler | None = None

        def log_text(self, message: str, stream: str = "stdout") -> None:
            self.messages.append(message)
            assert self.handler is not None
            # ロガー名による除外をすり抜ける再入を模す。
            self.handler.handle(
                logging.LogRecord(
                    "user-code", logging.INFO, __file__, 1, "nested", None, None
                )
            )

    fake = _ReentrantRun()
    handler = RunLogHandler(fake)  # type: ignore[arg-type]
    fake.handler = handler

    handler.handle(
        logging.LogRecord("user-code", logging.INFO, __file__, 1, "outer", None, None)
    )

    assert fake.messages == ["outer"]
