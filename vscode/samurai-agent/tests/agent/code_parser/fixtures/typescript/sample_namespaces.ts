// TypeScript Namespace Test Fixture
// Tests namespace element extraction

export namespace Utils {
    export function formatDate(date: Date): string {
        return date.toISOString();
    }

    export function parseDate(str: string): Date {
        return new Date(str);
    }
}

namespace Internal {
    export const VERSION = '1.0.0';
    
    export class Logger {
        log(message: string) {
            console.log(message);
        }
    }
}

export namespace API {
    export namespace V1 {
        export interface User {
            id: string;
            name: string;
        }
    }

    export namespace V2 {
        export interface User {
            id: string;
            firstName: string;
            lastName: string;
        }
    }
}

