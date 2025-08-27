// ChatInput.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'antd';
import { PaperClipOutlined, SendOutlined } from '@ant-design/icons';

export default function ChatInput({ draft, setDraft, handleKeyDown, sendMessage, onClickAttach, fileInputRef, onFileSelected, inputRef }) {
  return (
    <div className="w-full flex items-center gap-3 min-w-0">
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={onFileSelected} />
      <Tooltip title="Attach file">
        <button onClick={onClickAttach} className="p-1 rounded-md text-slate-300 hover:bg-white/5" aria-label="Attach" style={{ border: 'none', background: 'transparent' }}>
          <PaperClipOutlined style={{ fontSize: 16 }} />
        </button>
      </Tooltip>

      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-3 flex-1 min-w-0">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message"
          rows={1}
          className="flex-1 resize-none rounded-md bg-transparent text-slate-100 px-3 py-2 outline-none placeholder:text-slate-500 min-w-0"
          style={{ border: '1px solid rgba(148,163,184,0.06)', lineHeight: '1.25' }}
        />

        <button type="submit" className="flex items-center justify-center w-9 h-9 rounded-md" style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.06)', color: '#9fb7c9' }} aria-label="Send">
          <SendOutlined />
        </button>
      </form>
    </div>
  );
}

ChatInput.propTypes = {
  draft: PropTypes.string.isRequired,
  setDraft: PropTypes.func.isRequired,
  handleKeyDown: PropTypes.func.isRequired,
  sendMessage: PropTypes.func.isRequired,
  onClickAttach: PropTypes.func.isRequired,
  fileInputRef: PropTypes.object.isRequired,
  onFileSelected: PropTypes.func.isRequired,
  inputRef: PropTypes.object // forwarded ref to textarea
};
