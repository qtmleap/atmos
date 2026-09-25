"""テスト用の記録付きhttpxトランスポート。

`httpx.MockTransport`は単一のhandlerで完結する用途向けなので、リクエストの
記録・意図的な失敗の注入・待ち合わせが必要な本SDKのテストでは、
`httpx.BaseTransport`を直接実装したほうが小回りが利く。ネットワークには一切出ない。
"""

from __future__ import annotations

import email
import json
import threading
import time
from email.message import Message
from typing import Any

import httpx


def parse_multipart(request: httpx.Request) -> dict[str, Any]:
    """multipart/form-dataのリクエストボディをフィールド名 -> 値の辞書に変換する。"""
    content_type = request.headers["content-type"]
    body = request.read()
    raw = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + body
    msg = email.message_from_bytes(raw)

    fields: dict[str, Any] = {}
    for part in msg.get_payload():
        assert isinstance(part, Message)
        name = part.get_param("name", header="content-disposition")
        assert isinstance(name, str)
        filename = part.get_filename()
        payload = part.get_payload(decode=True)
        if filename:
            fields[name] = {
                "filename": filename,
                "content_type": part.get_content_type(),
                "content": payload,
            }
        else:
            fields[name] = payload.decode() if isinstance(payload, bytes) else payload
    return fields


class RecordedRequest:
    def __init__(self, request: httpx.Request) -> None:
        self.method = request.method
        self.path = request.url.path
        content_type = request.headers.get("content-type", "")
        if content_type.startswith("multipart/form-data"):
            self.json: dict[str, Any] | None = None
            self.fields: dict[str, Any] | None = parse_multipart(request)
        else:
            self.fields = None
            body = request.read()
            self.json = json.loads(body) if body else None


class RecordingTransport(httpx.BaseTransport):
    """リクエストを記録しつつ、事前に登録した応答（または失敗）を返すトランスポート。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._condition = threading.Condition(self._lock)
        self.requests: list[RecordedRequest] = []
        self._fail_paths: dict[str, int | None] = {}
        self._responses: dict[tuple[str, str], httpx.Response] = {}

    def fail(self, method: str, path: str, *, times: int | None = None) -> None:
        """このパスへのリクエストは接続エラーとして扱う（実際に送信しない）。

        `times`を指定するとその回数だけ失敗した後は通常どおり応答する
        （再試行の末に成功する場合のテスト用）。省略時は無期限に失敗し続ける。
        """
        self._fail_paths[f"{method.upper()} {path}"] = times

    def respond(self, method: str, path: str, response: httpx.Response) -> None:
        self._responses[(method.upper(), path)] = response

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        key = f"{request.method.upper()} {request.url.path}"
        with self._lock:
            should_fail = key in self._fail_paths
            if should_fail:
                remaining = self._fail_paths[key]
                if remaining is not None:
                    if remaining <= 1:
                        del self._fail_paths[key]
                    else:
                        self._fail_paths[key] = remaining - 1
        if should_fail:
            raise httpx.ConnectError("simulated connection failure", request=request)

        recorded = RecordedRequest(request)
        with self._condition:
            self.requests.append(recorded)
            self._condition.notify_all()

        response = self._responses.get((request.method.upper(), request.url.path))
        if response is not None:
            return response
        return httpx.Response(200, json={})

    def wait_for(self, count: int, timeout: float = 2.0) -> list[RecordedRequest]:
        """記録済みリクエストが`count`件以上になるまで待つ。"""
        deadline = time.monotonic() + timeout
        with self._condition:
            while len(self.requests) < count:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise AssertionError(
                        f"expected >= {count} requests within {timeout}s, "
                        f"got {len(self.requests)}: {[r.path for r in self.requests]}"
                    )
                self._condition.wait(timeout=remaining)
            return list(self.requests)
