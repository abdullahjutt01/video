// ─────────────────────────────────────────────────────────────
// ExportModalOptimized.tsx — Enhanced export with all optimizations
// ─────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { useFFmpegOptimized } from '@/hooks/useFFmpegOptimized';
import { usePerformanceMonitor, formatBytes, formatDuration } from '@/hooks/usePerformanceMonitor';
import {
  MemoryMonitor,
  URLManager,
  AudioNodeTracker,
  MediaElementTracker,
  MediaRecorderTracker,
  CleanupManager,
  ExportState,
} from '@/utils/memoryUtils';

interface Props {
  onClose: () => void;
}

type ExportQuality = 'draft' | 'high' | '4k';

const QUALITY_OPTS: { key: ExportQuality; label: string; desc: string; plan: string }[] = [
  { key: 'draft', label: '720p Draft', desc: 'Fast preview, H.264, 30FPS', plan: 'FREE' },
  { key: 'high', label: '1080p High', desc: 'No watermark, H.264 High, 30FPS', plan: 'PRO' },
  { key: '4k', label: '4K Ultra', desc: 'Professional H.264 4K, 24FPS', plan: 'PRO' },
];

export default function ExportModalOptimized({ onClose }: Props) {
  // Navigation & state management
  const { settings, duration, tracks, canvasRef, audioStream, setIsPlaying, setCurrentTime } =
    useEditorStore();
  const { load: loadFFmpeg, transcodeWithWorker, progress: encodeProgress, memoryUsage } =
    useFFmpegOptimized();
  const { startExport, startPhase, endPhase, recordingComplete, transcodingComplete, getReport } =
    usePerformanceMonitor();

  // State
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4');
  const [status, setStatus] = useState<ExportState>(ExportState.IDLE);
  const [recordProgress, setRecordProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState('');

  // Resource tracking
  const urlManagerRef = useRef(new URLManager());
  const audioTrackerRef = useRef(new AudioNodeTracker());
  const mediaTrackerRef = useRef(new MediaElementTracker());
  const recorderTrackerRef = useRef(new MediaRecorderTracker());

  const totalClips = tracks.reduce((n, t) => n + t.clips.length, 0);

  // Auto-reset when modal opens
  useEffect(() => {
    return () => {
      setIsPlaying(false);
    };
  }, [setIsPlaying]);

  /**
   * Get quality settings
   */
  const getQualitySettings = () => {
    const fpsMap = { draft: 30, high: 30, '4k': 24 };
    const bitrateMap = { draft: '2.5M', high: '6M', '4k': '12M' };

    return {
      fps: fpsMap[quality],
      videoBitrate: bitrateMap[quality],
      resolution: quality === '4k' ? 4 : quality === 'high' ? 2 : 1,
    };
  };

  /**
   * Handle export with optimizations
   */
  const handleExport = async () => {
    if (totalClips === 0 || !canvasRef || !audioStream) {
      alert('Please ensure media is loaded correctly before exporting.');
      return;
    }

    // Initialize export
    startExport();
    setStatus(ExportState.LOADING_ENGINE);
    MemoryMonitor.checkMemory('Export start');

    try {
      // Step 1: Load FFmpeg
      startPhase('FFmpeg Engine Load');
      await loadFFmpeg();
      endPhase();

      // Step 2: Recording setup
      setStatus(ExportState.RECORDING);
      setRecordProgress(0);
      setCurrentTime(0);

      const qualitySettings = getQualitySettings();

      // Create media stream with optimized recording params
      const stream = new MediaStream([
        ...canvasRef.captureStream(qualitySettings.fps).getTracks(),
        ...audioStream.getTracks(),
      ]);

      // Setup recorder with optimized codec
      startPhase('Recording');
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: quality === '4k' ? 20000000 : 15000000,
        audioBitsPerSecond: 128000,
      });

      recorderTrackerRef.current.register(recorder);

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        chunks.push(e.data);
        MemoryMonitor.checkMemory(`Recording [${chunks.length} chunks]`);
      };

      // Track final WebM blob
      let webmBlob: Blob | null = null;

      recorder.onstop = async () => {
        try {
          webmBlob = new Blob(chunks, { type: 'video/webm' });
          recordingComplete(duration, webmBlob);

          // Step 3: Transcoding
          setStatus(ExportState.TRANSCODING);
          startPhase('Transcoding to H.264/MP4');

          const webmFile = new File(
            [webmBlob],
            'input.webm',
            { type: 'video/webm' }
          );

          const outputName = `${settings.name || 'exported-video'}.mp4`;
          const videoBitrate = getQualitySettings().videoBitrate;

          // Transcode using optimized worker
          const mp4Data = await transcodeWithWorker(webmFile, outputName, [
            '-c:v', 'libx264',
            '-preset', 'superfast', // GPU-friendly
            '-crf', '22',
            '-pix_fmt', 'yuv420p',
            '-b:v', videoBitrate,
            '-maxrate', videoBitrate,
            '-bufsize', (parseInt(videoBitrate) / 2) + 'k',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', 'faststart+frag_keyframe',
            '-frag_duration', '2000000', // 2-second fragments
          ]);

          if (mp4Data) {
            const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' });
            transcodingComplete(duration, mp4Blob);

            const downloadUrl = urlManagerRef.current.create(mp4Blob);
            setDownloadUrl(downloadUrl);
            setStatus(ExportState.DONE);

            // Generate and show report
            const summary = getReport();
            setReport(summary);
            setShowReport(true);
          } else {
            throw new Error('Transcoding failed');
          }
        } catch (error) {
          console.error('Export error:', error);
          setStatus(ExportState.ERROR);
        } finally {
          // Cleanup resources
          endPhase();
          setIsPlaying(false);
          await cleanup();
        }
      };

      // Start recording
      recorder.start();
      setIsPlaying(true);

      // Monitor progress
      const checkProgress = setInterval(() => {
        const state = useEditorStore.getState();
        const p = Math.min(100, Math.round((state.currentTime / duration) * 100));
        setRecordProgress(p);

        if (state.currentTime >= duration) {
          clearInterval(checkProgress);
          recorder.stop();
          setIsPlaying(false);
        }
      }, 500); // Less frequent checking for better performance
    } catch (error) {
      console.error('Export initialization error:', error);
      setStatus(ExportState.ERROR);
      await cleanup();
    }
  };

  /**
   * Cleanup all resources
   */
  const cleanup = async () => {
    console.log('🧹 Cleaning up export resources...');
    setStatus(ExportState.CLEANUP);

    CleanupManager.releaseAll(
      urlManagerRef.current,
      audioTrackerRef.current,
      mediaTrackerRef.current,
      recorderTrackerRef.current,
      audioStream
    );
  };

  /**
   * Download exported file
   */
  const downloadFile = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${settings.name || 'exported-video'}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /**
   * Close modal with cleanup
   */
  const handleClose = async () => {
    if (status === ExportState.RECORDING || status === ExportState.TRANSCODING) {
      if (!confirm('Export in progress. Cancel?')) return;
      await cleanup();
    }
    setShowReport(false);
    onClose();
  };

  // Render UI
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          status !== ExportState.RECORDING &&
          status !== ExportState.TRANSCODING
        ) {
          handleClose();
        }
      }}
    >
      <div className="bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-slide-up relative overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Background glow for progress */}
        {(status === ExportState.RECORDING || status === ExportState.TRANSCODING) && (
          <div className="absolute inset-0 bg-indigo-500/5 animate-pulse-slow pointer-events-none" />
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-100 mb-1">🎬 Production Export</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              Optimized for Performance
            </p>
          </div>
          {status !== ExportState.RECORDING && status !== ExportState.TRANSCODING && (
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Project Info */}
        {status === ExportState.IDLE && (
          <>
            <div className="flex items-center gap-4 bg-black/40 rounded-2xl p-4 mb-6 border border-white/5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl">
                📽️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200 truncate">{settings.name}</p>
                <p className="text-[10px] text-slate-500">
                  {settings.resolution.width}x{settings.resolution.height} • {formatDuration(duration)} •{' '}
                  {settings.fps} FPS
                </p>
              </div>
            </div>

            {/* Quality Selection */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-400 mb-3 uppercase tracking-wide">
                Export Quality
              </label>
              <div className="grid grid-cols-3 gap-3">
                {QUALITY_OPTS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setQuality(opt.key)}
                    className={`p-3 rounded-xl transition-all border text-left ${
                      quality === opt.key
                        ? 'border-indigo-500 bg-indigo-500/20 shadow-lg shadow-indigo-500/30'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-200">{opt.label}</p>
                    <p className="text-[10px] text-slate-500">{opt.desc}</p>
                    <p className="text-[9px] text-indigo-400 mt-1">{opt.plan}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Memory Info */}
            {memoryUsage && (
              <div className="bg-black/40 rounded-2xl p-4 mb-6 border border-white/5">
                <p className="text-xs font-bold text-slate-400 mb-2">Memory Usage</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-200">
                      {(memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {memoryUsage.percentage.toFixed(0)}% of heap
                    </p>
                  </div>
                  {memoryUsage.percentage > 80 && (
                    <span className="text-xs text-yellow-500 font-bold">⚠️ HIGH</span>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleExport}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              🚀 Start Export
            </button>
          </>
        )}

        {/* Recording Progress */}
        {status === ExportState.RECORDING && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-bold text-slate-200 mb-3">Recording Video...</p>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/20">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
                  style={{ width: `${recordProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">{recordProgress}% complete</p>
            </div>
            <div className="bg-black/40 rounded-lg p-3 border border-white/5">
              <p className="text-[10px] text-slate-400">
                Rendering in progress... • Keep tab active for best performance
              </p>
            </div>
          </div>
        )}

        {/* Transcoding Progress */}
        {status === ExportState.TRANSCODING && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-bold text-slate-200 mb-3">Transcoding to H.264/MP4...</p>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/20">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
                  style={{ width: `${encodeProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">{encodeProgress}% complete</p>
            </div>
            <div className="bg-black/40 rounded-lg p-3 border border-white/5">
              <p className="text-[10px] text-slate-400">
                Running in background worker • Main thread remains responsive
              </p>
            </div>
          </div>
        )}

        {/* Success & Download */}
        {status === ExportState.DONE && (
          <div className="space-y-6">
            <div className="bg-green-500/20 border border-green-500/50 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm font-bold text-green-300">Export Complete!</p>
            </div>

            {downloadUrl && (
              <button
                onClick={downloadFile}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold py-3 px-4 rounded-xl transition-all"
              >
                ⬇️ Download {settings.name || 'video'}.mp4
              </button>
            )}

            {!showReport && (
              <button
                onClick={() => setShowReport(true)}
                className="w-full bg-white/10 hover:bg-white/20 text-slate-300 font-bold py-3 px-4 rounded-xl transition-all border border-white/20"
              >
                📊 View Performance Report
              </button>
            )}

            {showReport && (
              <div className="bg-black/40 rounded-2xl p-4 border border-white/10 max-h-64 overflow-y-auto">
                <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap break-words">
                  {report}
                </pre>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 px-4 rounded-xl transition-all border border-white/10"
            >
              Close
            </button>
          </div>
        )}

        {/* Error State */}
        {status === ExportState.ERROR && (
          <div className="space-y-4">
            <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-2">❌</p>
              <p className="text-sm font-bold text-red-300">Export Failed</p>
              <p className="text-[10px] text-red-200 mt-2">Check console for details</p>
            </div>
            <button
              onClick={handleClose}
              className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 px-4 rounded-xl transition-all border border-white/10"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
