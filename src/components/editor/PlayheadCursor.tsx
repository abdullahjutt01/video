'use client';
// ─────────────────────────────────────────────────────────────
// PlayheadCursor.tsx — Draggable red playhead on the timeline
// ─────────────────────────────────────────────────────────────
import { useRef, useCallback } from 'react';

interface Props {
  currentTime: number;
  pxPerSec: number;
  totalHeight: number;
  onTimeChange: (t: number) => void;
}

export default function PlayheadCursor({ currentTime, pxPerSec, totalHeight, onTimeChange }: Props) {
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const parent = containerRef.current.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const x = e.clientX - rect.left + parent.scrollLeft;
      onTimeChange(Math.max(0, x / pxPerSec));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [pxPerSec, onTimeChange]);

  const x = currentTime * pxPerSec;

  return (
    <div
      ref={containerRef}
      style={{ left: x, top: 0, height: totalHeight, position: 'absolute', pointerEvents: 'none', zIndex: 50 }}
    >
      {/* Draggable head */}
      <div
        className="playhead-head"
        style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'all' }}
        onMouseDown={handleMouseDown}
      />
      {/* Vertical line */}
      <div className="playhead-line" style={{ top: 0 }} />
    </div>
  );
}
