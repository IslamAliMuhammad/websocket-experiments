require('dotenv').config();
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/socketio_notifs';

// --- MongoDB connection ---
mongoose
  .connect(MONGO_URI, { dbName: 'socketio_notifs' })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((e) => console.error('Mongo error:', e));

// --- Notification model ---
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, required: true },
    title: { type: String, required: true },
    body: { type: String },
    read: { type: Boolean, default: false, index: true },
    meta: { type: Object },
  },
  { timestamps: true }
);
const Notification = mongoose.model('Notification', notificationSchema);

// --- helpers ---
function signAccess(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' }); // access قصير العمر
}

// simple HTTP auth middleware for protected REST routes
function httpAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// --- auth: demo login to get access token ---
app.post('/login', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });

  // userId is just username for simplicity
  const payload = { userId: username, username };
  const token = signAccess(payload);
  res.json({ token });
});

// --- send notification to a specific user (and persist) ---
app.post('/notify', async (req, res) => {
  const { targetUserId, title, body, meta } = req.body || {};
  if (!targetUserId || !title) {
    return res.status(400).json({ error: 'targetUserId and title are required' });
  }

  // persist
  const doc = await Notification.create({
    userId: targetUserId,
    title,
    body,
    meta,
    read: false,
  });

  // emit real-time if online
  io.to(targetUserId).emit('notification', {
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    meta: doc.meta,
    createdAt: doc.createdAt,
    read: doc.read,
  });

  res.json({ ok: true, id: doc._id });
});

// --- optional REST endpoints (protected) ---
app.get('/notifications', httpAuth, async (req, res) => {
  const { status = 'all', limit = 50 } = req.query;
  const q = { userId: req.user.userId };
  if (status === 'unread') q.read = false;
  if (status === 'read') q.read = true;

  const items = await Notification.find(q)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 200));

  res.json(items);
});

app.post('/notifications/mark-read', httpAuth, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  await Notification.updateMany(
    { _id: { $in: ids }, userId: req.user.userId },
    { $set: { read: true } }
  );
  res.json({ ok: true, count: ids.length });
});

app.post('/notifications/mark-all-read', httpAuth, async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user.userId, read: false },
    { $set: { read: true } }
  );
  res.json({ ok: true, matched: result.matchedCount || result.n, modified: result.modifiedCount || result.nModified });
});

// --- Socket.IO auth middleware ---
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error: token required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { userId: payload.userId, username: payload.username };
    next();
  } catch (e) {
    next(new Error('Authentication error: invalid token'));
  }
});

// --- sockets ---
io.on('connection', async (socket) => {
  const { userId, username } = socket.user;
  console.log(`🔌 ${username} connected (${socket.id})`);

  // each user joins their own room
  socket.join(userId);

  // send missed notifications on connect
  const unread = await Notification.find({ userId, read: false })
    .sort({ createdAt: 1 })
    .limit(100);

  socket.emit(
    'missed',
    unread.map((n) => ({
      id: n._id.toString(),
      title: n.title,
      body: n.body,
      meta: n.meta,
      createdAt: n.createdAt,
      read: n.read,
    }))
  );

  // get missed notifications on request
  socket.on('getMissed', async () => {
    const unread = await Notification.find({ userId, read: false })
      .sort({ createdAt: 1 })
      .limit(100);
    socket.emit(
      'missed',
      unread.map((n) => ({
        id: n._id.toString(),
        title: n.title,
        body: n.body,
        meta: n.meta,
        createdAt: n.createdAt,
        read: n.read,
      }))
    );
  });

  // mark notifications as read
  socket.on('markRead', async (ids = []) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    await Notification.updateMany(
      { _id: { $in: ids }, userId },
      { $set: { read: true } }
    );
    socket.emit('markedRead', ids);
  });

  socket.on('disconnect', () => {
    console.log(`❌ ${username} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
