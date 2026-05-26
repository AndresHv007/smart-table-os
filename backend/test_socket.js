const io = require('socket.io-client');
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected');
  
  socket.emit('joinRole', { role: 'Norte', name: 'TestHost' });
  
  setTimeout(() => {
    socket.emit('updateModules', { dice: { enabled: true, count: 5, faces: 20 } });
    console.log('Sent updateModules');
  }, 1000);
});

socket.on('gameState', (state) => {
  console.log('Got gameState with dice count:', state.modules.dice.count);
});

setTimeout(() => {
  process.exit(0);
}, 3000);
