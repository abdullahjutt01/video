// ─────────────────────────────────────────────────────────────
// src/store/useEditorStore.ts
// Core editor state: tracks, clips, undo/redo, project settings
// ─────────────────────────────────────────────────────────────
'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';
import type { Track, Clip, TrackType, Effect, ProjectSettings } from '@/types/editor';

// ── Default project settings ─────────────────────────────────
const defaultSettings: ProjectSettings = {
  name: 'Untitled Project',
  resolution: { width: 1920, height: 1080 },
  fps: 30,
  aspectRatio: '16:9',
  backgroundColor: '#000000',
};

// ─────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────
export interface EditorState {
  // ── Project ──
  projectId: string | null;
  settings: ProjectSettings;
  isDirty: boolean;
  isSaving: boolean;

  // ── Tracks & Clips ──
  tracks: Track[];
  duration: number; // auto-calculated from clips

  // ── Selection ──
  selectedClipId: string | null;
  selectedTrackId: string | null;

  // ── Playback ──
  currentTime: number;
  isPlaying: boolean;
  zoom: number; // pixels per second

  // ──────────────────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────────────────

  // Project
  loadProject: (id: string, settings: ProjectSettings, tracks: Track[]) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
  setIsSaving: (v: boolean) => void;

  // Tracks
  addTrack: (type: TrackType) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, patch: Partial<Track>) => void;
  reorderTracks: (fromIdx: number, toIdx: number) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;

  // Clips
  addClip: (trackId: string, clip: Omit<Clip, 'id' | 'trackId'>) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, patch: Partial<Clip>) => void;
  moveClip: (clipId: string, targetTrackId: string, newStartTime: number) => void;
  splitClip: (clipId: string, atTime: number) => void;
  duplicateClip: (clipId: string) => void;
  addEffect: (clipId: string, effect: Omit<Effect, 'id'>) => void;
  removeEffect: (clipId: string, effectId: string) => void;

  // Selection
  selectClip: (clipId: string | null) => void;
  selectTrack: (trackId: string | null) => void;

  // Playback
  setCurrentTime: (t: number) => void;
  setIsPlaying: (v: boolean) => void;
  setZoom: (z: number) => void;
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────
const uid = () => uuidv4();

/** Recalculate total project duration from all clips */
const calcDuration = (tracks: Track[]): number =>
  tracks.reduce((max, t) =>
    t.clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), max), 0);

const findClipMut = (tracks: Track[], clipId: string): { track: Track; clip: Clip; idx: number } | null => {
  for (const track of tracks) {
    const idx = track.clips.findIndex((c) => c.id === clipId);
    if (idx !== -1) return { track, clip: track.clips[idx], idx };
  }
  return null;
};

const trackLabel = (tracks: Track[], type: TrackType) => {
  const count = tracks.filter((t) => t.type === type).length + 1;
  const name = type.charAt(0).toUpperCase() + type.slice(1);
  return `${name} ${count}`;
};

const DEFAULT_TRACK_HEIGHT = 64;

// ─────────────────────────────────────────────────────────────
// Store — wrapped with immer (mutation) + temporal (undo/redo)
// ─────────────────────────────────────────────────────────────
export const useEditorStore = create<EditorState>()(
  temporal(
    immer((set, get) => ({
      // ── Initial state ──────────────────────────────────────
      projectId: null,
      settings: defaultSettings,
      isDirty: false,
      isSaving: false,
      tracks: [],
      duration: 0,
      selectedClipId: null,
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      zoom: 80, // px/sec

      // ── Project ────────────────────────────────────────────
      loadProject: (id, settings, tracks) =>
        set((s) => {
          s.projectId = id;
          s.settings = settings;
          s.tracks = tracks;
          s.duration = calcDuration(tracks);
          s.isDirty = false;
        }),

      updateSettings: (patch) =>
        set((s) => {
          Object.assign(s.settings, patch);
          s.isDirty = true;
        }),

      setIsSaving: (v) => set((s) => { s.isSaving = v; }),

      // ── Tracks ─────────────────────────────────────────────
      addTrack: (type) =>
        set((s) => {
          s.tracks.push({
            id: uid(),
            type,
            name: trackLabel(s.tracks, type),
            clips: [],
            isLocked: false,
            isMuted: false,
            isSolo: false,
            volume: 1.0,
            height: DEFAULT_TRACK_HEIGHT,
          });
          s.isDirty = true;
        }),

      removeTrack: (trackId) =>
        set((s) => {
          s.tracks = s.tracks.filter((t) => t.id !== trackId);
          if (s.selectedTrackId === trackId) s.selectedTrackId = null;
          s.duration = calcDuration(s.tracks);
          s.isDirty = true;
        }),

      updateTrack: (trackId, patch) =>
        set((s) => {
          const track = s.tracks.find((t) => t.id === trackId);
          if (track) { Object.assign(track, patch); s.isDirty = true; }
        }),

      reorderTracks: (fromIdx, toIdx) =>
        set((s) => {
          const [moved] = s.tracks.splice(fromIdx, 1);
          s.tracks.splice(toIdx, 0, moved);
          s.isDirty = true;
        }),

      toggleTrackMute: (trackId) =>
        set((s) => {
          const t = s.tracks.find((t) => t.id === trackId);
          if (t) { t.isMuted = !t.isMuted; s.isDirty = true; }
        }),

      toggleTrackSolo: (trackId) =>
        set((s) => {
          const t = s.tracks.find((t) => t.id === trackId);
          if (t) { t.isSolo = !t.isSolo; s.isDirty = true; }
        }),

      toggleTrackLock: (trackId) =>
        set((s) => {
          const t = s.tracks.find((t) => t.id === trackId);
          if (t) { t.isLocked = !t.isLocked; s.isDirty = true; }
        }),

      // ── Clips ──────────────────────────────────────────────
      addClip: (trackId, clip) =>
        set((s) => {
          const track = s.tracks.find((t) => t.id === trackId);
          if (!track || track.isLocked) return;
          const newClip: Clip = {
            id: uid(),
            trackId,
            volume: 1.0,
            opacity: 1.0,
            playbackRate: 1.0,
            effects: [],
            isLocked: false,
            isMuted: false,
            trimStart: 0,
            trimEnd: clip.duration,
            ...clip,
          };
          track.clips.push(newClip);
          s.duration = calcDuration(s.tracks);
          s.isDirty = true;
        }),

      removeClip: (clipId) =>
        set((s) => {
          for (const track of s.tracks) {
            const idx = track.clips.findIndex((c) => c.id === clipId);
            if (idx !== -1) {
              track.clips.splice(idx, 1);
              s.duration = calcDuration(s.tracks);
              s.isDirty = true;
              if (s.selectedClipId === clipId) s.selectedClipId = null;
              break;
            }
          }
        }),

      updateClip: (clipId, patch) =>
        set((s) => {
          const found = findClipMut(s.tracks, clipId);
          if (found) {
            Object.assign(found.clip, patch);
            s.duration = calcDuration(s.tracks);
            s.isDirty = true;
          }
        }),

      moveClip: (clipId, targetTrackId, newStartTime) =>
        set((s) => {
          const found = findClipMut(s.tracks, clipId);
          if (!found) return;
          const targetTrack = s.tracks.find((t) => t.id === targetTrackId);
          if (!targetTrack || targetTrack.isLocked) return;

          // Remove from current track
          found.track.clips.splice(found.idx, 1);

          // Add to target track
          found.clip.trackId = targetTrackId;
          found.clip.startTime = Math.max(0, newStartTime);
          targetTrack.clips.push(found.clip);

          s.duration = calcDuration(s.tracks);
          s.isDirty = true;
        }),

      splitClip: (clipId, atTime) =>
        set((s) => {
          const found = findClipMut(s.tracks, clipId);
          if (!found) return;
          const { clip, track, idx } = found;
          const splitOffset = atTime - clip.startTime;

          if (splitOffset <= 0.05 || splitOffset >= clip.duration - 0.05) return; // Too close to edge

          const left: Clip = {
            ...JSON.parse(JSON.stringify(clip)), // deep clone (immer-safe)
            duration: splitOffset,
            trimEnd: clip.trimStart + splitOffset,
          };
          const right: Clip = {
            ...JSON.parse(JSON.stringify(clip)),
            id: uid(),
            startTime: atTime,
            duration: clip.duration - splitOffset,
            trimStart: clip.trimStart + splitOffset,
          };

          track.clips.splice(idx, 1, left, right);
          s.isDirty = true;
        }),

      duplicateClip: (clipId) =>
        set((s) => {
          const found = findClipMut(s.tracks, clipId);
          if (!found) return;
          const dupe: Clip = {
            ...JSON.parse(JSON.stringify(found.clip)),
            id: uid(),
            startTime: found.clip.startTime + found.clip.duration + 0.1,
          };
          found.track.clips.push(dupe);
          s.duration = calcDuration(s.tracks);
          s.isDirty = true;
        }),

      addEffect: (clipId, effect) =>
        set((s) => {
          const found = findClipMut(s.tracks, clipId);
          if (found) {
            found.clip.effects.push({ id: uid(), ...effect });
            s.isDirty = true;
          }
        }),

      removeEffect: (clipId, effectId) =>
        set((s) => {
          const found = findClipMut(s.tracks, clipId);
          if (found) {
            found.clip.effects = found.clip.effects.filter((e) => e.id !== effectId);
            s.isDirty = true;
          }
        }),

      // ── Selection ──────────────────────────────────────────
      selectClip: (clipId) => set((s) => { s.selectedClipId = clipId; }),
      selectTrack: (trackId) => set((s) => { s.selectedTrackId = trackId; }),

      // ── Playback ───────────────────────────────────────────
      setCurrentTime: (t) => set((s) => { s.currentTime = Math.max(0, t); }),
      setIsPlaying: (v) => set((s) => { s.isPlaying = v; }),
      setZoom: (z) => set((s) => { s.zoom = Math.min(300, Math.max(20, z)); }),
    })),
    {
      // Zundo config: which slices to include in undo history
      partialize: (state: EditorState) => ({
        tracks: state.tracks,
        settings: state.settings,
        duration: state.duration,
      }),
      limit: 100, // Max undo steps
    }
  )
);

// ─────────────────────────────────────────────────────────────
// Undo / Redo hook
// ─────────────────────────────────────────────────────────────
export const useEditorHistory = () => {
  const store = useEditorStore.temporal.getState();
  return {
    undo: store.undo,
    redo: store.redo,
    canUndo: store.pastStates.length > 0,
    canRedo: store.futureStates.length > 0,
    historyLength: store.pastStates.length,
    clear: store.clear,
  };
};

// ─────────────────────────────────────────────────────────────
// Selector helpers (memoised slices)
// ─────────────────────────────────────────────────────────────
export const useSelectedClip = () =>
  useEditorStore((s) =>
    s.selectedClipId ? (() => {
      for (const t of s.tracks) {
        const c = t.clips.find((c) => c.id === s.selectedClipId);
        if (c) return c;
      }
      return null;
    })() : null
  );

export const useTrack = (trackId: string) =>
  useEditorStore((s) => s.tracks.find((t) => t.id === trackId) ?? null);
