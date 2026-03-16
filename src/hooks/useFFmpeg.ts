// ─────────────────────────────────────────────────────────────
// useFFmpeg.ts — FFmpeg.wasm hook for browser-side proxy encode
// ─────────────────────────────────────────────────────────────
'use client';

import { useRef, useState, useCallback } from 'react';

interface FFmpegHook {
  isLoaded: boolean;
  isLoading: boolean;
  progress: number;
  load: () => Promise<void>;
  transcode: (inputFile: File, outputName: string, options?: string[]) => Promise<Uint8Array | null>;
  extractFrame: (inputFile: File, atSec: number) => Promise<Blob | null>;
  error: string | null;
}

/**
 * Lazy-loads FFmpeg.wasm on first use.
 * Uses a singleton pattern so WASM is only downloaded once.
 *
 * Production usage:
 *   const { load, transcode, isLoaded } = useFFmpeg();
 *   await load();            // Downloads ~30MB WASM binary
 *   const out = await transcode(file, 'output.mp4', ['-c:v', 'libx264', '-crf', '28']);
 */
export function useFFmpeg(): FFmpegHook {
  const ffmpegRef = useRef<unknown>(null);
  const [isLoaded, setIsLoaded]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isLoaded || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      // Dynamic import so it's not bundled on SSR
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();

      // Progress callback
      ffmpeg.on('progress', ({ progress: p }: { progress: number }) => {
        setProgress(Math.round(p * 100));
      });

      // Load WASM from CDN (or serve locally for production)
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      ffmpegRef.current = { ffmpeg, fetchFile };
      setIsLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load FFmpeg.wasm');
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isLoading]);

  const transcode = useCallback(async (
    inputFile: File,
    outputName: string,
    options: string[] = ['-c:v', 'libx264', '-crf', '28', '-preset', 'fast']
  ): Promise<Uint8Array | null> => {
    if (!ffmpegRef.current) { setError('FFmpeg not loaded'); return null; }
    const { ffmpeg, fetchFile } = ffmpegRef.current as { ffmpeg: { writeFile: Function; exec: Function; readFile: Function }; fetchFile: Function };

    try {
      const inputName = 'input.' + inputFile.name.split('.').pop();
      await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
      await ffmpeg.exec(['-i', inputName, ...options, outputName]);
      const data = await ffmpeg.readFile(outputName) as Uint8Array;
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcode failed');
      return null;
    }
  }, []);

  const extractFrame = useCallback(async (
    inputFile: File,
    atSec: number
  ): Promise<Blob | null> => {
    if (!ffmpegRef.current) { setError('FFmpeg not loaded'); return null; }
    const { ffmpeg, fetchFile } = ffmpegRef.current as { ffmpeg: { writeFile: Function; exec: Function; readFile: Function }; fetchFile: Function };

    try {
      const inputName = 'frame_input.' + inputFile.name.split('.').pop();
      await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
      await ffmpeg.exec([
        '-ss', String(atSec),
        '-i', inputName,
        '-frames:v', '1',
        '-q:v', '2',
        'frame.jpg',
      ]);
      const data = await ffmpeg.readFile('frame.jpg') as Uint8Array;
      return new Blob([data], { type: 'image/jpeg' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Frame extraction failed');
      return null;
    }
  }, []);

  return { isLoaded, isLoading, progress, load, transcode, extractFrame, error };
}
