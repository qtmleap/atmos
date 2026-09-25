"""`atmos.init()` と `Run`（wandbの`run`相当）。"""

from __future__ import annotations

import atexit
import logging
import math
import os
import sys
import time
import weakref
from collections.abc import Callable, Mapping
from pathlib import Path
from types import TracebackType
from typing import Any, Literal, Self

import httpx

from atmos._buffering import BackgroundFlusher
from atmos._log_handler import RunLogHandler
from atmos._media import check_size, guess_content_type
from atmos._retry import RetryConfig, call_with_retry

logger = logging.getLogger("atmos")

Stream = Literal["stdout", "stderr"]
Status = Literal["finished", "failed"]
Visibility = Literal["public", "internal", "private"]

_VISIBILITIES: tuple[Visibility, ...] = ("public", "internal", "private")

_DEFAULT_FLUSH_INTERVAL = 5.0
_DEFAULT_BATCH_SIZE = 100
_DEFAULT_MAX_RETRIES = 5
_DEFAULT_RETRY_INITIAL_DELAY = 0.5
_DEFAULT_RETRY_MAX_DELAY = 30.0


# --- プロセス終了時の後始末（finish()忘れの保険） -----------------------------
#
# `finish()`を呼ばずにプロセスが終了すると、jobが`running`のまま残ってしまう。
# それを避けるため、生きている`Run`を弱参照で覚えておき、`atexit`で未finishのもの
# だけ`finish()`する。終了ステータスは、未捕捉例外でプロセスが終了していれば
# `failed`、そうでなければ`finished`とする。未捕捉例外の有無は`sys.excepthook`を
# 差し替えて記録する（既存のフックを置き換えるのではなく、必ず呼んでから連鎖する）。
# `KeyboardInterrupt`（Ctrl+C）も通常のPython実行では`sys.excepthook`に届くため、
# 特別扱いせず同じ経路で`failed`として片付く。

_active_runs: weakref.WeakSet[Run] = weakref.WeakSet()
_had_uncaught_exception = False
_previous_excepthook = sys.excepthook


def _record_uncaught_exception(
    exc_type: type[BaseException], exc_value: BaseException, exc_tb: Any
) -> None:
    """`sys.excepthook`から呼ばれ、「未捕捉例外があった」ことを記録してから元のフックに委譲する。"""
    global _had_uncaught_exception
    _had_uncaught_exception = True
    _previous_excepthook(exc_type, exc_value, exc_tb)


sys.excepthook = _record_uncaught_exception


def _atexit_cleanup() -> None:
    """未finishの`Run`をプロセス終了時に片付ける。ここでの失敗は警告に留める。"""
    status: Status = "failed" if _had_uncaught_exception else "finished"
    for run in list(_active_runs):
        if run._finished:
            continue
        try:
            run.finish(status=status)
        except Exception:
            logger.warning(
                "atmos: automatic cleanup of an unfinished run failed", exc_info=True
            )


atexit.register(_atexit_cleanup)


def _post_with_retry(
    client: httpx.Client,
    retry_config: RetryConfig,
    path: str,
    *,
    label: str,
    **kwargs: Any,
) -> httpx.Response:
    """`retry_config`に従って一時的な失敗を再試行しながらPOSTし、成功レスポンスを返す。

    再試行対象外のエラー、または再試行を使い切った場合は最後の例外をそのまま送出する。
    """

    def _do() -> httpx.Response:
        response = client.post(path, **kwargs)
        response.raise_for_status()
        return response

    return call_with_retry(_do, retry_config, label=label)


def init(
    project: str,
    *,
    name: str | None = None,
    config: Mapping[str, Any] | None = None,
    visibility: Visibility = "private",
    api_url: str | None = None,
    token: str | None = None,
    flush_interval: float = _DEFAULT_FLUSH_INTERVAL,
    batch_size: int = _DEFAULT_BATCH_SIZE,
    max_retries: int = _DEFAULT_MAX_RETRIES,
    retry_initial_delay: float = _DEFAULT_RETRY_INITIAL_DELAY,
    retry_max_delay: float = _DEFAULT_RETRY_MAX_DELAY,
    transport: httpx.BaseTransport | None = None,
    retry_sleep: Callable[[float], None] | None = None,
) -> Run:
    """runを開始する（`docs/SPEC.md` 6-7節）。

    1. `POST /api/projects` でproject取得/作成（同名のprojectがトークン所有者内に
       既に存在すれば再利用、無ければ`visibility`の公開範囲で作成される）。
       既存projectを再利用した場合、`visibility`は無視され公開範囲は変わらない。
       指定した`visibility`と既存projectの公開範囲が異なる場合は警告ログを出す
       （変更したい場合はWebの設定から行う）。
    2. `POST /api/projects/:project_id/jobs` でjobを作成する。
    3. できあがった`Run`を返す。以降の`log()`等はバックグラウンドスレッドで
       バッチ送信される。

    `api_url`/`token`は引数を優先し、未指定なら環境変数
    `ATMOS_API_URL`/`ATMOS_TOKEN` を使う。どちらも得られない場合は`ValueError`。

    一時的な失敗（接続エラー・タイムアウト・408/429/500/502/503/504）は
    `max_retries`回まで指数バックオフ＋ジッタで再試行する（429・503は
    `Retry-After`ヘッダがあればそれに従う）。それ以外の4xx（400/401/404/413等）は
    再試行しない。`Run`が返された後の`log()`等の送信にも同じ設定が使われる。

    戻り値の`Run`は`with`文にも対応する（`with atmos.init(...) as run:`）。
    ブロックを正常に抜ければ`finish("finished")`、例外で抜ければ`finish("failed")`
    を自動的に呼ぶ。`with`を使わず`finish()`を呼び忘れた場合も、プロセス終了時に
    `atexit`が未finishのrunを片付ける（未捕捉例外があれば`failed`、無ければ
    `finished`として扱う）。

    `transport`/`retry_sleep`は主にテスト用（`httpx.MockTransport`等の注入、
    再試行の待機時間の差し替え）。
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
    # flush_interval/batch_size/再試行設定の検証はそれぞれの実体
    # （BackgroundFlusher/RetryConfig）も行うが、project/jobの作成リクエストを
    # 送る前にここでも早期にチェックする。
    if flush_interval <= 0:
        raise ValueError("flush_interval は正の値である必要があります")
    if batch_size <= 0:
        raise ValueError("batch_size は正の値である必要があります")
    if visibility not in _VISIBILITIES:
        raise ValueError(
            f"visibility は {', '.join(_VISIBILITIES)} のいずれかである必要があります"
        )
    retry_config = RetryConfig(
        max_retries=max_retries,
        initial_delay=retry_initial_delay,
        max_delay=retry_max_delay,
        sleep=retry_sleep if retry_sleep is not None else time.sleep,
    )

    client = httpx.Client(
        base_url=resolved_api_url,
        headers={"Authorization": f"Bearer {resolved_token}"},
        transport=transport,
    )

    try:
        project_response = _post_with_retry(
            client,
            retry_config,
            "/api/projects",
            json={"name": project, "visibility": visibility},
            label="create project",
        )
        project_data = project_response.json()
        project_id = project_data["id"]
        existing_visibility = project_data.get("visibility")
        if project_response.status_code == 200 and existing_visibility != visibility:
            logger.warning(
                "atmos: 既存プロジェクト %r の公開範囲は %s のままです"
                "（変更はWebの設定から行ってください）",
                project,
                existing_visibility,
            )

        job_body: dict[str, Any] = {}
        if name is not None:
            job_body["name"] = name
        if config is not None:
            job_body["config"] = dict(config)

        job_response = _post_with_retry(
            client,
            retry_config,
            f"/api/projects/{project_id}/jobs",
            json=job_body,
            label="create job",
        )
        job = job_response.json()

        return Run(
            client=client,
            project_id=project_id,
            job_id=job["id"],
            flush_interval=flush_interval,
            batch_size=batch_size,
            retry_config=retry_config,
        )
    except Exception:
        client.close()
        raise


class Run:
    """1回のjob（wandbの`run`相当）を表す。`atmos.init()`が返す。

    `log()`/`log_text()`はバックグラウンドスレッドへバッファし、`flush_interval`秒
    または`batch_size`件のどちらか早い方でまとめて送信する。`log_image()`/
    `log_audio()`はバッファせず呼び出しのたびに即時送信する（ファイルI/Oを伴うため
    取りこぼしよりも呼び出しタイミングでの失敗検知を優先した）。

    metrics/logsの送信・media アップロード・`finish()`のPOSTは、一時的な失敗
    （接続エラー・タイムアウト・408/429/500/502/503/504）を`init()`で指定した
    設定に従って指数バックオフ＋ジッタで再試行する。再試行を使い切った後も、
    `log()`/`log_text()`/`log_image()`/`log_audio()`の送信失敗はログ警告に留めて
    例外は投げない（学習ループをクラッシュさせないため）。バックグラウンドの
    定期/件数flushで再試行を使い切った塊はバッファの先頭へ戻し、次回のflushで
    再送を試みる（`_buffering.py`の`BackgroundFlusher`参照）。最後に呼ぶ
    `finish()`だけは送信失敗を例外として伝播させる。

    `with atmos.init(...) as run:`のようにcontext managerとしても使える。
    ブロックを正常に抜ければ`finish("finished")`、例外で抜ければ
    `finish("failed")`を自動的に呼ぶ（詳細は`__exit__`を参照）。`with`を使わず
    `finish()`を呼び忘れた場合も、プロセス終了時に`atexit`が未finishのrunを
    片付ける。

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
        retry_config: RetryConfig | None = None,
    ) -> None:
        self._client = client
        self._project_id = project_id
        self._job_id = job_id
        self._finished = False
        self._retry_config = retry_config if retry_config is not None else RetryConfig()
        self._flusher = BackgroundFlusher(
            flush_interval=flush_interval, batch_size=batch_size
        )
        self._flusher.start(send_metrics=self._send_metrics, send_logs=self._send_logs)
        _active_runs.add(self)

    @property
    def project_id(self) -> str:
        return self._project_id

    @property
    def job_id(self) -> str:
        return self._job_id

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        """`with`ブロックを抜けるときに`finish()`を呼ぶ。

        正常終了なら`finished`、例外で抜けた場合は`failed`として終える。後者の
        場合、`finish()`自体が失敗しても警告ログに留めて元の例外はそのまま伝播
        させる（`with`ブロックの例外を`finish()`側の失敗で覆い隠さないため）。
        """
        if exc_type is not None:
            try:
                self.finish(status="failed")
            except Exception:
                logger.warning(
                    "atmos: finish() failed while handling an exception raised "
                    "inside the `with` block; the original exception is preserved",
                    exc_info=True,
                )
            return
        self.finish(status="finished")

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

        最終flush・finishエンドポイントへのPOSTとも、一時的な失敗は`init()`で
        指定した設定に従って再試行される（最終flushで再試行を使い切った塊は、
        定期/件数flushと異なりバッファへは戻さない）。
        """
        if self._finished:
            return
        self._finished = True
        _active_runs.discard(self)
        try:
            self._flusher.stop()
            flush_error: Exception | None = None
            try:
                self._flusher.flush(raise_on_error=True)
            except Exception as exc:  # noqa: BLE001 - finishのPOST後に再送出する
                flush_error = exc
            try:
                _post_with_retry(
                    self._client,
                    self._retry_config,
                    f"/api/projects/{self._project_id}/jobs/{self._job_id}/finish",
                    json={"status": status},
                    label="finish job",
                )
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
        check_size(file_path)

        def _do() -> httpx.Response:
            # 再試行のたびにファイルを開き直す（前回の送信でストリームが
            # 読み進められているため使い回せない）。
            with file_path.open("rb") as fh:
                response = self._client.post(
                    f"/api/projects/{self._project_id}/jobs/{self._job_id}/media",
                    data={"kind": kind, "step": str(step), "label": label},
                    files={"file": (file_path.name, fh, content_type)},
                )
            response.raise_for_status()
            return response

        try:
            call_with_retry(_do, self._retry_config, label=f"upload {kind} media")
        except httpx.HTTPError:
            logger.warning(
                "atmos: failed to upload %s media %r", kind, label, exc_info=True
            )

    def _send_metrics(self, metrics: list[dict[str, Any]]) -> None:
        _post_with_retry(
            self._client,
            self._retry_config,
            f"/api/projects/{self._project_id}/jobs/{self._job_id}/metrics",
            json={"metrics": metrics},
            label="send metrics",
        )

    def _send_logs(self, logs: list[dict[str, Any]]) -> None:
        _post_with_retry(
            self._client,
            self._retry_config,
            f"/api/projects/{self._project_id}/jobs/{self._job_id}/logs",
            json={"logs": logs},
            label="send logs",
        )
