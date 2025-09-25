// Test script to verify JavaScript execution in webview
console.log('Test: External JavaScript file loaded');
alert('External JavaScript is working!');

// Test if we can access the DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('Test: DOMContentLoaded event fired');
    alert('DOM is ready!');
});

