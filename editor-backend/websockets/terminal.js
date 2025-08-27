// editor-backend/websockets/terminal.js
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.warn('node-pty not installed; terminal feature will be disabled.');
}

const TERMINAL_SESSIONS = new Map();

exports.terminalWebSocketHandler = (request, socket, head, sessionId) => {
  const wss = new WebSocket.Server({ noServer: true });
  wss.handleUpgrade(request, socket, head, (ws) => {
    if (!pty) {
      ws.send(JSON.stringify({ type: 'output', data: 'Terminal not available. Install node-pty on the server.' }));
      ws.close();
      return;
    }

    const defaultCwd = process.env.HOME || '/tmp';
    const workspaceDir = path.join('/app/workspaces', sessionId);
    const initialCwd = fs.existsSync(workspaceDir) ? workspaceDir : defaultCwd;

    const ptyProcess = pty.spawn('bash', [], {
      name: 'xterm-color',
      cwd: initialCwd,
      env: process.env
    });

    console.log(`[terminal] spawned pty (pid=${ptyProcess.pid}) for session ${sessionId}`);

    ptyProcess.onData((data) => {
      ws.send(JSON.stringify({ type: 'output', data }));
    });

    ws.on('message', (msg) => {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'input') {
        ptyProcess.write(parsed.data);
      } else if (parsed.type === 'resize') {
        ptyProcess.resize(parsed.cols, parsed.rows);
      }
    });

    ws.on('close', () => {
      console.log(`[terminal] connection closed for session ${sessionId}, killing pty.`);
      ptyProcess.kill();
      TERMINAL_SESSIONS.delete(sessionId);
    });

    TERMINAL_SESSIONS.set(sessionId, ptyProcess);
  });
};