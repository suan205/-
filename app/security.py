"""密码哈希（PBKDF2-SHA256）与 JWT 访问令牌。"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from .config import settings
from .database import get_auth_generation

_ALGORITHM = "HS256"
_PBKDF2_ITERATIONS = 600_000
_SALT_BYTES = 16


def hash_password(password: str) -> str:
    """生成格式为 pbkdf2_sha256$迭代次数$盐$哈希 的密码摘要。"""
    salt = os.urandom(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return "$".join(
        (
            "pbkdf2_sha256",
            str(_PBKDF2_ITERATIONS),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(digest).decode("ascii"),
        )
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = encoded.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64, validate=True)
        expected = base64.b64decode(digest_b64, validate=True)
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iterations)
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, binascii.Error):
        return False


# 用户不存在时也做一次同等开销的校验，避免通过响应时间枚举账号。
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def create_access_token(user_id: int) -> tuple[str, int]:
    """返回 (token, 有效期秒数)。"""
    expires_in = settings.access_token_expire_minutes * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "generation": get_auth_generation(),
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)
    return token, expires_in


def decode_access_token(token: str) -> int | None:
    """校验令牌并返回用户 ID；无效或过期时返回 None。"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if (
        payload.get("type") != "access"
        or payload.get("generation") != get_auth_generation()
    ):
        return None
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None
