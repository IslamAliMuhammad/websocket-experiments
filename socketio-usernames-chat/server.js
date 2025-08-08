const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Configure Express to serve static files from the 'public' directory
app.use(express.static('public'));

// Store usernames in an object for each connected socket
let users = {};

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Receive username from the client
  socket.on('setUsername', (username) => {
    users[socket.id] = username;
    console.log(`✅ Username set for ${socket.id}: ${username}`);

    // Notify other clients that a new user has joined
    socket.broadcast.emit('userJoined', `${username} joined the chat`);
  });

  // Receive chat messages from the client
  socket.on('chatMessage', (msg) => {
    const username = users[socket.id] || 'Anonymous';
    io.emit('chatMessage', { username, msg });
  });

  // When a user disconnects, remove them from the users object
  socket.on('disconnect', () => {
    const username = users[socket.id];
    delete users[socket.id];
    if (username) {
      io.emit('userLeft', `${username} left the chat`);
    }
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

http.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
