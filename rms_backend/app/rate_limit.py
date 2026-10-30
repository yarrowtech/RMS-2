"""Shared slowapi Limiter instance.

Lives in its own module (not inside main.py) so route files can import it
for per-endpoint @limiter.limit(...) decorators without a circular import —
main.py imports every route router, so a route importing back from main.py
would be circular.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])
