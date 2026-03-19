'use client';
// ─────────────────────────────────────────────────────────────
// TimelineClip.tsx — Individual clip on a track, draggable + resizable
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import type { Clip, TrackType } from '@/types/editor';

const TRACK_COLORS: Record<TrackType, string> = {
  video:     'rgba(59, 130, 246, 0.85)',
  audio:     'rgba(34, 197, 94, 0.85)',
  text:      'rgba(234, 179, 8, 0.85)',
  voiceover: 'rgba(168, 85, 247, 0.85)',
};

const TRACK_COLORS_SOLID: Record<TrackType, string> = {
  video:     '#1d4ed8',
  audio:     '#15803d',
  text:      '#a16207',
  voiceover: '#7e22ce',
};

interface Props {
  clip: Clip;
  trackType: TrackType;
  pxPerSec: number;
  trackHeight: number;
  onDragStart?: (clipId: string, e: React.MouseEvent) => void;
}

export default function TimelineClip({ clip, trackType, pxPerSec, trackHeight, onDragStart }: Props) {
  const { selectedClipId, selectClip, updateClip, removeClip } = useEditorStore();
  const isSelected = selectedClipId === clip.id;

  const left   = clip.startTime * pxPerSec;
  const width  = Math.max(clip.duration * pxPerSec, 4); // min 4px so it's never invisible

  // ── Resize logic ──────────────────────────────────────────
  const resizeDir = useRef<'left' | 'right' | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartData = useRef({ startTime: 0, duration: 0, trimStart: 0, trimEnd: 0 });

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, dir: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    resizeDir.current = dir;
    resizeStartX.current = e.clientX;
    resizeStartData.current = {
      startTime: clip.startTime,
      duration: clip.duration,
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
    };

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartX.current;
      const dt = dx / pxPerSec;
      const orig = resizeStartData.current;

      if (dir === 'right') {
        const newDuration = Math.max(0.1, orig.duration + dt);
        const newTrimEnd = orig.trimStart + newDuration;
        updateClip(clip.id, { duration: newDuration, trimEnd: newTrimEnd });
      } else {
        const newStart = Math.max(0, orig.startTime + dt);
        const delta = newStart - orig.startTime;
        const newDuration = Math.max(0.1, orig.duration - delta);
        const newTrimStart = orig.trimStart + delta;
        updateClip(clip.id, {
          startTime: newStart,
          duration: newDuration,
          trimStart: newTrimStart,
        });
      }
    };

    const onMouseUp = () => {
      resizeDir.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [clip, pxPerSec, updateClip]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(isSelected ? null : clip.id);
  }, [clip.id, isSelected, selectClip]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id);
  }, [clip.id, selectClip]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Simple: right-click removes clip (production: show context menu)
    if (confirm(`Remove clip "${clip.name}"?`)) removeClip(clip.id);
  }, [clip.id, clip.name, removeClip]);

  // Muted / locked overlay
  const isMutedOrLocked = clip.isMuted || clip.isLocked;

  return (
    <div
      className={`timeline-clip ${isSelected ? 'selected' : ''}`}
      style={{
        left,
        width,
        height: trackHeight - 8,
        background: TRACK_COLORS[trackType],
        borderColor: isSelected ? '#6366f1' : 'rgba(255,255,255,0.12)',
        opacity: isMutedOrLocked ? 0.5 : 1,
        cursor: clip.isLocked ? 'not-allowed' : 'grab',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={(e) => {
        if (!clip.isLocked && onDragStart) onDragStart(clip.id, e);
      }}
    >
      {/* Background stripe pattern for video */}
      {trackType === 'video' && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent,
            transparent 20px,
            ${TRACK_COLORS_SOLID[trackType]}33 20px,
            ${TRACK_COLORS_SOLID[trackType]}33 21px
          )`,
        }} />
      )}

      {/* Waveform bars for audio/voiceover */}
      {(trackType === 'audio' || trackType === 'voiceover') && clip.waveformData && (
        <div className="waveform-bars">
          {clip.waveformData.slice(0, Math.floor(width / 3)).map((h, i) => (
            <div key={i} className="waveform-bar" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}

      {/* Clip Label */}
      <span className="clip-label">
        {trackType === 'video' && '🎬 '}
        {trackType === 'audio' && '🎵 '}
        {trackType === 'text' && '✏️ '}
        {trackType === 'voiceover' && '🎙️ '}
        {clip.name}
      </span>

      {/* Duration badge */}
      {width > 60 && (
        <span style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
          fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace',
        }}>
          {clip.duration.toFixed(1)}s
        </span>
      )}

      {/* Resize handle — left */}
      <div
        className="clip-resize-handle left"
        onMouseDown={(e) => handleResizeMouseDown(e, 'left')}
      />
      {/* Resize handle — right */}
      <div
        className="clip-resize-handle right"
        onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
      />
    </div>
  );
}
