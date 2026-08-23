const greet = require('./app');

const result = greet('Jenkins');

if (result !== 'Hello, Jenkins!') {
    console.error('Test failed');
    process.exit(1);
}

console.log('Test passed');
