// React Patterns Test Fixture
import React, { useState, useEffect } from 'react';

// React Hook
export function useCounter(initialValue: number = 0) {
    const [count, setCount] = useState(initialValue);
    
    useEffect(() => {
        console.log(`Count changed: ${count}`);
    }, [count]);
    
    return { count, setCount };
}

// React Component
export function MyComponent() {
    const { count, setCount } = useCounter();
    
    return (
        <div>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>Increment</button>
        </div>
    );
}

// Express Route Pattern
export function setupRoutes(app: any) {
    app.get('/api/users', (req: any, res: any) => {
        res.json({ users: [] });
    });
    
    app.post('/api/users', (req: any, res: any) => {
        res.json({ success: true });
    });
}

