// src/pages/LobbyPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Input, Button, Spin, notification, Switch } from 'antd';
import { 
  FaVideo, 
  FaVideoSlash, 
  FaMicrophone, 
  FaMicrophoneSlash, 
  FaLink,
  FaCode,
  FaGlobe,
  FaUserEdit,
  FaUserFriends
} from 'react-icons/fa';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:8080';

const LobbyPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef();

  // user & room
  const [userName, setUserName] = useState(sessionStorage.getItem('codecrew-username') || '');
  const [projectLanguage, setProjectLanguage] = useState(sessionStorage.getItem('codecrew-project-language') || 'cpp');
  const [roomMode, setRoomMode] = useState(sessionStorage.getItem('codecrew-room-mode') || 'project');

  // creator flags / toggles
  const [isRoomCreator, setIsRoomCreator] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Media / preview
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);

  // Config toggles (creator)
  const [enableVideo, setEnableVideo] = useState(true);
  const [multiFile, setMultiFile] = useState(true);
  const [sharedInputOutput, setSharedInputOutput] = useState(true);
  const [enableChat, setEnableChat] = useState(true);
  const [allowRun, setAllowRun] = useState(true);
  const [hostOnlyEditing, setHostOnlyEditing] = useState(false);

  // Language options
  const languages = [
    { id: 'cpp', name: 'C++', icon: <FaCode className="text-blue-400" /> },
    { id: 'java', name: 'Java', icon: <FaCode className="text-red-400" /> },
    { id: 'python', name: 'Python', icon: <FaCode className="text-yellow-400" /> },
  ];

  // Fetch session details once on mount to see if session is new / already initialized
  useEffect(() => {
    let mounted = true;
    const fetchSessionDetails = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get(`${SERVER_URL}/session/${id}/details`, { timeout: 5000 });
        if (!mounted) return;
        if (res.data && res.data.isNew === false) {
          setIsRoomCreator(false);
          setRoomMode(res.data.roomMode || 'project');
          setProjectLanguage(res.data.projectLanguage || 'cpp');
          // apply config if present
          const cfg = res.data.config || {};
          setEnableVideo(cfg.enableVideo !== undefined ? cfg.enableVideo : true);
          setMultiFile(cfg.multiFile !== undefined ? cfg.multiFile : true);
          setSharedInputOutput(cfg.sharedInputOutput !== undefined ? cfg.sharedInputOutput : (res.data.roomMode === 'project'));
          setEnableChat(cfg.enableChat !== undefined ? cfg.enableChat : true);
          setAllowRun(cfg.allowRun !== undefined ? cfg.allowRun : true);
          setHostOnlyEditing(cfg.editing === 'host-only');
        } else {
          setIsRoomCreator(true);
          // defaults for creator
          setEnableVideo(true);
          setMultiFile(true);
          setSharedInputOutput(true);
          setEnableChat(true);
          setAllowRun(true);
          setHostOnlyEditing(false);
        }
      } catch (error) {
        console.warn('[Lobby] fetching session details failed:', error?.message || error);
        if (mounted) {
          setIsRoomCreator(true);
          setEnableVideo(true);
          setMultiFile(true);
          setSharedInputOutput(true);
          setEnableChat(true);
          setAllowRun(true);
          setHostOnlyEditing(false);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchSessionDetails();
    return () => { mounted = false; };
  }, [id]);

  // Acquire media preview (safe pattern using ref)
  useEffect(() => {
    let mounted = true;
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Error accessing media devices.', err);
        // reflect reality in UI
        setEnableVideo(false);
        setIsCameraOn(false);
      }
    };
    getMedia();

    return () => {
      mounted = false;
      try {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
      } catch (e) { /* ignore */ }
      localStreamRef.current = null;
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch (e) {}
      }
    };
  
  }, [id]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      setIsMicOn(false);
      return;
    }
    const audioTracks = stream.getAudioTracks();
    const currentlyOn = audioTracks.length > 0 ? audioTracks[0].enabled : isMicOn;
    const newState = !currentlyOn;
    audioTracks.forEach(track => { try { track.enabled = newState; } catch (e) {} });
    setIsMicOn(newState);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      setIsCameraOn(false);
      return;
    }
    const videoTracks = stream.getVideoTracks();
    const currentlyOn = videoTracks.length > 0 ? videoTracks[0].enabled : isCameraOn;
    const newState = !currentlyOn;
    videoTracks.forEach(track => { try { track.enabled = newState; } catch (e) {} });
    setIsCameraOn(newState);
  };

  const handleJoin = async () => {
    if (!userName.trim()) {
      notification.warning({ message: 'Name Required' });
      return;
    }

    if (isLoading) {
      notification.info({ message: 'Checking session... please wait' });
      return;
    }

    try {
      if (isRoomCreator) {
        // build config from creator toggles
        const config = {
          roomMode,
          projectLanguage,
          multiFile,
          enableVideo,
          sharedInputOutput,
          enableChat,
          allowRun,
          editing: hostOnlyEditing ? 'host-only' : 'open',
          ownerName: userName
        };
        await axios.post(`${SERVER_URL}/session`, { id, config });
      }
    } catch (err) {
      console.warn('Failed to initialize session on server (continuing to join):', err?.response?.data || err?.message || err);
      notification.warning({ message: 'Session initialization may have failed; attempting to join anyway.' });
    }

    // Save local preferences
    sessionStorage.setItem('codecrew-username', userName);
    sessionStorage.setItem('codecrew-project-language', projectLanguage);
    sessionStorage.setItem('codecrew-room-mode', roomMode);
    sessionStorage.setItem('codecrew-mic-on', isMicOn);
    sessionStorage.setItem('codecrew-camera-on', isCameraOn);

    // stop preview stream then navigate
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch (e) { /* ignore */ }

    navigate(`/editor/${id}`);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/lobby/${id}`;
    navigator.clipboard.writeText(url);
    notification.success({ message: 'Link Copied!' });
  };

  // Modern dark-themed lobby styling matching HomePage
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black flex items-center justify-center">
        <Spin size="large" className="text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 antialiased p-4 md:p-6">
      <div className="max-w-6xl mx-auto mt-4 md:mt-8">
        {/* Header */}
        <header className="mb-6 md:mb-8 text-center">
          <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-white/5 text-xs text-slate-300 w-max mb-4">
            <span className="px-2 py-0.5 rounded bg-gradient-to-r from-cyan-400 to-violet-600 text-black font-semibold">Live</span>
            <span>Real-time collaborative coding session</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Join <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-violet-600">SyncForge</span> Session
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base">
            {isRoomCreator ? 'Configure your session before joining' : 'Join the collaborative coding session'}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Left: Video Preview */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                <span className="text-sm text-slate-300 ml-2">Camera Preview</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={toggleMic}
                  className={`p-2 rounded-full ${isMicOn ? 'bg-slate-700 hover:bg-slate-600 text-cyan-400' : 'bg-red-600/80 hover:bg-red-600 text-white'} transition-colors`}
                >
                  {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
                </button>
                <button
                  onClick={toggleCamera}
                  className={`p-2 rounded-full ${isCameraOn ? 'bg-slate-700 hover:bg-slate-600 text-cyan-400' : 'bg-red-600/80 hover:bg-red-600 text-white'} transition-colors`}
                >
                  {isCameraOn ? <FaVideo /> : <FaVideoSlash />}
                </button>
              </div>
            </div>
            
            <div className="relative aspect-video bg-black rounded-b-2xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1] rounded-b-2xl"
              />
              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 rounded-b-2xl">
                  <div className="text-slate-300 text-center">
                    <FaVideoSlash className="text-2xl mx-auto mb-2" />
                    <p className="text-sm">Camera is off</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Configuration */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-5 md:mb-6 text-center flex items-center justify-center gap-2">
              {isRoomCreator ? <FaUserEdit className="text-cyan-400" /> : <FaUserFriends className="text-violet-400" />}
              {isRoomCreator ? 'Session Configuration' : 'Join Session'}
            </h2>

            <div className="space-y-5">
              <div>
    <label 
        htmlFor="userNameInput" 
        className="block text-sm font-medium text-slate-300 mb-2"
    >
        Your Name
    </label>
    <Input
        id="userNameInput"
        placeholder="Enter your name"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        onPressEnter={handleJoin}
        className="
            w-full h-11 px-4 rounded-lg 
            bg-slate-800 
            border border-slate-600 
            text-slate-200 
            placeholder:text-slate-400 
            hover:text-slate-600
            hover:border-slate-500 
            focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500
        "
    />
</div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Session Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRoomMode('project')}
                    className={`p-3 rounded-lg border flex flex-col items-center justify-center transition-all ${
                      roomMode === 'project' 
                        ? 'bg-cyan-900/30 border-cyan-600 shadow-lg shadow-cyan-500/10' 
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <FaCode className={`text-lg mb-1 ${roomMode === 'project' ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className={roomMode === 'project' ? 'text-cyan-300 font-medium' : 'text-slate-300'}>Project Mode</span>
                  </button>
                  <button
                    onClick={() => setRoomMode('polyglot')}
                    className={`p-3 rounded-lg border flex flex-col items-center justify-center transition-all ${
                      roomMode === 'polyglot' 
                        ? 'bg-violet-900/30 border-violet-600 shadow-lg shadow-violet-500/10' 
                        : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <FaGlobe className={`text-lg mb-1 ${roomMode === 'polyglot' ? 'text-violet-400' : 'text-slate-400'}`} />
                    <span className={roomMode === 'polyglot' ? 'text-violet-300 font-medium' : 'text-slate-300'}>Polyglot Mode</span>
                  </button>
                </div>
              </div>

              {roomMode === 'project' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Project Language</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {languages.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setProjectLanguage(lang.id)}
                        className={`p-3 rounded-lg border flex flex-col items-center justify-center transition-all ${
                          projectLanguage === lang.id 
                            ? 'bg-cyan-900/30 border-cyan-600 shadow-lg shadow-cyan-500/10' 
                            : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {lang.icon}
                        <span className={`mt-1 ${projectLanguage === lang.id ? 'text-cyan-300 font-medium' : 'text-slate-300'}`}>
                          {lang.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Creator-only toggles */}
              {isRoomCreator && (
                <div className="pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Session Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="text-sm text-slate-300">Enable Video</div>
                      <Switch 
                        checked={enableVideo} 
                        onChange={setEnableVideo}
                        className="bg-slate-700"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="text-sm text-slate-300">Multi-file Project</div>
                      <Switch 
                        checked={multiFile} 
                        onChange={setMultiFile}
                        className="bg-slate-700"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="text-sm text-slate-300">Shared Input/Output</div>
                      <Switch 
                        checked={sharedInputOutput} 
                        onChange={setSharedInputOutput}
                        className="bg-slate-700"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="text-sm text-slate-300">Enable Chat</div>
                      <Switch 
                        checked={enableChat} 
                        onChange={setEnableChat}
                        className="bg-slate-700"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="text-sm text-slate-300">Allow Run Code</div>
                      <Switch 
                        checked={allowRun} 
                        onChange={setAllowRun}
                        className="bg-slate-700"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="text-sm text-slate-300">Host Editing Only</div>
                      <Switch 
                        checked={hostOnlyEditing} 
                        onChange={setHostOnlyEditing}
                        className="bg-slate-700"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-700 space-y-3">
                <Button
                  type="primary"
                  onClick={handleJoin}
                  className="w-full h-12 rounded-lg font-semibold bg-gradient-to-r from-cyan-500 to-violet-600 border-0 hover:brightness-110 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all"
                >
                  {isRoomCreator ? 'Create & Join Session' : 'Join Session'}
                </Button>

                <Button
                  onClick={handleCopyLink}
                  className="w-full h-12 rounded-lg bg-slate-700 text-white border-slate-600 hover:bg-slate-600 hover:border-slate-500 flex items-center justify-center gap-2"
                  icon={<FaLink />}
                >
                  Copy Session Link
                </Button>
              </div>

              <div className="text-xs text-slate-400 text-center">
                {isRoomCreator
                  ? 'As the session creator, your configuration will initialize the session.'
                  : 'This session already exists. You will join with the existing configuration.'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>SyncForge — Collaborative IDE with real-time editing, video, and shared runtimes</p>
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;