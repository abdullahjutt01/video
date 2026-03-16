'use client';
// ─────────────────────────────────────────────────────────────
// Toolbar.tsx — Top editor toolbar: export, project name, AI features
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

interface Props {
  onExport: () => void;
  onVoiceover: () => void;
  onCaptions: () => void;
}

export default function Toolbar({ onExport, onVoiceover, onCaptions }: Props) {
  const { settings, updateSettings, isDirty, isSaving } = useEditorStore();
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(settings.name);

  const commitName = () => {
    updateSettings({ name: nameVal.trim() || 'Untitled Project' });
    setEditingName(false);
  };

  return (
    <header className="h-12 flex items-center px-4 gap-3 border-b border-[var(--editor-border)] bg-[var(--editor-surface)] shrink-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2 shrink-0">
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 'bold', color: 'white',
        }}>N</div>
        <span className="text-sm font-semibold text-slate-200 hidden sm:block">NoLimit</span>
      </div>

      <div className="w-px h-5 bg-[var(--editor-border)]" />

      {/* Project Name */}
      {editingName ? (
        <input
          autoFocus
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
          className="bg-[var(--editor-bg)] border border-[var(--editor-accent)] rounded px-2 py-1 text-sm text-slate-200 outline-none w-48"
        />
      ) : (
        <button
          onClick={() => { setNameVal(settings.name); setEditingName(true); }}
          className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-1"
        >
          {settings.name}
          {isDirty && <span className="text-yellow-400 ml-1">●</span>}
          <span className="text-slate-600 text-xs ml-1">✎</span>
        </button>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-1">
          <div className="spinner" />
          Saving…
        </div>
      )}

      <div className="flex-1" />

      {/* Resolution & Social Presets */}
      <div className="flex items-center gap-1.5 hidden md:flex">
        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Frame</span>
        <select
          value={`${settings.resolution.width}x${settings.resolution.height}`}
          onChange={(e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            let aspectRatio = '16:9';
            if (w === 1080 && h === 1920) aspectRatio = '9:16';
            else if (w === 1080 && h === 1080) aspectRatio = '1:1';
            else if (w === 1080 && h === 1350) aspectRatio = '4:5';
            
            updateSettings({ 
              resolution: { width: w, height: h },
              aspectRatio
            });
          }}
          className="bg-[var(--editor-bg)] border border-[var(--editor-border)] text-[11px] text-slate-300 rounded px-2 py-1 outline-none hover:border-indigo-500/50 transition-colors cursor-pointer"
        >
          <optgroup label="Video Platforms">
            <option value="1920x1080">📺 YouTube / Desktop (16:9)</option>
            <option value="3840x2160">🎥 YouTube 4K (16:9)</option>
            <option value="1280x720">📽️ YouTube 720p (16:9)</option>
          </optgroup>
          <optgroup label="Social Media">
            <option value="1080x1920">📱 TikTok / Reels / Shorts (9:16)</option>
            <option value="1080x1080">📸 Instagram Post (1:1)</option>
            <option value="1080x1350">🤳 Instagram Portrait (4:5)</option>
          </optgroup>
        </select>
      </div>

      {/* FPS selector */}
      <select
        value={settings.fps}
        onChange={(e) => updateSettings({ fps: Number(e.target.value) })}
        className="bg-[var(--editor-bg)] border border-[var(--editor-border)] text-xs text-slate-400 rounded px-2 py-1 outline-none hidden md:block"
      >
        <option value={24}>24 fps</option>
        <option value={30}>30 fps</option>
        <option value={60}>60 fps</option>
      </select>

      <div className="w-px h-5 bg-[var(--editor-border)] hidden md:block" />

      {/* AI Features */}
      <button
        onClick={onVoiceover}
        data-tooltip="Generate AI Voiceover"
        className="btn btn-ghost text-xs px-3 h-8 hidden sm:flex"
      >
        🎙️ Voiceover
      </button>

      <button
        onClick={onCaptions}
        data-tooltip="Auto-generate captions"
        className="btn btn-ghost text-xs px-3 h-8 hidden sm:flex"
      >
        📝 Captions
      </button>

      <div className="w-px h-5 bg-[var(--editor-border)] hidden sm:block" />

      {/* Export */}
      <button
        onClick={onExport}
        className="btn btn-primary text-sm px-4 h-8 shadow-md shadow-indigo-500/20"
      >
        ⚡ Export
      </button>
    </header>
  );
}
