// src/components/common/ParticipantsList.js
import React, { useMemo, useState, useEffect } from 'react';
import { Avatar, Badge, Dropdown, Menu, Input, Button, Tooltip } from 'antd';
import { FaCrown, FaUser, FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaEllipsisV } from 'react-icons/fa';
import { SearchOutlined } from '@ant-design/icons';

const ParticipantsList = ({
  peers = new Map(),
  localUserName = '',
  ownerName = '',
  onPromoteToHost,
  onKickParticipant,
  isLocalHost
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  // simple debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const list = useMemo(() => {
    const items = [];
    items.push({
      id: 'local',
      userName: localUserName || 'You',
      isLocal: true,
      isHost: localUserName && ownerName === localUserName,
      isSpeaking: false,
      hasAudio: true,
      hasVideo: true
    });

    for (const [id, p] of peers) {
      if (!id) continue;
      items.push({
        id,
        userName: p.userName || 'Anonymous',
        isLocal: false,
        isHost: ownerName && p.userName === ownerName,
        isSpeaking: false,
        hasAudio: !!(p.stream && p.stream.getAudioTracks && p.stream.getAudioTracks().some(t => t.enabled)),
        hasVideo: !!(p.stream && p.stream.getVideoTracks && p.stream.getVideoTracks().some(t => t.enabled))
      });
    }

    items.sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (b.isHost && !a.isHost) return 1;
      if (a.isLocal && !b.isLocal) return -1;
      if (b.isLocal && !a.isLocal) return 1;
      return a.userName.localeCompare(b.userName);
    });

    const seen = new Set();
    const filtered = items.filter(it => {
      const key = `${it.id}:${it.userName}`;
      if (seen.has(key)) return false;
      seen.add(key);

      if (!debounced) return true;
      return (it.userName || '').toLowerCase().includes(debounced);
    });

    return filtered;
  }, [peers, localUserName, ownerName, debounced]);

  const getMenuItems = (participant) => {
    if (!isLocalHost || participant.isLocal || participant.isHost) return null;

    return (
      <Menu className="bg-slate-800 border-slate-700">
        <Menu.Item 
          key="promote" 
          onClick={() => onPromoteToHost && onPromoteToHost(participant.userName, participant.id)}
          className="text-slate-200 hover:text-cyan-400 hover:bg-slate-700/50"
        >
          Make Host
        </Menu.Item>
        <Menu.Item 
          key="kick" 
          danger 
          onClick={() => onKickParticipant && onKickParticipant(participant.userName, participant.id)}
          className="text-rose-400 hover:text-rose-300 hover:bg-slate-700/50"
        >
          Kick Participant
        </Menu.Item>
      </Menu>
    );
  };

  return (
    <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-950 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800 gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider">
          <FaUser className="text-cyan-400" />
          <span>Participants</span>
        </h3>
        <div className="flex gap-1 items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Search names..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs py-1.5 pl-8 pr-2 w-32 bg-slate-800/60 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-200 placeholder-slate-500"
            />
            <SearchOutlined className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-500 text-xs" />
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        {list.map(p => (
          <div 
            key={p.id} 
            className={`flex items-center p-3 rounded-xl transition-all ${
              p.isSpeaking 
                ? 'bg-cyan-900/30 ring-1 ring-cyan-500 shadow-lg' 
                : 'bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50'
            }`}
          >
            <div className="relative">
              <Avatar
                size="default"
                icon={<FaUser />}
                className={`${
                  p.isHost 
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20' 
                    : 'bg-gradient-to-r from-cyan-500 to-violet-600'
                } ${p.isSpeaking ? 'ring-2 ring-cyan-400' : ''}`}
              />
              <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5">
                {p.hasAudio ? (
                  <FaMicrophone className="text-green-400 text-xs" />
                ) : (
                  <FaMicrophoneSlash className="text-rose-400 text-xs" />
                )}
              </div>
            </div>
            
            <div className="ml-3 min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-200 truncate flex items-center gap-2">
                {p.userName}
                {p.isHost && (
                  <Tooltip title="Session Host" color="#0f172a">
                    <FaCrown className="text-amber-400 text-xs" />
                  </Tooltip>
                )}
                {p.isLocal && (
                  <span className="text-xs text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded-md">You</span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {p.isHost ? 'Host' : p.isLocal ? 'Local participant' : 'Remote participant'}
              </div>
            </div>
            
            <div className="ml-2 bg-slate-900/50 p-1 rounded-lg">
              {p.hasVideo ? (
                <FaVideo className="text-green-400 text-xs" />
              ) : (
                <FaVideoSlash className="text-rose-400 text-xs" />
              )}
            </div>
            
            {isLocalHost && !p.isLocal && !p.isHost && (
              <Dropdown 
                overlay={getMenuItems(p)} 
                trigger={['click']}
                placement="bottomRight"
              >
                <button className="ml-2 text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors">
                  <FaEllipsisV className="text-sm" />
                </button>
              </Dropdown>
            )}
          </div>
        ))}
        
        {list.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <FaUser className="text-3xl mx-auto mb-3 opacity-50" />
            <p className="text-sm">No participants found</p>
            {debounced && (
              <p className="text-xs mt-1">Try a different search term</p>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="text-xs text-slate-500 text-center">
          {list.length} participant{list.length !== 1 ? 's' : ''} in session
        </div>
      </div>
    </div>
  );
};

export default ParticipantsList;