'use client';
// ─────────────────────────────────────────────────────────────
// MediaLibrary.tsx — Left panel: upload + browse media assets
// ─────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useEditorStore } from '@/store/useEditorStore';
import type { TrackType } from '@/types/editor';

interface LibraryItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  src: string;
  duration: number;
  sizeMb: number;
  thumbnailUrl?: string;
}

// ── Generate fake waveform data for audio clips ──────────────
function genWaveform(len = 60): number[] {
  return Array.from({ length: len }, () => 10 + Math.random() * 80);
}

export default function MediaLibrary() {
  const { tracks, addTrack, addClip } = useEditorStore();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [tab, setTab] = useState<'media' | 'audio' | 'text'>('media');

  // ── File upload handler ───────────────────────────────────
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');
      if (!isVideo && !isAudio && !isImage) return;

      const src = URL.createObjectURL(file);
      const item: LibraryItem = {
        id: uuidv4(),
        name: file.name,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
        src,
        duration: 10, // Will be updated after media loads
        sizeMb: parseFloat((file.size / 1024 / 1024).toFixed(2)),
      };

      if (isVideo) {
        const vid = document.createElement('video');
        vid.src = src;
        vid.onloadedmetadata = () => {
          setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, duration: vid.duration } : i));
        };
      }

      setItems((prev) => [...prev, item]);
    });
  }, []);

  // ── Add clip to timeline ──────────────────────────────────
  const addToTimeline = useCallback((item: LibraryItem) => {
    const targetTrackType: TrackType = item.type === 'audio' ? 'audio' : 'video';

    // Find or create appropriate track
    let targetTrack = tracks.find((t) => t.type === targetTrackType && !t.isLocked);
    if (!targetTrack) {
      addTrack(targetTrackType);
      // After addTrack, re-read from store
      const state = useEditorStore.getState();
      targetTrack = state.tracks.filter((t) => t.type === targetTrackType).at(-1);
    }
    if (!targetTrack) return;

    // Find first available time slot on the track
    const occupied = targetTrack.clips.map((c) => c.startTime + c.duration);
    const startTime = occupied.length > 0 ? Math.max(...occupied) + 0.1 : 0;

    addClip(targetTrack.id, {
      type: item.type as any,
      src: item.src,
      name: item.name.replace(/\.[^.]+$/, ''),
      startTime,
      duration: item.duration,
      trimStart: 0,
      trimEnd: item.duration,
      volume: 1,
      opacity: 1,
      playbackRate: 1,
      effects: [],
      isLocked: false,
      isMuted: false,
      waveformData: item.type === 'audio' ? genWaveform() : undefined,
    });
  }, [tracks, addTrack, addClip]);

  const textPresets = [
    { name: 'Title', fontSize: 64, fontFamily: 'Inter' },
    { name: 'Subtitle', fontSize: 36, fontFamily: 'Inter' },
    { name: 'Caption', fontSize: 24, fontFamily: 'Inter' },
    { name: 'Lower Third', fontSize: 28, fontFamily: 'JetBrains Mono' },
  ];

  const addTextClip = useCallback((preset: typeof textPresets[0]) => {
    let textTrack = tracks.find((t) => t.type === 'text' && !t.isLocked);
    if (!textTrack) {
      addTrack('text');
      const state = useEditorStore.getState();
      textTrack = state.tracks.filter((t) => t.type === 'text').at(-1);
    }
    if (!textTrack) return;

    const occupied = textTrack.clips.map((c) => c.startTime + c.duration);
    const startTime = occupied.length > 0 ? Math.max(...occupied) + 0.1 : 0;

    addClip(textTrack.id, {
      type: 'text',
      src: '',
      name: preset.name,
      startTime,
      duration: 5,
      trimStart: 0,
      trimEnd: 5,
      volume: 1,
      opacity: 1,
      playbackRate: 1,
      effects: [],
      isLocked: false,
      isMuted: false,
      text: preset.name + ' Text',
      fontSize: preset.fontSize,
      fontFamily: preset.fontFamily,
      textColor: '#ffffff',
      textAlign: 'center',
    });
  }, [tracks, addTrack, addClip]);

  return (
    <div className="flex flex-col h-full bg-[var(--editor-surface)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--editor-border)] shrink-0">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Media Library</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--editor-border)] shrink-0">
        {(['media', 'audio', 'text'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs capitalize transition-colors ${tab === t ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
            {t === 'media' ? '🎬 Video' : t === 'audio' ? '🎵 Audio' : '✏️ Text'}
          </button>
        ))}
      </div>

      {/* Upload Zone (media/audio tabs) */}
      {tab !== 'text' && (
        <div
          onDragEnter={() => setIsDragOver(true)}
          onDragLeave={() => setIsDragOver(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={`mx-3 mt-3 mb-2 border-2 border-dashed rounded-lg p-4 text-center transition-colors shrink-0 ${isDragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-[var(--editor-border)] hover:border-indigo-500/50'}`}
        >
          <input
            type="file"
            id="file-upload"
            multiple
            accept={tab === 'audio' ? 'audio/*' : 'video/*,image/*'}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="text-2xl mb-1">{tab === 'audio' ? '🎵' : '📁'}</div>
            <p className="text-xs text-slate-400">Drop {tab} files here</p>
            <p className="text-xs text-indigo-400 mt-1">or browse</p>
          </label>
        </div>
      )}

      {/* Library Items */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {tab === 'text' ? (
          <div className="space-y-1.5 mt-2">
            {textPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => addTextClip(preset)}
                className="w-full text-left px-3 py-2 rounded-lg bg-[var(--editor-panel)] hover:bg-[var(--editor-hover)] transition-colors border border-[var(--editor-border)] group"
              >
                <span className="text-sm font-medium text-slate-200" style={{ fontFamily: preset.fontFamily, fontSize: Math.min(preset.fontSize / 3, 20) }}>
                  {preset.name}
                </span>
                <span className="text-xs text-slate-600 ml-auto float-right group-hover:text-indigo-400 transition-colors">+ Add</span>
              </button>
            ))}
          </div>
        ) : items.filter((i) => tab === 'audio' ? i.type === 'audio' : i.type !== 'audio').length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-700 text-xs">
            <p>No files yet</p>
          </div>
        ) : (
          <div className="space-y-1.5 mt-2">
            {items
              .filter((i) => tab === 'audio' ? i.type === 'audio' : i.type !== 'audio')
              .map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-2 py-2 rounded-lg bg-[var(--editor-panel)] hover:bg-[var(--editor-hover)] transition-colors border border-[var(--editor-border)] group cursor-pointer"
                onClick={() => addToTimeline(item)}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                  background: item.type === 'video' ? '#1d4ed8' : item.type === 'audio' ? '#15803d' : '#7e22ce',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {item.type === 'video' ? '🎬' : item.type === 'audio' ? '🎵' : '🖼️'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-600">
                    {item.duration.toFixed(1)}s · {item.sizeMb}MB
                  </p>
                </div>
                <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">+</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
