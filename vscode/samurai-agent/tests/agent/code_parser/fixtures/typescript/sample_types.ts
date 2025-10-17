// TypeScript Type Definitions Test Fixture
// Tests type_definition element extraction

export type UserId = string;
export type UserRole = 'admin' | 'user' | 'guest';

type Point = {
    x: number;
    y: number;
};

export type GenericResponse<T> = {
    data: T;
    status: number;
    message: string;
};

// Interface for comparison
export interface User {
    id: UserId;
    name: string;
    role: UserRole;
}

// Type alias with generics
export type ApiResult<T, E = Error> = 
    | { success: true; data: T }
    | { success: false; error: E };

