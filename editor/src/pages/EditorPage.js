// src/pages/EditorPage.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useEditorState from '../hooks/useEditorState';
import { Spin, notification, Modal, Switch, Select, Button, Tooltip } from 'antd';
import { FaCog } from 'react-icons/fa';
import CodeEditor from '../components/editor/CodeEditor';
import TerminalPanel from '../components/common/TerminalPanel';
import { useVideoChat } from '../hooks/useVideoChat';
import HostApprovalModal from '../components/common/HostApprovalModal';
import CollapsibleSidebar from '../components/common/CollapsibleSidebar';

const { Option } = Select;

const EditorPageContent = ({ id, userName }) => {
  const {
    state,
    actions,
    handleSaveToWorkspace,
    openTerminalInWorkspace,
    onUploadFiles,
    onUploadZip,
    editorTheme,files,fileTree
  } = useEditorState(id, userName);

  const videoHook = useVideoChat(id, userName);
  const {
    peers,
    localStream,
    localPeerId,
    pinnedPeerId,
    handlePinPeer,
    handleSelfPin,
    isSelfPinned,
    toggleMic,
    toggleCamera,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    handleToggleScreenShare,
    handleEndCall,
    playbackEnabled,
    enablePlayback,
  } = videoHook;

  const pinnedPeer = pinnedPeerId ? (peers.get(pinnedPeerId) || (pinnedPeerId === videoHook.localPeerId ? { userName, isScreenSharing: videoHook.isScreenSharing } : null)) : null;
  const pinnedStream = pinnedPeerId ? (peers.get(pinnedPeerId)?.stream || (pinnedPeerId === videoHook.localPeerId ? videoHook.localStream : null)) : null;
  const pinnedStreamType = pinnedPeer?.isScreenSharing ? 'screen' : 'camera';

  const [hostModalVisible, setHostModalVisible] = useState(false);
  const [configDraft, setConfigDraft] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [currentPendingOp, setCurrentPendingOp] = useState(null);

  // NEW: track sidebar width reported by CollapsibleSidebar
  const [sidebarWidth, setSidebarWidth] = useState(300);

  const handlePromoteToHost = (userToPromote, peerId) => {
    if (!actions || typeof actions.promoteToHost !== 'function') {
      console.warn('promoteToHost action not available');
      return;
    }
    actions.promoteToHost(userToPromote);
  };

  const handleKickParticipant = (userToKick, peerId) => {
    if (!actions || typeof actions.kickParticipant !== 'function') {
      console.warn('kickParticipant action not available');
      return;
    }
    actions.kickParticipant(userToKick, peerId);
  };

  useEffect(() => {
    if (state.config) {
      setConfigDraft({ ...state.config });
    }
  }, [state.config]);

  const openHostModal = () => {
    setConfigDraft({ ...(state.config || {
      roomMode: state.roomMode,
      projectLanguage: state.projectLanguage,
      enableVideo: true,
      enableTerminal: true,
      multiFile: true,
      sharedInputOutput: state.roomMode === 'project'
    }) });
    setHostModalVisible(true);
  };

  const applyHostConfig = async () => {
    Modal.confirm({
      title: 'Apply configuration changes?',
      content: 'This will update room settings and may affect all participants. Are you sure?',
      onOk: async () => {
        setConfigSaving(true);
        const ok = await actions.updateConfig(configDraft);
        setConfigSaving(false);
        setHostModalVisible(false);
        if (!ok) notification.error({ message: 'Failed to update room configuration.' });
        else notification.success({ message: 'Room configuration updated.' });
      }
    });
  };

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black flex items-center justify-center">
        <Spin size="large" className="text-cyan-400" tip="Loading Session..." />
      </div>
    );
  }

  const cfg = state.config || {};
  const enableVideo = (typeof cfg.enableVideo === 'boolean') ? cfg.enableVideo : true;
  const enableTerminal = (typeof cfg.enableTerminal === 'boolean') ? cfg.enableTerminal : true;
  const enableChat = (typeof cfg.enableChat === 'boolean') ? cfg.enableChat : true;
  const sharedInputOutput = (state.config && typeof state.config.sharedInputOutput === 'boolean')
    ? state.config.sharedInputOutput
    : (state.roomMode === 'project');

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 font-sans">
      <CollapsibleSidebar
        state={state}
        actions={actions}
        id={id}
        userName={userName}
        enableVideo={enableVideo}
        enableChat={enableChat}
        peers={peers}
        localUserName={userName}
        ownerName={state.config?.ownerName}
        localStream={videoHook.localStream}
        toggleMic={videoHook.toggleMic}
        toggleCamera={videoHook.toggleCamera}
        isMicOn={videoHook.isMicOn}
        isCameraOn={videoHook.isCameraOn}
        videoHook={videoHook}
        playbackEnabled={playbackEnabled}
        enablePlayback={enablePlayback}
        input={state.input}
        output={state.output}
        lang={state.lang}
        handleLang={actions.handleLang}
        handleRun={actions.handleRun}
        handleInput={actions.handleInput}
        runCodeDisabled={state.runCodeDisabled}
        roomMode={state.roomMode}
        projectLanguage={state.projectLanguage}
        sharedInputOutput={sharedInputOutput}
        onPromoteToHost={handlePromoteToHost}
        onKickParticipant={handleKickParticipant}
        isLocalHost={state.isHost}
        onSidebarResize={(w) => setSidebarWidth(w)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-3 bg-slate-900/60 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {state.isHost && (
              <Button 
                size="small" 
                onClick={openHostModal} 
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 border-0 text-white font-medium shadow-lg shadow-cyan-500/20"
                icon={<FaCog size={12} />}
              >
                Host Controls
              </Button>
            )}
            <div className="text-sm text-slate-300 font-medium bg-slate-800/50 px-3 py-1 rounded-md">
              Session: <span className="text-cyan-300 font-mono">{id}</span>
            </div>
          </div>
        </div>

        {/* File Tab Bar */}
        {Object.entries(state.files).length > 0 && (
          <div className="flex flex-row bg-slate-900/40 border-b border-slate-800 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
            {Object.entries(state.files).map(([fileId, file]) => (
              <div 
                key={fileId} 
                className={`flex items-center px-4 py-2 border-r border-slate-800 cursor-pointer transition-all flex-shrink-0 ${state.activeFileId === fileId ? 'bg-slate-800 text-white border-t-2 border-t-cyan-500' : 'bg-slate-900/30 text-slate-400 hover:bg-slate-800/50'}`}
                onClick={() => actions.handleTabChange(fileId)}
              >
                <span className="truncate max-w-xs text-sm">{file.name}</span>
                <button 
                  className="ml-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded p-1 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.handleFileClose(fileId);
                  }}
                  title="Close tab"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <CodeEditor
          monaco={state.monaco}
          editor={state.editor}
          binding={state.binding}
          activeFile={state.activeFileId ? state.files[state.activeFileId] : null}
          lang={state.lang}
          theme={state.theme}
          fontSize={state.fontSize}
          openFiles={state.files}
          activeFileId={state.activeFileId}
          onTabChange={actions.handleTabChange}
          onEditorMount={actions.editorDidMount}
          onEditorChange={actions.editorOnChange}
          onNewFile={actions.createNewFile}
          onNewFolder={actions.createFolder}
          onTerminalOpen={openTerminalInWorkspace}
          onDownloadFile={actions.handleSaveCode}
          onSaveToWorkspace={handleSaveToWorkspace}
          onUploadFiles={actions.uploadFiles}
          onUploadZip={actions.uploadZip}
          onThemeChange={actions.handleThemeChange}
          onFontFamilyChange={actions.handleFontFamilyChange}
          onIncreaseFontSize={actions.increaseFontSize}
          onDecreaseFontSize={actions.decreaseFontSize}
          files={state.files}
          fileTree={state.tree}
          sidebarWidth={sidebarWidth}
          isHost={state.isHost}
          editingMode={state.config?.editing || 'open'}
          openHostModal={openHostModal}
        />

        {enableTerminal && (
          <div className="border-t border-slate-800">
            <TerminalPanel
              sessionId={id}
              visible={state.terminalVisible}
              onToggle={(expanded) => actions.toggleTerminal(expanded)}
              onClose={() => actions.toggleTerminal(false)}
            />
          </div>
        )}
      </div>

      <HostApprovalModal
        visible={showApprovalModal}
        operation={currentPendingOp}
        onApprove={(op) => { actions.approveOperation(op); setShowApprovalModal(false); setCurrentPendingOp(null); }}
        onReject={(op) => { actions.rejectOperation(op); setShowApprovalModal(false); setCurrentPendingOp(null); }}
        onCancel={() => setShowApprovalModal(false)}
      />

      <Modal
        title="Host Controls — Update Room Configuration"
        open={hostModalVisible}
        onCancel={() => setHostModalVisible(false)}
        onOk={applyHostConfig}
        okText="Apply"
        confirmLoading={configSaving}
        className="host-controls-modal"
        styles={{
          body: { 
            padding: '16px 20px', 
            background: 'rgb(15 23 42 / 0.8)', 
            color: '#e2e8f0',
            borderRadius: '0 0 12px 12px'
          },
          header: {
            background: 'rgb(15 23 42)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            color: '#e2e8f0',
            borderRadius: '12px 12px 0 0',
            padding: '16px 20px'
          },
          content: {
            backgroundColor: 'rgb(15 23 42 / 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.2)'
          }
        }}
        okButtonProps={{
          className: 'bg-gradient-to-r from-cyan-500 to-violet-600 border-0 text-white hover:from-cyan-600 hover:to-violet-700'
        }}
        cancelButtonProps={{
          className: 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
        }}
      >
        {configDraft && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
              <div className="text-slate-300">Room Mode</div>
              <Select 
                value={configDraft.roomMode || state.roomMode} 
                onChange={(v) => setConfigDraft(d => ({ ...d, roomMode: v }))} 
                style={{ width: 160 }}
                className="config-select"
                popupClassName="bg-slate-800 border-slate-700"
              >
                <Option value="project">Project</Option>
                <Option value="polyglot">Polyglot</Option>
              </Select>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
              <div className="text-slate-300">Project Language</div>
              <Select 
                value={configDraft.projectLanguage || state.projectLanguage} 
                onChange={(v) => setConfigDraft(d => ({ ...d, projectLanguage: v }))} 
                style={{ width: 160 }}
                className="config-select"
                popupClassName="bg-slate-800 border-slate-700"
              >
                <Option value="cpp">C++</Option>
                <Option value="java">Java</Option>
                <Option value="python">Python</Option>
              </Select>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
              <div className="text-slate-300">Enable Video</div>
              <Switch 
                checked={!!configDraft.enableVideo} 
                onChange={(val) => setConfigDraft(d => ({ ...d, enableVideo: val }))}
                className="bg-slate-700"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
              <div className="text-slate-300">Enable Chat</div>
              <Switch 
                checked={!!configDraft.enableChat} 
                onChange={(val) => setConfigDraft(d => ({ ...d, enableChat: val }))}
                className="bg-slate-700"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
              <div className="text-slate-300">Multi-file Project</div>
              <Switch 
                checked={!!configDraft.multiFile} 
                onChange={(val) => setConfigDraft(d => ({ ...d, multiFile: val }))}
                className="bg-slate-700"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
              <div className="text-slate-300">Shared Input/Output</div>
              <Switch 
                checked={!!configDraft.sharedInputOutput} 
                onChange={(val) => setConfigDraft(d => ({ ...d, sharedInputOutput: val }))}
                className="bg-slate-700"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
              <div className="text-slate-300">Allow Run</div>
              <Switch 
                checked={configDraft.allowRun !== false} 
                onChange={(val) => setConfigDraft(d => ({ ...d, allowRun: val }))}
                className="bg-slate-700"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
              <div className="text-slate-300">Editing Mode</div>
              <Select 
                value={configDraft.editing || 'open'} 
                onChange={(v) => setConfigDraft(d => ({ ...d, editing: v }))} 
                style={{ width: 160 }}
                className="config-select"
                popupClassName="bg-slate-800 border-slate-700"
              >
                <Option value="open">Open (everyone)</Option>
                <Option value="host-only">Host only</Option>
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const EditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const userName = sessionStorage.getItem('codecrew-username');

  useEffect(() => {
    if (!userName) {
      notification.warning({ message: 'Please enter a name to join the session.' });
      navigate(`/lobby/${id}`);
    }
  }, [userName, id, navigate]);

  if (!userName) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black flex items-center justify-center">
        <Spin size="large" className="text-cyan-400" tip="Joining Session..." />
      </div>
    );
  }

  return <EditorPageContent id={id} userName={userName} />;
};

export default EditorPage;