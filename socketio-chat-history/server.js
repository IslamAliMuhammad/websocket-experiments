require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error(err));

// Define message schema and model
const messageSchema = new mongoose.Schema({
  username: String,
  room: String,
  msg: String,
  time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// Store users data in memory 
let users = {};

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('joinRoom', async ({ username, room }) => {
    users[socket.id] = { username, room };
    socket.join(room);

    // Send old chat history for the room
    const history = await Message.find({ room }).sort({ time: 1 }).limit(20);
    socket.emit('chatHistory', history);

    // Join notification 
    socket.broadcast.to(room).emit('message', `🔵 ${username} joined the room`);
  });

  socket.on('chatMessage', async (msg) => {
    const user = users[socket.id];
    if (user) {
      const newMessage = new Message({
        username: user.username,
        room: user.room,
        msg
      });
      await newMessage.save();
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

http.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
