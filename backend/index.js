const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const cors = require('cors'); // Import the cors middleware

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Use cors middleware to allow requests from the frontend development server
app.use(cors({ origin: 'http://localhost:3000' })); 

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Spawn a shell
  const shell = process.env.SHELL || 'bash';
  const term = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  // Pipe data from terminal to WebSocket
  term.onData((data) => {
    ws.send(data);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    term.kill();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    term.kill();
  });

  // Handle terminal resize
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'resize' && msg.cols && msg.rows) {
        term.resize(msg.cols, msg.rows);
      } else {
        term.write(message);
      }
    } catch (e) {
      // If it's not a JSON message, assume it's data for the terminal
      term.write(message);
    }
  });
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
}); 