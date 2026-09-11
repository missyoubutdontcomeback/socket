const { spawn } = require('child_process');

console.log('🚀 Starting Pig Me Development Server...\n');

// Start Socket.IO server
console.log('📡 Starting Socket.IO server on port 3001...');
const socketServer = spawn('node', ['server.js'], {
    stdio: 'inherit',
    shell: true
});

// Wait a bit then start Next.js
setTimeout(() => {
    console.log('\n🎨 Starting Next.js on port 3000...');
    const nextServer = spawn('npm', ['run', 'dev:next'], {
        stdio: 'inherit',
        shell: true
    });

    nextServer.on('error', (error) => {
        console.error('Failed to start Next.js:', error);
    });
}, 1000);

socketServer.on('error', (error) => {
    console.error('Failed to start Socket.IO:', error);
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});
