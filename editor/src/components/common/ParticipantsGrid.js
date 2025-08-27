// src/components/common/ParticipantsGrid.jsx
import React, { useRef, useEffect, useState, useMemo } from 'react';
import VideoTile from './VideoTile';
import { FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash, FaDesktop, FaPhoneSlash } from 'react-icons/fa';
import { Modal, notification, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { FaPhone } from "react-icons/fa";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function ParticipantsGrid({
  peers = new Map(),
  localStream,
  localPeerId,
  localUserName = 'You',
  handlePinPeer = () => {},
  handleSelfPin = () => {},
  pinnedPeerId = null,
  playbackEnabled = true,
  enablePlayback = () => {},
  toggleMic,
  toggleCamera,
  isMicOn,
  isCameraOn,
  compact = false,
  className = '',
  handleToggleScreenShare = () => {},
  isScreenSharing = false,
  sidebarCollapsed = false,
  handleEndCall = null,
  isLocalHost = false,
  initialPinnedAspectRatio,
  initialPinnedPosition,
  onPinnedSettingChange
}) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(360);
  const [cols, setCols] = useState(2);

  const [searchTerm, setSearchTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pinnedObjectPosition, setPinnedObjectPosition] = useState('center');
  const [pinnedAspectRatio, setPinnedAspectRatio] = useState('16/9');

  useEffect(() => {
    if (typeof initialPinnedPosition === 'string') setPinnedObjectPosition(initialPinnedPosition);
    if (typeof initialPinnedAspectRatio === 'string') setPinnedAspectRatio(initialPinnedAspectRatio);
  }, [initialPinnedPosition, initialPinnedAspectRatio]);

  // Update functions that also notify parent
  const handlePinnedPositionChange = (pos) => {
    setPinnedObjectPosition(pos);
    if (typeof onPinnedSettingChange === 'function') onPinnedSettingChange({ objectPosition: pos, aspectRatio: pinnedAspectRatio });
  };

  const handlePinnedAspectChange = (ratio) => {
    setPinnedAspectRatio(ratio);
    if (typeof onPinnedSettingChange === 'function') onPinnedSettingChange({ objectPosition: pinnedObjectPosition, aspectRatio: ratio });
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(Math.round(el.clientWidth));
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tileTarget = compact ? 140 : 180;
    const calculated = Math.floor(width / tileTarget) || 1;
    setCols(clamp(calculated, 1, 4));
  }, [width, compact]);

  const allParticipants = useMemo(() => {
    const arr = [
      {
        id: localPeerId || 'local',
        label: localUserName,
        stream: localStream,
        isLocal: true,
        peerObj: { isScreenSharing }
      }
    ];
    for (const p of peers.values()) {
      arr.push({
        id: p.id || p.peerId || p.userId,
        label: p.userName || 'Anon',
        stream: p.stream,
        isLocal: false,
        peerObj: p
      });
    }
    return arr;
  }, [peers, localPeerId, localUserName, localStream, isScreenSharing]);

  // Filter participants by search
  const visibleParticipants = useMemo(() => {
    if (!debounced) return allParticipants;
    return allParticipants.filter(p => (p.label || '').toLowerCase().includes(debounced));
  }, [allParticipants, debounced]);

  const pinnedEntry = visibleParticipants.find(p => p.id === pinnedPeerId) || null;
  const others = visibleParticipants.filter(p => p.id !== (pinnedEntry?.id));

  const handleToggleMic = toggleMic || (() => {});
  const handleToggleCamera = toggleCamera || (() => {});

  const confirmEndCall = () => {
    Modal.confirm({
      title: 'End Call',
      content: 'Are you sure you want to leave the session and end the call?',
      okText: 'Yes, leave',
      cancelText: 'Cancel',
      okButtonProps: {
        className: 'bg-rose-600 hover:bg-rose-700 border-0'
      },
      cancelButtonProps: {
        className: 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
      },
      className: 'video-modal',
      onOk: async () => {
        try {
          if (typeof handleEndCall === 'function') {
            await handleEndCall();
            notification.info({ message: 'Left the session' });
          } else {
            notification.warning({ message: 'Leave handler not provided — redirecting to home' });
            window.location.href = '/';
          }
        } catch (err) {
          console.error('[ParticipantsGrid] error calling handleEndCall', err);
          notification.error({ message: 'Failed to leave cleanly. Reloading.' });
          window.location.href = '/';
        }
      }
    });
  };

  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800 gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
          <FaPhone className="text-cyan-400" />
          <span>Video Chat</span>
        </h3>
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search participants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs py-1.5 pl-8 pr-2 w-32 bg-slate-800/60 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-200 placeholder-slate-500"
          />
          <SearchOutlined className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-500 text-xs" />
        </div>
      </div>

      {/* Media Controls */}
      <div className="flex items-center justify-center mb-4 gap-2">
        <button
          onClick={handleToggleMic}
          className={`p-3 rounded-full transition-all ${
            isMicOn 
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/20' 
              : 'bg-slate-700 text-rose-400 hover:bg-slate-600'
          }`}
          title={isMicOn ? 'Mute' : 'Unmute'}
        >
          {isMicOn ? <FaMicrophone size={14} /> : <FaMicrophoneSlash size={14} />}
        </button>
        
        <button
          onClick={handleToggleCamera}
          className={`p-3 rounded-full transition-all ${
            isCameraOn 
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/20' 
              : 'bg-slate-700 text-rose-400 hover:bg-slate-600'
          }`}
          title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {isCameraOn ? <FaVideo size={14} /> : <FaVideoSlash size={14} />}
        </button>
        
        <button
          onClick={handleToggleScreenShare}
          className={`p-3 rounded-full transition-all ${
            isScreenSharing 
              ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/20' 
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          title="Screen share"
        >
          <FaDesktop size={14} />
        </button>

        <button
          onClick={confirmEndCall}
          className="p-3 rounded-full bg-gradient-to-r from-rose-600 to-rose-700 text-white hover:from-rose-700 hover:to-rose-800 shadow-lg shadow-rose-500/20 transition-all"
          title="End call"
        >
          <FaPhoneSlash size={14} />
        </button>
      </div>

      {/* Pinned Video */}
      {pinnedEntry && (
        <div className="mb-4 rounded-xl overflow-hidden shadow-xl bg-black border border-slate-700">
          <VideoTile
            id={pinnedEntry.id}
            label={pinnedEntry.label}
            stream={pinnedEntry.stream}
            isLocal={pinnedEntry.isLocal}
            isPinned={true}
            playbackEnabled={playbackEnabled}
            onPin={() => (pinnedEntry.isLocal ? handleSelfPin() : handlePinPeer(pinnedEntry.id))}
            onRequestUnmute={() => enablePlayback()}
            compact={compact}
            remoteMediaState={pinnedEntry.peerObj}
            fitMode="cover"
            objectPosition={pinnedObjectPosition}
            onChangeObjectPosition={handlePinnedPositionChange}
            onChangeAspectRatio={handlePinnedAspectChange}
            aspectRatio={pinnedAspectRatio}
            showStats={false}
            isScreenSharing={pinnedEntry.peerObj?.isScreenSharing || false}
            showPositionControl={true}
            showAspectControl={true}
          />
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {(pinnedEntry ? others : visibleParticipants).map(p => (
          <div key={p.id} className="rounded-xl overflow-hidden shadow-md bg-slate-800/40 border border-slate-700">
            <VideoTile
              id={p.id}
              label={p.label}
              stream={p.stream}
              isLocal={p.isLocal}
              isPinned={p.id === pinnedPeerId}
              onPin={() => (p.isLocal ? handleSelfPin() : handlePinPeer(p.id))}
              playbackEnabled={playbackEnabled}
              onRequestUnmute={() => enablePlayback()}
              compact={compact}
              remoteMediaState={p.peerObj}
              isScreenSharing={p.peerObj?.isScreenSharing || false}
              showStats={false}
            />
          </div>
        ))}
      </div>

      {/* Empty state */}
      {visibleParticipants.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <FaVideo className="text-3xl mx-auto mb-3 opacity-50" />
          <p className="text-sm">No participants found</p>
          {debounced && (
            <p className="text-xs mt-1">Try a different search term</p>
          )}
        </div>
      )}
    </div>
  );
}