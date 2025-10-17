# Python Constants Test Fixture
# Tests constant element extraction

# Module-level constants (UPPER_CASE convention)
API_BASE_URL = 'https://api.example.com'
MAX_RETRIES = 3
TIMEOUT_SECONDS = 30
DEFAULT_PAGE_SIZE = 20

# Configuration constants
DATABASE_HOST = 'localhost'
DATABASE_PORT = 5432
DATABASE_NAME = 'myapp'

# Feature flags
ENABLE_CACHING = True
ENABLE_LOGGING = False

# Math constants
PI = 3.14159265359
E = 2.71828182846

# Regular variables (should not be extracted as constants)
counter = 0
temp_value = 'test'

# __all__ for exports
__all__ = [
    'API_BASE_URL',
    'MAX_RETRIES',
    'TIMEOUT_SECONDS',
    'DEFAULT_PAGE_SIZE'
]

