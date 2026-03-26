"""Lazy-initialised OpenAI client singleton."""

import os
from typing import Optional

from openai import AsyncOpenAI

from app.exceptions import AppError

_openai_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    """Get or create the OpenAI client (initialises on first call)."""
    global _openai_client

    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise AppError(500, "OpenAI API key not configured")

        _openai_client = AsyncOpenAI(api_key=api_key)

    return _openai_client
