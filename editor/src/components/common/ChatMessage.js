// src/components/common/ChatMessage.js
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DownloadOutlined, DownOutlined } from '@ant-design/icons';
import { Modal, Menu, Dropdown, Tooltip } from 'antd';

const { confirm } = Modal;

/**
 * ChatMessage
 * - keeps file/image/code handling
 * - shows a bubble "tail" using a CSS triangle div
 * - places per-message dropdown (arrow) at top-right of bubble
 * - uses dark-themed palette and subtle shadows consistent with app
 */
const ChatMessage = ({
  m,
  mine,
  bubbleColor,
  getDownloadUrl,
  onImageClick,
  sidebarWidth,
  onDeleteForEveryone,
  onDeleteForMe,
  accent = '#2e79f1ff',
  showSmallTime = false // if true, we show a small bubble-level timestamp
}) => {
  const [hover, setHover] = useState(false);

  const bubbleBase = {
    position: 'relative',
    padding: '6px 8px',
    borderRadius: 12,
    maxWidth: '100%',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    display: 'inline-block',
    boxShadow: '0 6px 14px rgba(2,6,23,0.12)'
  };

  const mineStyle = {
    ...bubbleBase,
    background: accent,
    color: '#fff'
  };

  const otherStyle = {
    ...bubbleBase,
    background: 'rgba(255,255,255,0.02)',
    color: '#e6eef8',
    border: `1px solid ${bubbleColor ? `${bubbleColor}22` : 'transparent'}`
  };

  const confirmDeleteForEveryone = (cb) => {
    confirm({
      title: 'Delete message for everyone?',
      content: 'This will remove the message for all participants. This cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() { cb && cb(); }
    });
  };

  const menu = (
    <Menu>
      {mine && <Menu.Item key="del-all" onClick={() => confirmDeleteForEveryone(onDeleteForEveryone)}>Delete for everyone</Menu.Item>}
      <Menu.Item key="del-me" onClick={() => onDeleteForMe && onDeleteForMe()}>{mine ? 'Delete for me' : 'Remove'}</Menu.Item>
    </Menu>
  );

  // small bubble tail element (CSS triangle)
  const Tail = ({ side = 'left' }) => {
    if (side === 'left') {
      return
    }
    return 
  };

  if (m.deleted) {
    return (
      <div style={{ ...otherStyle, fontStyle: 'italic', fontSize: 12, color: '#9fb7c9', padding: '6px 8px' }}>
        Message deleted
      </div>
    );
  }

  // handle file messages (images get a larger preview)
  if (m.type === 'file') {
    const fileUrl = getDownloadUrl(m.fileName);
    if (m.fileType && m.fileType.startsWith('image/')) {
      const maxImgWidth = Math.min((sidebarWidth || 240) * 0.95, 420);
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: mine ? 'flex-end' : 'flex-start',
            gap: 8,
            position: 'relative',
            width: '100%',
            minWidth: 0
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {/* bubble (image) */}
          <div style={{ position: 'relative', width: '80%', maxWidth: maxImgWidth }}>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { e.preventDefault(); onImageClick && onImageClick(fileUrl, m.fileName); }}
            >
              <img
                src={fileUrl}
                alt={m.fileName}
                loading="lazy"
                style={{ width: '80%', height: 'auto', maxHeight: 240, objectFit: 'cover', borderRadius: 10, display: 'block' ,paddingBottom:"12px"}}
                draggable={false}
              />
            </a>

            {/* per-message dropdown shown on hover */}
            {hover && (
              <div style={{ position: 'absolute', top: 2, right: 13 }}>
                <Dropdown overlay={menu} trigger={['click']}>
                  <a onClick={e => e.preventDefault()} style={{ fontSize: 8, color: '#9fb7c9' }}>
                    <DownOutlined />
                  </a>
                </Dropdown>
              </div>
            )}
          </div>

          {/* filename row */}
          

          <a href={fileUrl} download style={{ color: mine ? '#dcefff' : '#9fb7c9', fontSize: 12,  gap: 4, alignItems: 'center' }}>
            <DownloadOutlined />
          </a>
        </div>
      );
    }

    // non-image file row
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: '80%' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div style={mine ? mineStyle : otherStyle}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fileName}</div>
          <div style={{ fontSize: 12, color: mine ? 'rgba(255,255,255,0.9)' : 'rgba(230,238,248,0.9)' }}>{m.fileType || 'file'}</div>

          <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 10, color: mine ? 'rgba(255,255,255,0.85)' : 'rgba(159,183,201,0.9)' }}>
            {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <a href={getDownloadUrl(m.fileName)} download style={{ color: mine ? '#dcefff' : '#9fb7c9', fontSize: 12, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <DownloadOutlined /> 
        </a>
      </div>
    );
  }

  // code block detection
  const isCode = typeof m.text === 'string' && (m.text.includes('\n') || m.text.startsWith('npm') || m.text.startsWith('`'));
  if (isCode) {
    return (
      <pre
        style={{
          ...(mine ? mineStyle : otherStyle),
          fontFamily: 'monospace',
          fontSize: 13,
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          position: 'relative'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* tail */}
        <Tail side={mine ? 'right' : 'left'} />

        {/* menu */}
        {hover && (
          <div style={{ position: 'absolute', top: -8, right: mine ? 10 : undefined, left: mine ? undefined : 10 }}>
            <Dropdown overlay={menu} trigger={['click']}>
              <a onClick={e => e.preventDefault()} style={{ fontSize: 14, color: '#9fb7c9' }}>
                <DownOutlined />
              </a>
            </Dropdown>
          </div>
        )}

        {m.text}
        {showSmallTime && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', position: 'absolute', bottom: 6, right: 10 }}>
            {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </pre>
    );
  }

  // default text message bubble
  return (
    <div style={{ minWidth: 0 }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div style={mine ? mineStyle : otherStyle}>
          <Tail side={mine ? 'right' : 'left'} />

          {/* message text */}
          <div style={{ fontSize: 13, lineHeight: 1.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>

          {/* small per-bubble timestamp (optional) */}
          
        </div>

        {/* dropdown shown when hovering the bubble */}
        {hover && (
          <div style={{ position: 'absolute', top: -10, right: mine ? -8 : undefined, left: mine ? undefined : -8 }}>
            <Dropdown overlay={menu} trigger={['click']}>
              <a onClick={e => e.preventDefault()} style={{ fontSize: 14, color: '#9fb7c9' }} aria-label="message menu">
                <DownOutlined />
              </a>
            </Dropdown>
          </div>
        )}
      </div>
    </div>
  );
};

ChatMessage.propTypes = {
  m: PropTypes.object.isRequired,
  mine: PropTypes.bool,
  bubbleColor: PropTypes.string,
  getDownloadUrl: PropTypes.func.isRequired,
  onImageClick: PropTypes.func,
  sidebarWidth: PropTypes.number,
  onDeleteForEveryone: PropTypes.func,
  onDeleteForMe: PropTypes.func,
  accent: PropTypes.string,
  showSmallTime: PropTypes.bool
};

export default ChatMessage;
