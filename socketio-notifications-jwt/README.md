# Socket.IO Notifications + JWT + Push + Scaling

## Overview
This project demonstrates a progressive journey of learning **real-time communication** with WebSockets and Socket.IO.  
It starts with basic chat, then evolves into full JWT authentication, missed notifications stored in MongoDB, Push Notifications (Web Push API), and finally scaling with Redis adapter across multiple instances using Docker Compose.

---

## Features
- **JWT Authentication** (access + refresh tokens)
- **Socket.IO integration** with secure auth
- **Missed notifications** stored in MongoDB
- **Web Push API** for browser notifications
- **Redis adapter** for horizontal scaling across multiple Node.js instances
- **Docker Compose setup** for MongoDB, Redis, and multi-instance scaling

---

## Setup (Local)

1. Clone the repo and enter this folder:

```bash
git clone https://github.com/IslamAliMuhammad/websocket-experiments.git
cd socketio-notifications-jwt
```

2. Install dependencies:

```bash
npm install
```

3. Start MongoDB and Redis locally, or use Docker:

```bash
docker run -d -p 27017:27017 mongo
docker run -d -p 6379:6379 redis
```

4. Run the server:

```bash
node server.js
```

5. Open the client in your browser:

```
http://localhost:3000
```

---

## Setup (Docker Compose)

We included a `docker-compose.yml` to spin up everything (app + MongoDB + Redis).

1. Build and start services:

```bash
docker-compose up --build
```

2. Open your browser at:

```
http://localhost:3000

http://localhost:3001

```

---

## Scaling with Redis

Thanks to the **Redis adapter**, multiple Socket.IO server instances can share state (rooms, events, messages).  
In `docker-compose.yml`, we define `app1`, `app2`, both connected to the same Redis service.  
This demonstrates how Socket.IO scales horizontally.

---

## Learning Journey

This repo corresponds to **Level 3 + Level 4** of the full learning path:

- ✅ JWT Authentication with access & refresh tokens
- ✅ Missed notifications stored in MongoDB
- ✅ Push Notifications via Service Workers (Web Push)
- ✅ Scaling with Redis adapter

---

## References
- [Socket.IO Docs](https://socket.io/docs/v4/)
- [Web Push MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
