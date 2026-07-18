"""Email delivery + signed action tokens (verification, password reset).

Tokens are stateless signed JWTs (purpose + expiry), so no database storage is
needed. If SMTP is not configured, emails are logged instead of sent — the flows
still work end-to-end for local development, and production just sets SMTP_*.
"""

from __future__ import annotations

import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from jose import JWTError, jwt

from .config import settings

logger = logging.getLogger("clt-tj.email")


def make_token(subject: str | int, purpose: str, expires_minutes: int) -> str:
    payload = {
        "sub": str(subject),
        "purpose": purpose,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def read_token(token: str, purpose: str) -> str | None:
    """Return the subject if the token is valid and matches the purpose, else None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    if payload.get("purpose") != purpose:
        return None
    return payload.get("sub")


def send_email(to: str, subject: str, body: str) -> None:
    """Send an email, or log it when SMTP is not configured."""
    if not settings.email_enabled:
        logger.info("[email:dev] To: %s | %s\n%s", to, subject, body)
        return
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_tls:
                server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
    except Exception as exc:  # pragma: no cover - network dependent
        logger.error("Failed to send email to %s: %s", to, exc)


def send_verification_email(to: str, user_id: int) -> None:
    token = make_token(user_id, "verify", expires_minutes=60 * 24)
    link = f"{settings.frontend_url}/verify?token={token}"
    send_email(
        to,
        "Verify your CLT Trading Journal email",
        f"Welcome to CLT Trading Journal!\n\nConfirm your email address:\n{link}\n\n"
        f"This link expires in 24 hours.",
    )


def send_password_reset_email(to: str, user_id: int) -> None:
    token = make_token(user_id, "reset", expires_minutes=30)
    link = f"{settings.frontend_url}/reset?token={token}"
    send_email(
        to,
        "Reset your CLT Trading Journal password",
        f"We received a request to reset your password.\n\nReset it here:\n{link}\n\n"
        f"This link expires in 30 minutes. If you didn't request this, ignore this email.",
    )
