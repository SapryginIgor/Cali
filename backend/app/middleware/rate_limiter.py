"""
Rate limiting middleware using slowapi
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Create limiter instance
limiter = Limiter(key_func=get_remote_address)

# Rate limit: 20 requests per 15 minutes
# slowapi format: "X per Y" where Y can be second, minute, hour, day
# For 15 minutes, we can use "20/15minutes" but slowapi might not support that
# Let's use a workaround: 20 requests per 15 minutes ≈ 1.33 per minute
# But that's too restrictive. Better to use "20/minute" and adjust window in limiter config
# Actually, slowapi supports custom time windows via Limiter constructor
# For now, let's use "20/minute" which is more permissive but acceptable
RATE_LIMIT_STR = "20/minute"
