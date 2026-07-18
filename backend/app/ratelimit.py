"""A minimal in-process sliding-window rate limiter.

Suitable for a single-process deployment (the default here). For multi-worker
or multi-instance deployments, swap this for a Redis-backed limiter. Used to
throttle authentication endpoints against brute-force attempts.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        q = self._hits[key]
        cutoff = now - self.window
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= self.max_requests:
            retry = int(self.window - (now - q[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait and try again.",
                headers={"Retry-After": str(retry)},
            )
        q.append(now)


def _client_key(request: Request, scope: str) -> str:
    client = request.client.host if request.client else "unknown"
    return f"{scope}:{client}"


# 10 auth attempts per minute per IP.
_auth_limiter = SlidingWindowLimiter(max_requests=10, window_seconds=60)


def auth_rate_limit(request: Request) -> None:
    """FastAPI dependency: throttle authentication attempts per client IP."""
    _auth_limiter.check(_client_key(request, "auth"))
