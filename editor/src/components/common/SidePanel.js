// src/components/common/SidePanel.js
import React, { useRef, useEffect, useState } from 'react';
import { Input, Button, Select, Tooltip, Space } from 'antd';
import {
  PlayCircleOutlined,
  CodeOutlined,
  FileTextOutlined,
  LockOutlined,
  CopyOutlined,
  DeleteOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { FaTerminal, FaCog } from 'react-icons/fa';

const { TextArea } = Input;
const { Option } = Select;

const languageLabelMap = {
  cpp: 'C++',
  java: 'Java',
  python: 'Python 3'
};
const supportedRuntimes = new Set(['cpp', 'java', 'python']);

const SidePanel = ({
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
}) => {
  const wrapperRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPolyglot = roomMode === 'polyglot';
  const displayLangKey = isPolyglot ? (lang || 'cpp') : (projectLanguage || lang || 'cpp');
  const displayLangLabel = languageLabelMap[displayLangKey] || displayLangKey.toUpperCase();
  const isRunSupported = supportedRuntimes.has(isPolyglot ? (lang || 'cpp') : displayLangKey);
  const isSharedRun = (typeof sharedInputOutput === 'boolean') ? sharedInputOutput : (roomMode === 'project');

  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        setIsCompact(w < 200);
      }
    });
    ro.observe(el);
    setIsCompact(el.clientWidth < 340);
    return () => ro.disconnect();
  }, []);

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setCopied(false);
    }
  };

  const clearInput = () => {
    handleInput({ target: { value: '' } });
  };

  return (
    <aside
      ref={wrapperRef}
      className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 border-l border-slate-800 shadow-inner"
    >
      {/* Header */}
      <div className="p-4 bg-slate-900/60 border-b border-slate-800">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            
              <FaTerminal className="text-cyan-400 text-lg" />
            
            <div>
              <div className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Compiler</div>
              
            </div>
          </div>

          <Tooltip title="Run code (Ctrl + Enter)" color="#0f172a">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRun}
              loading={runCodeDisabled}
              disabled={runCodeDisabled || !isRunSupported}
              size="middle"
              className="bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 border-0 text-white font-semibold rounded-s-sm"
            >
              {isCompact ? null : (runCodeDisabled ? 'Running...' : 'Run')}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Language card */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CodeOutlined className="text-cyan-400" />
              <div className="text-sm font-medium text-slate-300">Language</div>
            </div>
            {!isPolyglot && <LockOutlined className="text-slate-500" />}
          </div>

          <div>
            {isPolyglot ? (
              <Select
                value={lang}
                onChange={handleLang}
                size={isCompact ? 'small' : 'middle'}
                className="w-full"
                popupClassName="bg-slate-800 border-slate-700"
                suffixIcon={<CodeOutlined className="text-slate-400" />}
                optionLabelProp="children"
              >
                <Option value="cpp" className="text-slate-200 hover:text-cyan-400">C++</Option>
                <Option value="java" className="text-slate-200 hover:text-cyan-400">Java</Option>
                <Option value="python" className="text-slate-200 hover:text-cyan-400">Python 3</Option>
              </Select>
            ) : (
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800/60 rounded-lg border border-slate-700">
                <div className="text-sm text-slate-200 font-medium">{displayLangLabel}</div>
                <div className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded-md">Locked</div>
              </div>
            )}
          </div>
        </div>

        {/* Input panel */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileTextOutlined className="text-cyan-400" />
              <div className="text-sm font-medium text-slate-300">Input</div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip title="Clear input" color="#0f172a">
                <button 
                  onClick={clearInput} 
                  className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <DeleteOutlined />
                </button>
              </Tooltip>
              <div className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded-md">
                {(input || '').length} chars
              </div>
            </div>
          </div>

          <TextArea
            value={input}
            onChange={handleInput}
            placeholder="Provide input for your program (stdin)."
            autoSize={{ minRows: 4, maxRows: 8 }}
            className="bg-slate-800/60 border-slate-700 text-slate-200 placeholder-slate-500 font-mono text-sm focus:border-cyan-500 focus:ring-0 resize-y"
            bordered={false}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Output panel */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FaTerminal className="text-cyan-400" />
              <div className="text-sm font-medium text-slate-300">Output</div>
            </div>

            <Space size={8}>
              <Tooltip title={copied ? 'Copied!' : 'Copy output'} color="#0f172a">
                <Button 
                  size="small" 
                  icon={copied ? <CheckCircleOutlined className="text-green-400" /> : <CopyOutlined />} 
                  onClick={copyOutput} 
                  className="bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-cyan-400 hover:border-slate-600 transition-all"
                />
              </Tooltip>
            </Space>
          </div>

          <TextArea
            value={output}
            readOnly
            autoSize={{ minRows: 5, maxRows: 10 }}
            className="bg-slate-900/60 border-slate-700 text-slate-200 font-mono text-sm focus:border-cyan-500 focus:ring-0 resize-y"
            bordered={false}
            style={{ resize: 'vertical' }}
            placeholder="Program output will appear here..."
          />

          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <div>{output ? `${(output || '').length} chars` : 'No output yet'}</div>
            <div className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded-md">UTF-8</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
        <div className="text-xs text-slate-400">
          Tip: Press <span className="px-1.5 mx-1 bg-slate-700 text-slate-200 rounded-md font-mono">Ctrl</span>+
          <span className="px-1.5 mx-1 bg-slate-700 text-slate-200 rounded-md font-mono">Enter</span> to run
        </div>
        <div className="text-xs text-slate-500">v1.0</div>
      </div>
    </aside>
  );
};

export default SidePanel;