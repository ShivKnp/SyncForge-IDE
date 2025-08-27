// src/components/common/ChatPanel.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { message as antdMessage, Dropdown, Menu, Modal } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { motion, AnimatePresence } from 'framer-motion';
import { FaComment, FaTimes } from "react-icons/fa";

// Backend / WS config
const CHAT_WS = (() => {
  if (process.env.REACT_APP_CHAT_WS) return process.env.REACT_APP_CHAT_WS.replace(/\/$/, '');
  const host = window.location.hostname;
  const backendPort = process.env.REACT_APP_BACKEND_PORT || '8080';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${host}:${backendPort}`;
})();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

// Local storage keys & palette
const getSessionStorageKey = (roomId) => `chat-messages-${roomId}`;
const USER_COLOR_KEY = 'chat-user-colors';
const DEFAULT_PALETTE = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#0EA5A3', '#7C3AED'];

function hashToIndex(name = '', mod = DEFAULT_PALETTE.length) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h) % mod;
}

function loadUserColors() {
  try {
    const raw = sessionStorage.getItem(USER_COLOR_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) { return {}; }
}

function saveUserColors(map) { try { sessionStorage.setItem(USER_COLOR_KEY, JSON.stringify(map)); } catch (e) {} }

function getUserColorFromMap(name) {
  const map = loadUserColors();
  if (map[name]) return map[name];
  const c = DEFAULT_PALETTE[hashToIndex(name)];
  map[name] = c; saveUserColors(map); return c;
}

function normalizeMsg(raw = {}) {
  return {
    id: raw.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user: raw.user || raw.from || raw.sender || 'System',
    text: raw.text || '',
    type: raw.type || (raw.fileName ? 'file' : 'chat'),
    ts: raw.ts || Date.now(),
    fileName: raw.fileName,
    fileType: raw.fileType,
    deleted: raw.deleted || false
  };
}

const TIME_WINDOW = 10 * 60 * 1000; // 10 minutes grouping
const ACCENT = '#3B82F6';

const ChatPanel = ({ roomId, userName, ownerName, onUploadDone, onUnreadChange }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);

  // lightbox state
  const [lightbox, setLightbox] = useState({ visible: false, src: '', fileName: '' });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef({ dragging: false, start: null, baseOffset: { x: 0, y: 0 } });

  const wsRef = useRef(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [showJump, setShowJump] = useState(false);

  // load messages from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(getSessionStorageKey(roomId));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMessages(Array.isArray(parsed) ? parsed.map(normalizeMsg) : []);
      } catch (e) { console.error('failed to parse messages', e); }
    }
  }, [roomId]);

  // persist messages to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(getSessionStorageKey(roomId), JSON.stringify(messages)); } catch (e) {}
  }, [messages, roomId]);

  // setup WS
  useEffect(() => {
    const url = `${CHAT_WS}/chat/${roomId}`;
    const ws = new ReconnectingWebSocket(url);
    wsRef.current = ws;

    const handleOpen = () => setConnected(true);
    const handleClose = () => setConnected(false);
    const handleError = () => setConnected(false);

    const handleMessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'history' && Array.isArray(msg.items)) {
          setMessages(msg.items.map(normalizeMsg));
          return;
        }
        if (msg.type === 'delete' && msg.id) {
          setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, deleted: true } : m)));
          return;
        }
        if (msg.type === 'clear') {
          setMessages([]);
          return;
        }
        if (msg.type === 'error') {
          antdMessage.error(msg.message || 'Server error');
          return;
        }
        if (msg && (msg.type === 'chat' || msg.type === 'file' || msg.type === 'system')) {
          setMessages(prev => {
            const nm = normalizeMsg(msg);
            if (prev.some(x => x.id === nm.id)) return prev;
            return [...prev, nm];
          });
        } else {
          setMessages(prev => [...prev, normalizeMsg({ text: ev.data, type: 'system' })]);
        }
      } catch (e) {
        setMessages(prev => [...prev, normalizeMsg({ text: ev.data, type: 'system' })]);
      }
    };

    ws.addEventListener('open', handleOpen);
    ws.addEventListener('message', handleMessage);
    ws.addEventListener('close', handleClose);
    ws.addEventListener('error', handleError);

    return () => {
      try {
        ws.removeEventListener('open', handleOpen);
        ws.removeEventListener('message', handleMessage);
        ws.removeEventListener('close', handleClose);
        ws.removeEventListener('error', handleError);
      } catch (e) {}
      try { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch (e) {}
    };
  }, [roomId]);

  // scroll & unread handling
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 64;
      setShowJump(!nearBottom);
      if (nearBottom) {
        setUnreadCount(0);
        onUnreadChange && onUnreadChange(0);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onUnreadChange]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 160;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight + 200, behavior: 'smooth' });
      setUnreadCount(0);
      onUnreadChange && onUnreadChange(0);
    } else {
      const last = messages[messages.length - 1];
      if (last && last.user !== (userName || '') && last.type !== 'system') {
        setUnreadCount(c => {
          const nc = c + 1;
          onUnreadChange && onUnreadChange(nc);
          return nc;
        });
      }
    }
  }, [messages, userName, onUnreadChange]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !wsRef.current) return;
    const payload = { type: 'chat', from: userName || 'Anonymous', text };
    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      setDraft('');
    } else {
      antdMessage.error('Not connected — message not sent.');
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); textAreaRef.current && textAreaRef.current.focus(); return;
    }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault(); textAreaRef.current && textAreaRef.current.focus(); return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); sendMessage();
    }
  };

  const onClickAttach = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  const onFileSelected = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const form = new FormData();
    form.append('file', file);
    form.append('userName', userName);

    const BACKEND_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '') || '';
    const uploadUrl = BACKEND_BASE ? `${BACKEND_BASE}/session/${encodeURIComponent(roomId)}/upload` : `/session/${encodeURIComponent(roomId)}/upload`;

    try {
      antdMessage.loading({ content: `Uploading ${file.name}...`, key: 'upload' });
      const res = await fetch(uploadUrl, { method: 'POST', body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const text = json?.error || (await res.text());
        antdMessage.error({ content: `Upload failed: ${text || res.statusText}`, key: 'upload' });
      } else {
        antdMessage.success({ content: `Uploaded ${file.name}`, key: 'upload' });
        try { if (typeof onUploadDone === 'function') onUploadDone(); } catch (_) {}
      }
    } catch (err) {
      antdMessage.error({ content: `Upload error: ${err.message}`, key: 'upload' });
    } finally {
      e.target.value = '';
    }
  };

  const getDownloadUrl = (fileName) => `${BACKEND_URL}/session/${encodeURIComponent(roomId)}/download/${encodeURIComponent(fileName)}`;

  // grouping messages into groups by user + time window
  const groups = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m) continue;
    const last = groups[groups.length - 1];
    const isMine = (m.user || '') === (userName || '') && m.type !== 'system';
    if (!last) groups.push({ user: m.user, items: [m], mine: isMine });
    else {
      const sameUser = (m.user || '') === (last.user || '');
      const close = m.ts - last.items[last.items.length - 1].ts < TIME_WINDOW;
      if (sameUser && close) last.items.push(m);
      else groups.push({ user: m.user, items: [m], mine: isMine });
    }
  }

  // lightbox helpers
  const openLightbox = useCallback((src, fileName) => {
    setLightbox({ visible: true, src, fileName });
    setZoom(1); setOffset({ x: 0, y: 0 });
  }, []);
  const closeLightbox = useCallback(() => {
    setLightbox({ visible: false, src: '', fileName: '' });
    setZoom(1); setOffset({ x: 0, y: 0 });
  }, []);
  const zoomIn = () => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(1, +(z - 0.25).toFixed(2)));
  const resetZoom = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  // pan handlers for image lightbox
  const onMouseDownPan = (e) => {
    if (zoom <= 1) return;
    panRef.current.dragging = true;
    panRef.current.start = { x: e.clientX, y: e.clientY };
    panRef.current.baseOffset = { ...offset };
    window.addEventListener('mousemove', onMouseMovePan);
    window.addEventListener('mouseup', onMouseUpPan);
  };
  const onMouseMovePan = (e) => {
    if (!panRef.current.dragging) return;
    const dx = e.clientX - panRef.current.start.x;
    const dy = e.clientY - panRef.current.start.y;
    setOffset({ x: panRef.current.baseOffset.x + dx, y: panRef.current.baseOffset.y + dy });
  };
  const onMouseUpPan = () => {
    panRef.current.dragging = false;
    window.removeEventListener('mousemove', onMouseMovePan);
    window.removeEventListener('mouseup', onMouseUpPan);
  };

  // message deletion helpers
  const deleteForEveryone = (id) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      antdMessage.error('Not connected — cannot delete for everyone.');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'delete', id, requester: userName }));
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, deleted: true } : m)));
  };

  const deleteForMe = (id) => setMessages(prev => prev.filter(m => m.id !== id));

  const clearChatForEveryone = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      antdMessage.error('Not connected — cannot clear chat.');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'clear', requester: userName }));
    setMessages([]);
  };

  const scrollToBottom = () => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight + 200, behavior: 'smooth' });
    setUnreadCount(0); onUnreadChange && onUnreadChange(0);
  };

  // small helpers for UI
  const initials = (n) => {
    if (!n) return 'U';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };
  const getUserColor = (name) => getUserColorFromMap(name || 'System');

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 bg-gradient-to-b from-slate-900 to-slate-950">
      {/* header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex justify-between items-center">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
          <FaComment className="text-cyan-400" />
          <span>Chat</span>
        </h3>
        <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md">
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* messages list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-4 sidebar-scrollbar"
      >
        {groups.map((g, gi) => {
          const mine = g.mine;
          const userColor = getUserColor(g.user);
          const initialsStr = initials(g.user);

          const headerMenu = (
            <Menu className="bg-slate-800 border-slate-700">
              <Menu.Item 
                key="clear" 
                onClick={() => clearChatForEveryone()}
                className="text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50"
              >
                Clear chat (all)
              </Menu.Item>
            </Menu>
          );

          const lastMsg = g.items[g.items.length - 1];
          const headerTime = lastMsg ? new Date(lastMsg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          return (
            <div key={`grp-${gi}`} className={`flex gap-3 items-start ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className="w-12 min-w-12 flex items-center justify-center">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-lg"
                  style={{ backgroundColor: userColor }}
                >
                  {initialsStr}
                </div>
              </div>

              {/* Message content */}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-slate-200 truncate">
                      {g.user}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500">{headerTime}</span>
                    <Dropdown overlay={headerMenu} trigger={['click']}>
                      <button className="text-slate-500 hover:text-cyan-400 transition-colors">
                        <DownOutlined className="text-xs" />
                      </button>
                    </Dropdown>
                  </div>
                </div>

                {/* Messages in group */}
                <div className="flex flex-col gap-2">
                  {g.items.map((m, idx) => {
                    const isLast = idx === g.items.length - 1;
                    return (
                      <div key={m.id} className={`flex gap-2 items-end ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                        <ChatMessage
                          m={m}
                          mine={mine}
                          bubbleColor={userColor}
                          getDownloadUrl={(fn) => getDownloadUrl(fn)}
                          onImageClick={(src, fname) => openLightbox(src, fname)}
                          sidebarWidth={240}
                          onDeleteForEveryone={() => deleteForEveryone(m.id)}
                          onDeleteForMe={() => deleteForMe(m.id)}
                          accent={ACCENT}
                          showSmallTime={!isLast}
                        />
                        {isLast && (
                          <span className="text-xs text-slate-500 mb-1">
                            {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Jump to bottom button */}
      {showJump && unreadCount > 0 && (
        <button 
          onClick={scrollToBottom} 
          className="fixed bottom-24 right-6 z-40 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-sm font-medium shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all"
        >
          {unreadCount} new • Jump to bottom
        </button>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/40">
        <ChatInput
          draft={draft}
          setDraft={setDraft}
          handleKeyDown={handleKeyDown}
          sendMessage={sendMessage}
          onClickAttach={onClickAttach}
          fileInputRef={fileInputRef}
          onFileSelected={onFileSelected}
          inputRef={textAreaRef}
        />
        <div className="flex justify-between items-center mt-3">
          <div className="text-xs text-slate-500">Press / or Ctrl+K to focus</div>
          <button 
            onClick={() => clearChatForEveryone()} 
            className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
          >
            Clear chat
          </button>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox.visible && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm"
            onDoubleClick={resetZoom}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="w-full max-w-4xl max-h-[90vh] bg-slate-800 rounded-xl p-4 flex flex-col gap-3 border border-slate-700 shadow-2xl"
            >
              {/* Lightbox header */}
              <div className="flex items-center justify-between">
                <div className="text-slate-200 font-medium truncate">{lightbox.fileName}</div>
                <div className="flex items-center gap-2">
                  <button onClick={zoomOut} className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:text-cyan-400 transition-colors">−</button>
                  <button onClick={resetZoom} className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:text-cyan-400 transition-colors">Reset</button>
                  <button onClick={zoomIn} className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:text-cyan-400 transition-colors">+</button>
                  <button onClick={closeLightbox} className="p-2 bg-rose-600 rounded-lg text-white hover:bg-rose-700 transition-colors">
                    <FaTimes />
                  </button>
                </div>
              </div>

              {/* Lightbox content */}
              <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg bg-slate-900">
                <div onMouseDown={onMouseDownPan} className="cursor-move">
                  <motion.img 
                    src={lightbox.src} 
                    alt={lightbox.fileName} 
                    className="max-w-full max-h-[70vh] rounded-lg"
                    style={{ 
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                      transition: 'transform 0.1s ease-out'
                    }}
                    draggable={false}
                  />
                </div>
              </div>

              {/* Lightbox footer */}
              <div className="text-center text-slate-400 text-sm">
                {Math.round(zoom * 100)}% zoom
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

ChatPanel.propTypes = {
  roomId: PropTypes.string.isRequired,
  userName: PropTypes.string,
  ownerName: PropTypes.string,
  onUploadDone: PropTypes.func,
  onUnreadChange: PropTypes.func
};

export default ChatPanel;