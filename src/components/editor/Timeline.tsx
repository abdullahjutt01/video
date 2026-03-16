'use client';
// ─────────────────────────────────────────────────────────────
// Timeline.tsx — Main timeline orchestrator
// Manages ruler, tracks, playhead, zoom, keyboard shortcuts
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback, useEffect, useState } from 'react';
import { useEditorStore, useEditorHistory } from '@/store/useEditorStore';
import TimelineTrack from './TimelineTrack';
import PlayheadCursor from './PlayheadCursor';
import type { TrackType } from '@/types/editor';

const RULER_HEIGHT = 36;
const LABEL_WIDTH  = 180;

const TRACK_TYPE_COLORS: Record<TrackType, string> = {
  video:     '#3b82f6',
  audio:     '#22c55e',
  text:      '#eab308',
  voiceover: '#a855f7',
};

const TRACK_TYPE_ICONS: Record<TrackType, string> = {
  video:     '🎬',
  audio:     '🎵',
  text:      '✏️',
  voiceover: '🎙️',
};

export default function Timeline() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    tracks, duration, zoom,
    currentTime, isPlaying,
    setCurrentTime, setIsPlaying, setZoom,
    addTrack, toggleTrackMute, toggleTrackSolo, toggleTrackLock, removeTrack,
    splitClip, selectedClipId,
  } = useEditorStore();

  const { undo, redo, canUndo, canRedo } = useEditorHistory();
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // ── Playback loop ──────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      const tick = (now: number) => {
        if (lastTickRef.current === 0) lastTickRef.current = now;
        const dt = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;
        
        // Use functional update to avoid stale closure of currentTime
        const latestTime = useEditorStore.getState().currentTime;
        const next = Math.min(duration || 999, latestTime + dt);
        
        setCurrentTime(next);

        if (next < (duration || 999)) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setIsPlaying(false);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      lastTickRef.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, duration, setCurrentTime, setIsPlaying]);

  const pxPerSec = zoom;
  const totalWidth = Math.max((duration + 5) * pxPerSec, scrollRef.current?.clientWidth ?? 800);

  // ── Timeline click → seek ──────────────────────────────────
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
    const t = Math.max(0, x / pxPerSec);
    setCurrentTime(t);
  }, [pxPerSec, setCurrentTime]);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === ' ') { e.preventDefault(); setIsPlaying(!isPlaying); }
      if (e.key === 'Home') { setCurrentTime(0); }
      if (e.key === 'End')  { setCurrentTime(duration); }
      if (e.key === 'ArrowLeft')  { const t = Math.max(0, currentTime - (e.shiftKey ? 5 : 1/30)); setCurrentTime(t); }
      if (e.key === 'ArrowRight') { const t = Math.min(duration, currentTime + (e.shiftKey ? 5 : 1/30)); setCurrentTime(t); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
        useEditorStore.getState().removeClip(selectedClipId);
      }
      if (e.key === 's' && !e.ctrlKey && selectedClipId) {
        splitClip(selectedClipId, currentTime);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedClipId) {
        e.preventDefault();
        useEditorStore.getState().duplicateClip(selectedClipId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, currentTime, duration, selectedClipId, undo, redo, setCurrentTime, setIsPlaying, splitClip]);

  // ── Scroll playhead into view when playing ────────────────
  useEffect(() => {
    if (isPlaying && scrollRef.current) {
      const headX = currentTime * pxPerSec;
      const { scrollLeft, clientWidth } = scrollRef.current;
      if (headX > scrollLeft + clientWidth - 80) {
        scrollRef.current.scrollLeft = headX - 80;
      }
    }
  }, [currentTime, isPlaying, pxPerSec]);

  // ── Zoom with scroll wheel ────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      setZoom(zoom * factor);
    }
  }, [zoom, setZoom]);

  // ── Auto-scroll horizontally ──────────────────────────────
  const handleAddTrack = useCallback((type: TrackType) => {
    addTrack(type);
  }, [addTrack]);

  const totalTracksHeight = tracks.reduce((h, t) => h + t.height, 0);

  return (
    <div className="flex flex-col h-full bg-[var(--editor-panel)] select-none">
      {/* ── Top Controls Bar ───────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--editor-border)] shrink-0">
        {/* Undo / Redo */}
        <button onClick={undo} disabled={!canUndo} data-tooltip="Undo (Ctrl+Z)"
          className="btn btn-ghost text-xs p-1.5 w-8 h-8 justify-center" aria-label="Undo">
          ↩
        </button>
        <button onClick={redo} disabled={!canRedo} data-tooltip="Redo (Ctrl+Y)"
          className="btn btn-ghost text-xs p-1.5 w-8 h-8 justify-center" aria-label="Redo">
          ↪
        </button>

        <div className="w-px h-5 bg-[var(--editor-border)] mx-1" />

        {/* Playback Controls */}
        <button onClick={() => { setCurrentTime(0); }}
          data-tooltip="Go to Start (Home)" className="btn btn-ghost text-xs p-1.5 w-8 h-8 justify-center">
          ⏮
        </button>
        <button onClick={() => setIsPlaying(!isPlaying)}
          data-tooltip={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          className={`btn ${isPlaying ? 'btn-danger' : 'btn-primary'} text-base w-10 h-8 justify-center`}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={() => { setCurrentTime(duration); }}
          data-tooltip="Go to End (End)" className="btn btn-ghost text-xs p-1.5 w-8 h-8 justify-center">
          ⏭
        </button>

        {/* Time display */}
        <code className="text-xs font-mono text-slate-400 ml-1 bg-black/30 px-2 py-1 rounded">
          {formatTimecode(currentTime)}
        </code>

        <div className="w-px h-5 bg-[var(--editor-border)] mx-1" />

        {/* Split clip */}
        <button
          onClick={() => selectedClipId && splitClip(selectedClipId, currentTime)}
          data-tooltip="Split Clip at Playhead (S)"
          disabled={!selectedClipId}
          className="btn btn-ghost text-xs px-2 h-8"
        >
          ✂️ Split
        </button>

        {/* Add Track buttons */}
        <div className="flex gap-1 ml-auto">
          {(['video', 'audio', 'text', 'voiceover'] as TrackType[]).map((t) => (
            <button
              key={t}
              onClick={() => handleAddTrack(t)}
              data-tooltip={`Add ${t} track`}
              className="btn btn-ghost text-xs px-2 h-8"
              style={{ borderLeftColor: TRACK_TYPE_COLORS[t], borderLeftWidth: 2 }}
            >
              {TRACK_TYPE_ICONS[t]} +
            </button>
          ))}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <span className="text-xs text-slate-500">🔍</span>
          <input
            type="range" min={20} max={300} step={5}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 accent-indigo-500"
          />
          <span className="text-xs text-slate-400 w-12">{zoom.toFixed(0)}px/s</span>
        </div>
      </div>

      {/* ── Track Headers + Scrollable Timeline ──────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Track labels panel */}
        <div style={{ width: LABEL_WIDTH }} className="shrink-0 border-r border-[var(--editor-border)] overflow-y-hidden">
          {/* Ruler spacer */}
          <div style={{ height: RULER_HEIGHT }} className="border-b border-[var(--editor-border)] bg-[var(--editor-bg)]" />

          {tracks.map((track) => (
            <div
              key={track.id}
              style={{ height: track.height, borderLeftColor: TRACK_TYPE_COLORS[track.type] }}
              className="flex items-center px-2 border-b border-[var(--editor-border)] border-l-2 group transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-medium truncate text-slate-300">
                  {TRACK_TYPE_ICONS[track.type]} {track.name}
                </span>
                <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleTrackMute(track.id)}
                    title={track.isMuted ? 'Unmute' : 'Mute'}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${track.isMuted ? 'bg-yellow-500/80 text-black' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                  >M</button>
                  <button
                    onClick={() => toggleTrackSolo(track.id)}
                    title={track.isSolo ? 'Unsolo' : 'Solo'}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${track.isSolo ? 'bg-green-500/80 text-black' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                  >S</button>
                  <button
                    onClick={() => toggleTrackLock(track.id)}
                    title={track.isLocked ? 'Unlock' : 'Lock'}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${track.isLocked ? 'bg-red-500/80 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                  >🔒</button>
                  <button
                    onClick={() => removeTrack(track.id)}
                    title="Remove track"
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400 hover:bg-red-500/60 hover:text-white"
                  >✕</button>
                </div>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {tracks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-xs text-center px-4">
              <p>Click + to add tracks</p>
            </div>
          )}
        </div>

        {/* Right: Scrollable ruler + tracks */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative"
          onClick={handleTimelineClick}
          onWheel={handleWheel}
          style={{ cursor: 'crosshair' }}
        >
          {/* Time Ruler */}
          <TimeRuler
            totalWidth={totalWidth}
            pxPerSec={pxPerSec}
            duration={duration}
            currentTime={currentTime}
          />

          {/* Track rows */}
          <div style={{ width: totalWidth, position: 'relative' }}>
            {tracks.map((track) => (
              <TimelineTrack
                key={track.id}
                track={track}
                pxPerSec={pxPerSec}
                totalWidth={totalWidth}
              />
            ))}

            {/* Playhead */}
            {totalTracksHeight > 0 && (
              <PlayheadCursor
                currentTime={currentTime}
                pxPerSec={pxPerSec}
                totalHeight={totalTracksHeight + RULER_HEIGHT}
                onTimeChange={(t) => { setCurrentTime(t); setIsPlaying(false); }}
              />
            )}
          </div>

          {/* Empty timeline message */}
          {tracks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-700 pointer-events-none">
              <p className="text-3xl mb-2">🎬</p>
              <p className="text-sm">Add tracks and drop media to start editing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TimeRuler — Time scale with adaptive tick density
// ─────────────────────────────────────────────────────────────
function TimeRuler({ totalWidth, pxPerSec, duration, currentTime }: {
  totalWidth: number; pxPerSec: number; duration: number; currentTime: number;
}) {
  // Adaptive: at 80px/s show every second; at 20px/s show every 5s; at 10px/s every 10s
  const tickInterval = pxPerSec >= 100 ? 1 : pxPerSec >= 50 ? 2 : pxPerSec >= 20 ? 5 : 10;
  const ticks: number[] = [];
  for (let t = 0; t <= duration + tickInterval; t += tickInterval) ticks.push(t);

  return (
    <div
      style={{ width: totalWidth, height: RULER_HEIGHT, position: 'sticky', top: 0, zIndex: 40 }}
      className="bg-[var(--editor-bg)] border-b border-[var(--editor-border)] shrink-0"
    >
      {/* Current time indicator */}
      <div
        style={{ left: currentTime * pxPerSec, position: 'absolute', top: 0, bottom: 0, width: 2, background: '#f43f5e', opacity: 0.7, pointerEvents: 'none' }}
      />

      {ticks.map((t) => (
        <div key={t} style={{ left: t * pxPerSec, position: 'absolute', top: 0, bottom: 0 }}
          className="flex flex-col items-start"
        >
          {/* Major tick */}
          <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.2)', marginTop: 'auto' }} />
          <span style={{ fontSize: 9, color: '#6b7280', paddingLeft: 3, position: 'absolute', top: 4 }}>
            {formatTimecode(t)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatTimecode(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const f = Math.floor((secs % 1) * 30); // frames @30fps
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}:${pad(f)}`;
}
function pad(n: number) { return n.toString().padStart(2, '0'); }
