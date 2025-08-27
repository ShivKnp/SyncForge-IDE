// src/hooks/useVideoChat.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Global store to track active connections by roomId
const activeConnections = new Map();

export const useVideoChat = (roomId, userName) => {
  const navigate = useNavigate();

  // states
  const [localPeerId, setLocalPeerId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState(new Map());
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [pinnedPeerId, setPinnedPeerId] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [playbackEnabled, setPlaybackEnabled] = useState(false);

  // refs for stability
  const wsRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingRemoteDescriptions = useRef(new Map());
  const isMountedRef = useRef(true);
  const connectionIdRef = useRef(null);

  // keep ref synchronized with state
  useEffect(() => { 
    localStreamRef.current = localStream; 
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Remove from global tracking
      if (connectionIdRef.current && activeConnections.has(roomId)) {
        const roomConnections = activeConnections.get(roomId);
        roomConnections.delete(connectionIdRef.current);
        if (roomConnections.size === 0) {
          activeConnections.delete(roomId);
        }
      }

      // Cleanup all connections
      if (wsRef.current) {
        try { 
          wsRef.current.onclose = null;
          wsRef.current.close(); 
        } catch (e) {}
        wsRef.current = null;
      }
      
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        try { pc.close(); } catch (e) {}
      }
      peerConnectionsRef.current.clear();
      
      if (cameraStreamRef.current) {
        try { cameraStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      }
      if (screenStreamRef.current) {
        try { screenStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      }
    };
  }, [roomId]);

  // Stable send function
  const sendToServer = useCallback((message) => {
    try {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return false;
      }
      ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.warn('[useVideoChat] sendToServer error', err);
      return false;
    }
  }, []);

  // cleanup helper
  const cleanupPeerConnection = useCallback((peerId) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      try { pc.close(); } catch (e) {}
      peerConnectionsRef.current.delete(peerId);
    }
    pendingRemoteDescriptions.current.delete(peerId);
    setPeers(prev => {
      const m = new Map(prev);
      m.delete(peerId);
      return m;
    });
  }, []);

  // Helper to replace video track
  const replaceVideoTrack = useCallback(async (newTrack) => {
    for (const pc of peerConnectionsRef.current.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && newTrack) {
        try {
          await sender.replaceTrack(newTrack);
        } catch (err) {
          console.warn('replaceTrack failed', err);
        }
      }
    }
  }, []);

  // createPeerConnection - FIXED VERSION
  const createPeerConnection = useCallback((peerId, peerUserName) => {

    if (peerConnectionsRef.current.has(peerId)) {
  // PeerConnection already exists — update the stored userName so late name updates
  // (e.g. join messages that arrive after initial anon-join) are reflected in the UI.
  if (peerUserName) {
    setPeers(prev => {
      const m = new Map(prev);
      const prevEntry = m.get(peerId) || {};
      m.set(peerId, { ...prevEntry, userName: peerUserName });
      return m;
    });
  }
  return peerConnectionsRef.current.get(peerId);
}

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.__peerId = peerId;

    // FIXED: Better negotiation handling
    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') {
          console.debug('[PC] negotiationneeded but signalingState != stable', peerId, pc.signalingState);
          return;
        }
        
        // Add a small delay to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendToServer({ type: 'offer', to: peerId, data: offer });
        console.debug('[PC] sent offer to', peerId);
      } catch (err) {
        console.warn('[PC] negotiationneeded error', err);
      }
    };

    pc.ontrack = (event) => {
      if (!isMountedRef.current) return;
      
      let incoming = null;
      if (event.streams && event.streams.length > 0) {
        incoming = event.streams[0];
      } else {
        incoming = new MediaStream();
        if (event.track) incoming.addTrack(event.track);
      }
      console.debug('[useVideoChat] ontrack from', peerId, 'tracks:', incoming.getTracks().map(t => t.kind));
      
      setPeers(prev => {
        const m = new Map(prev);
        const prevEntry = m.get(peerId) || {};
        m.set(peerId, { ...prevEntry, id: peerId, userName: peerUserName, stream: incoming });
        return m;
      });
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) sendToServer({ type: 'ice-candidate', to: peerId, data: ev.candidate });
    };

    pc.onconnectionstatechange = () => {
      console.debug('[PC] connectionState', peerId, pc.connectionState);
    };

    // FIXED: Better ICE connection handling
    pc.oniceconnectionstatechange = () => {
      console.debug('[PC] iceConnectionState', peerId, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn('[PC] ICE connection failed, restarting ICE');
        try {
          if (pc.restartIce) {
            pc.restartIce();
          }
        } catch (restartErr) {
          console.warn('[PC] restartIce failed', restartErr);
        }
      }
    };

    pc.onsignalingstatechange = () => {
      const pending = pendingRemoteDescriptions.current.get(peerId);
      if (pending && (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-local-pranswer')) {
        console.debug('[PC] applying queued remote answer for', peerId, 'state', pc.signalingState);
        pc.setRemoteDescription(new RTCSessionDescription(pending))
          .then(() => pendingRemoteDescriptions.current.delete(peerId))
          .catch(err => console.warn('[PC] queued remote desc apply failed', peerId, err));
      }
    };

    // FIXED: Add tracks AFTER creating the peer connection with delay
    setTimeout(() => {
      const currentStream = isScreenSharing && screenStreamRef.current ? screenStreamRef.current : cameraStreamRef.current;
      if (currentStream) {
        try {
          currentStream.getTracks().forEach(track => {
            if (!pc.getSenders().some(snd => snd.track === track)) {
              pc.addTrack(track, currentStream);
            }
          });
        } catch (err) {
          console.warn('[useVideoChat] addTrack failed', err);
        }
      }
    }, 200);

    peerConnectionsRef.current.set(peerId, pc);
    setPeers(prev => {
      const m = new Map(prev);
      if (!m.has(peerId)) m.set(peerId, { id: peerId, userName: peerUserName, stream: new MediaStream() });
      else m.set(peerId, { ...m.get(peerId), userName: peerUserName });
      return m;
    });

    return pc;
  }, [sendToServer, isScreenSharing]);

  // WebSocket connection management - SINGLE INSTANCE with global tracking
  const setupWebSocket = useCallback(() => {
    if (!roomId || typeof userName !== 'string' || userName.trim() === '' || !isMountedRef.current) return;
    // Initialize room tracking
    if (!activeConnections.has(roomId)) {
      activeConnections.set(roomId, new Set());
    }
    const roomConnections = activeConnections.get(roomId);

    // If we already have an active connection for this room, don't create a new one
    if (roomConnections.size > 0) {
      console.debug('[WS] already have active connection for room', roomId, 'skipping new connection');
      return;
    }

    const protocol = 'wss'; // Render uses HTTPS/WSS
  const backendHost = 'syncforge-ide.onrender.com';
  const wsUrl = `${protocol}://${backendHost}/video/${roomId}`;

  console.log('Connecting to WebSocket:', wsUrl); /

    // Close existing connection if any
    if (wsRef.current) {
      try { 
        wsRef.current.onclose = null;
        wsRef.current.close(); 
        wsRef.current = null;
      } catch (e) {}
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    connectionIdRef.current = Date.now() + Math.random().toString(36).substr(2, 9);
    roomConnections.add(connectionIdRef.current);

    console.debug('[useVideoChat] opening ws', wsUrl);

    ws.onopen = () => {
      if (!isMountedRef.current) {
        ws.close();
        return;
      }
      console.debug('[WS] connected');
      try { 
        ws.send(JSON.stringify({ type: 'join', name: userName })); 
        ws.send(JSON.stringify({ type: 'media-update', data: { audio: isMicOn, video: isCameraOn } }));
      } catch (e) {
        console.warn('[WS] failed to send join message', e);
      }
    };

    ws.onmessage = async (evt) => {
      if (!isMountedRef.current) return;
      
      let message;
      try { 
        message = JSON.parse(evt.data); 
      } catch (e) { 
        console.warn('[WS] invalid JSON', e); 
        return; 
      }
      const { from, type, data, name: peerUserName } = message;
      console.debug('[WS] receive', type, 'from', from);

      try {
        switch (type) {
          case 'assign-id':
            setLocalPeerId(message.id);
            break;

          case 'user-list':
            for (const u of message.users) {
              createPeerConnection(u.userId, u.userName);
            }
            break;

          case 'join':
            createPeerConnection(from, peerUserName);
            break;

          case 'offer': {
            console.debug('[WS] offer from', from);
            const pc = createPeerConnection(from, peerUserName);
            
            // FIXED: Better offer handling with rollback
            if (pc.signalingState !== 'stable') {
              console.warn('[WS] glare detected - rolling back for polite peer');
              try {
                await pc.setLocalDescription({ type: 'rollback' });
              } catch (rollbackErr) {
                console.warn('[WS] rollback failed, creating new PC', rollbackErr);
                // Create a fresh PC if rollback fails
                cleanupPeerConnection(from);
                const newPc = createPeerConnection(from, peerUserName);
                await newPc.setRemoteDescription(new RTCSessionDescription(data));
                const answer = await newPc.createAnswer();
                await newPc.setLocalDescription(answer);
                sendToServer({ type: 'answer', to: from, data: answer });
                break;
              }
            }

            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data));
            } catch (err) {
              console.error('[WS] setRemoteDescription(offer) failed', err);
              break;
            }

            // FIXED: Add tracks after setting remote description
            const currentStream = isScreenSharing && screenStreamRef.current ? screenStreamRef.current : cameraStreamRef.current;
            if (currentStream) {
              try {
                currentStream.getTracks().forEach(track => {
                  if (!pc.getSenders().some(snd => snd.track === track)) {
                    pc.addTrack(track, currentStream);
                  }
                });
              } catch (err) { console.warn('[WS] addTrack before answer failed', err); }
            }

            try {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendToServer({ type: 'answer', to: from, data: answer });
              console.debug('[WS] answered offer to', from);
            } catch (err) {
              console.error('[WS] createAnswer failed', err);
            }
            break;
          }

          case 'answer': {
            console.debug('[WS] answer from', from);
            const pc = peerConnectionsRef.current.get(from);
            if (!pc) { 
              console.warn('[WS] answer for unknown pc', from); 
              break; 
            }

            // FIXED: Better answer handling with retry logic
            const applyAnswer = async (answerData) => {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(answerData));
                console.debug('[WS] applied remote answer for', from);
                pendingRemoteDescriptions.current.delete(from);
              } catch (err) {
                console.warn('[WS] setRemoteDescription(answer) failed, will retry', err);
                
                // Retry after a delay with fresh PC if needed
                setTimeout(async () => {
                  if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-local-pranswer') {
                    try {
                      await pc.setRemoteDescription(new RTCSessionDescription(answerData));
                      console.debug('[WS] applied queued answer after delay for', from);
                      pendingRemoteDescriptions.current.delete(from);
                    } catch (retryErr) {
                      console.warn('[WS] retry also failed, creating new PC', retryErr);
                      // Create fresh PC as last resort
                      cleanupPeerConnection(from);
                      createPeerConnection(from, peerUserName);
                    }
                  }
                }, 500);
              }
            };

            if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-local-pranswer') {
              await applyAnswer(data);
            } else {
              console.warn('[WS] Received answer while pc in unexpected signalingState:', pc.signalingState, ' — queueing', from);
              pendingRemoteDescriptions.current.set(from, data);
            }
            break;
          }

          case 'ice-candidate': {
            const pc = peerConnectionsRef.current.get(from);
            if (pc) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data));
              } catch (err) {
                console.warn('[WS] addIceCandidate failed', err);
              }
            } else {
              console.warn('[WS] ice-candidate for unknown pc', from);
            }
            break;
          }

          case 'media-update': {
            setPeers(prev => {
              const m = new Map(prev);
              const existing = m.get(from) || {};
              m.set(from, { ...existing, ...data });
              return m;
            });
            break;
          }

          case 'leave': {
            console.debug('[WS] peer left', from);
            if (pinnedPeerId === from) setPinnedPeerId(null);
            cleanupPeerConnection(from);
            break;
          }

          case 'kicked': {
            // Server-side kick: politely inform the user and redirect away
            try {
              const reason = message.reason || 'Removed by host';
              // show alert and navigate to lobby (or homepage)
              alert(`You were removed from the session. Reason: ${reason}`);
            } catch (e) {
              console.warn('kicked: failed to show alert', e);
            }
            // Ensure local cleanup and redirect to lobby
            try {
              if (wsRef.current) { wsRef.current.close(); }
            } catch (e) {}
            navigate(`/lobby/${roomId}`);
            break;
          }

          // FIXED: Add negotiation-failed handler
          case 'negotiation-failed': {
            console.warn('[WS] negotiation failed with', from, 'recreating connection');
            cleanupPeerConnection(from);
            createPeerConnection(from, peerUserName);
            break;
          }

          default:
            console.debug('[WS] unknown type', type);
            break;
        }
      } catch (err) {
        console.error('[WS] message handler error', err);
      }
    };

    ws.onclose = (ev) => {
      if (!isMountedRef.current) return;
      console.debug('[WS] closed', ev.code, ev.reason);
      
      // Remove from global tracking
      if (connectionIdRef.current && activeConnections.has(roomId)) {
        const roomConnections = activeConnections.get(roomId);
        roomConnections.delete(connectionIdRef.current);
        if (roomConnections.size === 0) {
          activeConnections.delete(roomId);
        }
      }
    };

    // FIXED: Better error handling with reconnection
    ws.onerror = (err) => {
      if (!isMountedRef.current) return;
      console.error('[WS] ws error', err);
      
      // Attempt reconnection after error
      setTimeout(() => {
        if (isMountedRef.current && roomId && userName) {
          console.debug('[WS] attempting reconnection after error');
          setupWebSocket();
        }
      }, 2000);
    };
  }, [roomId, userName, cleanupPeerConnection, sendToServer, createPeerConnection, localPeerId, isScreenSharing, pinnedPeerId, navigate]);

  // WebSocket effect - setup only when needed
  useEffect(() => {
    if (roomId && userName) {
      setupWebSocket();
    }
    
    return () => {
      // Cleanup will be handled by the main unmount effect
    };
  }, [roomId, userName, setupWebSocket]);

  // Acquire local media - ONLY ONCE
  useEffect(() => {
    let cancelled = false;
    const initMedia = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        cameraStreamRef.current = s;
        setLocalStream(s);
        console.debug('[useVideoChat] local media acquired');
      } catch (err) {
        console.error('[useVideoChat] getUserMedia failed', err);
      }
    };
    initMedia();
    return () => { cancelled = true; };
  }, []);

  // When localStream changes, add tracks to existing PCs
  useEffect(() => {
    const currentStream = isScreenSharing && screenStreamRef.current ? screenStreamRef.current : cameraStreamRef.current;
    if (!currentStream) return;
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      try {
        currentStream.getTracks().forEach(track => {
          if (!pc.getSenders().some(snd => snd.track === track)) {
            pc.addTrack(track, currentStream);
            console.debug('[useVideoChat] added local track to pc', peerId, track.kind);
          }
        });
      } catch (err) {
        console.warn('[useVideoChat] addTrack to pc failed', err);
      }
    }
  }, [localStream, isScreenSharing]);

  // screen share toggle - maintain both streams but only show the active one
  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen sharing and revert to camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      
      // Switch back to camera stream for local preview
      if (cameraStreamRef.current) {
        setLocalStream(cameraStreamRef.current);
        await replaceVideoTrack(cameraStreamRef.current.getVideoTracks()[0]);
      }
      
      setIsScreenSharing(false);
      sendToServer({ type: 'media-update', data: { isScreenSharing: false } });
      return;
    }

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screen;
      
      setLocalStream(screen);
      await replaceVideoTrack(screen.getVideoTracks()[0]);
      
      screen.getVideoTracks()[0].onended = () => {
        if (isScreenSharing) {
          handleToggleScreenShare();
        }
      };
      
      setIsScreenSharing(true);
      sendToServer({ type: 'media-update', data: { isScreenSharing: true } });
    } catch (err) {
      console.error('[useVideoChat] getDisplayMedia failed', err);
    }
  }, [isScreenSharing, sendToServer, replaceVideoTrack]);

  // Get the appropriate stream for local display
  const getDisplayStream = useCallback(() => {
    if (isScreenSharing && screenStreamRef.current) {
      return screenStreamRef.current;
    }
    return cameraStreamRef.current;
  }, [isScreenSharing]);

  // mic/camera toggles
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !isMicOn;
    localStreamRef.current.getAudioTracks().forEach(t => t.enabled = newState);
    setIsMicOn(newState);
    try {
      sendToServer({ type: 'media-update', data: { isMicOn: newState, isCameraOn } });
    } catch (e) {}
  }, [isMicOn, isCameraOn, sendToServer]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !isCameraOn;
    localStreamRef.current.getVideoTracks().forEach(t => t.enabled = newState);
    setIsCameraOn(newState);
    try {
      sendToServer({ type: 'media-update', data: { isCameraOn: newState, isMicOn } });
    } catch (e) {}
  }, [isCameraOn, isMicOn, sendToServer]);

  const handlePinPeer = useCallback((peerId) => {
    setPinnedPeerId(current => (current === peerId ? null : peerId));
  }, []);

  const handleSelfPin = useCallback(() => {
    if (localPeerId) {
      setPinnedPeerId(current => (current === localPeerId ? null : localPeerId));
    }
  }, [localPeerId]);

  const handleEndCall = useCallback(() => {
    try {
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        try { pc.close(); } catch {}
      }
      peerConnectionsRef.current.clear();
      if (wsRef.current) try { wsRef.current.close(); } catch {}
      if (cameraStreamRef.current) try { cameraStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
      if (screenStreamRef.current) try { screenStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
    } catch (err) {
      console.warn('[useVideoChat] handleEndCall cleanup error', err);
    }
    navigate('/');
  }, [navigate]);

  const enablePlayback = useCallback(() => {
    setPlaybackEnabled(true);
  }, []);

  return {
    localPeerId,
    localStream: getDisplayStream(),
    peers,
    toggleMic,
    toggleCamera,
    isMicOn,
    isCameraOn,
    handleEndCall,
    isScreenSharing,
    handleToggleScreenShare,
    pinnedPeerId,
    handlePinPeer,
    handleSelfPin,
    isSelfPinned: pinnedPeerId === localPeerId,
    playbackEnabled,
    enablePlayback,
    cameraStream: cameraStreamRef.current,
    screenStream: screenStreamRef.current,
    hasScreenShare: !!screenStreamRef.current,
    hasCamera: !!cameraStreamRef.current,
    getCurrentStream: getDisplayStream,
  };

};


