const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let users = {};

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('joinRoom', ({ username, room }) => {
    users[socket.id] = { username, room };
    socket.join(room);

    // Notify others in the room
    socket.broadcast.to(room).emit('message', `🔵 ${username} joined the room`);

    console.log(`✅ ${username} joined room ${room}`);
  });

  socket.on('chatMessage', (msg) => {
    const user = users[socket.id];
    if (user) {
      io.to(user.room).emit('message', `${user.username}: ${msg}`);
    }
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      io.to(user.room).emit('message', `🔴 ${user.username} left the room`);
      delete users[socket.id];
    }
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

http.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
