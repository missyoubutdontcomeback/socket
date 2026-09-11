const { spawn } = require('child_process');

// Start Socket.IO server
const socketServer = spawn('node', ['server.js']);

socketServer.stdout.on('data', (data) => {
    console.log(`[Socket.IO] ${data}`);
});

socketServer.stderr.on('data', (data) => {
    console.error(`[Socket.IO Error] ${data}`);
});

// Start Next.js
const nextServer = spawn('npm', ['start']);

nextServer.stdout.on('data', (data) => {
    console.log(`[Next.js] ${data}`);
});

nextServer.stderr.on('data', (data) => {
    console.error(`[Next.js Error] ${data}`);
});

// Handle process termination
process.on('SIGTERM', () => {
    socketServer.kill();
    nextServer.kill();
    process.exit(0);
});

process.on('SIGINT', () => {
    socketServer.kill();
    nextServer.kill();
    process.exit(0);
});

console.log('Starting Pig Me application...');
console.log('Socket.IO server on port 3001');
console.log('Next.js app on port 3000');
