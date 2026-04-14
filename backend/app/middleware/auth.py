"""
Supabase JWT verification and subscription enforcement dependencies for FastAPI.
"""

import json
import os
from datetime import datetime, timezone
from typing import Annotated, Optional

import jwt
from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePublicKey
from jwt.algorithms import ECAlgorithm
from fastapi import Depends, Header, HTTPException

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# EC public key JWK for ES256 (new Supabase projects)
_SUPABASE_JWT_JWKS_RAW = os.getenv("SUPABASE_JWT_JWKS", "")
# Legacy HS256 secret (old Supabase projects)
_SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def _build_ec_public_key() -> Optional[EllipticCurvePublicKey]:
    if not _SUPABASE_JWT_JWKS_RAW:
        return None
    try:
        jwk = json.loads(_SUPABASE_JWT_JWKS_RAW)
        return ECAlgorithm.from_jwk(jwk)
    except Exception:
        return None


_EC_PUBLIC_KEY = _build_ec_public_key()


def _get_supabase_admin():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(500, "Supabase is not configured on the server")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


async def verify_token(
    authorization: Annotated[Optional[str], Header()] = None,
) -> str:
    """Validate Supabase JWT (ES256 or HS256) and return the user ID (sub claim)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")

    token = authorization.removeprefix("Bearer ").strip()

    if not _EC_PUBLIC_KEY and not _SUPABASE_JWT_SECRET:
        raise HTTPException(500, "JWT verification is not configured on the server")

    try:
        if _EC_PUBLIC_KEY:
            payload = jwt.decode(
                token,
                _EC_PUBLIC_KEY,
                algorithms=["ES256"],
                options={"require": ["sub", "exp"]},
                audience="authenticated",
            )
        else:
            payload = jwt.decode(
                token,
                _SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"require": ["sub", "exp"]},
                audience="authenticated",
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Invalid or expired token")
    except jwt.InvalidTokenError as e:
        import logging
        logging.getLogger(__name__).error("JWT invalid: %s", e)
        raise HTTPException(401, "Invalid or expired token")

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Invalid or expired token")

    return user_id


async def require_active_subscription(
    user_id: Annotated[str, Depends(verify_token)],
) -> str:
    """Reject if the user's trial has expired or subscription is inactive. Returns user_id."""
    if os.getenv("SKIP_SUBSCRIPTION_CHECK", "").lower() in ("1", "true"):
        return user_id

    sb = _get_supabase_admin()
    result = (
        sb.table("profiles")
        .select("subscription_status, trial_ends_at")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(403, "Profile not found")

    status = result.data.get("subscription_status", "")
    trial_ends_at = result.data.get("trial_ends_at")

    if status == "premium":
        return user_id

    if status == "trialing" and trial_ends_at:
        ends = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
        if ends > datetime.now(timezone.utc):
            return user_id

    raise HTTPException(403, "Trial expired. Subscribe to continue.")
