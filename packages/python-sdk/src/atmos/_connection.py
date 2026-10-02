"""学習用runと管理用clientで共通の接続設定。"""

from __future__ import annotations

import os


def resolve_connection(api_url: str | None, token: str | None) -> tuple[str, str]:
    resolved_api_url = api_url or os.environ.get("ATMOS_API_URL")
    resolved_token = token or os.environ.get("ATMOS_TOKEN")
    if not resolved_api_url:
        raise ValueError(
            "atmos: api_url が指定されていません。"
            "api_url 引数か ATMOS_API_URL 環境変数で指定してください。"
        )
    if not resolved_token:
        raise ValueError(
            "atmos: token が指定されていません。"
            "token 引数か ATMOS_TOKEN 環境変数で指定してください。"
        )
    return resolved_api_url, resolved_token
