"""`atmos.init()` と `Run`（wandbの`run`相当）。"""

from __future__ import annotations

import logging
import math
import os
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Literal

import httpx

from atmos._buffering import BackgroundFlusher
from atmos._log_handler import RunLogHandler
from atmos._media import guess_content_type

logger = logging.getLogger("atmos")

Stream = Literal["stdout", "stderr"]
Status = Literal["finished", "failed"]

_DEFAULT_FLUSH_INTERVAL = 5.0
_DEFAULT_BATCH_SIZE = 100


def init(
    project: str,
    *,
    name: str | None = None,
    config: Mapping[str, Any] | None = None,
    api_url: str | None = None,
    token: str | None = None,
    flush_interval: float = _DEFAULT_FLUSH_INTERVAL,
    batch_size: int = _DEFAULT_BATCH_SIZE,
    transport: httpx.BaseTransport | None = None,
) -> Run:
    """runを開始する（`docs/SPEC.md` 6-7節）。

    1. `POST /api/projects` でproject取得/作成（`(name, visibility="private")`が
       トークン所有者内で既に存在すれば再利用、無ければ作成される）。
    2. `POST /api/projects/:project_id/jobs` でjobを作成する。
    3. できあがった`Run`を返す。以降の`log()`等はバックグラウンドスレッドで
       バッチ送信される。

    `api_url`/`token`は引数を優先し、未指定なら環境変数
    `ATMOS_API_URL`/`ATMOS_TOKEN` を使う。どちらも得られない場合は`ValueError`。

    `transport`は主にテスト用（`httpx.MockTransport`等を注入する）。
    """
    resolved_api_url = api_url or os.environ.get("ATMOS_API_URL")
    resolved_token = token or os.environ.get("ATMOS_TOKEN")

    if not resolved_api_url:
        raise ValueError(
            "atmos: api_url が指定されていません。"
            "wb.init(api_url=...) 引数か ATMOS_API_URL 環境変数で指定してください。"
        )
    if not resolved_token:
        raise ValueError(
            "atmos: token が指定されていません。"
            "wb.init(token=...) 引数か ATMOS_TOKEN 環境変数で指定してください。"
        )
    # flush_interval/batch_sizeの検証はBackgroundFlusherも行うが、project/jobの
    # 作成リクエストを送る前に弾けるようここでも早期にチェックする。
    if flush_interval <= 0:
        raise ValueError("flush_interval は正の値である必要があります")
    if batch_size <= 0:
        raise ValueError("batch_size は正の値である必要があります")

    client = httpx.Client(
        base_url=resolved_api_url,
        headers={"Authorization": f"Bearer {resolved_token}"},
        transport=transport,
    )

    try:
        project_response = client.post(
            "/api/projects", json={"name": project, "visibility": "private"}
        )
        project_response.raise_for_status()
        project_id = project_response.json()["id"]

        job_body: dict[str, Any] = {}
        if name is not None:
            job_body["name"] = name
        if config is not None:
            job_body["config"] = dict(config)

        job_response = client.post(f"/api/projects/{project_id}/jobs", json=job_body)
        job_response.raise_for_status()
        job = job_response.json()

        return Run(
            client=client,
            project_id=project_id,
            job_id=job["id"],
            flush_interval=flush_interval,
            batch_size=batch_size,
        )
    except Exception:
        client.close()
        raise


class Run:
    """1回のjob（wandbの`run`相当）を表す。`atmos.init()`が返す。

    `log()`/`log_text()`はバックグラウンドスレッドへバッファし、`flush_interval`秒
    または`batch_size`件のどちらか早い方でまとめて送信する。送信失敗はログ警告に
    留めて例外は投げない（学習ループをクラッシュさせないため）。
    `log_image()`/`log_audio()`はバッファせず呼び出しのたびに即時送信する
    （ファイルI/Oを伴うため取りこぼしよりも呼び出しタイミングでの失敗検知を優先した）。
    最後に呼ぶ`finish()`だけは送信失敗を例外として伝播させる。

    単一スレッドから`log()`等を順に呼び出す使い方（`docs/PLAN.md`のサンプルコード
    通り）を前提としており、複数スレッドから同時に呼び出すことは想定していない。
    既知の制約はREADMEの「既知の制約（並行性まわり）」を参照。
    """

    def __init__(
        self,
        *,
        client: httpx.Client,
        project_id: str,
        job_id: str,
        flush_interval: float = _DEFAULT_FLUSH_INTERVAL,
        batch_size: int = _DEFAULT_BATCH_SIZE,
    ) -> None:
        self._client = client
        self._project_id = project_id
        self._job_id = job_id
        self._finished = False
        self._flusher = BackgroundFlusher(
            flush_interval=flush_interval, batch_size=batch_size
        )
        self._flusher.start(send_metrics=self._send_metrics, send_logs=self._send_logs)

    @property
    def project_id(self) -> str:
        return self._project_id

    @property
    def job_id(self) -> str:
        return self._job_id

    def log(self, metrics: Mapping[str, float], step: int) -> None:
        """メトリクスをバッファに積む（`docs/SPEC.md`の`IngestMetricsRequest`形式）。"""
        if self._finished:
            logger.warning("atmos: log() called after finish(); ignoring")
            return
        for key, value in metrics.items():
            # サーバーは空文字のkeyを400で拒否し、同じバッチ全体が失われるため積まない
            # （`log_text()`の空メッセージ除外と同じ理由）。
            if key == "":
                logger.warning("atmos: log() dropped an empty key at step %d", step)
                continue
            number = float(value)
            # NaN/Infは JSON にできず（httpxは allow_nan=False で直列化する）、1件でも
            # 混ざると同じバッチの正常なデータまで送信できなくなるため、積む前に除く。
            if not math.isfinite(number):
                logger.warning(
                    "atmos: log() dropped non-finite value %r for key %r at step %d",
                    number,
                    key,
                    step,
                )
                continue
            self._flusher.add_metric({"step": step, "key": key, "value": number})

    def log_text(self, message: str, stream: Stream = "stdout") -> None:
        """ログ行をバッファに積む（`docs/SPEC.md`の`IngestLogsRequest`形式）。"""
        if self._finished:
            logger.warning("atmos: log_text() called after finish(); ignoring")
            return
        # サーバーは空のメッセージを400で拒否し、同じバッチ全体が失われるため積まない。
        if message == "":
            logger.warning("atmos: log_text() called with an empty message; ignoring")
            return
        self._flusher.add_log({"stream": stream, "message": message})

    def log_image(self, label: str, path: str | os.PathLike[str], step: int) -> None:
        """画像を即時アップロードする（`image/png`|`image/jpeg`|`image/webp`）。"""
        self._log_media(label=label, path=path, step=step, kind="image")

    def log_audio(self, label: str, path: str | os.PathLike[str], step: int) -> None:
        """音声を即時アップロードする（`audio/wav`|`audio/mpeg`）。"""
        self._log_media(label=label, path=path, step=step, kind="audio")

    def log_handler(self) -> logging.Handler:
        """標準`logging`と連携するハンドラを返す（`WARNING`以上は`stream="stderr"`）。"""
        return RunLogHandler(self)

    def finish(self, status: Status = "finished") -> None:
        """バッファを最終flushしてから`finish`エンドポイントを呼ぶ。

        まずバックグラウンドスレッドを停止させ（進行中のflushがあれば完了を待つ）、
        その後に呼び出し元スレッド上で最後のflushを行う。先にflushしてからスレッドを
        止める順序だと、バックグラウンド側が送信中のまま`finish`リクエストが先に
        サーバーへ届いたり、送信中に`httpx.Client`をcloseしてしまう競合が起こり得る
        ため、停止を先に行う。

        最終flushが失敗しても`finish`エンドポイントへのPOSTは必ず試みる
        （jobが`running`のまま残らないようにするため）。その上で、finish呼び出しの
        失敗、またはそれが成功した場合は保持しておいた最終flushの失敗を例外として
        送出する（呼び出し側が実行の成否やデータの欠落を最後に確認できるようにするため）。
        二重呼び出しは無害（2回目以降は何もしない）。
        """
        if self._finished:
            return
        self._finished = True
        try:
            self._flusher.stop()
            flush_error: Exception | None = None
            try:
                self._flusher.flush(raise_on_error=True)
            except Exception as exc:  # noqa: BLE001 - finishのPOST後に再送出する
                flush_error = exc
            try:
                response = self._client.post(
                    f"/api/projects/{self._project_id}/jobs/{self._job_id}/finish",
                    json={"status": status},
                )
                response.raise_for_status()
            except Exception as finish_error:
                # 両方失敗した場合はfinishの失敗を送出し、flushの失敗は原因として添える。
                if flush_error is not None:
                    raise finish_error from flush_error
                raise
            if flush_error is not None:
                raise flush_error
        finally:
            self._client.close()

    def _log_media(
        self,
        *,
        label: str,
        path: str | os.PathLike[str],
        step: int,
        kind: Literal["image", "audio"],
    ) -> None:
        if self._finished:
            logger.warning("atmos: log_%s() called after finish(); ignoring", kind)
            return

        file_path = Path(path)
        content_type = guess_content_type(file_path, kind)

        try:
            with file_path.open("rb") as fh:
                response = self._client.post(
                    f"/api/projects/{self._project_id}/jobs/{self._job_id}/media",
                    data={"kind": kind, "step": str(step), "label": label},
                    files={"file": (file_path.name, fh, content_type)},
                )
            response.raise_for_status()
        except httpx.HTTPError:
            logger.warning(
                "atmos: failed to upload %s media %r", kind, label, exc_info=True
            )

    def _send_metrics(self, metrics: list[dict[str, Any]]) -> None:
        response = self._client.post(
            f"/api/projects/{self._project_id}/jobs/{self._job_id}/metrics",
            json={"metrics": metrics},
        )
        response.raise_for_status()

    def _send_logs(self, logs: list[dict[str, Any]]) -> None:
        response = self._client.post(
            f"/api/projects/{self._project_id}/jobs/{self._job_id}/logs",
            json={"logs": logs},
        )
        response.raise_for_status()
