from __future__ import annotations

import httpx

from atmos import _run
from atmos._retry import RetryConfig
from atmos._run import Run
from tests._support import RecordingTransport


def test_heartbeat_is_sent_while_idle_and_stops_after_finish(monkeypatch) -> None:
    monkeypatch.setattr(_run, "_HEARTBEAT_INTERVAL", 0.01)
    transport = RecordingTransport()
    path = "/api/projects/p1/jobs/j1/heartbeat"
    transport.respond("POST", path, httpx.Response(204))
    client = httpx.Client(base_url="http://testserver", transport=transport)
    run = Run(
        client=client,
        project_id="p1",
        job_id="j1",
        flush_interval=60,
        batch_size=100,
        retry_config=RetryConfig(max_retries=0),
    )
    transport.wait_for(1)
    assert transport.requests[0].path == path
    run.finish()
    assert run._heartbeat_thread.is_alive() is False
    assert transport.requests[-1].path == "/api/projects/p1/jobs/j1/finish"
