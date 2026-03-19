'use client';
import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { useFFmpeg } from '@/hooks/useFFmpeg';

interface Props {
  onClose: () => void;
}

type ExportQuality = 'draft' | 'high' | '4k';

const QUALITY_OPTS: { key: ExportQuality; label: string; desc: string; plan: string }[] = [
  { key: 'draft',  label: '720p Draft',  desc: 'Fast preview, H.264', plan: 'FREE' },
  { key: 'high',   label: '1080p High',  desc: 'No watermark, H.264 High', plan: 'PRO' },
  { key: '4k',     label: '4K Ultra',    desc: 'Professional H.264 4K', plan: 'PRO' },
];

export default function ExportModal({ onClose }: Props) {
  const { settings, duration, tracks, canvasRef, audioStream, setIsPlaying, setCurrentTime } = useEditorStore();
  const { load: loadFFmpeg, transcode, progress: encodeProgress, isLoading: ffmpegLoading, isLoaded: ffmpegLoaded, error: ffmpegError } = useFFmpeg();
  
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4');
  const [status, setStatus] = useState<'idle' | 'loading_engine' | 'recording' | 'transcoding' | 'done' | 'error'>('idle');
  const [recordProgress, setRecordProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const totalClips = tracks.reduce((n, t) => n + t.clips.length, 0);

  // Auto-reset when modal opens
  useEffect(() => {
    return () => {
      setIsPlaying(false);
    };
  }, [setIsPlaying]);

  const handleExport = async () => {
    if (totalClips === 0 || !canvasRef || !audioStream) {
      alert("Please ensure media is loaded correctly before exporting.");
      return;
    }

    // Step 1: Load FFmpeg if needed
    if (!ffmpegLoaded) {
      setStatus('loading_engine');
      await loadFFmpeg();
    }
    
    setStatus('recording');
    setRecordProgress(0);
    setCurrentTime(0);

    const stream = new MediaStream([
      ...canvasRef.captureStream(30).getTracks(),
      ...audioStream.getTracks()
    ]);

    // Use WebM for intermediate recording (most stable in browser)
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 20000000, // High bitrate for intermediate
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    
    recorder.onstop = async () => {
      setStatus('transcoding');
      const webmBlob = new Blob(chunks, { type: 'video/webm' });
      const webmFile = new File([webmBlob], 'input.webm', { type: 'video/webm' });

      // Step 2: Transcode to MP4 (H.264) for maximum compatibility
      const outputName = `${settings.name || 'exported-video'}.mp4`;
      const videoBits = quality === '4k' ? '12M' : (quality === 'high' ? '6M' : '2.5M');
      
      try {
        const mp4Data = await transcode(webmFile, outputName, [
          '-c:v', 'libx264',
          '-preset', 'superfast',
          '-crf', '22',
          '-pix_fmt', 'yuv420p', // Critical for mobile gallery compatibility
          '-b:v', videoBits,
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', 'faststart' // Progressive download
        ]);

        if (mp4Data) {
          const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' });
          const url = URL.createObjectURL(mp4Blob);
          setDownloadUrl(url);
          setStatus('done');
        } else {
          setStatus('error');
        }
      } catch (e) {
        console.error('Transcoding failed:', e);
        setStatus('error');
      }
    };

    // Begin recording
    recorder.start();
    setIsPlaying(true);

    // Monitor recording progress
    const checkProgress = setInterval(() => {
      const state = useEditorStore.getState();
      const p = Math.min(100, Math.round((state.currentTime / duration) * 100));
      setRecordProgress(p);

      if (state.currentTime >= duration) {
        clearInterval(checkProgress);
        recorder.stop();
        setIsPlaying(false);
      }
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget && status !== 'recording' && status !== 'transcoding') onClose(); }}>
      <div className="bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-3xl p-8 w-full max-w-md shadow-2xl animate-slide-up relative overflow-hidden">
        
        {/* Background glow for progress */}
        {(status === 'recording' || status === 'transcoding') && (
          <div className="absolute inset-0 bg-indigo-500/5 animate-pulse-slow pointer-events-none" />
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-100 mb-1">🎬 Production Export</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Ready for TikTok & Instagram</p>
          </div>
          {status !== 'recording' && status !== 'transcoding' && (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors">✕</button>
          )}
        </div>

        {status === 'idle' && (
          <>
            {/* Project info badge */}
            <div className="flex items-center gap-4 bg-black/40 rounded-2xl p-4 mb-6 border border-white/5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl">📽️</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200 truncate">{settings.name}</p>
                <p className="text-[10px] text-slate-500">{settings.resolution.width}x{settings.resolution.height} • {duration.toFixed(1)}s • {settings.fps} FPS</p>
              </div>
            </div>

            {/* Quality options */}
            <div className="space-y-2 mb-8">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-2 block">Compatibility Mode: H.264 MP4</label>
              {QUALITY_OPTS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setQuality(opt.key)}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 ${quality === opt.key ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'border-white/5 bg-white/5 hover:bg-white/[0.08] hover:border-white/10'}`}
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-200">{opt.label}</p>
                    <p className="text-[10px] text-slate-500">{opt.desc}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${opt.plan === 'FREE' ? 'bg-slate-800 text-slate-500' : 'bg-indigo-500 text-white'}`}>
                    {opt.plan}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleExport}
              disabled={totalClips === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span className="flex items-center justify-center gap-2">
                🚀 {totalClips === 0 ? 'Wait, no clips!' : 'Export for Social Media'}
              </span>
            </button>
          </>
        )}

        {status === 'loading_engine' && (
          <div className="text-center py-10">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
            </div>
            <p className="text-slate-200 font-bold mb-2">Waking up FFmpeg...</p>
            <p className="text-xs text-slate-500 px-6">Initializing browser-side GPU acceleration. This only happens once.</p>
          </div>
        )}

        {(status === 'recording' || status === 'transcoding') && (
          <div className="text-center py-8">
            <div className="relative w-32 h-32 mx-auto mb-8">
              {/* Circular Progress */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                <circle
                  cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
                  strokeDasharray={364}
                  strokeDashoffset={364 - (364 * (status === 'recording' ? recordProgress : encodeProgress)) / 100}
                  className="text-indigo-500 transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white">{status === 'recording' ? recordProgress : encodeProgress}%</span>
              </div>
            </div>
            
            <p className="text-lg font-bold text-slate-100 mb-2">
              {status === 'recording' ? '🎥 Recording Frame Data...' : '⚙️ Optimizing for Social Media...'}
            </p>
            <p className="text-xs text-slate-500 px-8">
              {status === 'recording' ? 'Capturing synchronized audio & video tracks' : 'Encoding standard H.264 MP4 for gallery compatibility'}
            </p>
          </div>
        )}

        {status === 'done' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg shadow-green-500/10">✨</div>
            <p className="text-xl font-bold text-slate-100 mb-2">Export Successful!</p>
            <p className="text-sm text-slate-500 mb-8 px-6">Your H.264 MP4 is ready. This file is 100% compatible with TikTok & Instagram.</p>
            
            <div className="space-y-3">
              <a
                href={downloadUrl ?? '#'}
                download={`${settings.name || 'exported-video'}.mp4`}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-2xl block transition-all shadow-xl shadow-green-500/20 active:scale-[0.98]"
              >
                ⬇️ Save to Gallery
              </a>
              <button 
                onClick={onClose}
                className="w-full bg-white/5 border border-white/5 text-slate-400 font-bold py-3 rounded-2xl hover:bg-white/10 transition-all"
              >
                Close Editor
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl mx-auto mb-6">⚠️</div>
            <p className="text-lg font-bold text-slate-100 mb-2">Export Failed</p>
            <p className="text-xs text-red-400/80 mb-8 px-6">{ffmpegError || 'The browser ran out of memory or encountered a codec error. Try using "Draft" quality.'}</p>
            <button
              onClick={() => setStatus('idle')}
              className="w-full bg-white/10 text-white font-bold py-4 rounded-2xl hover:bg-white/20 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
