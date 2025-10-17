# Python Type Definitions Test Fixture
# Tests type_definition element extraction

from typing import TypeAlias, Union, List, Dict

# PEP 613 Type Aliases
UserId: TypeAlias = str
UserRole: TypeAlias = str

# Generic type aliases
Point: TypeAlias = tuple[float, float]
Matrix: TypeAlias = List[List[float]]

# Union types
Result: TypeAlias = Union[int, str, None]

# Complex type alias
ApiResponse: TypeAlias = Dict[str, Union[str, int, List[str]]]

# Protocol (structural typing)
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None:
        ...

class Closeable(Protocol):
    def close(self) -> None:
        ...

