const http = require('http');

function greet(name) {
    return `Hello, ${name}!`;
}

if (require.main === module) {
    const server = http.createServer((req, res) => {

        // Health check endpoint
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
            return;
        }

        // Normal application response
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(greet('Jenkins CI/CD'));
    });

    server.listen(3000, '0.0.0.0', () => {
        console.log('Server running on port 3000');
    });
}

module.exports = greet;