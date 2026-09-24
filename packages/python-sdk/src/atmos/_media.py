"""画像・音声ファイルのcontent_type推定。

`docs/SPEC.md` 9節が受け付けるのは以下のみ:
- image: image/png, image/jpeg, image/webp
- audio: audio/wav, audio/mpeg

標準ライブラリの`mimetypes`は`.wav`を`audio/x-wav`と推定する環境があるため、
既知のエイリアスは正規化してから許可リストと突き合わせる。
"""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Literal

MediaKind = Literal["image", "audio"]

_ALLOWED_CONTENT_TYPES: dict[MediaKind, frozenset[str]] = {
    "image": frozenset({"image/png", "image/jpeg", "image/webp"}),
    "audio": frozenset({"audio/wav", "audio/mpeg"}),
}

_CONTENT_TYPE_ALIASES: dict[str, str] = {
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/vnd.wave": "audio/wav",
}


def guess_content_type(path: Path, kind: MediaKind) -> str:
    """ファイル名からAPIが受け付けるcontent_typeを推定する。

    推定できない、または`kind`に対して許可されていない形式の場合は`ValueError`を送出する。
    """
    guessed, _ = mimetypes.guess_type(path.name)
    if guessed is not None:
        guessed = _CONTENT_TYPE_ALIASES.get(guessed, guessed)

    allowed = _ALLOWED_CONTENT_TYPES[kind]
    if guessed is not None and guessed in allowed:
        return guessed

    raise ValueError(
        f"{path} のcontent_typeを{kind}として推定できませんでした"
        f"（推定結果: {guessed!r}、許可されている形式: {sorted(allowed)}）"
    )
