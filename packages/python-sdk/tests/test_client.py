from __future__ import annotations

import httpx
import pytest

import atmos
from tests._support import RecordingTransport

API_URL = "https://atmos.example.com"
PROJECT_PATH = "/api/projects/p1"
JOB_PATH = f"{PROJECT_PATH}/jobs/j1"


@pytest.mark.parametrize("target,path", [("project", PROJECT_PATH), ("job", JOB_PATH)])
def test_delete_uses_bearer_and_does_not_create_a_run(target: str, path: str) -> None:
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(204)

    with atmos.Client(
        api_url=API_URL, token="access-token", transport=httpx.MockTransport(handle)
    ) as client:
        if target == "project":
            client.delete_project("p1")
        else:
            client.delete_job("p1", "j1")
        assert not client.is_closed
    assert client.is_closed
    assert len(requests) == 1
    assert requests[0].method == "DELETE"
    assert str(requests[0].url) == f"{API_URL}{path}"
    assert requests[0].headers["authorization"] == "Bearer access-token"
    assert requests[0].content == b""


@pytest.mark.parametrize("target,path", [("project", PROJECT_PATH), ("job", JOB_PATH)])
@pytest.mark.parametrize("status", [401, 403, 404])
def test_delete_propagates_permanent_errors_without_retry(
    target: str, path: str, status: int
) -> None:
    transport = RecordingTransport()
    transport.respond("DELETE", path, httpx.Response(status))
    with atmos.Client(
        api_url=API_URL, token="token", transport=transport, retry_sleep=lambda _: None
    ) as client:
        with pytest.raises(httpx.HTTPStatusError) as error:
            if target == "project":
                client.delete_project("p1")
            else:
                client.delete_job("p1", "j1")
        assert error.value.response.status_code == status
    assert len(transport.requests) == 1


@pytest.mark.parametrize("failure", ["http", "connection"])
def test_delete_retries_temporary_failures(failure: str) -> None:
    requests: list[httpx.Request] = []
    sleeps: list[float] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if len(requests) == 1:
            if failure == "connection":
                raise httpx.ConnectError("temporary failure", request=request)
            return httpx.Response(503, headers={"Retry-After": "0"})
        return httpx.Response(204)

    with atmos.Client(
        api_url=API_URL,
        token="token",
        transport=httpx.MockTransport(handle),
        retry_sleep=sleeps.append,
    ) as client:
        client.delete_job("p1", "j1")
    assert len(requests) == 2
    assert all(
        request.method == "DELETE" and request.url.path == JOB_PATH
        for request in requests
    )
    assert len(sleeps) == 1


def test_delete_raises_when_retries_are_exhausted() -> None:
    transport = RecordingTransport()
    transport.respond("DELETE", PROJECT_PATH, httpx.Response(503))
    with (
        atmos.Client(
            api_url=API_URL,
            token="token",
            transport=transport,
            max_retries=2,
            retry_sleep=lambda _: None,
        ) as client,
        pytest.raises(httpx.HTTPStatusError),
    ):
        client.delete_project("p1")
    assert len(transport.requests) == 3


def test_retry_does_not_hide_a_404_after_an_uncertain_delete() -> None:
    attempts = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.ReadError("response lost", request=request)
        return httpx.Response(404)

    with atmos.Client(
        api_url=API_URL,
        token="token",
        transport=httpx.MockTransport(handle),
        retry_sleep=lambda _: None,
    ) as client:
        with pytest.raises(httpx.HTTPStatusError) as error:
            client.delete_project("p1")
        assert error.value.response.status_code == 404
    assert attempts == 2


@pytest.mark.parametrize("explicit", [False, True])
def test_connection_settings_match_init_environment_precedence(
    monkeypatch: pytest.MonkeyPatch, explicit: bool
) -> None:
    monkeypatch.setenv("ATMOS_API_URL", "https://environment.example.com")
    monkeypatch.setenv("ATMOS_TOKEN", "environment-token")
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(204)

    with atmos.Client(
        api_url=API_URL if explicit else None,
        token="explicit-token" if explicit else None,
        transport=httpx.MockTransport(handle),
    ) as client:
        client.delete_project("p1")
    expected_url = API_URL if explicit else "https://environment.example.com"
    expected_token = "explicit-token" if explicit else "environment-token"
    assert str(requests[0].url) == f"{expected_url}{PROJECT_PATH}"
    assert requests[0].headers["authorization"] == f"Bearer {expected_token}"


@pytest.mark.parametrize("missing", ["api_url", "token"])
def test_missing_connection_setting_fails_before_a_request(
    monkeypatch: pytest.MonkeyPatch, missing: str
) -> None:
    monkeypatch.delenv("ATMOS_API_URL", raising=False)
    monkeypatch.delenv("ATMOS_TOKEN", raising=False)
    with pytest.raises(ValueError, match=missing):
        atmos.Client(
            api_url=None if missing == "api_url" else API_URL,
            token=None if missing == "token" else "token",
        )


@pytest.mark.parametrize("invalid_id", ["", ".", ".."])
def test_invalid_ids_do_not_send_delete(invalid_id: str) -> None:
    transport = RecordingTransport()
    with atmos.Client(api_url=API_URL, token="token", transport=transport) as client:
        with pytest.raises(ValueError):
            client.delete_project(invalid_id)
        with pytest.raises(ValueError):
            client.delete_job("p1", invalid_id)
    assert transport.requests == []


def test_context_manager_closes_client_on_error() -> None:
    with (
        pytest.raises(RuntimeError, match="caller failed"),
        atmos.Client(
            api_url=API_URL, token="token", transport=RecordingTransport()
        ) as client,
    ):
        raise RuntimeError("caller failed")
    assert client.is_closed
    client.close()
