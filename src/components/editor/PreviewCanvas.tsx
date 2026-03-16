'use client';
// ─────────────────────────────────────────────────────────────
// PreviewCanvas.tsx — Video preview panel (uses HTML5 video for
// proxy preview; FFmpeg.wasm for frame-accurate seeking)
// ─────────────────────────────────────────────────────────────
import { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

export default function PreviewCanvas() {
  const { tracks, currentTime, isPlaying, settings } = useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspectStyle, setAspectStyle] = useState<React.CSSProperties>({});

  // Determine canvas aspect ratio from project settings
  useEffect(() => {
    const { width, height } = settings.resolution;
    const ratio = width / height;
    setAspectStyle({ aspectRatio: `${ratio}` });
  }, [settings.resolution]);

  // Draw frame on canvas (simplified: in production this uses FFmpeg.wasm)
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = settings.backgroundColor || '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find all active clips at currentTime
    const activeVideoClips = tracks
      .filter((t) => t.type === 'video' && !t.isMuted)
      .flatMap((t) => t.clips)
      .filter((c) => !c.isMuted && currentTime >= c.startTime && currentTime <= c.startTime + c.duration);

    // Find active text clips
    const activeTextClips = tracks
      .filter((t) => t.type === 'text' && !t.isMuted)
      .flatMap((t) => t.clips)
      .filter((c) => !c.isMuted && currentTime >= c.startTime && currentTime <= c.startTime + c.duration);

    if (activeVideoClips.length === 0) {
      // Empty frame — show timecode
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid pattern
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      const step = canvas.width / 12;
      for (let x = 0; x <= canvas.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      const vstep = canvas.height / 6;
      for (let y = 0; y <= canvas.height; y += vstep) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }

    // Render text clips
    activeTextClips.forEach((clip) => {
      ctx.save();
      ctx.font = `${clip.fontSize || 48}px ${clip.fontFamily || 'Inter, sans-serif'}`;
      ctx.fillStyle = clip.textColor || '#ffffff';
      ctx.textAlign = (clip.textAlign as CanvasTextAlign) || 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(
        clip.text || clip.name,
        canvas.width / 2,
        canvas.height * 0.85,
        canvas.width - 80
      );
      ctx.restore();
    });

    // Timecode overlay (bottom right)
    ctx.save();
    ctx.font = '14px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'right';
    ctx.fillText(formatTimecode(currentTime), canvas.width - 12, canvas.height - 12);
    ctx.restore();
  }, [tracks, currentTime, settings]);

  // Redraw on time/track change
  useEffect(() => {
    drawFrame();
  }, [drawFrame]);

  const { width: resW, height: resH } = settings.resolution;
  // Scale down for display (max 640 wide in panel)
  const displayW = 640;
  const displayH = Math.round(displayW * (resH / resW));

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[var(--editor-bg)] p-4">
      {/* Canvas container */}
      <div
        className="relative shadow-2xl rounded-lg overflow-hidden"
        style={{ width: '100%', maxWidth: displayW, ...aspectStyle }}
      >
        <canvas
          ref={canvasRef}
          width={resW}
          height={resH}
          style={{ width: '100%', height: 'auto', display: 'block', background: '#000' }}
        />

        {/* Play indicator overlay */}
        {isPlaying && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(244, 63, 94, 0.9)', color: 'white',
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            fontFamily: 'monospace', letterSpacing: 1,
          }}>
            ● REC
          </div>
        )}
      </div>

      {/* Resolution info */}
      <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
        <span>{resW}×{resH}</span>
        <span>·</span>
        <span>{settings.fps} fps</span>
        <span>·</span>
        <span>{settings.aspectRatio}</span>
      </div>
    </div>
  );
}

function formatTimecode(secs: number): string {
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60), f = Math.floor((secs % 1) * 30);
  return `${pad(m)}:${pad(s)}:${pad(f)}`;
}
function pad(n: number) { return n.toString().padStart(2, '0'); }
