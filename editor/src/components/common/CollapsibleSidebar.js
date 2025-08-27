// src/components/common/CollapsibleSidebar.js
import React, { useState, useEffect } from 'react';
import { Tooltip } from 'antd';
import {
  VscFiles,
  VscAccount,
  VscCommentDiscussion,
  VscChevronLeft,
  VscChevronRight,
  VscPlay,
  VscDeviceCameraVideo
} from 'react-icons/vsc';
import { Resizable } from 're-resizable';
import FileTree from './FileTree';
import ParticipantsList from './ParticipantsList';
import ParticipantsGrid from './ParticipantsGrid';
import ChatPanel from './ChatPanel';
import SidePanel from './SidePanel';

const CollapsibleSidebar = ({
  state,
  actions,
  id,
  userName,
  ownerName,
  enableVideo,
  enableChat,
  peers,
  localUserName,
  localStream,
  toggleMic,
  toggleCamera,
  isMicOn,
  isCameraOn,
  videoHook,
  playbackEnabled,
  enablePlayback,
  input,
  output,
  lang,
  handleLang,
  handleRun,
  handleInput,
  runCodeDisabled,
  roomMode,
  projectLanguage,
  sharedInputOutput,
  onPromoteToHost,
  onKickParticipant,
  isLocalHost,
  onUploadDone,
  handleEndCall,
  onSidebarResize
}) => {
  const [activePanel, setActivePanel] = useState('files');
  const [isExpanded, setIsExpanded] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(310);
  const [maxSidebarWidth, setMaxSidebarWidth] = useState(Math.round(window.innerWidth * 0.7));

  useEffect(() => {
    const onResize = () => setMaxSidebarWidth(Math.round(window.innerWidth * 0.7));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof onSidebarResize === 'function') {
      onSidebarResize(sidebarWidth);
    }
  }, [sidebarWidth, onSidebarResize]);

  const togglePanel = (panel) => {
    if (activePanel === panel && isExpanded) {
      setIsExpanded(false);
    } else {
      setActivePanel(panel);
      setIsExpanded(true);
      if (panel === 'chat') {
        setUnreadCount(0);
      }
    }
  };

  return (
    <div className="flex h-full flex-shrink-0">
      {/* Activity Bar - Styled to match theme */}
      <div className="flex flex-col items-center py-4 w-12 bg-slate-900 border-r border-slate-800">
        <div className="flex flex-col items-center space-y-5">
          <Tooltip title="Files" placement="right" color="#0f172a">
            <button
              className={`p-2 rounded-lg transition-all ${activePanel === 'files' && isExpanded ? 'bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              onClick={() => togglePanel('files')}
            >
              <VscFiles size={20} />
            </button>
          </Tooltip>

          <Tooltip title="Compiler" placement="right" color="#0f172a">
            <button
              className={`p-2 rounded-lg transition-all ${activePanel === 'compiler' && isExpanded ? 'bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              onClick={() => togglePanel('compiler')}
            >
              <VscPlay size={20} />
            </button>
          </Tooltip>

          <Tooltip title="Participants" placement="right" color="#0f172a">
            <button
              className={`p-2 rounded-lg transition-all ${activePanel === 'participants' && isExpanded ? 'bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              onClick={() => togglePanel('participants')}
            >
              <VscAccount size={20} />
            </button>
          </Tooltip>


          {enableVideo && (
            <Tooltip title="Video Chat" placement="right" color="#0f172a">
              <button
                className={`p-2 rounded-lg transition-all ${activePanel === 'video' && isExpanded ? 'bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                onClick={() => togglePanel('video')}
              >
                <VscDeviceCameraVideo size={18} />
              </button>
            </Tooltip>
          )}

          {enableChat && (
            <Tooltip title="Chat" placement="right" color="#0f172a">
              <button
                className={`relative p-2 rounded-lg transition-all ${activePanel === 'chat' && isExpanded ? 'bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                onClick={() => togglePanel('chat')}
              >
                <VscCommentDiscussion size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium leading-none text-white bg-rose-500 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            </Tooltip>
          )}
        </div>

        <div className="mt-auto">
          <Tooltip title={isExpanded ? "Collapse sidebar" : "Expand sidebar"} placement="right" color="#0f172a">
            <button
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <VscChevronLeft size={16} /> : <VscChevronRight size={16} />}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Collapsible Sidebar Content with Resizable */}
      {isExpanded && (
        <Resizable
          style={{ flexShrink: 0 }}
          size={{ width: sidebarWidth, height: '100%' }}
          maxWidth={maxSidebarWidth}
          minWidth={280}
          enable={{ right: true }}
          onResizeStop={(e, direction, ref, d) => {
            setSidebarWidth(w => {
              const next = w + d.width;
              const clamped = Math.max(280, Math.min(maxSidebarWidth, next));
              if (typeof onSidebarResize === 'function') onSidebarResize(clamped);
              return clamped;
            });
          }}
          handleStyles={{
            right: {
              width: '6px',
              right: '-3px',
              cursor: 'col-resize',
              backgroundColor: 'rgba(148, 163, 184, 0.2)',
              borderRadius: '3px'
            }
          }}
          className="flex flex-col"
        >
          <div className="h-full bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-md font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                {activePanel === 'files' && (
                  <>
                    <VscFiles className="text-cyan-400" />
                    <span>Explorer</span>
                  </>
                )}
                {activePanel === 'participants' && (
                  <>
                    <VscAccount className="text-cyan-400" />
                    <span>Participants</span>
                  </>
                )}
                {activePanel === 'compiler' && (
                  <>
                    <VscPlay className="text-cyan-400" />
                    <span>Compiler</span>
                  </>
                )}
                {activePanel === 'video' && (
                  <>
                    <VscDeviceCameraVideo className="text-cyan-400" />
                    <span>Video Chat</span>
                  </>
                )}
                {activePanel === 'chat' && (
                  <>
                    <VscCommentDiscussion className="text-cyan-400" />
                    <span>Chat</span>
                  </>
                )}
              </h2>
            </div>

            <div className="flex-1 overflow-auto bg-slate-900/30">
              {activePanel === 'files' && (
                <FileTree
                  tree={state.tree}
                  selectedNodeId={state.selectedNodeId}
                  onSelectNode={actions.selectNode}
                  onCreateFile={actions.createNewFile}
                  onCreateFolder={actions.createFolder}
                  onRenameNode={actions.renameNode}
                  onDeleteNode={actions.deleteNode}
                  onFileClick={actions.handleTabChange}
                  activeFileId={state.activeFileId}
                />
              )}

              {activePanel === 'participants' && (
                <ParticipantsList
                  peers={peers}
                  localUserName={localUserName || userName}
                  ownerName={ownerName || state.config?.ownerName}
                  onPromoteToHost={(targetName, peerId) => actions.promoteToHost(targetName)}
                  onKickParticipant={(targetName, peerId) => actions.kickParticipant(targetName, peerId)}
                  isLocalHost={isLocalHost}
                />
              )}

              {activePanel === 'compiler' && (
                <div className="h-full">
                  <SidePanel
                    input={input}
                    output={output}
                    lang={lang}
                    handleLang={handleLang}
                    handleRun={handleRun}
                    handleInput={handleInput}
                    runCodeDisabled={runCodeDisabled}
                    roomMode={roomMode}
                    projectLanguage={projectLanguage}
                    sharedInputOutput={sharedInputOutput}
                  />
                </div>
              )}

              {activePanel === 'video' && enableVideo && (
                <div className="p-3">
                  <ParticipantsGrid
                    peers={peers}
                    localStream={localStream}
                    localPeerId={videoHook?.localPeerId}
                    localUserName={localUserName || userName}
                    handlePinPeer={videoHook?.handlePinPeer}
                    handleSelfPin={videoHook?.handleSelfPin}
                    pinnedPeerId={videoHook?.pinnedPeerId}
                    compact={true}
                    playbackEnabled={playbackEnabled}
                    enablePlayback={enablePlayback}
                    toggleMic={toggleMic}
                    toggleCamera={toggleCamera}
                    isMicOn={isMicOn}
                    isCameraOn={isCameraOn}
                    handleToggleScreenShare={videoHook?.handleToggleScreenShare}
                    isScreenSharing={videoHook?.isScreenSharing}
                    sidebarWidth={sidebarWidth}
                    handleEndCall={handleEndCall}
                    isLocalHost={isLocalHost}
                    initialPinnedPosition={(state.config && state.config.pinnedObjectPosition) || 'center'}
                    initialPinnedAspectRatio={(state.config && state.config.pinnedAspectRatio) || '16/9'}
                    onPinnedSettingChange={({ objectPosition, aspectRatio }) => {
                      if (actions && typeof actions.updateConfig === 'function') {
                        actions.updateConfig({ pinnedObjectPosition: objectPosition, pinnedAspectRatio: aspectRatio });
                      }
                    }}
                  />
                </div>
              )}

              {activePanel === 'chat' && enableChat && (
                <ChatPanel
                  roomId={id}
                  userName={userName}
                  ownerName={ownerName}
                  onUploadDone={onUploadDone}
                  onUnreadChange={(c) => setUnreadCount(c)}
                  embedded={true}
                />
              )}
            </div>
          </div>
        </Resizable>
      )}
    </div>
  );
};

export default CollapsibleSidebar;