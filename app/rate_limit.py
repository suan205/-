"""基于内存的简易 IP 限流（单进程）。

多实例部署时请替换为 Redis 等共享存储方案。
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

from .config import settings

_WINDOW_SECONDS = 60.0
_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def rate_limit(request: Request) -> None:
    limit = settings.rate_limit_per_minute
    if limit <= 0:
        return

    client = request.client.host if request.client else "unknown"
    now = time.monotonic()

    with _lock:
        # 定期清理过期来源，避免字典无限增长。
        if len(_hits) > 4096:
            stale = [
                key
                for key, bucket in _hits.items()
                if not bucket or now - bucket[-1] > _WINDOW_SECONDS
            ]
            for key in stale:
                _hits.pop(key, None)

        bucket = _hits[client]
        while bucket and now - bucket[0] > _WINDOW_SECONDS:
            bucket.popleft()

        if len(bucket) >= limit:
            retry_after = max(1, int(_WINDOW_SECONDS - (now - bucket[0])) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"请求过于频繁，请 {retry_after} 秒后再试",
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)
