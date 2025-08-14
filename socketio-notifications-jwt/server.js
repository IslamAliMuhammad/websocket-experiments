require('dotenv').config();
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// --- Simple "login" endpoint for testing ---
// In real app: validate username/password and issue token
app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });

  // payload can include user id, roles, etc.
  const payload = { userId: username, username }; // here userId == username for demo
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  return res.json({ token });
});

// --- Endpoint to send a notification to a user ---
// For demo: POST /notify { targetUserId, title, body }
app.post('/notify', (req, res) => {
  const { targetUserId, title, body } = req.body;
  if (!targetUserId || !title) return res.status(400).json({ error: 'targetUserId and title required' });

  // Emit to the specific user's room
  io.to(targetUserId).emit('notification', { title, body, time: new Date().toISOString() });

  // Optional: store notification in DB here

  return res.json({ ok: true, sentTo: targetUserId });
});


// --- Socket.IO authentication middleware ---
io.use((socket, next) => {
  // client should connect with: io({ auth: { token } })
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: token required'));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // attach user info to socket
    socket.user = {
      userId: payload.userId,
      username: payload.username
    };
    return next();
  } catch (err) {
    console.error('JWT verify error:', err.message);
    return next(new Error('Authentication error: invalid token'));
  }
});

// --- On connection ---
io.on('connection', (socket) => {
  const { userId, username } = socket.user;
  console.log(`🔌 ${username} connected (socket id: ${socket.id})`);

  // join a private room for this user (userId as room name)
  socket.join(userId);

  // optional: notify others that this user is online
  socket.broadcast.emit('presence', { userId, username, status: 'online' });

  // example: client can request its missed notifications (if we stored them)
  socket.on('getMissed', () => {
    // fetch from DB if implemented, then emit back:
    // socket.emit('missed', [...])
  });

  socket.on('disconnect', () => {
    console.log(`❌ ${username} disconnected`);
    socket.broadcast.emit('presence', { userId, username, status: 'offline' });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
