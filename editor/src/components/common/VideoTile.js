// src/components/common/VideoTile.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  FaThumbtack, FaMicrophone, FaMicrophoneSlash,
  FaVideo, FaVideoSlash, FaVolumeUp, FaVolumeMute,
  FaDesktop, FaArrowsAlt, FaExpandAlt, FaCompressAlt
} from 'react-icons/fa';

const parseAspect = (ratioStr) => {
  // accepts '16/9', '4/3', '1/1', '21/9' or numbers like '16:9'
  if (!ratioStr) return 16 / 9;
  const sep = ratioStr.includes('/') ? '/' : ratioStr.includes(':') ? ':' : null;
  if (!sep) return Number(ratioStr) || 16 / 9;
  const [a, b] = ratioStr.split(sep).map(Number);
  if (!a || !b) return 16 / 9;
  return a / b;
};

const VideoTile = ({
  id,
  label,
  stream,
  isLocal = false,
  isPinned = false,
  onPin,
  playbackEnabled = true,
  onRequestUnmute,
  compact = false,
  remoteMediaState = {},
  fitMode = 'cover',
  objectPosition = 'center',
  onChangeObjectPosition = null,
  showPositionControl = false,
  showStats = true,
  aspectRatio = '16/9',        // new: string describing aspect ratio
  onChangeAspectRatio = null,  // callback when pinned aspect ratio changes
  showAspectControl = false,   // whether to show aspect ratio control (pinned)
  isScreenSharing = false
}) => {
  const videoRef = useRef(null);
  const [mutedLocally, setMutedLocally] = useState(false);
  const [trackStatus, setTrackStatus] = useState({ video: false, audio: false, videoCount: 0, audioCount: 0 });
  const [speaking, setSpeaking] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [showPosMenu, setShowPosMenu] = useState(false);
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const [isInPiP, setIsInPiP] = useState(false);

  // attach stream & update statuses
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const attach = () => {
      try {
        if (videoElement.srcObject !== stream) {
          videoElement.srcObject = stream || null;
        }
        videoElement.muted = isLocal || mutedLocally;
        videoElement.play().catch(() => {});
      } catch (e) { console.warn('[VideoTile] attach stream', e); }
    };

    attach();

    const update = () => {
      if (!stream) {
        setTrackStatus({ video: false, audio: false, videoCount: 0, audioCount: 0 });
        setHasVideo(false);
        setSpeaking(false);
        return;
      }
      const vTracks = stream.getVideoTracks();
      const aTracks = stream.getAudioTracks();
      const vEnabled = vTracks.length > 0 && vTracks.some(t => t.enabled && t.readyState === 'live');
      const aEnabled = aTracks.length > 0 && aTracks.some(t => t.enabled && t.readyState === 'live');

      setTrackStatus({ video: vEnabled, audio: aEnabled, videoCount: vTracks.length, audioCount: aTracks.length });
      setHasVideo(vEnabled);
      setSpeaking(aEnabled && !mutedLocally && !isLocal);
    };

    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [stream, isLocal, mutedLocally]);

  useEffect(() => {
    if (!isLocal && videoRef.current) {
      const newMuted = !playbackEnabled;
      setMutedLocally(newMuted);
      try { videoRef.current.muted = newMuted; } catch (e) {}
    }
  }, [playbackEnabled, isLocal]);

  // PiP listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleEnter = () => setIsInPiP(true);
    const handleLeave = () => setIsInPiP(false);
    v.addEventListener('enterpictureinpicture', handleEnter);
    v.addEventListener('leavepictureinpicture', handleLeave);
    return () => {
      v.removeEventListener('enterpictureinpicture', handleEnter);
      v.removeEventListener('leavepictureinpicture', handleLeave);
    };
  }, []);

  const audioOn = typeof remoteMediaState.isMicOn === 'boolean' ? remoteMediaState.isMicOn : trackStatus.audio;
  const videoOn = typeof remoteMediaState.isCameraOn === 'boolean' ? remoteMediaState.isCameraOn : trackStatus.video;
  const initials = (label || 'You').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  const handleTileClick = () => {
    if (!isLocal && !playbackEnabled) onRequestUnmute?.();
  };

  const handleSpeakerToggle = (e) => {
    e.stopPropagation();
    const newMuted = !mutedLocally;
    setMutedLocally(newMuted);
    if (videoRef.current) {
      try {
        videoRef.current.muted = newMuted;
        if (!newMuted) videoRef.current.play().catch(() => {});
      } catch (err) { console.debug('Speaker toggle', err); }
    }
  };

  const posOptions = [
    { key: 'center', label: 'Center' },
    { key: 'top', label: 'Top' },
    { key: 'bottom', label: 'Bottom' },
    { key: 'left', label: 'Left' },
    { key: 'right', label: 'Right' },
    { key: 'top left', label: 'Top-Left' },
    { key: 'top right', label: 'Top-Right' },
    { key: 'bottom left', label: 'Bottom-Left' },
    { key: 'bottom right', label: 'Bottom-Right' }
  ];

  const aspectOptions = [
    { key: '16/9', label: '16:9' },
    { key: '4/3', label: '4:3' },
    { key: '1/1', label: '1:1 (square)' },
    { key: '21/9', label: '21:9 (ultrawide)' }
  ];

  // style: compute aspect ratio and padding-top fallback
  const ratioNum = parseAspect(aspectRatio);
  const paddingTop = `${100 / ratioNum}%`; // eg 56.25%
  const aspectStyle = {
    position: 'relative',
    width: '100%',
    aspectRatio: `${aspectRatio}`, // modern browsers
    paddingTop // fallback
  };

  const innerVideoStyle = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: fitMode === 'cover' ? 'cover' : 'contain',
    objectPosition: objectPosition || 'center',
    backgroundColor: '#000'
  };

  const requestPiP = async () => {
    try {
      const v = videoRef.current;
      if (!v) return;
      // Toggle PiP: if in PiP -> exit; else request.
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
      } else {
        // some browsers require playing video and not muted for PiP; attempt
        try { await v.requestPictureInPicture(); } catch (err) {
          console.warn('PiP request failed', err);
        }
      }
    } catch (err) {
      console.warn('PiP error', err);
    }
  };

  return (
    <div
      className={`relative group overflow-hidden rounded-xl bg-gray-800 shadow-lg transition-all duration-200 hover:shadow-xl ${isPinned ? 'ring-2 ring-blue-500 ring-opacity-80' : ''}`}
      onClick={handleTileClick}
      role="button"
      tabIndex={0}
      aria-label={`participant-${label}`}
    >
      {/* 16:9 (or chosen) container */}
      <div style={aspectStyle} className="w-full bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || mutedLocally}
          style={innerVideoStyle}
        />

        {/* avatar fallback */}
        {(!stream || !hasVideo) && (
          <div style={{ position: 'absolute', inset: 0 }} className="w-full h-full flex items-center justify-center bg-gray-700">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
              {initials}
            </div>
          </div>
        )}
      </div>

      {/* TOP LEFT: name (requested) */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
        <div className="text-xs text-white font-semibold bg-black/60 px-2 py-1 rounded">
          {label}
        </div>
      </div>

      {/* Controls - top right */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-30">
        <div className={`p-1 rounded-full ${audioOn ? 'bg-green-500' : 'bg-red-500'}`}>
          {audioOn ? <FaMicrophone size={10} className="text-white" /> : <FaMicrophoneSlash size={10} className="text-white" />}
        </div>

        <div className={`p-1 rounded-full ${videoOn ? 'bg-green-500' : 'bg-red-500'}`}>
          {videoOn ? <FaVideo size={10} className="text-white" /> : <FaVideoSlash size={10} className="text-white" />}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onPin?.(); }}
          className={`p-1 rounded-full ${isPinned ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          title="Pin"
        >
          <FaThumbtack size={10} />
        </button>

        {!isLocal && (
          <button onClick={handleSpeakerToggle} className={`p-1 rounded-full ${mutedLocally ? 'bg-red-500' : 'bg-green-500'} text-white`} title="Toggle speaker">
            {mutedLocally ? <FaVolumeMute size={10} /> : <FaVolumeUp size={10} />}
          </button>
        )}

        {/* PiP button: shown only on pinned tile */}
        {isPinned && (
          <button
            onClick={(e) => { e.stopPropagation(); requestPiP(); }}
            className="p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200"
            title={isInPiP ? 'Exit picture-in-picture' : 'Open picture-in-picture'}
          >
            <FaExpandAlt size={12} />
          </button>
        )}

        {/* Aspect ratio control (only show for pinned if enabled) */}
        {isPinned && showAspectControl && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowAspectMenu(v => !v); }}
              className="p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200"
              title="Aspect ratio"
            >
              <FaCompressAlt size={12} />
            </button>
            {showAspectMenu && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-40 text-xs">
                {aspectOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setShowAspectMenu(false); onChangeAspectRatio?.(opt.key); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* crop position control (hosts) */}
        {showPositionControl && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowPosMenu(v => !v); }}
              className="p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200"
              title="Crop position"
            >
              <FaArrowsAlt size={12} />
            </button>
            {showPosMenu && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-40 text-xs">
                {posOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setShowPosMenu(false); onChangeObjectPosition?.(opt.key); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom overlay — hide if showStats is false */}
      {showStats && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 z-10">
          <div className="text-white text-sm font-medium truncate">{label}</div>
          <div className="text-gray-300 text-xs">
            {trackStatus.videoCount > 0 && `${trackStatus.videoCount} video`}
            {trackStatus.videoCount > 0 && trackStatus.audioCount > 0 && ' • '}
            {trackStatus.audioCount > 0 && `${trackStatus.audioCount} audio`}
          </div>
        </div>
      )}

      {speaking && (
        <div className="absolute inset-0 ring-2 ring-green-400 rounded-xl pointer-events-none animate-pulse z-0" />
      )}
    </div>
  );
};

export default VideoTile;
