// src/components/editor/CodeEditor.js
import React, { Suspense, useState, useRef, useEffect } from 'react';
import { Button, Space, Tooltip, Dropdown, message, Input } from 'antd';
import {
  FileAddOutlined,
  FolderAddOutlined,
  MoreOutlined,
  FontSizeOutlined,
  FontColorsOutlined,
  BgColorsOutlined,
  UploadOutlined,
  FileZipOutlined,
  PlusOutlined,
  MinusOutlined,
  FolderOutlined,
  SearchOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import { FaTerminal,FaSearch } from 'react-icons/fa';
import JSZip from 'jszip';
// near other imports
import createCursorManager from '../editor/CursorManager'; // or wherever you save it

const MonacoEditorLazy = React.lazy(() => import('react-monaco-editor'));
const { Search } = Input;

const CodeEditor = ({
  monaco,
  signalWs,         // <--- WebSocket/Signaling socket instance (video/signaling)
  myPeerId,         // <--- your peer id (string)
  myDisplayName ,
  editor,
  binding,
  activeFile,
  lang,
  theme,
  fontSize,
  onEditorMount,
  onEditorChange,
  onNewFile,
  onNewFolder,
  onTerminalOpen,
  onDownloadFile,
  onSaveToWorkspace,
  onUploadFiles,
  onUploadZip,
  onThemeChange,
  onDecreaseFontSize,
  onIncreaseFontSize,
  onFontFamilyChange,
  files = {},
  fileTree = {},
  sidebarWidth = 300,
  isHost = false,
  editingMode = 'open',
  openHostModal = null,
  sessionId = null
}) => {
  const [wordWrap, setWordWrap] = useState(false);
  const fileContent = activeFile ? activeFile.content : '';
  const fileInputRef = useRef(null);
  const zipInputRef = useRef(null);

  const editorInstanceRef = useRef(null);
  const monacoRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [collapsedToolbar, setCollapsedToolbar] = useState(false);


  const cursorManagerRef = useRef(null);
const sendCursorTimerRef = useRef(null);
const selectionListenerRef = useRef(null);


  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth || document.documentElement.clientWidth;
      setCollapsedToolbar((sidebarWidth / w) > 0.6);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [sidebarWidth]);

  useEffect(() => {
  return () => {
    // cleanup selection timer & listener
    if (sendCursorTimerRef.current) clearTimeout(sendCursorTimerRef.current);
    if (selectionListenerRef.current) {
      try { selectionListenerRef.current.dispose?.(); } catch (e) {}
      selectionListenerRef.current = null;
    }
    // dispose cursor manager
    if (cursorManagerRef.current) {
      try { cursorManagerRef.current.dispose(); } catch (e) {}
      cursorManagerRef.current = null;
    }
  };
}, []); // run only on unmount


  const editingHostOnly = editingMode === 'host-only';
  const readOnly = editingHostOnly && !isHost;

  const editorOptions = {
    fontSize,
    theme,
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: wordWrap ? 'on' : 'off',
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    glyphMargin: true,
    folding: true,
    lineDecorationsWidth: 10,
    lineNumbersMinChars: 3,
    scrollbar: { vertical: 'auto', horizontal: 'auto', useShadows: true },
    readOnly
  };

  const handleEditorMount = (editorInstance, monacoNamespace) => {
  editorInstanceRef.current = editorInstance;
  monacoRef.current = monacoNamespace;

  // existing callback
  if (typeof onEditorMount === 'function') onEditorMount(editorInstance, monacoNamespace);

  // create cursor manager (only if signaling socket provided)
  if (signalWs && myPeerId) {
    // create manager once
    if (!cursorManagerRef.current) {
      cursorManagerRef.current = createCursorManager(editorInstance, editorInstance.getModel(), signalWs, myPeerId);
    }

    // attach a selection-change sender (debounced/throttled)
    // store listener so we can remove later
    if (!selectionListenerRef.current) {
      selectionListenerRef.current = editorInstance.onDidChangeCursorSelection((e) => {
        if (sendCursorTimerRef.current) clearTimeout(sendCursorTimerRef.current);
        sendCursorTimerRef.current = setTimeout(() => {
          const sel = editorInstance.getSelection();
          const payload = {
            type: 'cursor',
            userId: myPeerId,
            name: myDisplayName || 'Anon',
            selection: {
              startLine: sel.startLineNumber,
              startColumn: sel.startColumn,
              endLine: sel.endLineNumber,
              endColumn: sel.endColumn
            },
            caret: { lineNumber: sel.endLineNumber, column: sel.endColumn }
          };
          try { signalWs.send(JSON.stringify(payload)); } catch (e) { /* ignore if closed */ }
        }, 40); // tune if needed
      });
    }
  }
};


  const openMonacoFind = (q = '') => {
    const ed = editorInstanceRef.current;
    if (!ed) return;

    try {
      ed.getAction('actions.find').run();
    } catch (e) {
      try { ed.trigger('keyboard', 'actions.find', {}); } catch (err) {}
    }

    setTimeout(() => {
      const root = ed.getDomNode ? ed.getDomNode() : document;
      const input = root ? root.querySelector('.find-widget .monaco-inputbox input') : null;
      if (input) {
        input.focus();
        input.value = q || '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        const globalInput = document.querySelector('.monaco-editor .find-widget .monaco-inputbox input');
        if (globalInput) {
          globalInput.focus();
          globalInput.value = q || '';
          globalInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      if (q && q.length > 0) {
        try { ed.getAction('editor.action.nextMatchFindAction').run(); } catch (e) {}
      }
    }, 60);
  };

  const handleFileUpload = (event) => {
    if (editingHostOnly && !isHost) return message.warn('Only the host can upload files.');
    const filesArr = Array.from(event.target.files || []);
    if (filesArr.length === 0) return;
    const validExtensions = ['.cpp', '.c', '.h', '.hpp', '.java', '.py', '.js', '.ts', '.html', '.css', '.txt'];
    const validFiles = filesArr.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return validExtensions.includes(ext);
    });
    if (validFiles.length === 0) {
      message.error('No valid files selected. Supported formats: ' + validExtensions.join(', '));
      return;
    }
    if (onUploadFiles) onUploadFiles(validFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleZipUpload = (event) => {
    if (editingHostOnly && !isHost) return message.warn('Only the host can upload ZIP files.');
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      message.error('Please select a valid ZIP file');
      return;
    }
    if (onUploadZip) onUploadZip(file);
    if (zipInputRef.current) zipInputRef.current.value = '';
  };

  const handleDownloadProject = async () => {
    try {
      const zip = new JSZip();
      const addToZip = (node, path = '') => {
        if (!node) return;
        if (node.type === 'file') {
          zip.file(path + node.name, files[node.id]?.content || '');
        } else if (node.type === 'folder') {
          const folderPath = path + node.name + '/';
          (node.children || []).forEach(childId => {
            const childNode = fileTree[childId];
            if (childNode) addToZip(childNode, folderPath);
          });
        }
      };
      const root = fileTree?.root;
      if (root && root.children) root.children.forEach(cid => addToZip(fileTree[cid], ''));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
      message.success('Project downloaded successfully!');
    } catch (err) {
      console.error(err);
      message.error('Failed to download project');
    }
  };

  const collapsedMenuItems = [
    {
      key: 'search',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => openMonacoFind(searchQuery)}>Search…</button>
    },
    {
      key: 'theme-dark',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => onThemeChange && onThemeChange('vs-dark')}>Theme: Dark</button>
    },
    {
      key: 'theme-light',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => onThemeChange && onThemeChange('vs')}>Theme: Light</button>
    },
    {
      key: 'font-monaco',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => onFontFamilyChange && onFontFamilyChange('Monaco, Menlo, "Ubuntu Mono", monospace')}>Font: Monaco</button>
    },
    {
      key: 'font-fira',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => onFontFamilyChange && onFontFamilyChange('"Fira Code", "Cascadia Code", "JetBrains Mono", monospace')}>Font: Fira Code</button>
    },
    {
      key: 'dec-font',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => onDecreaseFontSize && onDecreaseFontSize()}>Decrease font</button>
    },
    {
      key: 'inc-font',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => onIncreaseFontSize && onIncreaseFontSize()}>Increase font</button>
    },
    {
      key: 'word-wrap',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => setWordWrap(w => !w)}>{wordWrap ? 'Disable Word Wrap' : 'Enable Word Wrap'}</button>
    },
    {
      key: 'save-workspace',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => { if (typeof onSaveToWorkspace === 'function') onSaveToWorkspace(); }}>Save to Workspace</button>
    },
    {
      key: 'download-project',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => handleDownloadProject()}>Download Project (ZIP)</button>
    },
    {
      key: 'open-terminal',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => onTerminalOpen && onTerminalOpen()}>Open Terminal</button>
    }
  ];

  if (isHost) {
    collapsedMenuItems.push({
      key: 'host-controls',
      label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => { if (typeof openHostModal === 'function') openHostModal(); }}>Host Controls</button>
    });
  }

  collapsedMenuItems.push({
    key: 'more',
    label: <button className="w-full text-left px-2 py-1 text-slate-200 hover:text-cyan-400 transition-colors" onClick={() => message.info('More options')}>More…</button>
  });

  const shareSession = async () => {
    try {
      let sess = sessionId;
      if (!sess) {
        try {
          const parts = window.location.pathname.split('/').filter(Boolean);
          if (parts.length >= 2) {
            sess = parts[parts.length - 1];
          }
        } catch (e) {
          sess = null;
        }
      }
      const inviteUrl = sess ? `${window.location.origin}/lobby/${sess}` : window.location.origin;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        message.success('Invite link copied to clipboard');
        return;
      }

      const ta = document.createElement('textarea');
      ta.value = inviteUrl;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        message.success('Invite link copied to clipboard');
      } catch (err) {
        message.error('Unable to copy invite link automatically — please copy manually: ' + inviteUrl);
      } finally {
        document.body.removeChild(ta);
      }
    } catch (err) {
      console.error('shareSession failed', err);
      message.error('Failed to copy invite link');
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-900/60 border-b border-slate-800">
        <Space>
          <Tooltip title={readOnly ? 'Read-only (host-only editing enabled)' : 'New File'} color="#0f172a">
            <Button 
              type="text" 
              icon={<FileAddOutlined />} 
              onClick={() => onNewFile && onNewFile(`untitled-${Date.now()}.txt`)} 
              disabled={readOnly} 
              className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
            />
          </Tooltip>
          
          <Tooltip title={readOnly ? 'Read-only (host-only editing enabled)' : 'New Folder'} color="#0f172a">
            <Button 
              type="text" 
              icon={<FolderAddOutlined />} 
              onClick={() => onNewFolder && onNewFolder(`new-folder-${Date.now()}`)} 
              disabled={readOnly} 
              className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
            />
          </Tooltip>

          <Tooltip title={readOnly ? 'Read-only (host-only editing enabled)' : 'Upload Files'} color="#0f172a">
            <Button 
              type="text" 
              icon={<UploadOutlined />} 
              onClick={() => fileInputRef.current?.click()} 
              disabled={readOnly} 
              className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg"
            >
              <input type="file" ref={fileInputRef} multiple accept=".cpp,.c,.h,.hpp,.java,.py,.js,.ts,.html,.css,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
            </Button>
          </Tooltip>

          <Tooltip title={readOnly ? 'Read-only (host-only editing enabled)' : 'Upload ZIP Project'} color="#0f172a">
            <Button 
              type="text" 
              icon={<FileZipOutlined />} 
              onClick={() => zipInputRef.current?.click()} 
              disabled={readOnly} 
              className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg"
            >
              <input type="file" ref={zipInputRef} accept=".zip" onChange={handleZipUpload} style={{ display: 'none' }} />
            </Button>
          </Tooltip>

          <Tooltip title="Share / Invite" color="#0f172a">
            <Button 
              type="text" 
              icon={<ShareAltOutlined />} 
              onClick={shareSession} 
              className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
            />
          </Tooltip>

          <Tooltip title="Download Project as ZIP" color="#0f172a">
            <Button 
              type="text" 
              icon={<FolderOutlined />} 
              onClick={handleDownloadProject} 
              className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
            />
          </Tooltip>

          <Tooltip title="Open Terminal" color="#0f172a">
            <Button 
              type="text" 
              icon={<FaTerminal />} 
              onClick={() => onTerminalOpen && onTerminalOpen()} 
              className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg"
            />
          </Tooltip>
        </Space>

        <div className="flex items-center gap-2">
          {!collapsedToolbar && (
            <Tooltip title="Open Monaco Search" color="#0f172a">
              <Button
                type="primary"
                style={{
    background: 'transparent',
    border: 'none',
    padding: '8px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  }}
                icon={<FaSearch style={{ color: '#94a3b8' }} />}
                onClick={() => openMonacoFind(searchQuery)}
                className="search-button"

              />
            </Tooltip>
          )}

          {!collapsedToolbar ? (
            <Space>
              <Dropdown
                menu={{
                  items: [
                    { key: 'dark', label: 'Dark', onClick: () => onThemeChange && onThemeChange('vs-dark') },
                    { key: 'light', label: 'Light', onClick: () => onThemeChange && onThemeChange('vs') }
                  ],
                  className: 'bg-slate-800 border-slate-700'
                }}
                trigger={['click']}
              >
                <Button 
                  type="text" 
                  icon={<BgColorsOutlined />} 
                  className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
                />
              </Dropdown>

              <Dropdown
                menu={{
                  items: [
                    { key: 'monaco', label: 'Monaco', onClick: () => onFontFamilyChange && onFontFamilyChange('Monaco, Menlo, "Ubuntu Mono", monospace') },
                    { key: 'fira', label: 'Fira Code', onClick: () => onFontFamilyChange && onFontFamilyChange('"Fira Code", "Cascadia Code", "JetBrains Mono", monospace') },
                  ],
                  className: 'bg-slate-800 border-slate-700'
                }}
                trigger={['click']}
              >
                <Button 
                  type="text" 
                  icon={<FontColorsOutlined />} 
                  className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
                />
              </Dropdown>

              <Tooltip title="Decrease Font Size" color="#0f172a">
                <Button 
                  type="text" 
                  icon={<MinusOutlined />} 
                  className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
                  onClick={() => onDecreaseFontSize && onDecreaseFontSize()} 
                />
              </Tooltip>
              
              <Tooltip title="Font Size" color="#0f172a">
                <Button 
                  type="text" 
                  icon={<FontSizeOutlined />} 
                  className="text-slate-400 hover:bg-slate-800/50 transition-all rounded-lg"
                >
                  {fontSize}px
                </Button>
              </Tooltip>
              
              <Tooltip title="Increase Font Size" color="#0f172a">
                <Button 
                  type="text" 
                  icon={<PlusOutlined />} 
                  className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
                  onClick={() => onIncreaseFontSize && onIncreaseFontSize()} 
                />
              </Tooltip>

              <Tooltip title="More Options" color="#0f172a">
                <Dropdown
                  placement="bottomRight"
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'wordwrap', label: wordWrap ? 'Disable Word Wrap' : 'Enable Word Wrap', onClick: () => setWordWrap(w => !w) },
                      { key: 'save', label: 'Save to Workspace', onClick: () => { if (typeof onSaveToWorkspace === 'function') onSaveToWorkspace(); } },
                      { key: 'download', label: 'Download Project (ZIP)', onClick: () => handleDownloadProject() },
                      { key: 'terminal', label: 'Open Terminal', onClick: () => onTerminalOpen && onTerminalOpen() },
                      ...(isHost ? [{ key: 'host', label: 'Host Controls', onClick: () => { if (typeof openHostModal === 'function') openHostModal(); } }] : []),
                    ],
                    className: 'bg-slate-800 border-slate-700'
                  }}
                >
                  <Button 
                    type="text" 
                    icon={<MoreOutlined />} 
                    className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
                  />
                </Dropdown>
              </Tooltip>
            </Space>
          ) : (
            <Dropdown
              menu={{ 
                items: collapsedMenuItems,
                className: 'bg-slate-800 border-slate-700'
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button 
                type="text" 
                icon={<MoreOutlined />} 
                className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg" 
              />
            </Dropdown>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="h-full flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950"><div className="text-slate-400">Loading editor…</div></div>}>
          <MonacoEditorLazy
            language={lang}
            theme={theme}
            value={fileContent || ''}
            options={editorOptions}
            editorDidMount={handleEditorMount}
            onChange={onEditorChange}
            className="h-full"
          />
        </Suspense>
      </div>

      {readOnly && (
        <div className="px-4 py-2 bg-amber-900/30 border-t border-amber-800 text-sm text-amber-200 flex items-center justify-between">
          <div>You are in read-only mode — the host has restricted editing to hosts only.</div>
          <div className="text-xs">Ask the host to promote you to host to edit.</div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center space-x-4">
          <span className="bg-slate-800/50 px-2 py-1 rounded-md">{lang ? lang.toUpperCase() : 'TEXT'}</span>
          <span>{wordWrap ? 'Word Wrap: On' : 'Word Wrap: Off'}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Ln {editor?.getPosition()?.lineNumber || 1}, Col {editor?.getPosition()?.column || 1}</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;