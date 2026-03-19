// ─────────────────────────────────────────────────────────────
// offscreenCanvasRenderer.ts — Optimize canvas rendering with offscreen canvas
// ─────────────────────────────────────────────────────────────
'use client';

/**
 * Configuration for offscreen rendering
 */
export interface OffscreenCanvasConfig {
  width: number;
  height: number;
  targetFPS: number;
}

/**
 * Wrapper for offscreen canvas rendering
 * Supports both OffscreenCanvas (worker) and HTMLCanvas (main thread)
 */
export class OffscreenCanvasRenderer {
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private config: OffscreenCanvasConfig;
  private lastFrameTime = 0;
  private frameDelay: number;
  private frameCount = 0;
  private fps = 0;

  constructor(
    canvas: OffscreenCanvas | HTMLCanvasElement,
    config: OffscreenCanvasConfig
  ) {
    this.canvas = canvas;
    this.config = config;
    this.frameDelay = 1000 / config.targetFPS; // Time between frames in ms

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    this.ctx = ctx as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  }

  /**
   * Draw image at specific position
   */
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void {
    this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  /**
   * Draw rectangle
   */
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    fillStyle?: string,
    strokeStyle?: string,
    lineWidth?: number
  ): void {
    if (fillStyle) {
      this.ctx.fillStyle = fillStyle;
      this.ctx.fillRect(x, y, width, height);
    }
    if (strokeStyle) {
      this.ctx.strokeStyle = strokeStyle;
      if (lineWidth) this.ctx.lineWidth = lineWidth;
      this.ctx.strokeRect(x, y, width, height);
    }
  }

  /**
   * Draw text
   */
  drawText(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    fontFamily: string,
    fillStyle: string,
    align: CanvasTextAlign = 'left'
  ): void {
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.fillStyle = fillStyle;
    this.ctx.textAlign = align;
    this.ctx.fillText(text, x, y);
  }

  /**
   * Clear canvas
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Fill canvas with color
   */
  fill(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Check if should render frame (frame rate limiting)
   */
  shouldRender(): boolean {
    const now = performance.now();
    if (now - this.lastFrameTime >= this.frameDelay) {
      this.lastFrameTime = now;
      this.frameCount++;
      return true;
    }
    return false;
  }

  /**
   * Get canvas stream for recording
   */
  captureStream(frameRate: number): MediaStream {
    if (this.canvas instanceof HTMLCanvasElement) {
      return this.canvas.captureStream(frameRate);
    } else {
      // OffscreenCanvas doesn't have captureStream directly
      // Return a placeholder - in practice, you'd need to transfer frames differently
      throw new Error('OffscreenCanvas.captureStream() not supported in worker');
    }
  }

  /**
   * Convert to ImageData for analysis
   */
  getImageData(x: number, y: number, width: number, height: number): ImageData {
    return this.ctx.getImageData(x, y, width, height);
  }

  /**
   * Get current frame rate
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * Update FPS counter (call periodically)
   */
  updateFPSCounter(currentTime: number): void {
    // Implementation would update fps based on frameCount and elapsed time
  }

  /**
   * Get canvas as blob for export
   */
  async toBlob(type = 'image/png', quality = 0.92): Promise<Blob> {
    if (this.canvas instanceof HTMLCanvasElement) {
      return new Promise((resolve, reject) => {
        this.canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to convert canvas to blob'));
          },
          type,
          quality
        );
      });
    } else {
      // OffscreenCanvas.convertToBlob()
      return (this.canvas as any).convertToBlob({ type, quality });
    }
  }

  /**
   * Get underlying canvas
   */
  getCanvas(): OffscreenCanvas | HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.config.width = width;
    this.config.height = height;
  }
}

/**
 * Utility for creating offscreen canvas in worker
 */
export function createOffscreenCanvas(width: number, height: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  return canvas;
}

/**
 * Rendering pipeline with frame rate control
 */
export class RenderingPipeline {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private renderer: OffscreenCanvasRenderer;
  private animationFrameId: number | null = null;
  private targetFPS: number;
  private frameQueue: Array<() => void> = [];

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    targetFPS: number
  ) {
    this.canvas = canvas;
    this.targetFPS = targetFPS;
    this.renderer = new OffscreenCanvasRenderer(canvas, {
      width: canvas.width,
      height: canvas.height,
      targetFPS,
    });
  }

  /**
   * Queue a draw operation
   */
  queue(drawFn: () => void): void {
    this.frameQueue.push(drawFn);
  }

  /**
   * Start rendering loop
   */
  start(onFrame?: (frameNumber: number) => void): void {
    let frameNumber = 0;
    const frameInterval = 1000 / this.targetFPS;
    let lastFrameTime = performance.now();

    const render = () => {
      const now = performance.now();

      if (now - lastFrameTime >= frameInterval) {
        this.renderer.clear();

        // Process queued operations
        while (this.frameQueue.length > 0) {
          const drawFn = this.frameQueue.shift();
          if (drawFn) drawFn();
        }

        frameNumber++;
        if (onFrame) onFrame(frameNumber);
        lastFrameTime = now;
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  /**
   * Stop rendering loop
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.frameQueue = [];
  }

  /**
   * Get renderer instance
   */
  getRenderer(): OffscreenCanvasRenderer {
    return this.renderer;
  }
}

/**
 * Frame buffer for decoupling capture from rendering
 */
export class FrameBuffer {
  private buffer: Blob[] = [];
  private maxSize: number;

  constructor(maxFrames: number = 300) {
    // Default ~10 seconds at 30fps
    this.maxSize = maxFrames;
  }

  /**
   * Add frame to buffer
   */
  addFrame(frameData: Blob): void {
    this.buffer.push(frameData);

    // Keep buffer size limited
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  /**
   * Get buffer size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Get frames range
   */
  getFrames(start: number = 0, length?: number): Blob[] {
    if (length === undefined) {
      return this.buffer.slice(start);
    }
    return this.buffer.slice(start, start + length);
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get total size in bytes
   */
  getTotalBytes(): number {
    return this.buffer.reduce((sum, blob) => sum + blob.size, 0);
  }
}
