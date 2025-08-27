// websockets/share.js
const ShareDB = require('sharedb');
const WebSocketJSONStream = require('@teamwork/websocket-json-stream');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const share = new ShareDB({ presence: true });
const connection = share.connect();

exports.connection = connection;

/**
 * shareWebSocketHandler - for Sharedb realtime over websocket
 */
exports.shareWebSocketHandler = (request, socket, head) => {
  const wss = new WebSocket.Server({ noServer: true });
  wss.on('connection', (ws) => {
    const stream = new WebSocketJSONStream(ws);
    share.listen(stream);
  });
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws);
  });
};

// -------------------- session doc creation / ensureSessionExists --------------------
exports.ensureSessionExists = (id, config = {}) => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof config === 'string') {
        config = { projectLanguage: config };
      }

      const defaultConfig = {
        roomMode: 'project',
        projectLanguage: 'cpp',
        multiFile: true,
        enableVideo: true,
        enableTerminal: true,
        sharedInputOutput: true,
        allowFileCreation: true
      };

      const mergedConfig = { ...defaultConfig, ...(config || {}) };
      const doc = connection.get('examples', id);

      doc.fetch((err) => {
        if (err) return reject(err);

        if (doc.type === null) {
          let initialFile;
          const lang = mergedConfig.projectLanguage || 'cpp';
          switch (lang) {
            case 'python':
              initialFile = { name: 'main.py', content: 'print("Hello, Python!")' };
              break;
            case 'java':
              initialFile = { name: 'Main.java', content: 'class Main { public static void main(String[] args) { System.out.println("Hello, Java!"); }}' };
              break;
            default:
              initialFile = { name: 'main.cpp', content: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, C++!";\n    return 0;\n}' };
          }

          const fileId = uuidv4();
          const rootId = 'root';
          const initialData = {
            config: mergedConfig,
            roomMode: mergedConfig.roomMode,
            projectLanguage: mergedConfig.projectLanguage,
            tree: {
              [rootId]: { id: rootId, parentId: null, name: id, type: 'folder', children: [fileId] },
              [fileId]: { id: fileId, parentId: rootId, name: initialFile.name, type: 'file' }
            },
            contents: { [fileId]: initialFile.content },
            input: '',
            output: '',
            lang: mergedConfig.projectLanguage
          };

          doc.create(initialData, (createErr) => {
            if (createErr) {
              doc.fetch((fetchErr) => {
                if (fetchErr) return reject(createErr);
                if (doc.type === null) return reject(createErr);
                resolve({ isNew: false, doc });
              });
            } else {
              console.log('[ensureSessionExists] created new session', id);
              resolve({ isNew: true, doc });
            }
          });
        } else {
          // ensure config exists (non-destructive)
          if (!doc.data.config) {
            const currentConfig = {
              roomMode: doc.data.roomMode || 'project',
              projectLanguage: doc.data.projectLanguage || doc.data.lang || 'cpp',
              multiFile: true,
              enableVideo: true,
              enableTerminal: true,
              sharedInputOutput: doc.data.input !== undefined && doc.data.output !== undefined ? true : true,
              allowFileCreation: true
            };
            try {
              doc.submitOp([{ p: ['config'], oi: currentConfig }], (err) => {
                return resolve({ isNew: false, doc });
              });
            } catch (e) {
              return resolve({ isNew: false, doc });
            }
          } else {
            return resolve({ isNew: false, doc });
          }
        }
      });
    } catch (ex) {
      reject(ex);
    }
  });
};

// -------------------- session sockets registry & admin ops --------------------

const sessionSockets = new Map();
function registerSocket(sessionId, peerId, ws) {
  if (!sessionId || !peerId || !ws) return;
  if (!sessionSockets.has(sessionId)) sessionSockets.set(sessionId, new Map());
  sessionSockets.get(sessionId).set(peerId, ws);
}
function unregisterSocket(sessionId, peerId) {
  if (!sessionId || !peerId) return;
  if (!sessionSockets.has(sessionId)) return;
  const m = sessionSockets.get(sessionId);
  m.delete(peerId);
  if (m.size === 0) sessionSockets.delete(sessionId);
}
async function kickParticipant(sessionId, peerId) {
  const m = sessionSockets.get(sessionId);
  if (!m) return;
  const ws = m.get(peerId);
  if (!ws) return;
  try {
    ws.send(JSON.stringify({ type: 'kicked', reason: 'Removed by host', peerId, sessionId }));
    ws.close();
  } catch(e) {
    try { ws.terminate(); } catch {}
  } finally {
    unregisterSocket(sessionId, peerId);
  }
}

async function setSessionOwner(sessionId, ownerName) {
  return new Promise((resolve, reject) => {
    const doc = connection.get('examples', sessionId);
    doc.fetch((err) => {
      if (err) return reject(err);
      try {
        const cfg = doc.data && doc.data.config ? Object.assign({}, doc.data.config, { ownerName }) : { ownerName };
        doc.submitOp([{ p: ['config'], oi: cfg }], { source: 'server' }, (opErr) => {
          if (opErr) return reject(opErr);
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

exports.registerSocket = registerSocket;
exports.unregisterSocket = unregisterSocket;
exports.kickParticipant = kickParticipant;
exports.setSessionOwner = setSessionOwner;

// -------------------- Signaling WebSocket handler (for identify / admin messages) --------------------
exports.signalWebSocketHandler = (request, socket, head) => {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws, req) => {
    let registered = false;
    let sessionId = null;
    let peerId = null;

    ws.on('message', (dataRaw) => {
      let msg;
      try { msg = JSON.parse(dataRaw); } catch (e) { return; }

      if (msg && msg.type === 'identify') {
        sessionId = msg.sessionId;
        peerId = msg.peerId || uuidv4();
        registerSocket(sessionId, peerId, ws);
        registered = true;
        safeSendJson(ws, { type: 'assign-id', id: peerId });
        console.log(`[signal] identified peer ${peerId} for session ${sessionId}`);
        return;
      }

      if (msg && msg.type === 'set-name' && msg.name && registered && sessionId && peerId) {
        console.log(`[signal] peer ${peerId}@${sessionId} set name ${msg.name}`);
        return;
      }
    });

    ws.on('close', () => {
      if (registered && sessionId && peerId) unregisterSocket(sessionId, peerId);
    });

    ws.on('error', () => {
      if (registered && sessionId && peerId) unregisterSocket(sessionId, peerId);
    });
  });

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws);
  });
};

// helper used in the signal handler:
function safeSendJson(ws, obj) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(obj));
    return true;
  } catch (err) {
    console.warn('[share] safeSendJson failed', err && err.stack ? err.stack : err);
    return false;
  }
}
