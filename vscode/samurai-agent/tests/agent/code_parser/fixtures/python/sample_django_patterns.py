# Django/Flask Patterns Test Fixture
from django.http import HttpResponse, HttpRequest
from dataclasses import dataclass

# Django View
def user_list_view(request: HttpRequest) -> HttpResponse:
    users = []
    return HttpResponse('User list')

# Dataclass
@dataclass
class UserDTO:
    id: int
    name: str
    email: str

# FastAPI-like pattern
def get_users():
    """FastAPI endpoint"""
    return {"users": []}

# Entry point (main function)
def main():
    """Main entry point"""
    if __name__ == "__main__":
        print("Starting application")
        app.run()

main()

