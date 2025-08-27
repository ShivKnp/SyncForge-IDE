// src/pages/HomePage.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Modal, Input, Space, message,notification } from "antd";
import { FiCode, FiUsers, FiVideo, FiShare2, FiGithub, FiDatabase, FiZap, FiCloud, FiLock, FiClipboard,FiInfo,FiCopy,FiAlertCircle } from "react-icons/fi";

/**
 * Tailwind-styled home page for the collaborative IDE.
 * Name chosen to reflect functionality: SyncForge — Collaborative IDE
 *
 * Props:
 *  - createId: () => string            // function that returns a new session id
 *  - showJoinModal: () => void         // opens join modal (optional)
 */

const PROJECT_NAME = "SyncForge"; // change this if you prefer another name
const SUBTITLE = "Collaborative IDE — real-time editing, built-in video & shared runtimes.";

const GITHUB_URL = "https://github.com/ShivKnp"; // replace with your repo

const features = [
  {
    icon: <FiCode size={20} />,
    title: "Realtime Editor",
    desc: "Operational-Transformation powered Monaco editor with shared cursors, conflict-free edits and lightning-fast sync."
  },
  {
    icon: <FiVideo size={20} />,
    title: "Integrated Video",
    desc: "Native WebRTC video & audio for low-latency pair programming without leaving the editor."
  },
  {
    icon: <FiUsers size={20} />,
    title: "Presence & Roles",
    desc: "Host controls, promote/demote collaborators, host-only editing mode and participant management."
  },
  {
    icon: <FiShare2 size={20} />,
    title: "Share & Persist",
    desc: "One-click share links, save snapshots to workspace, download projects as ZIPs."
  }
];

const techStack = [
  { name: "React", icon: <FiZap/> },
  { name: "Monaco Editor", icon: <FiCode/> },
  { name: "ShareDB (OT)", icon: <FiCloud/> },
  { name: "WebRTC", icon: <FiVideo/> },
  { name: "Node.js + Express", icon: <FiDatabase/> },
  { name: "Docker", icon: <FiLock/> },
];

const HomePage = ({ createId, showJoinModal: externalShowJoin }) => {
  const navigate = useNavigate();
  const joinId = createId ? createId() : "demo-" + Math.random().toString(36).slice(2, 8);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inputError, setInputError] = useState("");

  // open either from parent prop or local button
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setInviteInput("");
    setInputError("");
  };

  // Try to robustly extract the session id from input:
  // Accepts:
  //  - full URLs like https://your.app/lobby/abc123
  //  - relative paths /lobby/abc123
  //  - bare ids like abc123
  const parseInviteUrl = (text) => {
    if (!text) return null;
    const trimmed = text.trim();

    // If it already looks like a bare id (no slashes, short), return it.
    // Accept [A-Za-z0-9-_]{4,}
    const bareIdMatch = trimmed.match(/^([A-Za-z0-9\-_]{4,})$/);
    if (bareIdMatch) return bareIdMatch[1];

    // Try to extract from common patterns containing /lobby/:id
    const lobbyRegex = /\/lobby\/([A-Za-z0-9\-_]+)/i;
    const m = trimmed.match(lobbyRegex);
    if (m && m[1]) return m[1];

    // Try query param like ?room=abc123 or ?id=abc123
    const paramRegex = /[?&](?:room|id)=([A-Za-z0-9\-_]+)/i;
    const p = trimmed.match(paramRegex);
    if (p && p[1]) return p[1];

    return null;
  };

  const handleJoin = () => {
    setInputError("");
    const id = parseInviteUrl(inviteInput);
    if (!id) {
      setInputError("Please paste a valid invite URL or session id.");
      return;
    }
    // close modal then navigate
    setIsModalOpen(false);
    setInviteInput("");
    message.success("Joining session...");
    navigate(`/lobby/${id}`);
  };

  const handlePasteClipboard = async () => {
    try {
      if (!navigator.clipboard) {
        setInputError("Clipboard API not available in this browser.");
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text) {
        setInputError("Clipboard is empty.");
        return;
      }
      setInviteInput(text);
      setInputError("");
      // Optionally auto-join if it's obviously valid:
      const id = parseInviteUrl(text);
      if (id) {
        message.info("Invite detected in clipboard. Click Join to proceed.");
      }
    } catch (err) {
      setInputError("Unable to read clipboard.");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleJoin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 antialiased">
      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-black/30 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-600 to-cyan-400 text-white font-extrabold rounded-lg px-3 py-2 shadow-lg">
              SF
            </div>
            <div>
              <div className="font-semibold text-lg">{PROJECT_NAME}</div>
              <div className="text-xs text-slate-400 -mt-0.5">Collaborative IDE</div>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
              <Button
                size="middle"
                shape="round"
                className="flex items-center gap-2 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200"
              >
                <FiGithub />
                <span className="hidden sm:inline">GitHub</span>
              </Button>
            </a>

            <Link to={`/lobby/${joinId}`}>
              <Button
                size="middle"
                shape="round"
                className="ml-2 bg-gradient-to-r from-cyan-400 to-violet-600 text-slate-900 font-semibold border-0 shadow-md hover:scale-[1.01] transform transition"
              >
                Start a session
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <main className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* Left */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-white/5 text-xs text-slate-300 w-max">
            <span className="px-2 py-0.5 rounded bg-gradient-to-r from-cyan-400 to-violet-600 text-black font-semibold">New</span>
            <span>Realtime multi-user IDE • Host controls • Run & test</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Code together. <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">Ship faster.</span>
          </h1>

          <p className="text-lg text-slate-300 max-w-2xl">
            {PROJECT_NAME} — {SUBTITLE} Built for interviews, teaching, and remote pairing: a synchronized Monaco editor, integrated audio/video and collaborative tooling.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
            <Link to={`/lobby/${joinId}`}>
              <Button size="large" shape="round" className="bg-gradient-to-r from-cyan-400 to-violet-600 text-slate-900 font-bold px-6 py-3 border-0 shadow-lg">
                New session
              </Button>
            </Link>

            <Button
              size="large"
              shape="round"
              onClick={openModal}
              className="bg-transparent border border-slate-700 text-slate-200 px-6 py-3"
            >
              Join session
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/2 p-4 rounded-lg border border-slate-800">
              <div className="text-sm text-slate-300">Sync</div>
              <div className="text-lg font-semibold">Operational Transformation</div>
            </div>
            <div className="bg-white/2 p-4 rounded-lg border border-slate-800">
              <div className="text-sm text-slate-300">Run</div>
              <div className="text-lg font-semibold">C++, Java, Python</div>
            </div>
            <div className="bg-white/2 p-4 rounded-lg border border-slate-800">
              <div className="text-sm text-slate-300">Voice</div>
              <div className="text-lg font-semibold">WebRTC Built-in</div>
            </div>
          </div>
        </div>

        {/* Right - code/demo mock */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl overflow-hidden border border-slate-800 shadow-2xl transform hover:scale-[1.01] transition">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 border-b border-slate-800">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              <div className="ml-auto text-xs text-slate-400">Live preview</div>
            </div>
            <pre className="p-6 text-sm text-slate-200 bg-gradient-to-b from-slate-900 to-slate-950 font-mono">
{`// SyncForge demo
#include <iostream>
int main() {
  std::cout << "Hello, Realtime IDE!" << std::endl;
  return 0;
}`}
            </pre>
            <div className="flex gap-2 px-4 py-3 bg-slate-800 border-t border-slate-800">
              <Button className="flex-1 bg-slate-700 border-0 text-slate-100">Open editor</Button>
              <Button className="bg-transparent border border-slate-700 text-slate-200">Download</Button>
            </div>
          </div>
        </div>
      </main>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, idx) => (
            <div key={idx} className="p-6 bg-slate-800/40 border border-slate-800 rounded-xl hover:shadow-xl transition">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-600 text-slate-900 mb-4">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-slate-300">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COLLABORATIVE IDE & TECH STACK */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-800/40 p-6 rounded-xl border border-slate-800">
          <h2 className="text-2xl font-bold mb-3">What makes {PROJECT_NAME} a collaborative IDE?</h2>
          <ul className="list-disc pl-5 text-slate-300 space-y-2">
            <li><strong>Shared Monaco editor</strong> with cursor-level presence and OT-based consistency (ShareDB/json0).</li>
            <li><strong>Host role & access controls</strong> — host-only editing, promote participants to host, kick participants.</li>
            <li><strong>Built-in run & test harness</strong> — run user code in sandboxed workers/containers and share input/output.</li>
            <li><strong>Integrated WebRTC</strong> for video, screen-share & low-latency voice for seamless collaboration.</li>
            <li><strong>Workspace snapshots</strong> and ZIP export so you can save and review sessions later.</li>
          </ul>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 p-4 rounded border border-slate-800">
              <h4 className="font-semibold">Editing Modes</h4>
              <p className="text-slate-300 text-sm">Open editing or host-only mode where only hosts can modify files (others view & suggest).</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded border border-slate-800">
              <h4 className="font-semibold">Session Controls</h4>
              <p className="text-slate-300 text-sm">Owner persists configuration, manage participants, and configure runtime options.</p>
            </div>
          </div>
        </div>

        <aside className="bg-slate-800/30 p-6 rounded-xl border border-slate-800">
          <h3 className="text-xl font-semibold mb-3">Tech Stack</h3>
          <div className="flex flex-col gap-3">
            {techStack.map((t, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-slate-900/40 transition">
                <div className="text-cyan-400">{t.icon}</div>
                <div className="text-slate-200">{t.name}</div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h4 className="font-semibold mb-2">Use Cases</h4>
            <ul className="text-slate-300 text-sm list-disc pl-5 space-y-1">
              <li>Live interviews & coding tests</li>
              <li>Remote pair-programming sessions</li>
              <li>Teaching & walkthroughs</li>
            </ul>
          </div>
        </aside>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xl font-bold">{PROJECT_NAME}</div>
            <div className="text-sm text-slate-400">Realtime Collaborative IDE — Built with love.</div>
          </div>

          <div className="flex items-center gap-6 text-slate-400 text-sm">
            <div>Made with ❤️ by Shivansh & Team</div>
            <div>{new Date().getFullYear()} · Open-source</div>
          </div>
        </div>
      </footer>

      {/* --- Join Modal (dark themed) --- */}
      <Modal
  open={isModalOpen}
  onCancel={closeModal}
  footer={null}
  centered
  className="join-modal"
  closeIcon={<div className="text-slate-300 hover:text-cyan-400 transition-colors p-1">✕</div>}
  styles={{
    body: { 
      padding: 0, 
      background: "transparent",
      borderRadius: "1rem"
    },
    content: {
      backgroundColor: "rgb(15 23 42 / 0.6)",
      backdropFilter: "blur(10px)",
      borderRadius: "1rem",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      border: "1px solid rgba(148, 163, 184, 0.2)"
    }
  }}
>
  <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 max-w-xl mx-auto shadow-xl">
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <div className="inline-flex items-center gap-2 text-xs text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-full mb-2">
          <FiUsers className="text-xs" />
          <span>Collaborative Session</span>
        </div>
        <h3 className="text-xl font-bold text-white">Join a Session</h3>
        <p className="text-slate-400 text-sm mt-1">Enter a session ID or paste an invite URL to join an existing room</p>
      </div>
      <div className="text-slate-500 text-xs bg-slate-800/50 px-2 py-1 rounded-md">{PROJECT_NAME}</div>
    </div>

    <div className="mt-4">
      <div className="relative">
        <Input
          //placeholder="Paste invite session id (e.g. abc123)"
          value={inviteInput}
          onChange={(e) => { setInviteInput(e.target.value); setInputError(""); }}
          onKeyDown={handleKeyPress}
          size="large"
          bordered={false}
          className="bg-slate-800/60 rounded-lg text-white px-4 py-3 h-12 border border-slate-700 hover:border-slate-600 focus:border-cyan-500 transition-colors"
        />
        {inputError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-rose-400 bg-rose-400/10 px-3 py-2 rounded-lg">
            <FiAlertCircle className="text-base" />
            <span>{inputError}</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePasteClipboard}
            icon={<FiClipboard className="text-slate-300" />}
            className="bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-slate-600 h-10 rounded-lg flex items-center gap-2"
          >
            Paste from clipboard
          </Button>

          <Button
            type="primary"
            onClick={handleJoin}
            className="bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-semibold h-10 rounded-lg border-0 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:brightness-110 transition-all"
          >
            Join Session
          </Button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1">
          <FiInfo className="text-slate-400" />
          <span>Or enter a code and press Enter</span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800">
        <div className="text-xs text-slate-500 mb-2">Session ID example:</div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-mono text-cyan-300 bg-cyan-400/10 px-3 py-2 rounded-lg">hdemo-3qf88i</div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText("hdemo-3qf88i");
              notification.success({ message: "Example code copied!" });
            }}
            className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
            title="Copy example"
          >
            <FiCopy className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  </div>
</Modal>
    </div>
  );
};

export default HomePage;
