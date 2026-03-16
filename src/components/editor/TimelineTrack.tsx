'use client';
// ─────────────────────────────────────────────────────────────
// TimelineTrack.tsx — Single horizontal track row with clip rendering
// ─────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import TimelineClip from './TimelineClip';
import type { Track } from '@/types/editor';

interface Props {
  track: Track;
  pxPerSec: number;
  totalWidth: number;
}

export default function TimelineTrack({ track, pxPerSec, totalWidth }: Props) {
  const { moveClip, selectTrack, selectedTrackId } = useEditorStore();
  const isSelected = selectedTrackId === track.id;

  // ── Drop zone: when clip is dragged and dropped here ──────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!track.isLocked) e.preventDefault();
  }, [track.isLocked]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const clipId = e.dataTransfer.getData('clipId');
    const offsetX = parseFloat(e.dataTransfer.getData('offsetX') || '0');
    if (!clipId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - offsetX;
    const newTime = Math.max(0, x / pxPerSec);
    moveClip(clipId, track.id, newTime);
  }, [track.id, pxPerSec, moveClip]);

  // ── Clip drag start ──────────────────────────────────────
  const handleClipDragStart = useCallback((clipId: string, e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;

    // We use native drag with dataTransfer for cross-track moves
    // This is a simplified approach; for production use @dnd-kit
    (e.currentTarget as HTMLElement).setAttribute('draggable', 'true');
    el.addEventListener('dragstart', (de: DragEvent) => {
      de.dataTransfer?.setData('clipId', clipId);
      de.dataTransfer?.setData('offsetX', String(offsetX));
    }, { once: true });
  }, []);

  const trackTypeColors: Record<string, string> = {
    video:     'border-blue-500/30 hover:border-blue-500/60',
    audio:     'border-green-500/30 hover:border-green-500/60',
    text:      'border-yellow-500/30 hover:border-yellow-500/60',
    voiceover: 'border-purple-500/30 hover:border-purple-500/60',
  };

  return (
    <div
      style={{ height: track.height, width: totalWidth, position: 'relative' }}
      className={`border-b border-[var(--editor-border)] transition-colors ${isSelected ? 'bg-white/[0.03]' : ''} ${track.isLocked ? 'cursor-not-allowed' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => selectTrack(track.id)}
    >
      {/* Track background subtle indicator */}
      <div
        className={`absolute inset-0 border-l-2 transition-colors ${trackTypeColors[track.type] || 'border-white/10'}`}
        style={{ pointerEvents: 'none' }}
      />

      {/* Locked overlay */}
      {track.isLocked && (
        <div className="absolute inset-0 bg-black/20 z-10 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-white/30">🔒 Locked</span>
        </div>
      )}

      {/* Clips */}
      {track.clips.map((clip) => (
        <TimelineClip
          key={clip.id}
          clip={clip}
          trackType={track.type}
          pxPerSec={pxPerSec}
          trackHeight={track.height}
          onDragStart={handleClipDragStart}
        />
      ))}

      {/* Empty track hint */}
      {track.clips.length === 0 && !track.isLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-white/20">Drop media here</span>
        </div>
      )}
    </div>
  );
}
