// ─────────────────────────────────────────────────────────────
// memoryUtils.ts — Detect and prevent memory leaks during export
// ─────────────────────────────────────────────────────────────
'use client';

/**
 * Memory threshold configuration
 */
export const MEMORY_THRESHOLDS = {
  WARNING: 100 * 1024 * 1024, // 100MB
  CRITICAL: 250 * 1024 * 1024, // 250MB
  MAX_ALLOWED: 400 * 1024 * 1024, // 400MB
};

/**
 * Track memory usage and log warnings
 */
export class MemoryMonitor {
  private static lastWarning = 0;
  private static warningCooldown = 5000; // 5 second cooldown

  /**
   * Get current estimated memory usage
   */
  static getMemoryUsage(): {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    percentage: number;
  } | null {
    if (!performance.memory) {
      console.warn('performance.memory not available (requires --enable-precise-memory-info flag)');
      return null;
    }

    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
    const percentage = (usedJSHeapSize / jsHeapSizeLimit) * 100;

    return {
      usedJSHeapSize,
      totalJSHeapSize,
      jsHeapSizeLimit,
      percentage,
    };
  }

  /**
   * Check memory usage and warn if exceeds thresholds
   */
  static checkMemory(label?: string): boolean {
    const memory = this.getMemoryUsage();
    if (!memory) return true;

    const now = Date.now();
    if (memory.usedJSHeapSize > MEMORY_THRESHOLDS.WARNING) {
      if (now - this.lastWarning > this.warningCooldown) {
        const mb = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
        const warning =
          memory.usedJSHeapSize > MEMORY_THRESHOLDS.CRITICAL
            ? `🚨 CRITICAL memory: ${mb}MB`
            : `⚠️ HIGH memory: ${mb}MB`;
        console.warn(`${warning} ${label ? `[${label}]` : ''}`);
        this.lastWarning = now;
      }
    }

    return memory.usedJSHeapSize < MEMORY_THRESHOLDS.MAX_ALLOWED;
  }

  /**
   * Force garbage collection (if available)
   */
  static async forceGC(): Promise<boolean> {
    if (!globalThis.gc) {
      console.warn('GC not available. Run with --expose-gc flag');
      return false;
    }
    try {
      globalThis.gc();
      // Small delay to let GC complete
      await new Promise((r) => setTimeout(r, 100));
      return true;
    } catch (e) {
      console.error('GC failed:', e);
      return false;
    }
  }
}

/**
 * Safely revoke object URLs and prevent leaks
 */
export class URLManager {
  private urls = new Set<string>();

  create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }

  revoke(url: string): void {
    if (this.urls.has(url)) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);
    }
  }

  /**
   * Cleanup all URLs
   */
  revokeAll(): void {
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls.clear();
  }

  /**
   * Get count of active URLs
   */
  count(): number {
    return this.urls.size;
  }
}

/**
 * Track and cleanup Web Audio nodes
 */
export class AudioNodeTracker {
  private nodes: AudioNode[] = [];

  registerNode(node: AudioNode): void {
    this.nodes.push(node);
  }

  /**
   * Disconnect all nodes safely
   */
  disconnectAll(): void {
    this.nodes.forEach((node) => {
      try {
        if (node.disconnect) {
          node.disconnect();
        }
      } catch (e) {
        console.error('Failed to disconnect audio node:', e);
      }
    });
    this.nodes = [];
  }

  count(): number {
    return this.nodes.length;
  }
}

/**
 * Track and cleanup HTMLMediaElements
 */
export class MediaElementTracker {
  private elements = new Map<string, HTMLMediaElement>();

  register(id: string, element: HTMLMediaElement): void {
    this.elements.set(id, element);
  }

  unregister(id: string): void {
    const element = this.elements.get(id);
    if (element) {
      this.cleanup(element);
      this.elements.delete(id);
    }
  }

  /**
   * Cleanup a single element
   */
  private cleanup(element: HTMLMediaElement): void {
    try {
      // Stop playback
      element.pause();
      element.currentTime = 0;

      // Remove src
      element.src = '';
      element.srcset = '';

      // Remove all source children
      for (const source of Array.from(element.querySelectorAll('source'))) {
        source.remove();
      }

      // Reset state
      element.load?.();
    } catch (e) {
      console.error('Failed to cleanup media element:', e);
    }
  }

  /**
   * Cleanup all elements
   */
  cleanupAll(): void {
    this.elements.forEach((element) => this.cleanup(element));
    this.elements.clear();
  }

  count(): number {
    return this.elements.size;
  }
}

/**
 * Track MediaRecorder instances
 */
export class MediaRecorderTracker {
  private recorders: MediaRecorder[] = [];

  register(recorder: MediaRecorder): void {
    this.recorders.push(recorder);
  }

  /**
   * Stop and cleanup all recorders
   */
  stopAll(): void {
    this.recorders.forEach((recorder) => {
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch (e) {
        console.error('Failed to stop recorder:', e);
      }
    });
    this.recorders = [];
  }

  count(): number {
    return this.recorders.length;
  }
}

/**
 * Cleanup utilities
 */
export const CleanupManager = {
  /**
   * Stop media stream tracks
   */
  stopStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        console.error('Failed to stop track:', e);
      }
    });
  },

  /**
   * Cleanup canvas context
   */
  clearCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): void {
    try {
      const ctx =
        canvas instanceof HTMLCanvasElement
          ? canvas.getContext('2d')
          : (canvas as any).getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (e) {
      console.error('Failed to clear canvas:', e);
    }
  },

  /**
   * Release all resources
   */
  releaseAll(
    urlManager: URLManager,
    audioTracker: AudioNodeTracker,
    mediaTracker: MediaElementTracker,
    recorderTracker: MediaRecorderTracker,
    mediaStream?: MediaStream
  ): void {
    console.log('🧹 Releasing resources...');

    if (recorderTracker.count() > 0) {
      console.log(`  - Stopping ${recorderTracker.count()} MediaRecorders`);
      recorderTracker.stopAll();
    }

    if (mediaTracker.count() > 0) {
      console.log(`  - Cleaning up ${mediaTracker.count()} media elements`);
      mediaTracker.cleanupAll();
    }

    if (audioTracker.count() > 0) {
      console.log(`  - Disconnecting ${audioTracker.count()} audio nodes`);
      audioTracker.disconnectAll();
    }

    if (mediaStream) {
      console.log('  - Stopping media stream');
      this.stopStream(mediaStream);
    }

    if (urlManager.count() > 0) {
      console.log(`  - Revoking ${urlManager.count()} object URLs`);
      urlManager.revokeAll();
    }

    const memory = MemoryMonitor.getMemoryUsage();
    if (memory) {
      console.log(
        `  - Memory after cleanup: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`
      );
    }
  },
};

/**
 * Error recovery and state machine
 */
export enum ExportState {
  IDLE = 'idle',
  LOADING_ENGINE = 'loading_engine',
  RECORDING = 'recording',
  TRANSCODING = 'transcoding',
  DONE = 'done',
  ERROR = 'error',
  CLEANUP = 'cleanup',
}

export interface ExportCheckpoint {
  state: ExportState;
  progress: number;
  timestamp: number;
  webmBlob?: Blob;
  error?: string;
}
