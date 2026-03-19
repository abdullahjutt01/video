'use client';
import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { MemoryMonitor, URLManager, MediaRecorderTracker, CleanupManager } from '@/utils/memoryUtils';
import { generateOptimizationReport } from '@/utils/exportOptimizationGuide';

interface Props {
  onClose: () => void;
}

type ExportQuality = 'draft' | 'high' | '4k';

const QUALITY_OPTS: {
  key: ExportQuality;
  label: string;
  desc: string;
  plan: string;
  fps: number;
  resolution: number;
}[] = [
  {
    key: 'draft',
    label: '720p Draft',
    desc: 'Fastest, 24 FPS',
    plan: 'FREE',
    fps: 24,
    resolution: 720,
  },
  {
    key: 'high',
    label: '1080p High',
    desc: 'Balanced, 30 FPS',
    plan: 'PRO',
    fps: 30,
    resolution: 1080,
  },
  {
    key: '4k',
    label: '4K Ultra',
    desc: 'Professional, 24 FPS',
    plan: 'PRO',
    fps: 24,
    resolution: 2160,
  },
];

export default function ExportModal({ onClose }: Props) {
  const { settings, duration, tracks, canvasRef, audioStream, setIsPlaying, setCurrentTime } =
    useEditorStore();
  const {
    load: loadFFmpeg,
    transcode,
    progress: encodeProgress,
    isLoading: ffmpegLoading,
    isLoaded: ffmpegLoaded,
    error: ffmpegError,
    cleanup: ffmpegCleanup,
  } = useFFmpeg();

  const [quality, setQuality] = useState<ExportQuality>('high');
  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4');
  const [status, setStatus] = useState<
    'idle' | 'loading_engine' | 'recording' | 'transcoding' | 'done' | 'error'
  >('idle');
  const [recordProgress, setRecordProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<{
    usedJSHeapSize: number;
    percentage: number;
  } | null>(null);
  const [showOptimizationTips, setShowOptimizationTips] = useState(true);

  // Resource tracking
  const urlManagerRef = useRef(new URLManager());
  const recorderTrackerRef = useRef(new MediaRecorderTracker());

  const totalClips = tracks.reduce((n, t) => n + t.clips.length, 0);

  // Monitor memory usage
  useEffect(() => {
    const interval = setInterval(() => {
      const memory = MemoryMonitor.getMemoryUsage();
      if (memory) {
        setMemoryUsage({
          usedJSHeapSize: memory.usedJSHeapSize,
          percentage: memory.percentage,
        });
        MemoryMonitor.checkMemory('Export modal');
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Auto-reset when modal opens
  useEffect(() => {
    return () => {
      setIsPlaying(false);
    };
  }, [setIsPlaying]);

  /**
   * Get quality-specific settings
   */
  const getQualitySettings = (q: ExportQuality) => {
    const settingsMap = {
      draft: { fps: 24, videoBits: '2.5M', preset: 'ultrafast' },
      high: { fps: 30, videoBits: '6M', preset: 'superfast' },
      '4k': { fps: 24, videoBits: '12M', preset: 'fast' },
    };
    return settingsMap[q];
  };

  const handleExport = async () => {
    if (totalClips === 0 || !canvasRef || !audioStream) {
      alert('Please ensure media is loaded correctly before exporting.');
      return;
    }

    if (memoryUsage && memoryUsage.percentage > 85) {
      alert(
        '⚠️ Memory usage is very high (>85%). Close other applications or tabs and try again.'
      );
      return;
    }

    // Check for very long videos - recommend server rendering
    if ((duration || 0) > 3600) {
      const shouldContinue = confirm(
        `⚠️ This video is ${Math.round(duration! / 60)} minutes long.\n\nBrowser encoding may take many hours or fail due to memory limits.\n\nFor videos longer than 1 hour, we recommend:\n1. Exporting to a shorter clip first\n2. Using a dedicated server (contact support)\n\nContinue anyway?`
      );
      if (!shouldContinue) return;
    }

    // Step 1: Load FFmpeg if needed
    if (!ffmpegLoaded) {
      setStatus('loading_engine');
      await loadFFmpeg();
    }

    setStatus('recording');
    setRecordProgress(0);
    setCurrentTime(0);

    const qualitySettings = getQualitySettings(quality);

    const stream = new MediaStream([
      ...canvasRef.captureStream(qualitySettings.fps).getTracks(),
      ...audioStream.getTracks(),
    ]);

    // Use VP8 (better compression) for intermediate recording with optimized bitrate
    // Bitrate formula: resolution * fps * quality_factor
    // For long videos, use lower bitrate to prevent memory issues
    const isLongVideo = (duration || 0) > 1800; // >30 minutes
    const bitrateMbps = isLongVideo
      ? quality === '4k'
        ? 8 // 8 Mbps for 4K, long videos
        : quality === 'high'
          ? 4 // 4 Mbps for 1080p, long videos
          : 2 // 2 Mbps for 720p
      : quality === '4k'
        ? 20 // 20 Mbps for 4K, short videos
        : quality === 'high'
          ? 12 // 12 Mbps for 1080p, short videos
          : 6; // 6 Mbps for 720p

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: bitrateMbps * 1000000,
    });

    recorderTrackerRef.current.register(recorder);

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);

    recorder.onstop = async () => {
      setStatus('transcoding');
      const webmBlob = new Blob(chunks, { type: 'video/webm' });
      const webmFile = new File([webmBlob], 'input.webm', { type: 'video/webm' });

      // Step 2: Transcode to MP4 (H.264)
      const outputName = `${settings.name || 'exported-video'}.mp4`;
      const qs = getQualitySettings(quality);

      try {
        MemoryMonitor.checkMemory('Before transcode');

        // For very long videos, use slower preset but lower crf
        // This improves compression and reduces memory spikes
        const isLongVideo = (duration || 0) > 1800;
        const ffmpegPreset = isLongVideo ? 'slow' : qs.preset;
        const ffmpegCrf = isLongVideo ? '24' : '22'; // Higher = smaller file (more aggressive compression)

        const mp4Data = await transcode(webmFile, outputName, [
          '-c:v',
          'libx264',
          '-preset',
          ffmpegPreset,
          '-crf',
          ffmpegCrf,
          '-pix_fmt',
          'yuv420p',
          '-b:v',
          qs.videoBits,
          '-maxrate',
          qs.videoBits,
          '-bufsize',
          `${parseInt(qs.videoBits) * 2}`,
          '-c:a',
          'aac',
          '-b:a',
          '96k', // Reduced from 128k for long videos
          '-movflags',
          'faststart+frag_keyframe',
          '-frag_duration',
          '1000000', // Smaller fragments for better memory management
          '-strict',
          '-2',
        ]);

        if (mp4Data) {
          const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' });
          const url = urlManagerRef.current.create(mp4Blob);
          setDownloadUrl(url);
          setStatus('done');

          console.log(
            `✅ Export complete: ${(mp4Blob.size / 1024 / 1024).toFixed(2)}MB`
          );
          MemoryMonitor.checkMemory('Export complete');
        } else {
          setStatus('error');
          console.error('FFmpeg returned no output data');
        }
      } catch (e) {
        console.error('Transcoding failed:', e);
        const errorMsg = e instanceof Error ? e.message : String(e);
        
        // Detect specific error types
        if (errorMsg.includes('memory') || errorMsg.includes('Memory')) {
          console.error(
            `💾 OUT OF MEMORY: Browser ran out of memory during encoding.\n` +
            `📊 Tips:\n` +
            `• Close other browser tabs\n` +
            `• Reduce video quality (use Draft mode)\n` +
            `• Split long videos into shorter clips\n` +
            `• For videos >1 hour, use server encoding`
          );
        } else if (errorMsg.includes('timeout')) {
          console.error(
            `⏱️ TIMEOUT: Encoding took too long.\n` +
            `📊 Try:\n` +
            `• Reduce quality setting\n` +
            `• Split the video into shorter clips\n` +
            `• Check your system resources`
          );
        } else if (errorMsg.includes('codec') || errorMsg.includes('format')) {
          console.error(
            `🎬 CODEC ERROR: Video format issue.\n` +
            `📊 Try:\n` +
            `• Use a different quality setting\n` +
            `• Check that all clips are valid media files`
          );
        }
        
        setStatus('error');
      } finally {
        // Cleanup
        recorderTrackerRef.current.stopAll();
        try {
          CleanupManager.stopStream(stream);
        } catch (e) {
          console.error('Stream cleanup error:', e);
        }

        // Memory cleanup
        try {
          if (chunks.length > 0) {
            chunks.length = 0; // Clear array
          }
        } catch (e) {
          // Ignore cleanup errors
        }
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
    }, 500); // Less frequent for better performance
  };

  /**
   * Close modal with cleanup
   */
  const handleClose = () => {
    if (status === 'recording' || status === 'transcoding') {
      if (!confirm('Export in progress. Cancel?')) return;
      setIsPlaying(false);
      recorderTrackerRef.current.stopAll();
    }
    ffmpegCleanup?.();
    urlManagerRef.current.revokeAll();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          status !== 'recording' &&
          status !== 'transcoding'
        )
          handleClose();
      }}
    >
      <div className="bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-slide-up relative overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Background glow for progress */}
        {(status === 'recording' || status === 'transcoding') && (
          <div className="absolute inset-0 bg-indigo-500/5 animate-pulse-slow pointer-events-none" />
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-100 mb-1">🎬 Production Export</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              Optimized for Performance
            </p>
          </div>
          {status !== 'recording' && status !== 'transcoding' && (
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {status === 'idle' && (
          <>
            {/* Project info badge */}
            <div className="flex items-center gap-4 bg-black/40 rounded-2xl p-4 mb-6 border border-white/5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl">
                📽️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200 truncate">{settings.name}</p>
                <p className="text-[10px] text-slate-500">
                  {settings.resolution.width}x{settings.resolution.height} •{' '}
                  {duration.toFixed(1)}s • {settings.fps} FPS
                </p>
              </div>
            </div>

            {/* Memory Usage Warning */}
            {memoryUsage && memoryUsage.percentage > 70 && (
              <div
                className={`rounded-2xl p-4 mb-6 border ${
                  memoryUsage.percentage > 85
                    ? 'bg-red-500/10 border-red-500/50'
                    : 'bg-yellow-500/10 border-yellow-500/50'
                }`}
              >
                <p className={`text-xs font-bold mb-2 ${
                  memoryUsage.percentage > 85
                    ? 'text-red-300'
                    : 'text-yellow-300'
                }`}>
                  {memoryUsage.percentage > 85
                    ? '🚨 High Memory Usage'
                    : '⚠️ Memory Usage'}
                </p>
                <p className={`text-[10px] ${
                  memoryUsage.percentage > 85
                    ? 'text-red-200'
                    : 'text-yellow-200'
                }`}>
                  {(memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB (
                  {memoryUsage.percentage.toFixed(0)}%) - Close other tabs for better
                  performance
                </p>
              </div>
            )}

            {/* Optimization Tips */}
            {showOptimizationTips && (
              <div className="bg-indigo-500/10 border border-indigo-500/50 rounded-2xl p-4 mb-6">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-bold text-indigo-300">💡 Quick Tips for Faster Export</p>
                  <button
                    onClick={() => setShowOptimizationTips(false)}
                    className="text-slate-500 hover:text-slate-400"
                  >
                    ✕
                  </button>
                </div>
                <ul className="text-[10px] text-indigo-200 space-y-1">
                  <li>✓ Keep this tab active (backgrounding slows export 10x)</li>
                  <li>✓ Use Draft quality for fast preview</li>
                  <li>✓ Close other browser tabs to free memory</li>
                  <li>✓ Make sure hardware acceleration is enabled in browser settings</li>
                </ul>
              </div>
            )}

            {/* Quality options */}
            <div className="space-y-2 mb-8">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-2 block">
                Export Quality
              </label>
              {QUALITY_OPTS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setQuality(opt.key)}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 ${
                    quality === opt.key
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                      : 'border-white/5 bg-white/5 hover:bg-white/[0.08] hover:border-white/10'
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-200">{opt.label}</p>
                    <p className="text-[10px] text-slate-500">{opt.desc}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      opt.plan === 'FREE'
                        ? 'bg-slate-800 text-slate-500'
                        : 'bg-indigo-500 text-white'
                    }`}
                  >
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
                🚀{' '}
                {totalClips === 0
                  ? 'Wait, no clips!'
                  : 'Start Optimized Export'}
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
            <p className="text-slate-200 font-bold mb-2">Initializing Export Engine...</p>
            <p className="text-xs text-slate-500 px-6">
              Loading FFmpeg WebAssembly. This only happens once (~30MB download).
            </p>
          </div>
        )}

        {(status === 'recording' || status === 'transcoding') && (
          <div className="text-center py-8">
            <div className="relative w-32 h-32 mx-auto mb-8">
              {/* Circular Progress */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-white/5"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={364}
                  strokeDashoffset={
                    364 - (364 * (status === 'recording' ? recordProgress : encodeProgress)) / 100
                  }
                  className="text-indigo-500 transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white">
                  {status === 'recording' ? recordProgress : encodeProgress}%
                </span>
              </div>
            </div>

            <p className="text-lg font-bold text-slate-100 mb-2">
              {status === 'recording'
                ? '🎥 Recording Frame Data...'
                : '⚙️ Optimizing for Social Media...'}
            </p>
            <p className="text-xs text-slate-500 px-8 mb-6">
              {status === 'recording'
                ? 'Capturing synchronized audio & video tracks'
                : 'Encoding standard H.264 MP4 for gallery compatibility'}
            </p>

            {status === 'transcoding' && (
              <div className="bg-black/40 rounded-lg p-2 border border-white/5 text-[10px] text-slate-400">
                Running in background • Main thread is responsive
              </div>
            )}

            {status === 'recording' && (
              <div className="bg-black/40 rounded-lg p-2 border border-white/5 text-[10px] text-slate-400">
                💡 Keep this tab active for best speed
              </div>
            )}
          </div>
        )}

        {status === 'done' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg shadow-green-500/10">
              ✨
            </div>
            <p className="text-xl font-bold text-slate-100 mb-2">Export Successful!</p>
            <p className="text-sm text-slate-500 mb-8 px-6">
              Your H.264 MP4 is ready. This file is 100% compatible with TikTok & Instagram.
            </p>

            <div className="space-y-3">
              <a
                href={downloadUrl ?? '#'}
                download={`${settings.name || 'exported-video'}.mp4`}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-2xl block transition-all shadow-xl shadow-green-500/20 active:scale-[0.98]"
              >
                ⬇️ Download Video
              </a>
              <button
                onClick={handleClose}
                className="w-full bg-white/5 border border-white/5 text-slate-400 font-bold py-3 rounded-2xl hover:bg-white/10 transition-all"
              >
                Close Export
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl mx-auto mb-6">
              ⚠️
            </div>
            <p className="text-lg font-bold text-slate-100 mb-2">Export Failed</p>
            <p className="text-xs text-red-400/80 mb-8 px-6">
              {ffmpegError ||
                `Browser encoding failed. Video length: ${Math.round((duration || 0) / 60)} minutes.`}
            </p>

            {/* Video length specific recommendations */}
            {(duration || 0) > 3600 ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-8 text-left">
                <p className="text-xs font-bold text-yellow-300 mb-2">📹 Long Video Detected</p>
                <ul className="text-xs text-yellow-200/70 space-y-1">
                  <li>✓ Split video into multiple &lt;30 min clips</li>
                  <li>✓ Export each clip separately</li>
                  <li>✓ Use Draft quality mode</li>
                  <li>✓ Keep browser active (no tab switching)</li>
                  <li>✓ Close all other applications</li>
                </ul>
              </div>
            ) : (
              <ul className="text-xs text-red-200/70 mb-8 text-left mx-auto max-w-xs space-y-1">
                <li>✓ Close unused browser tabs</li>
                <li>✓ Use "Draft" quality for faster encoding</li>
                <li>✓ Keep this tab active during export</li>
                <li>✓ Check available RAM (4GB+)</li>
              </ul>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStatus('idle')}
                className="flex-1 bg-white/10 text-white font-bold py-3 rounded-lg hover:bg-white/20 transition-all"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-red-500/20 border border-red-500/30 text-red-300 font-bold py-3 rounded-lg hover:bg-red-500/30 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
