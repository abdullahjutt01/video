'use client';
// ─────────────────────────────────────────────────────────────
// PreviewCanvas.tsx — Real-time Video Preview Engine
// Caches media elements and renders them onto Canvas API
// Synchronized with Zustand store's currentTime
// ─────────────────────────────────────────────────────────────
import { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

export default function PreviewCanvas() {
  const { tracks, currentTime, isPlaying, settings } = useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaCache = useRef<Map<string, HTMLVideoElement | HTMLImageElement>>(new Map());
  const [aspectStyle, setAspectStyle] = useState<React.CSSProperties>({});

  // Determine canvas aspect ratio from project settings
  useEffect(() => {
    const { width, height } = settings.resolution;
    const ratio = width / height;
    setAspectStyle({ aspectRatio: `${ratio}` });
  }, [settings.resolution]);

  // ── Media Management (Pre-load & Sync) ─────────────────────
  useEffect(() => {
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (!clip.src) return;
        
        let el = mediaCache.current.get(clip.id);
        if (!el) {
        let el = mediaCache.current.get(clip.id);
        if (!el) {
          if (clip.type === 'video') {
            const video = document.createElement('video');
            video.src = clip.src;
            video.muted = true;
            video.preload = 'auto';
            video.crossOrigin = 'anonymous';
            mediaCache.current.set(clip.id, video);
            el = video;
          } else if (clip.type === 'image') {
            const img = new Image();
            img.src = clip.src;
            img.crossOrigin = 'anonymous';
            mediaCache.current.set(clip.id, img);
            el = img;
          }
        }
        }

        // Sync playback position for videos
        if (el instanceof HTMLVideoElement) {
          const clipLocalTime = currentTime - clip.startTime;
          if (clipLocalTime >= 0 && clipLocalTime <= clip.duration) {
            const targetTime = clipLocalTime + (clip.trimStart || 0);
            // Seek if significantly desynced (>100ms)
            if (Math.abs(el.currentTime - targetTime) > 0.1) {
              el.currentTime = targetTime;
            }
          }
        }
      });
    });
  }, [tracks, currentTime]);

  // ── Rendering Logic ────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear with background color
    ctx.fillStyle = settings.backgroundColor || '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Filter active clips and sort by Z-order (Tracks)
    // We treat tracks as layers (bottom track = index 0)
    const activeLayers = tracks
      .filter(t => !t.isMuted)
      .flatMap(t => t.clips.map(c => ({ 
        ...c, 
        trackType: t.type,
      })))
      .filter(c => !c.isMuted && currentTime >= c.startTime && currentTime <= c.startTime + c.duration)
      .sort((a, b) => {
        // Simple track layering: video < audio < voiceover < text
        const z = { video: 1, audio: 2, voiceover: 3, text: 4 };
        return z[a.trackType as keyof typeof z] - z[b.trackType as keyof typeof z];
      });

    // 3. Draw each layer
    activeLayers.forEach(clip => {
      ctx.save();
      ctx.globalAlpha = clip.opacity ?? 1;

      // Render Video/Image
      if (clip.type === 'video' || clip.type === 'image' || (clip.type === 'voiceover' && clip.src)) {
        const el = mediaCache.current.get(clip.id);
        
        if (el && (el instanceof HTMLImageElement || (el instanceof HTMLVideoElement && el.readyState >= 2))) {
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        } else if (clip.src) {
          // Glassmorphic loading state
          ctx.fillStyle = 'rgba(15, 15, 30, 0.8)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.font = '500 14px Outfit';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ SYNCING MEDIA...', canvas.width/2, canvas.height/2);
          
          // Subtle pulse bar
          const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
          ctx.fillStyle = `rgba(99, 102, 241, ${0.1 + pulse * 0.2})`;
          ctx.fillRect(canvas.width/2 - 60, canvas.height/2 + 20, 120, 2);
        }
      }

      // Render Text
      if (clip.trackType === 'text' && clip.text) {
        ctx.font = `${clip.fontSize || 48}px ${clip.fontFamily || 'Inter, sans-serif'}`;
        ctx.fillStyle = clip.textColor || '#ffffff';
        ctx.textAlign = (clip.textAlign as CanvasTextAlign) || 'center';
        
        // Text Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        
        // Multi-line support (simple)
        const lines = clip.text.split('\n');
        const lineHeight = (clip.fontSize || 48) * 1.2;
        const totalH = lines.length * lineHeight;
        const startY = (canvas.height / 2) - (totalH / 2) + (lineHeight / 2);

        lines.forEach((line, i) => {
          ctx.fillText(line, canvas.width / 2, startY + (i * lineHeight));
        });
      }

      ctx.restore();
    });

    // 4. Overlays (Timecode)
    ctx.save();
    ctx.font = '14px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'right';
    ctx.fillText(formatTimecode(currentTime), canvas.width - 20, canvas.height - 20);
    ctx.restore();
  }, [tracks, currentTime, settings]);

  // ── Render Loop ───────────────────────────────────────────
  useEffect(() => {
    let rafId: number;
    const render = () => {
      drawFrame();
      rafId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(rafId);
  }, [drawFrame]);

  const { width: resW, height: resH } = settings.resolution;
  const displayW = 640;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[var(--editor-bg)] p-4">
      <div
        className="relative shadow-2xl rounded-lg overflow-hidden border border-[var(--editor-border)] bg-black"
        style={{ width: '100%', maxWidth: displayW, ...aspectStyle }}
      >
        <canvas
          ref={canvasRef}
          width={resW}
          height={resH}
          className="w-full h-auto block"
        />

        {/* Play indicator */}
        {isPlaying && (
          <div className="absolute top-4 right-4 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1.5 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-white" />
            LIVE PREVIEW
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-4 text-[10px] text-slate-500 font-medium uppercase tracking-widest">
        <span>{resW} × {resH}</span>
        <span className="w-1 h-1 rounded-full bg-slate-800" />
        <span>{settings.fps} FPS</span>
        <span className="w-1 h-1 rounded-full bg-slate-800" />
        <span>{settings.aspectRatio}</span>
      </div>
    </div>
  );
}

function formatTimecode(secs: number): string {
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60), f = Math.floor((secs % 1) * 30);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
}
