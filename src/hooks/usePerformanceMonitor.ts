// ─────────────────────────────────────────────────────────────
// usePerformanceMonitor.ts — Track export performance metrics
// ─────────────────────────────────────────────────────────────
'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

export interface PerformanceMetrics {
  recordingDuration: number; // seconds
  transcodeDuration: number; // seconds
  totalDuration: number; // seconds
  inputSize: number; // bytes
  outputSize: number; // bytes
  fps: number;
  bitrate: string; // e.g., "8.5 Mbps"
  compression: number; // output/input ratio
  peakMemory: number; // bytes
  averageMemory: number; // bytes
}

export interface PerformancePhase {
  name: string;
  startTime: number;
  endTime?: number;
  duration: number;
  memoryStart: number;
  memoryEnd?: number;
  memoryDelta: number;
}

/**
 * Monitor and optimize export performance
 */
export function usePerformanceMonitor() {
  const metricsRef = useRef<PerformanceMetrics>({
    recordingDuration: 0,
    transcodeDuration: 0,
    totalDuration: 0,
    inputSize: 0,
    outputSize: 0,
    fps: 30,
    bitrate: '0 Mbps',
    compression: 0,
    peakMemory: 0,
    averageMemory: 0,
  });

  const phasesRef = useRef<PerformancePhase[]>([]);
  const phaseStartRef = useRef<{ name: string; time: number; memory: number } | null>(null);
  const memoryHistoryRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(metricsRef.current);

  /**
   * Start tracking a performance phase
   */
  const startPhase = useCallback((name: string) => {
    const memory = getMemoryUsage();
    phaseStartRef.current = {
      name,
      time: performance.now(),
      memory,
    };
    console.log(`⏱️  ${name} started...`);
  }, []);

  /**
   * End tracking a performance phase
   */
  const endPhase = useCallback(() => {
    if (!phaseStartRef.current) return;

    const endTime = performance.now();
    const endMemory = getMemoryUsage();
    const duration = (endTime - phaseStartRef.current.time) / 1000;
    const memoryDelta = endMemory - phaseStartRef.current.memory;

    const phase: PerformancePhase = {
      name: phaseStartRef.current.name,
      startTime: phaseStartRef.current.time,
      endTime,
      duration,
      memoryStart: phaseStartRef.current.memory,
      memoryEnd: endMemory,
      memoryDelta,
    };

    phasesRef.current.push(phase);
    console.log(
      `✅ ${phase.name} completed in ${duration.toFixed(2)}s (${phase.memoryDelta > 0 ? '+' : ''}${(phase.memoryDelta / 1024 / 1024).toFixed(2)}MB)`
    );

    phaseStartRef.current = null;
  }, []);

  /**
   * Record recording phase completion
   */
  const recordingComplete = useCallback(
    (duration: number, webmBlob: Blob) => {
      endPhase();
      metricsRef.current.recordingDuration = duration;
      metricsRef.current.inputSize = webmBlob.size;
      setMetrics({ ...metricsRef.current });
    },
    [endPhase]
  );

  /**
   * Record transcoding phase completion
   */
  const transcodingComplete = useCallback(
    (duration: number, outputBlob: Blob) => {
      endPhase();
      metricsRef.current.transcodeDuration = duration;
      metricsRef.current.outputSize = outputBlob.size;

      // Calculate metrics
      const totalDuration = metricsRef.current.recordingDuration + duration;
      metricsRef.current.totalDuration = totalDuration;
      metricsRef.current.compression =
        metricsRef.current.inputSize > 0
          ? metricsRef.current.outputSize / metricsRef.current.inputSize
          : 0;

      // Calculate bitrate (bitrate = (filesize * 8) / duration)
      const bitrate =
        (outputBlob.size * 8) / 1000000 / metricsRef.current.recordingDuration;
      metricsRef.current.bitrate = `${bitrate.toFixed(2)} Mbps`;

      setMetrics({ ...metricsRef.current });
    },
    []
  );

  /**
   * Get current memory usage
   */
  function getMemoryUsage(): number {
    if (!performance.memory) return 0;
    return performance.memory.usedJSHeapSize;
  }

  /**
   * Update memory history
   */
  const trackMemory = useCallback(() => {
    const memory = getMemoryUsage();
    memoryHistoryRef.current.push(memory);

    metricsRef.current.peakMemory = Math.max(metricsRef.current.peakMemory, memory);

    if (memoryHistoryRef.current.length > 0) {
      const avg =
        memoryHistoryRef.current.reduce((a, b) => a + b) / memoryHistoryRef.current.length;
      metricsRef.current.averageMemory = avg;
    }
  }, []);

  /**
   * Start overall export timer
   */
  const startExport = useCallback(() => {
    startTimeRef.current = performance.now();
    phasesRef.current = [];
    memoryHistoryRef.current = [];
    metricsRef.current = {
      recordingDuration: 0,
      transcodeDuration: 0,
      totalDuration: 0,
      inputSize: 0,
      outputSize: 0,
      fps: 30,
      bitrate: '0 Mbps',
      compression: 0,
      peakMemory: 0,
      averageMemory: 0,
    };
    console.log('🚀 Export started');
  }, []);

  /**
   * Get summary report
   */
  const getReport = useCallback((): string => {
    const lines = [
      '📊 EXPORT PERFORMANCE REPORT',
      '─'.repeat(50),
      `Total Duration: ${metricsRef.current.totalDuration.toFixed(2)}s`,
      `Recording: ${metricsRef.current.recordingDuration.toFixed(2)}s`,
      `Transcoding: ${metricsRef.current.transcodeDuration.toFixed(2)}s`,
      '',
      `Input Size: ${(metricsRef.current.inputSize / 1024 / 1024).toFixed(2)}MB`,
      `Output Size: ${(metricsRef.current.outputSize / 1024 / 1024).toFixed(2)}MB`,
      `Compression: ${(metricsRef.current.compression * 100).toFixed(1)}%`,
      `Bitrate: ${metricsRef.current.bitrate}`,
      '',
      `Peak Memory: ${(metricsRef.current.peakMemory / 1024 / 1024).toFixed(2)}MB`,
      `Average Memory: ${(metricsRef.current.averageMemory / 1024 / 1024).toFixed(2)}MB`,
      '',
      'Phases:',
      ...phasesRef.current.map(
        (p) =>
          `  • ${p.name}: ${p.duration.toFixed(2)}s (${p.memoryDelta > 0 ? '+' : ''}${(p.memoryDelta / 1024 / 1024).toFixed(2)}MB)`
      ),
    ];

    const summary = lines.join('\n');
    console.log(summary);
    return summary;
  }, []);

  /**
   * Setup memory tracking interval
   */
  useEffect(() => {
    const interval = setInterval(() => {
      trackMemory();
    }, 1000); // Track every second

    return () => clearInterval(interval);
  }, [trackMemory]);

  return {
    metrics,
    startExport,
    startPhase,
    endPhase,
    recordingComplete,
    transcodingComplete,
    trackMemory,
    getReport,
  };
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration to HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h > 0) parts.push(String(h).padStart(2, '0'));
  parts.push(String(m).padStart(2, '0'));
  parts.push(String(s).padStart(2, '0'));
  return parts.join(':');
}
