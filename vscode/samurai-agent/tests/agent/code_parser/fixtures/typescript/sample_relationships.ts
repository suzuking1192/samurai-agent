// TypeScript Relationships Test Fixture
// Tests call graph, inheritance, and type dependencies

import { User } from './types';

// Call graph test
export function processUser(userId: string): User | null {
    const user = getUserById(userId);
    if (user) {
        validateUser(user);
        sendNotification(user);
    }
    return user;
}

function getUserById(id: string): User | null {
    return null;
}

function validateUser(user: User): boolean {
    return true;
}

function sendNotification(user: User): void {
    console.log('Sending notification');
}

// Inheritance test
export class Animal {
    name: string;
    
    constructor(name: string) {
        this.name = name;
    }
    
    makeSound(): void {
        console.log('Some sound');
    }
}

export class Dog extends Animal {
    breed: string;
    
    constructor(name: string, breed: string) {
        super(name);
        this.breed = breed;
    }
    
    makeSound(): void {
        console.log('Woof!');
    }
}

// Interface implementation
export interface Drawable {
    draw(): void;
}

export interface Colorable {
    setColor(color: string): void;
}

export class Shape implements Drawable, Colorable {
    draw(): void {
        console.log('Drawing shape');
    }
    
    setColor(color: string): void {
        console.log(`Setting color to ${color}`);
    }
}

// Type dependencies
export type ResponseData<T> = {
    data: T;
    metadata: Metadata;
};

export type Metadata = {
    timestamp: number;
    version: string;
};

export function fetchData<T>(url: string): ResponseData<T> {
    return {} as ResponseData<T>;
}

