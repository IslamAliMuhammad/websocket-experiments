const WebSocket = require('ws');

// Create a WebSocket server on port 3000   
const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', function connection(ws) {
  console.log('🔌 Client connected');

  console.log(wss.clients)
  ws.on('message', function incoming(message) {
    console.log('📨 Received:', message.toString());

    // Broadcast the message to all connected clients
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`📢 Server: ${message}`);
      }
    });
  });

  ws.on('close', () => {
    console.log('❌ Client disconnected');
  });
});

console.log('🚀 WebSocket server running on ws://localhost:3000');
