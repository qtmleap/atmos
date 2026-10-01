"""学習を開始せずにジョブとプロジェクトを管理するclient。"""

from __future__ import annotations

import time
from collections.abc import Callable
from types import TracebackType
from typing import Self
from urllib.parse import quote

import httpx

from atmos._connection import resolve_connection
from atmos._retry import RetryConfig, call_with_retry


def _id_segment(value: str) -> str:
    if not value or value in {".", ".."}:
        raise ValueError("project_id と job_id には有効なIDを指定してください")
    return quote(value, safe="")


class Client:
    """IDを指定して既存のジョブとプロジェクトを削除する。"""

    def __init__(
        self,
        *,
        api_url: str | None = None,
        token: str | None = None,
        max_retries: int = 5,
        retry_initial_delay: float = 0.5,
        retry_max_delay: float = 30.0,
        transport: httpx.BaseTransport | None = None,
        retry_sleep: Callable[[float], None] | None = None,
    ) -> None:
        resolved_api_url, resolved_token = resolve_connection(api_url, token)
        self._retry_config = RetryConfig(
            max_retries=max_retries,
            initial_delay=retry_initial_delay,
            max_delay=retry_max_delay,
            sleep=retry_sleep if retry_sleep is not None else time.sleep,
        )
        self._client = httpx.Client(
            base_url=resolved_api_url,
            headers={"Authorization": f"Bearer {resolved_token}"},
            transport=transport,
        )

    def delete_job(self, project_id: str, job_id: str) -> None:
        """ジョブと関連データを削除する。失敗は例外として返す。"""
        path = f"/api/projects/{_id_segment(project_id)}/jobs/{_id_segment(job_id)}"
        self._delete(path, label="delete job")

    def delete_project(self, project_id: str) -> None:
        """プロジェクトと配下の全ジョブ・関連データを削除する。"""
        self._delete(f"/api/projects/{_id_segment(project_id)}", label="delete project")

    def _delete(self, path: str, *, label: str) -> None:
        def send() -> None:
            response = self._client.delete(path)
            response.raise_for_status()

        call_with_retry(send, self._retry_config, label=label)

    @property
    def is_closed(self) -> bool:
        return self._client.is_closed

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()
