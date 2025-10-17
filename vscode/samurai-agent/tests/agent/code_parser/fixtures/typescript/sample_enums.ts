// TypeScript Enum Test Fixture
// Tests enum element extraction

export enum Status {
    Active = 'active',
    Inactive = 'inactive',
    Pending = 'pending'
}

enum HttpMethod {
    GET,
    POST,
    PUT,
    DELETE
}

export enum Color {
    Red = '#FF0000',
    Green = '#00FF00',
    Blue = '#0000FF'
}

// Const enum (optimization)
const enum Direction {
    Up = 1,
    Down = 2,
    Left = 3,
    Right = 4
}

export { HttpMethod, Direction };

