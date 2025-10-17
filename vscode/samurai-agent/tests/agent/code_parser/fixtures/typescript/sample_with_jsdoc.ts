// TypeScript with JSDoc Test Fixture
// Tests documentation extraction

/**
 * Calculates the sum of two numbers
 * @param a The first number
 * @param b The second number
 * @returns The sum of a and b
 * @example
 * add(2, 3) // returns 5
 */
export function add(a: number, b: number): number {
    return a + b;
}

/**
 * User class representing a user entity
 * @deprecated Use NewUser instead
 */
export class User {
    /**
     * Gets the full name of the user
     * @returns The full name
     */
    getFullName(): string {
        return "John Doe";
    }
}

/**
 * Validates an email address
 * @param email The email to validate
 * @returns True if valid, false otherwise
 * @throws {ValidationError} If email format is invalid
 */
export function validateEmail(email: string): boolean {
    // Validation logic here
    return true;
}

