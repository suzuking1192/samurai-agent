# Python with Docstrings Test Fixture
# Tests documentation extraction

def add(a: int, b: int) -> int:
    """
    Calculates the sum of two numbers.
    
    Args:
        a (int): The first number
        b (int): The second number
        
    Returns:
        int: The sum of a and b
    """
    return a + b

class User:
    """
    User class representing a user entity.
    
    This class provides methods for user management.
    """
    
    def __init__(self, name: str):
        """
        Initialize a new User instance.
        
        Parameters:
            name (str): The user's name
        """
        self.name = name
    
    def get_full_name(self) -> str:
        """Get the full name of the user.
        
        Returns:
            str: The full name
        """
        return self.name

def validate_email(email: str) -> bool:
    """
    Validates an email address.
    
    Args:
        email: The email to validate
        
    Returns:
        True if valid, False otherwise
        
    Raises:
        ValueError: If email format is invalid
    """
    # Validation logic here
    return True

