# WebSocket Learning Journey 🚀

This repo is a **step-by-step journey** into WebSockets and Socket.IO.  
Each folder represents a level or side project that gradually builds new features.

---

## 📂 Projects

- [pure-websocket-chat](./pure-websocket-chat)  
  → Level 1: Pure WebSocket chat demo (no libraries).

- [socketio-usernames-chat](./socketio-usernames-chat)  
  → Level 2: Socket.IO chat with usernames.

- [socketio-chat-history](./socketio-chat-history)  
  → Side Quest: Adding chat history / persistence.

- [socketio-private-rooms](./socketio-private-rooms)  
  → Side Quest: Private rooms / namespaces.

- [socketio-notifications-jwt](./socketio-notifications-jwt)  
  → Level 3 + 4: JWT auth, missed notifications (MongoDB), Web Push, and scaling with Redis.

---

## 🛠️ How to Run Any Project

1. Enter the project folder:

```bash
cd folder-name
npm install
node server.js
```

2. Or if the project supports Docker Compose:

```bash
docker-compose up --build
```

---

## 🌍 Journey Recap

- **Level 1** → `pure-websocket-chat`: Learn raw WebSocket basics.  
- **Level 2** → `socketio-usernames-chat`: Upgrade to Socket.IO with username handling.  
- **Side Quest** → `socketio-chat-history`: Store chat messages.  
- **Side Quest** → `socketio-private-rooms`: Private chat rooms.  
- **Level 3 + 4** → `socketio-notifications-jwt`: JWT auth, notifications, push, scaling with Redis.

---

## References
- [Socket.IO](https://socket.io/docs/v4/)
- [MDN WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [Web Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
