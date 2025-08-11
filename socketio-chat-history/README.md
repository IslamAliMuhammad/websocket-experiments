# Socket.IO Chat with MongoDB History

This is a real-time chat app using **Socket.IO**, **Express**, and **MongoDB**.  
It supports multiple rooms and loads the last 20 messages when a user joins.

## How to Run

1. Install dependencies:
```bash
npm install
```

2. Configure .env:
```env
MONGO_URI=mongodb://localhost:27017/socketio_chat
PORT=3000
```

3. Start MongoDB:
```bash
mongod
```

4. Start the server:
```bash
node server.js
```

5. Open:
[http://localhost:3000](http://localhost:3000)
