# 🔔 Realtime Notifications Demo (Socket.IO + JWT + MongoDB + Push + Scaling)

## 📌 Overview
This project is a **demo application** showcasing how to build a realtime notification system using:
- **Socket.IO** (WebSocket abstraction)
- **JWT Authentication + Refresh Tokens**
- **MongoDB** for persisting notifications & push subscriptions
- **Web Push API** for sending push notifications (even when the browser is closed)
- **Scaling with Redis Adapter** for multi-instance horizontal scaling

The project is structured into progressive levels:
- **Level 1:** WebSocket Basics
- **Level 2:** Socket.IO + Usernames
- **Level 3:** JWT Auth + Notifications + Refresh Tokens
- **Level 4:** Push Notifications + Scaling (Redis + Docker Compose)

---

## 🚀 Run Locally

### 1) Install dependencies
```bash
npm install
```

### 2) Run MongoDB + Redis locally (if not using Docker)
```bash
docker run -d -p 27017:27017 mongo
docker run -d -p 6379:6379 redis
```

### 3) Start the server
```bash
node server.js
```

### 4) Open the Client
Open `index.html` in your browser.

---

## 🐳 Run with Docker Compose

```bash
docker-compose up --build
```

This will start:
- `app1` + `app2` (Node.js servers)
- `mongo`
- `redis`

Accessible at:
- http://localhost:3000
- http://localhost:3001

---

## 🧩 Features

- ✅ Authentication with JWT + Refresh Token flow
- ✅ Realtime notifications (Socket.IO events)
- ✅ Store missed notifications in MongoDB
- ✅ Web Push Notifications (even when browser is closed)
- ✅ Horizontal scaling with Redis Pub/Sub

---

## 📖 Explanation

### 🔐 JWT + Refresh
- Login → server issues access token (short-lived) + refresh token (cookie).
- Access token is used with Socket.IO + REST API.
- On expiry → refresh endpoint issues a new token.

### 🔔 Notifications
- Notifications are delivered instantly via Socket.IO.
- If user is offline → notification is stored in MongoDB as "missed".

### 📲 Web Push
- Browser subscribes using a VAPID public key.
- Server stores the subscription in MongoDB.
- Server → Push service → Browser displays Notification.

### ⚖️ Scaling (Redis Adapter)
- Multiple instances (app1, app2).
- Redis Pub/Sub ensures all events are broadcast across instances.

---

## 🧪 Levels Recap

### Level 1 → Pure WebSocket
- Basic client/server example.

### Level 2 → Socket.IO + Usernames
- Socket.IO integration.
- Broadcast join/leave events.

### Level 3 → JWT + Notifications
- Login, refresh tokens.
- Realtime + missed notifications.

### Level 4 → Push + Scaling
- Push notifications using Web Push API.
- Scaling with Redis + docker-compose.

---

## 📚 References
- [Socket.IO Docs](https://socket.io/docs/v4/)
- [Web Push Book](https://web-push-book.gauntface.com/)
- [Redis Pub/Sub](https://redis.io/docs/interact/pubsub/)
- [JWT Guide](https://jwt.io/introduction/)

---

👨‍💻 *Demo Project for training purposes (Laravel dev → Realtime WS skills)*
