"""SQLite 访问层：每次操作使用独立连接，简单且线程安全。"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email         TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    generation TEXT NOT NULL
);
INSERT OR IGNORE INTO auth_state (id, generation)
VALUES (1, lower(hex(randomblob(32))));
"""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(settings.database_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    db_path: Path = settings.database_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)


def get_auth_generation() -> str:
    """数据库重建后标识随之改变，使旧 Token 失效，即使签名密钥不变。"""
    with get_connection() as conn:
        return conn.execute(
            "SELECT generation FROM auth_state WHERE id = 1"
        ).fetchone()[0]


def create_user(username: str, email: str, password_hash: str) -> sqlite3.Row | None:
    """创建用户；用户名或邮箱冲突时返回 None（唯一索引兜底）。"""
    with get_connection() as conn:
        try:
            cursor = conn.execute(
                """
                INSERT INTO users (username, email, password_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (username, email, password_hash, utc_now_iso()),
            )
        except sqlite3.IntegrityError:
            return None
        return conn.execute(
            "SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()


def get_user_by_id(user_id: int) -> sqlite3.Row | None:
    with get_connection() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()


def get_user_by_account(account: str) -> sqlite3.Row | None:
    """按邮箱或用户名查找（不区分大小写）。"""
    with get_connection() as conn:
        return conn.execute(
            """
            SELECT * FROM users
            WHERE email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE
            LIMIT 1
            """,
            (account, account),
        ).fetchone()


def username_exists(username: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE",
            (username,),
        ).fetchone()
        return row is not None


def email_exists(email: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM users WHERE email = ? COLLATE NOCASE",
            (email,),
        ).fetchone()
        return row is not None


def clear_database() -> None:
    """供清库脚本调用，复用服务配置。"""
    db_path = settings.database_path
    files = [Path(str(db_path) + suffix) for suffix in ("", "-wal", "-shm", "-journal")]
    print(f"Database: {db_path.resolve()}")
    if not any(path.exists() for path in files):
        print("No database files found. Nothing to clear.")
        return
    print("WARNING: ALL accounts will be deleted. Stop the backend first (Ctrl+C).")
    if input("Type YES to continue: ").strip().upper() != "YES":
        print("Cancelled. Database was not changed.")
        return
    for path in files:
        path.unlink(missing_ok=True)
    print("Done. Restart the backend. Old tokens will be invalid in the new database.")


if __name__ == "__main__":
    import sys

    if sys.argv[1:] != ["--clear"]:
        raise SystemExit("Usage: python -m app.database --clear")
    try:
        clear_database()
    except (OSError, EOFError) as exc:
        print(f"ERROR: {exc}. Stop the backend and check file permissions.")
        raise SystemExit(1)
