// ─────────────────────────────────────────────────────────────
// src/types/editor.ts
// Core domain types for the video editor
// ─────────────────────────────────────────────────────────────

export type TrackType = 'video' | 'audio' | 'text' | 'voiceover';

export type PlanTier = 'FREE' | 'PRO' | 'ENTERPRISE';

// ── Effects ─────────────────────────────────────────────────

export type EffectType = 'brightness' | 'contrast' | 'saturation' | 'blur'
  | 'fade_in' | 'fade_out' | 'speed' | 'text_overlay';

export interface Effect {
  id: string;
  type: EffectType;
  params: Record<string, number | string | boolean>;
  startTime?: number; // relative to clip start
  duration?: number;
}

// ── Caption Segment ─────────────────────────────────────────

export interface CaptionSegment {
  id: string;
  text: string;
  startTime: number; // seconds
  endTime: number;
}

// ── Clip ────────────────────────────────────────────────────

export interface Clip {
  id: string;
  trackId: string;
  src: string;            // S3 URL or blob: URL (for uploaded media)
  name: string;
  /** Timeline position (seconds from project start) */
  startTime: number;
  /** Total effective duration on timeline */
  duration: number;
  /** Source in-point trim (seconds from media start) */
  trimStart: number;
  /** Source out-point trim (seconds from media start) */
  trimEnd: number;
  volume: number;         // 0.0 – 1.0
  opacity: number;        // 0.0 – 1.0
  playbackRate: number;   // 0.25 – 4.0
  effects: Effect[];
  isLocked: boolean;
  isMuted: boolean;
  // Text-track specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  // Audio waveform data (random-sampled for visual, not for playback)
  waveformData?: number[];
}

// ── Track ────────────────────────────────────────────────────

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  clips: Clip[];
  isLocked: boolean;
  isMuted: boolean;
  isSolo: boolean;
  volume: number; // 0.0 – 1.0
  height: number; // px — user can resize tracks
}

// ── Project ──────────────────────────────────────────────────

export interface ProjectSettings {
  name: string;
  resolution: { width: number; height: number };
  fps: number;        // 24 | 30 | 60
  aspectRatio: string; // '16:9' | '9:16' | '1:1' | '4:3'
  backgroundColor: string;
}

// ── Export Job ───────────────────────────────────────────────

export type ExportStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed';

export interface ExportJob {
  id: string;
  projectId: string;
  status: ExportStatus;
  progress: number;   // 0–100
  downloadUrl?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// ── Voiceover Job ────────────────────────────────────────────

export interface VoiceoverJob {
  id: string;
  text: string;
  voiceId: string;
  status: ExportStatus;
  audioUrl?: string;
  durationSec?: number;
}

// ── Media Asset (from library) ───────────────────────────────

export interface MediaAsset {
  id: string;
  type: 'video' | 'audio' | 'image';
  name: string;
  src: string;
  thumbnailUrl?: string;
  durationSec?: number;
  sizeMb: number;
  uploadedAt: string;
}
