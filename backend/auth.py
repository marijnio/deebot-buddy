"""Zero-dependency authentication, PBKDF2 password hashing, signed cookies, and rate limiting."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from typing import Any

COOKIE_NAME = "deebot_session"
PBKDF2_ITERATIONS = 200_000
REMEMBER_TTL_SECONDS = 30 * 86400
SESSION_TTL_SECONDS = 12 * 3600
INTERNAL_SETTING_KEYS = {"auth_password_hash", "auth_secret"}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${salt.hex()}${dk.hex()}"


def verify_password_hash(password: str, stored_hash: str) -> bool:
    try:
        scheme, salt_hex, dk_hex = stored_hash.split("$", 2)
        if scheme != "pbkdf2_sha256":
            return False
        salt = bytes.fromhex(salt_hex)
        expected_dk = bytes.fromhex(dk_hex)
    except (ValueError, TypeError):
        return False

    dk = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return hmac.compare_digest(dk, expected_dk)


def is_env_password_set() -> bool:
    return bool(os.environ.get("DEEBOT_PASSWORD", "").strip())


def _get_setting(conn: sqlite3.Connection, key: str) -> str:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else ""


def get_or_create_auth_secret(conn: sqlite3.Connection) -> str:
    env_secret = os.environ.get("DEEBOT_SESSION_SECRET", "").strip()
    if env_secret:
        return env_secret

    existing = _get_setting(conn, "auth_secret")
    if existing:
        return existing

    new_secret = secrets.token_hex(32)
    conn.execute(
        """
        INSERT INTO settings (key, value) VALUES ('auth_secret', ?)
        ON CONFLICT(key) DO NOTHING
        """,
        (new_secret,),
    )
    conn.commit()
    return _get_setting(conn, "auth_secret") or new_secret


def get_auth_state(conn: sqlite3.Connection) -> dict[str, Any]:
    env_pw = os.environ.get("DEEBOT_PASSWORD", "").strip()
    secret = get_or_create_auth_secret(conn)

    if env_pw:
        fingerprint = hashlib.sha256(f"env:{env_pw}".encode("utf-8")).hexdigest()[:16]
        return {
            "password_enabled": True,
            "managed_by_env": True,
            "password_hash": "",
            "secret": secret,
            "fingerprint": fingerprint,
        }

    stored_hash = _get_setting(conn, "auth_password_hash")
    if stored_hash:
        fingerprint = hashlib.sha256(f"db:{stored_hash}".encode("utf-8")).hexdigest()[:16]
        return {
            "password_enabled": True,
            "managed_by_env": False,
            "password_hash": stored_hash,
            "secret": secret,
            "fingerprint": fingerprint,
        }

    return {
        "password_enabled": False,
        "managed_by_env": False,
        "password_hash": "",
        "secret": secret,
        "fingerprint": "",
    }


def verify_credentials(conn: sqlite3.Connection, password: str) -> bool:
    state = get_auth_state(conn)
    if not state["password_enabled"]:
        return True
    if state["managed_by_env"]:
        env_pw = os.environ.get("DEEBOT_PASSWORD", "").strip()
        return hmac.compare_digest(password.encode("utf-8"), env_pw.encode("utf-8"))
    return verify_password_hash(password, state["password_hash"])


def create_session_token(secret: str, fingerprint: str, ttl_seconds: int) -> str:
    expires_ts = int(time.time()) + ttl_seconds
    payload = f"{expires_ts}.{fingerprint}"
    sig = hmac.new(
        secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return f"{payload}.{sig}"


def verify_session_token(
    token: str, secret: str, expected_fingerprint: str
) -> bool:
    if not token or not expected_fingerprint:
        return False
    try:
        expires_str, fingerprint, sig = token.split(".", 2)
        expires_ts = int(expires_str)
    except (ValueError, TypeError):
        return False

    if expires_ts <= int(time.time()):
        return False
    if not hmac.compare_digest(fingerprint, expected_fingerprint):
        return False

    payload = f"{expires_str}.{fingerprint}"
    expected_sig = hmac.new(
        secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(sig, expected_sig)


class LoginRateLimiter:
    """In-memory per-IP sliding-window limiter for failed login attempts."""

    def __init__(self, max_attempts: int = 10, window_seconds: int = 600) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, ip: str, now: float) -> deque[float]:
        q = self._attempts[ip]
        cutoff = now - self.window_seconds
        while q and q[0] < cutoff:
            q.popleft()
        return q

    def is_blocked(self, ip: str) -> int:
        now = time.monotonic()
        q = self._prune(ip, now)
        if len(q) >= self.max_attempts:
            return max(1, int(self.window_seconds - (now - q[0])))
        return 0

    def record_failure(self, ip: str) -> None:
        now = time.monotonic()
        q = self._prune(ip, now)
        q.append(now)

    def reset(self, ip: str) -> None:
        self._attempts.pop(ip, None)


login_rate_limiter = LoginRateLimiter()
