#!/usr/bin/env node

// Test the colon fixing regex specifically
const testCases = [
    'J[DOM: chatMessages Element]',
    'J[DOM:chatMessages Element]',
    'K(renderAssistantResponse(messageElement, message))',
    'A[Test: Something]',
    'B(Test: Something)',
];

console.log('=== TESTING COLON FIX REGEX ===\n');

// Method 1: Current implementation (with test)
console.log('Method 1: Using test() then replace()');
testCases.forEach(input => {
    const labelColonRegex = /(\[|\()([^\]\)]*?):([^\]\)]*?)(\]|\))/g;
    const hasMatch = labelColonRegex.test(input);
    const output = input.replace(/(\[|\()([^\]\)]*?):([^\]\)]*?)(\]|\))/g, '$1$2 $3$4');
    console.log(`  Input:  "${input}"`);
    console.log(`  Match:  ${hasMatch}`);
    console.log(`  Output: "${output}"`);
    console.log(`  Fixed:  ${input !== output}\n`);
});

console.log('\n=== METHOD 2: Just replace without test ===\n');
testCases.forEach(input => {
    const output = input.replace(/(\[|\()([^\]\)]*?):([^\]\)]*?)(\]|\))/g, '$1$2 $3$4');
    console.log(`  Input:  "${input}"`);
    console.log(`  Output: "${output}"`);
    console.log(`  Fixed:  ${input !== output}\n`);
});

// Test with full line
console.log('\n=== TESTING FULL LINE ===\n');
const fullLine = '    I --7. Renders basic content & H3 directly to DOM--> J[DOM: chatMessages Element]';
console.log(`Input:  "${fullLine}"`);
const fixed = fullLine.replace(/(\[|\()([^\]\)]*?):([^\]\)]*?)(\]|\))/g, '$1$2 $3$4');
console.log(`Output: "${fixed}"`);
console.log(`Fixed:  ${fullLine !== fixed}`);

