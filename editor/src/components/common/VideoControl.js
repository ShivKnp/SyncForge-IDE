// src/components/common/VideoControls.jsx
import React from 'react';
import {
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaDesktop,
  FaPhone,
  FaExpand,
  FaCompress
} from 'react-icons/fa';

const VideoControls = ({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isMaximized,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleMaximize,
  onEndCall,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap- p-3 bg-gray-800 rounded-xl ${className}`}>
      {/* Microphone Toggle */}
      <button
        onClick={onToggleMic}
        className={`p-3 rounded-full transition-all duration-200 ${
          isMicOn
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
        title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
      >
        {isMicOn ? <FaMicrophone size={16} /> : <FaMicrophoneSlash size={16} />}
      </button>

      {/* Camera Toggle */}
      <button
        onClick={onToggleCamera}
        className={`p-3 rounded-full transition-all duration-200 ${
          isCameraOn
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
        title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
      >
        {isCameraOn ? <FaVideo size={16} /> : <FaVideoSlash size={16} />}
      </button>

      {/* Screen Share Toggle */}
      <button
        onClick={onToggleScreenShare}
        className={`p-3 rounded-full transition-all duration-200 ${
          isScreenSharing
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-600 hover:bg-gray-700 text-white'
        }`}
        title={isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
      >
        <FaDesktop size={16} />
      </button>

      {/* Maximize/Restore Toggle */}
      <button
        onClick={onToggleMaximize}
        className="p-3 rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-all duration-200"
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? <FaCompress size={16} /> : <FaExpand size={16} />}
      </button>

      {/* End Call Button */}
      <button
        onClick={onEndCall}
        className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200"
        title="End call"
      >
        <FaPhone size={16} />
      </button>
    </div>
  );
};

export default VideoControls;