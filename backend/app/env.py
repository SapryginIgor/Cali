"""Backend environment loading helpers."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


def _env_file_candidates() -> list[Path]:
    configured_path = os.getenv("BACKEND_ENV_FILE") or os.getenv("ENV_FILE")
    candidates: list[Path] = []
    if configured_path:
        candidates.append(Path(configured_path))

    backend_root = Path(__file__).resolve().parents[1]
    cwd = Path.cwd()
    candidates.extend(
        [
            cwd / ".env",
            cwd / "backend" / ".env",
            backend_root / ".env",
            Path("/app/.env"),
            Path("/app/backend/.env"),
            Path("/etc/cali/backend.env"),
        ]
    )

    deduped: list[Path] = []
    seen: set[str] = set()
    for path in candidates:
        key = str(path)
        if key not in seen:
            deduped.append(path)
            seen.add(key)
    return deduped


def load_backend_env() -> list[str]:
    """Load backend env files from explicit and deployment-friendly paths.

    Existing process env values win over file values, so platform-provided
    secrets still take priority when they are actually injected.
    """
    loaded_paths: list[str] = []
    for path in _env_file_candidates():
        if path.exists():
            load_dotenv(path, override=False)
            loaded_paths.append(str(path))
    return loaded_paths


def get_env_file_status() -> dict[str, object]:
    """Return non-secret env-file diagnostics."""
    candidates = _env_file_candidates()
    existing = [str(path) for path in candidates if path.exists()]
    return {
        "configuredPath": os.getenv("BACKEND_ENV_FILE") or os.getenv("ENV_FILE") or None,
        "existing": existing,
        "checked": [str(path) for path in candidates],
    }
