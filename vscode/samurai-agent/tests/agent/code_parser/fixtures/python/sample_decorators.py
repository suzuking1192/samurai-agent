# Python Decorators Test Fixture
# Tests annotation element extraction

from functools import wraps
from typing import Callable

def log_calls(func: Callable) -> Callable:
    """Decorator to log function calls"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

def cache_result(func: Callable) -> Callable:
    """Decorator to cache function results"""
    cache = {}
    @wraps(func)
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
        return cache[args]
    return wrapper

def require_auth(func: Callable) -> Callable:
    """Decorator to require authentication"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Check authentication
        return func(*args, **kwargs)
    return wrapper

class MyService:
    @log_calls
    def process(self, data: str) -> str:
        return data.upper()

    @cache_result
    def expensive_operation(self, n: int) -> int:
        return n * n

@log_calls
@require_auth
def protected_function():
    return "secret data"

# Property decorators
class User:
    def __init__(self, first: str, last: str):
        self._first = first
        self._last = last

    @property
    def full_name(self) -> str:
        return f"{self._first} {self._last}"

    @full_name.setter
    def full_name(self, value: str):
        self._first, self._last = value.split()

