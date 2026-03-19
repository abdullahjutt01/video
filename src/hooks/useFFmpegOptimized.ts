// ─────────────────────────────────────────────────────────────
// useFFmpegOptimized.ts — Enhanced FFmpeg hook with Web Worker & cleanup
// ─────────────────────────────────────────────────────────────
'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { MemoryMonitor, URLManager } from '@/utils/memoryUtils';

interface FFmpegHook {
  isLoaded: boolean;
  isLoading: boolean;
  progress: number;
  load: () => Promise<void>;
  transcode: (inputFile: File, outputName: string, options?: string[]) => Promise<Uint8Array | null>;
  transcodeWithWorker: (
    inputFile: File,
    outputName: string,
    options?: string[]
  ) => Promise<Uint8Array | null>;
  extractFrame: (inputFile: File, atSec: number) => Promise<Blob | null>;
  cleanup: () => void;
  memoryUsage: { usedJSHeapSize: number; percentage: number } | null;
  error: string | null;
}

let ffmpegSingleton: any = null;
let ffmpegFetchFile: any = null;
const workerPool: Worker[] = [];
const MAX_WORKERS = 1; // Use single worker for sequential transcodes

/**
 * Create or reuse a Web Worker
 */
function getOrCreateWorker(): Worker {
  if (workerPool.length < MAX_WORKERS) {
    // Create new worker
    try {
      const worker = new Worker('/exportWorker.js', { type: 'module' });
      workerPool.push(worker);
      return worker;
    } catch (e) {
      console.warn('Failed to create worker, falling back to main thread:', e);
      return null as any;
    }
  }
  return workerPool[0];
}

/**
 * Terminate all workers
 */
function terminateWorkers(): void {
  workerPool.forEach((w) => {
    try {
      w.terminate();
    } catch (e) {
      console.error('Failed to terminate worker:', e);
    }
  });
  workerPool.length = 0;
}

/**
 * Optimized FFmpeg hook with memory management
 */
export function useFFmpegOptimized(): FFmpegHook {
  const ffmpegRef = useRef<unknown>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [memoryUsage, setMemoryUsage] = useState(
    MemoryMonitor.getMemoryUsage()
  );
  const urlManagerRef = useRef(new URLManager());

  // Monitor memory periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const mem = MemoryMonitor.getMemoryUsage();
      setMemoryUsage(mem);
      MemoryMonitor.checkMemory('FFmpeg processing');
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    if (isLoaded || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      // Reuse singleton if available
      if (ffmpegSingleton) {
        ffmpegRef.current = { ffmpeg: ffmpegSingleton, fetchFile: ffmpegFetchFile };
        setIsLoaded(true);
        return;
      }

      // Dynamic import
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();

      ffmpeg.on('progress', ({ progress: p }: { progress: number }) => {
        setProgress(Math.round(p * 100));
      });

      // Load WASM from CDN
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      // Store singleton
      ffmpegSingleton = ffmpeg;
      ffmpegFetchFile = fetchFile;
      ffmpegRef.current = { ffmpeg, fetchFile };
      setIsLoaded(true);

      console.log('✅ FFmpeg loaded successfully');
      MemoryMonitor.checkMemory('After FFmpeg load');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load FFmpeg.wasm';
      setError(msg);
      console.error('FFmpeg load error:', msg);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isLoading]);

  /**
   * Transcode on main thread (for compatibility)
   */
  const transcode = useCallback(
    async (
      inputFile: File,
      outputName: string,
      options: string[] = ['-c:v', 'libx264', '-crf', '28', '-preset', 'fast']
    ): Promise<Uint8Array | null> => {
      if (!ffmpegRef.current) {
        setError('FFmpeg not loaded');
        return null;
      }

      const { ffmpeg, fetchFile } = ffmpegRef.current as {
        ffmpeg: { writeFile: Function; exec: Function; readFile: Function; deleteFile?: Function };
        fetchFile: Function;
      };

      try {
        setProgress(0);
        const inputName = 'input.' + inputFile.name.split('.').pop();

        // Check memory before processing
        MemoryMonitor.checkMemory(`Transcode: ${inputFile.name}`);

        // Write input
        await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

        // Execute transcode
        await ffmpeg.exec(['-i', inputName, ...options, outputName]);

        // Read output
        const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

        // Cleanup intermediate files
        try {
          if (ffmpeg.deleteFile) {
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);
          }
        } catch (e) {
          console.warn('Cleanup error:', e);
        }

        setProgress(100);
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Transcode failed';
        setError(msg);
        console.error('Transcode error:', msg);
        return null;
      }
    },
    []
  );

  /**
   * Transcode using Web Worker (non-blocking)
   */
  const transcodeWithWorker = useCallback(
    async (
      inputFile: File,
      outputName: string,
      options: string[] = ['-c:v', 'libx264', '-crf', '22', '-preset', 'superfast']
    ): Promise<Uint8Array | null> => {
      const worker = getOrCreateWorker();
      if (!worker) {
        console.log('Worker unavailable, using main thread');
        return transcode(inputFile, outputName, options);
      }

      return new Promise((resolve) => {
        try {
          setProgress(0);

          // Read file as ArrayBuffer
          const reader = new FileReader();
          reader.onload = (e) => {
            const inputBuffer = e.target?.result as ArrayBuffer;

            const messageHandler = (event: MessageEvent) => {
              const { type, progress: p, success, data, error: err } = event.data;

              if (type === 'progress') {
                setProgress(Math.round(p));
              } else if (type === 'transcodeComplete') {
                if (success) {
                  setProgress(100);
                  const uint8Array = new Uint8Array(data);
                  worker.removeEventListener('message', messageHandler);
                  resolve(uint8Array);
                } else {
                  setError(err || 'Transcode failed');
                  worker.removeEventListener('message', messageHandler);
                  resolve(null);
                }
              } else if (type === 'error') {
                setError(err);
                worker.removeEventListener('message', messageHandler);
                resolve(null);
              }
            };

            worker.addEventListener('message', messageHandler);

            // Send transcode job
            worker.postMessage(
              {
                type: 'transcode',
                inputData: inputBuffer,
                inputName: 'input.' + inputFile.name.split('.').pop(),
                outputName,
                options,
              },
              [inputBuffer] // Transfer ownership
            );
          };
          reader.readAsArrayBuffer(inputFile);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Worker transcode failed';
          setError(msg);
          resolve(null);
        }
      });
    },
    [transcode]
  );

  /**
   * Extract frame at timestamp
   */
  const extractFrame = useCallback(
    async (inputFile: File, atSec: number): Promise<Blob | null> => {
      if (!ffmpegRef.current) {
        setError('FFmpeg not loaded');
        return null;
      }

      const { ffmpeg, fetchFile } = ffmpegRef.current as {
        ffmpeg: { writeFile: Function; exec: Function; readFile: Function; deleteFile?: Function };
        fetchFile: Function;
      };

      try {
        const inputName = 'frame_input.' + inputFile.name.split('.').pop();
        await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
        await ffmpeg.exec([
          '-ss',
          String(atSec),
          '-i',
          inputName,
          '-frames:v',
          '1',
          '-q:v',
          '2',
          'frame.jpg',
        ]);

        const data = (await ffmpeg.readFile('frame.jpg')) as Uint8Array;
        const blob = new Blob([data], { type: 'image/jpeg' });

        // Cleanup
        try {
          if (ffmpeg.deleteFile) {
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile('frame.jpg');
          }
        } catch (e) {
          console.warn('Cleanup error:', e);
        }

        return blob;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Frame extraction failed';
        setError(msg);
        return null;
      }
    },
    []
  );

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up FFmpeg resources...');

    // Stop all workers
    if (workerPool.length > 0) {
      console.log(`  - Terminating ${workerPool.length} worker(s)`);
      terminateWorkers();
    }

    // Keep FFmpeg singleton but reset progress
    setProgress(0);
    setError(null);

    // Revoke URLs
    if (urlManagerRef.current.count() > 0) {
      console.log(`  - Revoking ${urlManagerRef.current.count()} object URLs`);
      urlManagerRef.current.revokeAll();
    }

    const memory = MemoryMonitor.getMemoryUsage();
    if (memory) {
      console.log(`  - Memory after cleanup: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isLoaded,
    isLoading,
    progress,
    load,
    transcode,
    transcodeWithWorker,
    extractFrame,
    cleanup,
    memoryUsage,
    error,
  };
}
