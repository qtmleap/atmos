from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from atmos._run import Run
from tests._support import RecordingTransport

PROJECT_ID = "p1"
JOB_ID = "j1"
MEDIA_PATH = f"/api/projects/{PROJECT_ID}/jobs/{JOB_ID}/media"


def _make_run(transport: RecordingTransport) -> Run:
    transport.respond(
        "POST",
        MEDIA_PATH,
        httpx.Response(201, json={"id": "media-1", "kind": "image"}),
    )
    client = httpx.Client(base_url="http://testserver", transport=transport)
    return Run(
        client=client,
        project_id=PROJECT_ID,
        job_id=JOB_ID,
        flush_interval=10.0,
        batch_size=100,
    )


def test_log_image_uploads_multipart_with_guessed_content_type(tmp_path: Path) -> None:
    image_path = tmp_path / "sample.png"
    image_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"fake-png-bytes")

    transport = RecordingTransport()
    run = _make_run(transport)
    try:
        run.log_image("sample", image_path, step=1)

        requests = transport.wait_for(1, timeout=2.0)
        request = requests[0]
        assert request.path == MEDIA_PATH
        assert request.fields is not None
        assert request.fields["kind"] == "image"
        assert request.fields["step"] == "1"
        assert request.fields["label"] == "sample"
        assert request.fields["file"]["content_type"] == "image/png"
        assert request.fields["file"]["filename"] == "sample.png"
    finally:
        run._flusher.stop()
        run._client.close()


def test_log_audio_uploads_multipart_with_guessed_content_type(tmp_path: Path) -> None:
    audio_path = tmp_path / "sample.wav"
    audio_path.write_bytes(b"RIFF....WAVEfmt ")

    transport = RecordingTransport()
    run = _make_run(transport)
    try:
        run.log_audio("sample", audio_path, step=2)

        requests = transport.wait_for(1, timeout=2.0)
        request = requests[0]
        assert request.fields is not None
        assert request.fields["kind"] == "audio"
        assert request.fields["step"] == "2"
        # mimetypesは環境によって.wavを"audio/x-wav"と推定するため、
        # SDK側でSPEC.mdが要求する"audio/wav"へ正規化している。
        assert request.fields["file"]["content_type"] == "audio/wav"
    finally:
        run._flusher.stop()
        run._client.close()


def test_log_image_rejects_unrecognized_extension(tmp_path: Path) -> None:
    bogus_path = tmp_path / "sample.bmp"
    bogus_path.write_bytes(b"not really a bmp")

    transport = RecordingTransport()
    run = _make_run(transport)
    try:
        with pytest.raises(ValueError, match="content_type"):
            run.log_image("sample", bogus_path, step=1)
        assert len(transport.requests) == 0
    finally:
        run._flusher.stop()
        run._client.close()


def test_log_image_missing_file_raises(tmp_path: Path) -> None:
    transport = RecordingTransport()
    run = _make_run(transport)
    try:
        with pytest.raises(FileNotFoundError):
            run.log_image("sample", tmp_path / "does-not-exist.png", step=1)
    finally:
        run._flusher.stop()
        run._client.close()


def test_media_send_failure_is_swallowed(tmp_path: Path) -> None:
    image_path = tmp_path / "sample.png"
    image_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"fake-png-bytes")

    transport = RecordingTransport()
    transport.fail("POST", MEDIA_PATH)
    run = _make_run(transport)
    try:
        # ネットワークエラーでも例外は伝播しない。
        run.log_image("sample", image_path, step=1)
    finally:
        run._flusher.stop()
        run._client.close()
