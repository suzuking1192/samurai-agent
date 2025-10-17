# Python Relationships Test Fixture
# Tests call graph, inheritance, and type dependencies

from typing import Optional

# Call graph test
def process_user(user_id: str) -> Optional[dict]:
    user = get_user_by_id(user_id)
    if user:
        validate_user(user)
        send_notification(user)
    return user

def get_user_by_id(user_id: str) -> Optional[dict]:
    return None

def validate_user(user: dict) -> bool:
    return True

def send_notification(user: dict) -> None:
    print('Sending notification')

# Inheritance test
class Animal:
    def __init__(self, name: str):
        self.name = name
    
    def make_sound(self) -> None:
        print('Some sound')

class Dog(Animal):
    def __init__(self, name: str, breed: str):
        super().__init__(name)
        self.breed = breed
    
    def make_sound(self) -> None:
        print('Woof!')

# Multiple inheritance / Mixins
class Serializable:
    def to_json(self) -> str:
        return '{}'

class Timestamped:
    def get_timestamp(self) -> int:
        return 0

class User(Serializable, Timestamped):
    def __init__(self, name: str):
        self.name = name

