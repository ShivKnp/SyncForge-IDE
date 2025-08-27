// src/components/common/FileTree.js (enhanced version)
import React, { useState } from 'react';
import { Button, Tooltip } from 'antd';
import { 
  FolderOutlined, 
  FolderOpenOutlined, 
  FileOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  PlusOutlined,
  CaretRightOutlined,
  CaretDownOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { FaFolder } from "react-icons/fa";

const TreeNode = ({ 
  nodeId, 
  node, 
  tree, 
  onSelectNode, 
  selectedNodeId, 
  onFileClick, 
  onRenameNode, 
  onDeleteNode, 
  activeFileId, 
  depth = 0,
  searchTerm,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOver,
  onContextMenu
}) => {
  if (!node) return null;
  
  // Skip rendering if node doesn't match search term (unless it's a parent of a matching node)
  const shouldRender = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase());
  if (!shouldRender && (!node.children || node.children.length === 0)) return null;
  
  const isSelected = nodeId === selectedNodeId;
  const isActive = nodeId === activeFileId;
  const isFolder = node.type === 'folder';
  const [isExpanded, setIsExpanded] = React.useState(depth < 2);

  const handleSelect = (e) => { 
    e.stopPropagation(); 
    onSelectNode(nodeId); 
    if (isFolder) {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick(nodeId);
    }
  };
  
  const handleDoubleClick = () => { 
    if (!isFolder) onFileClick(nodeId); 
    if (isFolder) setIsExpanded(!isExpanded);
  };

  // Get file extension for styling
  const getFileIconColor = () => {
    if (!node.name || !node.name.includes('.')) return '#67e8f9';
    
    const extension = node.name.split('.').pop().toLowerCase();
    const colorMap = {
      js: '#fde047',
      ts: '#3b82f6',
      jsx: '#22d3ee',
      tsx: '#3b82f6',
      html: '#f97316',
      css: '#6366f1',
      py: '#3b82f6',
      java: '#f59e0b',
      cpp: '#2563eb',
      c: '#94a3b8',
      json: '#eab308',
      md: '#000000',
      txt: '#94a3b8'
    };
    
    return colorMap[extension] || '#67e8f9';
  };

  // File type badges
  // FileTree.js - replace the getFileBadge function with this safe version
const getFileBadge = (fileName) => {
  // defensive: ensure fileName is a string
  if (!fileName || typeof fileName !== 'string') return null;
  if (!fileName.includes('.')) return null;

  const extension = fileName.split('.').pop().toLowerCase();
  const badgeMap = {
    cpp: { text: 'C++', color: 'bg-blue-900/40 text-blue-300' },
    java: { text: 'Java', color: 'bg-amber-900/40 text-amber-300' },
    c: { text: 'C', color: 'bg-slate-700 text-slate-300' },
    txt: { text: 'Text', color: 'bg-slate-700 text-slate-300' },
    ts: { text: 'TS', color: 'bg-blue-900/40 text-blue-300' },
    jsx: { text: 'JSX', color: 'bg-cyan-900/40 text-cyan-300' },
    tsx: { text: 'TSX', color: 'bg-blue-900/40 text-blue-300' },
    html: { text: 'HTML', color: 'bg-orange-900/40 text-orange-300' },
    css: { text: 'CSS', color: 'bg-indigo-900/40 text-indigo-300' },
    py: { text: 'PY', color: 'bg-blue-900/40 text-blue-300' },
    json: { text: 'JSON', color: 'bg-slate-700 text-slate-300' },
    md: { text: 'MD', color: 'bg-slate-700 text-slate-300' },
  };

  const badge = badgeMap[extension];
  if (!badge) return null;

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${badge.color}`}>
      {badge.text}
    </span>
  );
};


  // File status indicators
  const getStatusIndicator = (node) => {
    const status = node.status || 'none';
    
    const statusMap = {
      modified: 'bg-yellow-400',
      added: 'bg-green-400',
      deleted: 'bg-red-400',
      conflicted: 'bg-purple-400',
      none: ''
    };
    
    if (!statusMap[status] || status === 'none') return null;
    
    return (
      <span className={`w-2 h-2 rounded-full ${statusMap[status]} ml-2`} />
    );
  };

  return (
    <div className="transition-all duration-150 ease-in-out">
      <div 
        onClick={handleSelect} 
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, nodeId)}
        draggable={nodeId !== 'root'}
        onDragStart={(e) => onDragStart(e, nodeId)}
        onDragOver={(e) => onDragOver(e, nodeId)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, nodeId)}
        className={`flex items-center gap-2 py-1 px-1 cursor-pointer transition-all duration-200 group rounded-md
          ${isSelected ? 'bg-cyan-900/30 text-cyan-200' : 
            'text-slate-300 hover:bg-slate-800/50'}
          ${isActive ? 'ring-1 ring-cyan-500' : ''}
          ${dragOver === nodeId ? 'bg-cyan-900/20 ring-1 ring-cyan-400' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {isFolder ? (
          <span className="flex items-center text-amber-400">
            {isExpanded ? <CaretDownOutlined className="text-xs" /> : <CaretRightOutlined className="text-xs" />}
            <span className="ml-1">
              {isExpanded ? <FolderOpenOutlined /> : <FolderOutlined />}
            </span>
          </span>
        ) : (
          <FileOutlined style={{ color: getFileIconColor() }} />
        )}
        
        <span className="flex-1 truncate text-sm font-medium flex items-center gap-2">
          {node.name}
          {!isFolder && getFileBadge(node.name)}
          {getStatusIndicator(node)}
        </span>
        
        {isSelected && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip title="Rename" color="#0f172a">
              <Button 
                type="text" 
                size="small" 
                icon={<EditOutlined className="text-xs" />} 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const newName = prompt('New name:', node.name); 
                  if (newName) onRenameNode(nodeId, newName); 
                }}
                className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-cyan-400"
              />
            </Tooltip>
            <Tooltip title="Delete" color="#0f172a">
              <Button 
                type="text" 
                size="small" 
                icon={<DeleteOutlined className="text-xs" />} 
                onClick={(e) => { e.stopPropagation(); onDeleteNode(nodeId); }}
                className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-rose-400"
              />
            </Tooltip>
          </div>
        )}
      </div>
      
      {isFolder && isExpanded && node.children && (
        <div className="ml-2 border-l border-slate-700 transition-all duration-300 ease-in-out">
          {node.children.map(childId => (
            <TreeNode 
              key={childId} 
              nodeId={childId} 
              node={tree[childId]} 
              tree={tree} 
              onSelectNode={onSelectNode} 
              selectedNodeId={selectedNodeId} 
              onFileClick={onFileClick} 
              onRenameNode={onRenameNode} 
              onDeleteNode={onDeleteNode} 
              activeFileId={activeFileId}
              depth={depth + 1}
              searchTerm={searchTerm}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              dragOver={dragOver}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Context Menu Component
const ContextMenu = ({ contextMenu, setContextMenu, tree, onCreateFile, onCreateFolder, onRenameNode, onDeleteNode }) => {
  if (!contextMenu.visible) return null;
  
  const node = tree[contextMenu.nodeId];
  const isFolder = node?.type === 'folder';
  
  return (
    <div 
      className="fixed bg-slate-800 shadow-lg rounded-md py-1 z-50 border border-slate-700 backdrop-blur-sm"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onMouseDown={() => setContextMenu({ ...contextMenu, visible: false })}
    >
      <button 
        className="w-full text-left px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-700/80 flex items-center gap-2 transition-colors"
        onClick={() => {
          if (isFolder) {
            onCreateFolder(contextMenu.nodeId, 'new-folder');
          } else {
            onCreateFile(contextMenu.nodeId, 'new-file.txt');
          }
          setContextMenu({ ...contextMenu, visible: false });
        }}
      >
        <PlusOutlined /> New {isFolder ? 'Folder' : 'File'}
      </button>
      <button 
        className="w-full text-left px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-700/80 flex items-center gap-2 transition-colors"
        onClick={() => {
          const newName = prompt('Rename:', node.name);
          if (newName) onRenameNode(contextMenu.nodeId, newName);
          setContextMenu({ ...contextMenu, visible: false });
        }}
      >
        <EditOutlined /> Rename
      </button>
      <button 
        className="w-full text-left px-4 py-1.5 text-sm text-rose-400 hover:bg-slate-700/80 flex items-center gap-2 transition-colors"
        onClick={() => {
          onDeleteNode(contextMenu.nodeId);
          setContextMenu({ ...contextMenu, visible: false });
        }}
      >
        <DeleteOutlined /> Delete
      </button>
    </div>
  );
};

const FileTree = ({ tree, selectedNodeId, onSelectNode, onCreateFile, onCreateFolder, onRenameNode, onDeleteNode, onFileClick, activeFileId }) => {
  const rootNode = tree?.root;
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, nodeId: null });
  const [dragOver, setDragOver] = useState(null);
  
  // Context menu handler
  const handleContextMenu = (e, nodeId) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodeId: nodeId
    });
  };
  
  // Drag and drop handlers
  const handleDragStart = (e, nodeId) => {
    e.dataTransfer.setData('text/plain', nodeId);
  };

  const handleDragOver = (e, nodeId) => {
    e.preventDefault();
    setDragOver(nodeId);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e, targetNodeId) => {
    e.preventDefault();
    const sourceNodeId = e.dataTransfer.getData('text/plain');
    
    // Implement your move logic here
    console.log(`Move ${sourceNodeId} to ${targetNodeId}`);
    
    setDragOver(null);
  };
  
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 p-3">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800 gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
          <FaFolder className="text-cyan-400" />
          <span>Explorer</span>
        </h3>
        <div className="flex gap-1 items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs py-1 pl-7 pr-2 w-32 bg-slate-800/60 border border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-200 placeholder-slate-500"
            />
            <SearchOutlined className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-500 text-xs" />
          </div>
          <div className="flex gap-1">
            <Tooltip title="New File" color="#0f172a">
              <Button 
                type="text" 
                size="small" 
                icon={<PlusOutlined />} 
                onClick={() => onCreateFile(selectedNodeId, 'new-file.txt')}
                className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg"
              />
            </Tooltip>
            <Tooltip title="New Folder" color="#0f172a">
              <Button 
                type="text" 
                size="small" 
                icon={<FolderOutlined />} 
                onClick={() => onCreateFolder(selectedNodeId, 'new-folder')}
                className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-slate-800/50 transition-all rounded-lg"
              />
            </Tooltip>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-1 sidebar-scrollbar">
        {rootNode && (
          <TreeNode 
            nodeId={'root'} 
            node={rootNode} 
            tree={tree} 
            onSelectNode={onSelectNode} 
            selectedNodeId={selectedNodeId} 
            onFileClick={onFileClick} 
            onRenameNode={onRenameNode} 
            onDeleteNode={onDeleteNode} 
            activeFileId={activeFileId}
            searchTerm={searchTerm}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            dragOver={dragOver}
            onContextMenu={handleContextMenu}
          />
        )}
        
        {(!rootNode || Object.keys(tree).length <= 1) && (
          <div className="text-center py-8 px-4 text-slate-500">
            <FolderOpenOutlined className="text-3xl mb-3 opacity-40" />
            <p className="text-sm font-medium mb-1">No files yet</p>
            <p className="text-xs mb-4 opacity-75">Get started by creating a new file or folder</p>
            <div className="flex justify-center gap-2">
              <button 
                onClick={() => onCreateFile('root', 'new-file.txt')}
                className="text-xs bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-all"
              >
                <PlusOutlined className="text-xs" /> New File
              </button>
              <button 
                onClick={() => onCreateFolder('root', 'new-folder')}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-all"
              >
                <FolderOutlined className="text-xs" /> New Folder
              </button>
            </div>
          </div>
        )}
      </div>
      
      <ContextMenu 
        contextMenu={contextMenu} 
        setContextMenu={setContextMenu} 
        tree={tree}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onRenameNode={onRenameNode}
        onDeleteNode={onDeleteNode}
      />
    </div>
  );
};

export default FileTree;
