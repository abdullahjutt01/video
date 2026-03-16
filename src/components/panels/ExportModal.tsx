'use client';
// ─────────────────────────────────────────────────────────────
// ExportModal.tsx — Export job configuration & status dialog
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

interface Props {
  onClose: () => void;
}

type ExportQuality = 'draft' | 'high' | '4k';

const QUALITY_OPTS: { key: ExportQuality; label: string; desc: string; plan: string }[] = [
  { key: 'draft',  label: '720p Draft',  desc: 'Fast preview, watermark', plan: 'FREE' },
  { key: 'high',   label: '1080p High',  desc: 'No watermark, fast GPU', plan: 'PRO' },
  { key: '4k',     label: '4K Ultra',    desc: 'HDR, no watermark, h264_nvenc', plan: 'PRO' },
];

export default function ExportModal({ onClose }: Props) {
  const { settings, duration, tracks, canvasRef, audioStream, setIsPlaying, setCurrentTime, currentTime } = useEditorStore();
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4');
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const totalClips = tracks.reduce((n, t) => n + t.clips.length, 0);

  const handleExport = async () => {
    if (totalClips === 0 || !canvasRef || !audioStream) {
      alert("Please ensure media is loaded correctly before exporting.");
      return;
    }
    
    setStatus('processing');
    setProgress(0);
    setCurrentTime(0);

    const stream = new MediaStream([
      ...canvasRef.captureStream(30).getTracks(),
      ...audioStream.getTracks()
    ]);

    const mimeType = format === 'mp4' ? 'video/mp4;codecs=h264' : 'video/webm;codecs=vp9';
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
      videoBitsPerSecond: quality === '4k' ? 25000000 : (quality === 'high' ? 8000000 : 2500000),
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus('done');
      setIsPlaying(false);
    };

    // Begin recording
    recorder.start();
    setIsPlaying(true);

    // Monitor progress
    const checkProgress = setInterval(() => {
      const p = Math.min(100, Math.round((useEditorStore.getState().currentTime / duration) * 100));
      setProgress(p);

      if (useEditorStore.getState().currentTime >= duration) {
        clearInterval(checkProgress);
        recorder.stop();
        setIsPlaying(false);
      }
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-100">⚡ Export Video</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Project info */}
        <div className="bg-[var(--editor-bg)] rounded-lg p-3 mb-4 text-xs text-slate-400 space-y-1">
          <div className="flex justify-between"><span>Project</span><span className="text-slate-300">{settings.name}</span></div>
          <div className="flex justify-between"><span>Duration</span><span className="text-slate-300">{duration.toFixed(1)}s</span></div>
          <div className="flex justify-between"><span>Resolution</span><span className="text-slate-300">{settings.resolution.width}×{settings.resolution.height}</span></div>
          <div className="flex justify-between"><span>Clips</span><span className="text-slate-300">{totalClips}</span></div>
        </div>

        {status === 'idle' && (
          <>
            {/* Quality selector */}
            <div className="space-y-2 mb-4">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quality</label>
              {QUALITY_OPTS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setQuality(opt.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${quality === opt.key ? 'border-indigo-500 bg-indigo-500/10' : 'border-[var(--editor-border)] bg-[var(--editor-bg)] hover:border-white/20'}`}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${opt.plan === 'FREE' ? 'border-slate-600 text-slate-500' : 'border-indigo-500/50 text-indigo-400'}`}>
                    {opt.plan}
                  </span>
                </button>
              ))}
            </div>

            {/* Format selector */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Format</label>
              <div className="flex gap-2">
                {(['mp4', 'webm'] as const).map((f) => (
                  <button key={f} onClick={() => setFormat(f)}
                    className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${format === f ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10' : 'border-[var(--editor-border)] text-slate-400 hover:border-white/20'}`}>
                    .{f}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={totalClips === 0}
              className="btn btn-primary w-full text-sm py-3"
            >
              {totalClips === 0 ? 'Add clips to export' : 'Export Now'}
            </button>
          </>
        )}

        {(status === 'queued' || status === 'processing') && (
          <div className="text-center py-6">
            <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <p className="text-slate-300 font-medium mb-1">
              {status === 'queued' ? '⏳ In queue…' : '🖥️ GPU Rendering…'}
            </p>
            <p className="text-xs text-slate-500 mb-4">
              {status === 'queued' ? 'Your job is waiting for a GPU worker' : `h264_nvenc encoding — ${progress}%`}
            </p>
            {status === 'processing' && (
              <div className="w-full bg-[var(--editor-border)] rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}
                />
              </div>
            )}
          </div>
        )}

        {status === 'done' && (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-slate-200 font-semibold mb-1">Export Complete!</p>
            <p className="text-xs text-slate-500 mb-4">Your video is ready to download</p>
            <a
              href={downloadUrl ?? '#'}
              download={`${settings.name || 'exported-video'}.${format}`}
              className="btn btn-primary w-full text-sm py-3 text-center"
            >
              ⬇️ Download Video
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
