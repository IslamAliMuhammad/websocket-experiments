require('dotenv').config();
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

const {
  PORT = 3000,
  JWT_SECRET = 'secret',
  MONGO_URI = 'mongodb://localhost:27017/socketio_notifs',
  REFRESH_TTL_DAYS = '7',
  REFRESH_COOKIE_NAME = 'rt',
} = process.env;

// VAPID keys for Web Push Notifications
// These keys are used to authenticate the push notifications sent to the browser
// You can generate them using web-push library or use existing keys
// To generate new keys, run `node gen-vapid.js` in the terminal
// Make sure to replace these keys with your own in production
// The public key is used by the browser to subscribe to push notifications
// The private key is used by the server to sign the push notifications
// The subject is the email address or URL of the owner of the VAPID keys
// It is used to identify the sender of the push notifications
// In production, make sure to use a valid email address or URL
// This is important for compliance with the Web Push Protocol
// and to ensure that the push notifications are delivered correctly
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:admin@example.com' } = process.env;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ---------- MongoDB ----------
mongoose
  .connect(MONGO_URI, { dbName: 'socketio_notifs' })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((e) => console.error('Mongo error:', e));

  // --- Push Subscription model ---
const pushSubSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, required: true },
    endpoint: { type: String, index: true, required: true, unique: true },
    keys: {
      p256dh: String,
      auth: String,
    },
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);
const PushSubscription = mongoose.model('PushSubscription', pushSubSchema);

// ---------- Models ----------
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

// Refresh tokens (opaque, قابلة للإلغاء والروتيشن)
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, required: true },
    token: { type: String, index: true, required: true }, // في الإنتاج: خزن hash بدل الـ token نفسه
    expiresAt: { type: Date, index: true, required: true },
    revokedAt: { type: Date },
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);
const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

// ---------- Helpers ----------
function signAccess(payload) {
  // Access token قصير العمر
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

function generateOpaqueToken(bytes = 64) {
  return crypto.randomBytes(bytes).toString('hex');
}

function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // In production, set to true if using HTTPS
    expires: expiresAt,
    path: '/', // Make sure the cookie is accessible across the app
  });
}

async function issueRefreshToken(userId, req, res) {
  const ttlDays = parseInt(REFRESH_TTL_DAYS, 10) || 7;
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId,
    token, // In production, store a hash of this token
    expiresAt,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  setRefreshCookie(res, token, expiresAt);
  return token;
}

async function rotateRefreshToken(oldToken, req, res) {
  const doc = await RefreshToken.findOne({ token: oldToken, revokedAt: { $exists: false } });
  if (!doc) return null;
  if (doc.expiresAt < new Date()) return null;

  // Revoking the old token
  doc.revokedAt = new Date();
  await doc.save();

  // Issuing a new token
  return await issueRefreshToken(doc.userId, req, res);
}

// HTTP authentication middleware
// This checks the Access Token from the Authorization header
// and attaches the user info to req.user
// It is used for REST endpoints that require authentication
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

// ---------- Auth Endpoints ----------

// Login endpoint: generates Access Token and issues Refresh Token
app.post('/login', async (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });

  const payload = { userId: username, username };
  const accessToken = signAccess(payload);

  await issueRefreshToken(payload.userId, req, res);

  res.json({ token: accessToken });
});

// Refresh endpoint: issues a new Access Token using the Refresh Token
// It also rotates the Refresh Token
app.post('/refresh', async (req, res) => {
  const old = req.cookies[REFRESH_COOKIE_NAME];
  if (!old) return res.status(401).json({ error: 'no refresh cookie' });

  const doc = await RefreshToken.findOne({ token: old, revokedAt: { $exists: false } });
  if (!doc) return res.status(401).json({ error: 'invalid refresh token' });
  if (doc.expiresAt < new Date()) return res.status(401).json({ error: 'refresh expired' });

  // Generate new Access Token
  // In production, you might want to include more user info in the payload
  // or use a different strategy for user identification
  // Here we just use the userId from the refresh token
  // This is a simplified example, adjust as needed
  // For example, you might want to fetch user details from the database
  // or include roles/permissions in the payload
  // Note: In production, consider using a more secure way to handle user identification
  // such as fetching user details from the database
  // or using a more complex payload structure
  // For this example, we assume the userId is sufficient
  // and we use it directly in the payload
  const payload = { userId: doc.userId, username: doc.userId };
  const newAccess = signAccess(payload);

  // Rotate the Refresh Token
  // This will revoke the old token and issue a new one
  // The new token will be set in the cookie
  // This is important for security, to prevent token reuse
  // In production, you might want to store a hash of the token instead of the token
  // for better security
  // This is a simplified example, adjust as needed
  await rotateRefreshToken(old, req, res);

  res.json({ token: newAccess });
});

// Logout: revokes the current Refresh Token and clears the cookie
// This is important to prevent further access using the old token
// In production, you might want to also invalidate the Access Token
// or handle it differently based on your security requirements
// This is a simplified example, adjust as needed
// For example, you might want to log the user out from all devices
// or handle session management in a more complex way
app.post('/logout', async (req, res) => {
  const cur = req.cookies[REFRESH_COOKIE_NAME];
  if (cur) {
    await RefreshToken.updateOne({ token: cur, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// ---------- Notification Endpoints ----------

// Create a new notification
// This endpoint is used to create a new notification for a user
// It can be called by the server or other services to notify users
// It requires the target userId and title, and optionally body and meta data
// The notification will be saved in the database and emitted to the user via Socket.IO
// This is a simplified example, adjust as needed
// For example, you might want to add more validation, error handling,
// or additional fields to the notification
// In production, consider adding more fields to the notification schema
// such as priority, type, or additional metadata
app.post('/notify', async (req, res) => {
  const { targetUserId, title, body, meta } = req.body || {};
  if (!targetUserId || !title) {
    return res.status(400).json({ error: 'targetUserId and title are required' });
  }

  const doc = await Notification.create({
    userId: targetUserId,
    title,
    body,
    meta,
    read: false,
  });

  // Emit the notification to the target user via Socket.IO
  // This will send the notification to the user in real-time
  // The user will receive the notification in their Socket.IO client
  // This is important for real-time applications where users need to be notified immediately
  // In production, consider adding more fields to the notification schema
  // such as priority, type, or additional metadata
  // This is a simplified example, adjust as needed
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

// Get notifications for the authenticated user
// This endpoint retrieves notifications for the authenticated user
// It supports filtering by read/unread status and pagination
// The user must be authenticated using the Access Token
// The notifications will be returned in descending order by creation date
// The user can specify the status (all, read, unread) and limit the number of notifications
// This is a simplified example, adjust as needed
// For example, you might want to add more filtering options, sorting, or additional fields
// In production, consider adding more fields to the notification schema
// such as priority, type, or additional metadata
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

// ---------- Push Notifications Endpoints ----------
app.get('/push/public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
// This endpoint allows the client to subscribe to push notifications
// It requires the subscription object from the client, which includes the endpoint and keys
// The subscription will be saved in the database and used to send push notifications
// The user must be authenticated using the Access Token
// The subscription will be associated with the userId from the Access Token
// This is important for real-time applications where users need to receive notifications
// In production, consider adding more fields to the subscription schema
// such as IP address, or additional metadata
app.post('/push/subscribe', httpAuth, async (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint || !sub.keys) {
    return res.status(400).json({ error: 'invalid subscription' });
  }
  await PushSubscription.updateOne(
    { endpoint: sub.endpoint },
    {
      $set: {
        userId: req.user.userId,
        endpoint: sub.endpoint,
        keys: sub.keys,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
    },
    { upsert: true }
  );
  res.json({ ok: true });
});

// Delete a push subscription
app.post('/push/unsubscribe', httpAuth, async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  await PushSubscription.deleteOne({ endpoint, userId: req.user.userId });
  res.json({ ok: true });
});

// Test push notification endpoint
app.post('/push/test', httpAuth, async (req, res) => {
  const { title = 'Test', body = 'Hello!', data } = req.body || {};
  const subs = await PushSubscription.find({ userId: req.user.userId }).lean();

  const payload = JSON.stringify({ title, body, data });
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: s.keys,
          },
          payload
        );
        sent++;
      } catch (e) {
        // Invalid subscription or other error
        // If the subscription is invalid (e.g., endpoint not reachable), delete it
        if (e.statusCode === 404 || e.statusCode === 410) {
          await PushSubscription.deleteOne({ endpoint: s.endpoint });
        } else {

          console.error('push error:', e.statusCode, e.body || e.message);
        }
      }
    })
  );

  res.json({ ok: true, sent });
});

// ---------- Socket.IO authentication ----------
// This middleware checks the JWT token from the socket handshake
// and attaches the user info to the socket object
// It is used to authenticate users when they connect to the Socket.IO server
// The token should be sent in the handshake auth field as { token: 'your_jwt_token' }
// If the token is valid, the user info will be available in socket.user
// If the token is missing or invalid, an error will be thrown
// This is important for real-time applications where users need to be authenticated
// before they can receive notifications or perform actions
// In production, consider adding more fields to the user info
// such as roles, permissions, or additional metadata
// This is a simplified example, adjust as needed
// For example, you might want to fetch user details from the database
// or include roles/permissions in the user info
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

// ---------- Socket.IO events ----------
io.on('connection', async (socket) => {
  const { userId, username } = socket.user;
  console.log(`🔌 ${username} connected (${socket.id})`);
  socket.join(userId);

  // Send missed notifications to the user
  // This will send the last 100 unread notifications to the user
  // It is useful for users who reconnect and want to see what they missed
  // The notifications will be sent in ascending order by creation date
  // This is a simplified example, adjust as needed
  // For example, you might want to add more filtering options, sorting, or additional fields
  // In production, consider adding more fields to the notification schema
  // such as priority, type, or additional metadata
  // This is important for real-time applications where users need to be notified immediately
  // and to catch up on missed notifications
  // The user will receive the missed notifications in their Socket.IO client
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
