const io = require('socket.io-client');
const socket = io('http://127.0.0.1:3001');

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('adminLogin', '1234', (res) => {
    console.log('adminLogin res:', res);
    socket.emit('joinRole', { role: 'Norte', profileId: null, name: 'Administrador' });
    setTimeout(() => process.exit(0), 1000);
  });
});

socket.on('disconnect', () => console.log('Disconnected'));
