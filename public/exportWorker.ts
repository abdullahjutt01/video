// ─────────────────────────────────────────────────────────────
// exportWorker.ts — Web Worker for background FFmpeg transcoding
// ─────────────────────────────────────────────────────────────
// This worker handles FFmpeg transcoding in a background thread
// to prevent UI blocking during export

interface TranscodeMessage {
  type: 'transcode';
  inputData: ArrayBuffer;
  inputName: string;
  outputName: string;
  options: string[];
}

interface LoadMessage {
  type: 'load';
}

let FFmpeg: any = null;
let fetchFile: any = null;
let ffmpeg: any = null;
let isInitialized = false;

/**
 * Initialize FFmpeg in the worker (runs once per worker lifetime)
 */
async function initFFmpeg() {
  if (isInitialized) return;

  try {
    const { FFmpeg: FFmpegModule } = await import('@ffmpeg/ffmpeg');
    const { fetchFile: fetchFileModule, toBlobURL } = await import('@ffmpeg/util');

    FFmpeg = FFmpegModule;
    fetchFile = fetchFileModule;

    ffmpeg = new FFmpeg();

    // Progress callback
    ffmpeg.on('progress', ({ progress: p }: { progress: number }) => {
      if (self) {
        self.postMessage({
          type: 'progress',
          progress: Math.round(p * 100),
        });
      }
    });

    // Load WASM from CDN
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    isInitialized = true;
    self.postMessage({ type: 'initialized', success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initialize FFmpeg';
    self.postMessage({
      type: 'error',
      error: message,
    });
  }
}

/**
 * Transcode video in background
 */
async function performTranscode(
  inputData: ArrayBuffer,
  inputName: string,
  outputName: string,
  options: string[]
) {
  if (!ffmpeg) {
    self.postMessage({
      type: 'error',
      error: 'FFmpeg not initialized',
    });
    return;
  }

  try {
    // Write input file to FFmpeg's virtual filesystem
    const uint8Array = new Uint8Array(inputData);
    await ffmpeg.writeFile(inputName, uint8Array);

    // Execute transcode command
    await ffmpeg.exec(['-i', inputName, ...options, outputName]);

    // Read output file
    const outputData = await ffmpeg.readFile(outputName);

    // Clean up files
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (e) {
      // Ignore cleanup errors
    }

    // Send result back to main thread
    self.postMessage(
      {
        type: 'transcodeComplete',
        success: true,
        data: outputData.buffer, // Transfer as ArrayBuffer
      },
      [outputData.buffer] // Transfer ownership
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcode failed';
    self.postMessage({
      type: 'error',
      error: message,
    });
  }
}

/**
 * Message handler for worker
 */
self.onmessage = async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === 'load') {
    await initFFmpeg();
  } else if (type === 'transcode') {
    const { inputData, inputName, outputName, options } = event.data as TranscodeMessage;
    await performTranscode(inputData, inputName, outputName, options);
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
