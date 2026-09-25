from __future__ import annotations

import httpx
import pytest

import atmos
from tests._support import RecordingTransport


def _prepared_transport() -> RecordingTransport:
    transport = RecordingTransport()
    transport.respond(
        "POST",
        "/api/projects",
        httpx.Response(200, json={"id": "project-1", "name": "my-project"}),
    )
    transport.respond(
        "POST",
        "/api/projects/project-1/jobs",
        httpx.Response(
            201,
            json={"id": "job-1", "project_id": "project-1", "status": "running"},
        ),
    )
    return transport


def test_init_creates_project_then_job_in_order() -> None:
    transport = _prepared_transport()

    run = atmos.init(
        project="my-project",
        name="exp1",
        config={"lr": 1e-3},
        api_url="http://testserver",
        token="secret-token",
        transport=transport,
    )

    assert len(transport.requests) == 2

    project_request = transport.requests[0]
    assert project_request.method == "POST"
    assert project_request.path == "/api/projects"
    assert project_request.json == {"name": "my-project", "visibility": "private"}

    job_request = transport.requests[1]
    assert job_request.method == "POST"
    assert job_request.path == "/api/projects/project-1/jobs"
    assert job_request.json == {"name": "exp1", "config": {"lr": 1e-3}}

    assert run.project_id == "project-1"
    assert run.job_id == "job-1"

    run._flusher.stop()
    run._client.close()


def test_init_omits_optional_job_fields_when_not_given() -> None:
    transport = _prepared_transport()

    run = atmos.init(
        project="my-project",
        api_url="http://testserver",
        token="secret-token",
        transport=transport,
    )

    job_request = transport.requests[1]
    assert job_request.json == {}

    run._flusher.stop()
    run._client.close()


def test_init_prefers_explicit_args_over_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ATMOS_API_URL", "http://env-should-not-be-used")
    monkeypatch.setenv("ATMOS_TOKEN", "env-token")
    transport = _prepared_transport()

    run = atmos.init(
        project="my-project",
        api_url="http://testserver",
        token="explicit-token",
        transport=transport,
    )

    assert run._client.headers["authorization"] == "Bearer explicit-token"
    run._flusher.stop()
    run._client.close()


def test_init_falls_back_to_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ATMOS_API_URL", "http://testserver")
    monkeypatch.setenv("ATMOS_TOKEN", "env-token")
    transport = _prepared_transport()

    run = atmos.init(project="my-project", transport=transport)

    assert run._client.headers["authorization"] == "Bearer env-token"
    run._flusher.stop()
    run._client.close()


def test_init_requires_api_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ATMOS_API_URL", raising=False)
    monkeypatch.setenv("ATMOS_TOKEN", "env-token")

    with pytest.raises(ValueError, match="api_url"):
        atmos.init(project="my-project")


def test_init_requires_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ATMOS_API_URL", "http://testserver")
    monkeypatch.delenv("ATMOS_TOKEN", raising=False)

    with pytest.raises(ValueError, match="token"):
        atmos.init(project="my-project")
