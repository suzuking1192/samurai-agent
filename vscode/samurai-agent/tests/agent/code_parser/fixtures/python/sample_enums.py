# Python Enum Test Fixture
# Tests enum element extraction

from enum import Enum, IntEnum, Flag, auto

class Status(Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    PENDING = 'pending'

class HttpMethod(Enum):
    GET = 'GET'
    POST = 'POST'
    PUT = 'PUT'
    DELETE = 'DELETE'

class Priority(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

class Permission(Flag):
    READ = auto()
    WRITE = auto()
    EXECUTE = auto()
    ALL = READ | WRITE | EXECUTE

# Enum with methods
class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3

    def is_primary(self) -> bool:
        return self in (Color.RED, Color.GREEN, Color.BLUE)

