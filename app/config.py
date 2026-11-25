"""应用配置：从环境变量 / .env 读取，未提供 SECRET_KEY 时自动生成并持久化。"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """极简 .env 解析：KEY=VALUE，已存在的环境变量优先。"""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


_load_dotenv(BASE_DIR / ".env")


def _resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else BASE_DIR / path


def _int_env(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"环境变量 {name} 必须是整数，当前值：{raw!r}") from exc
    if value < minimum:
        raise RuntimeError(f"环境变量 {name} 不能小于 {minimum}，当前值：{value}")
    return value


def _load_or_create_secret(data_dir: Path) -> str:
    env_secret = os.getenv("SECRET_KEY", "").strip()
    if env_secret:
        return env_secret

    key_file = data_dir / "secret.key"
    if key_file.is_file():
        saved = key_file.read_text(encoding="utf-8").strip()
        if saved:
            return saved

    data_dir.mkdir(parents=True, exist_ok=True)
    generated = secrets.token_urlsafe(48)
    key_file.write_text(generated, encoding="utf-8")
    try:
        key_file.chmod(0o600)
    except OSError:
        # Windows 上 chmod 支持有限，失败不影响使用。
        pass
    return generated


DATA_DIR = _resolve_path(os.getenv("DATA_DIR", "data"))


@dataclass(frozen=True)
class Settings:
    app_name: str = "登录注册 API"
    data_dir: Path = DATA_DIR
    database_path: Path = _resolve_path(
        os.getenv("DATABASE_PATH", str(DATA_DIR / "app.db"))
    )
    secret_key: str = _load_or_create_secret(DATA_DIR)
    access_token_expire_minutes: int = _int_env(
        "ACCESS_TOKEN_EXPIRE_MINUTES", 1440
    )
    rate_limit_per_minute: int = _int_env("RATE_LIMIT_PER_MINUTE", 20, minimum=0)
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5500,http://127.0.0.1:5500,"
            "http://localhost:5501,http://127.0.0.1:5501,"
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    )


settings = Settings()
