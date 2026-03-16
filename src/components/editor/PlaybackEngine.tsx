'use client';
// ─────────────────────────────────────────────────────────────
// PlaybackEngine.tsx — Invisible synchronizer for Audio/Video
// Ensures all media elements are playing/paused and seeked
// in sync with the global editor currentTime
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

export default function PlaybackEngine() {
  const { tracks, currentTime, isPlaying } = useEditorStore();
  const playersRef = useRef<Map<string, HTMLAudioElement | HTMLVideoElement>>(new Map());

  useEffect(() => {
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (!clip.src) return;

        let player = playersRef.current.get(clip.id);
        
        // Create player if it doesn't exist
        if (!player) {
          const resolvedType = clip.type || (
            (clip.src.toLowerCase().includes('video') || clip.src.match(/\.(mp4|webm|mov)$/i)) ? 'video' : 'audio'
          );
          player = resolvedType === 'video' ? document.createElement('video') : document.createElement('audio');
          player.src = clip.src;
          player.crossOrigin = 'anonymous';
          player.preload = 'auto';
          playersRef.current.set(clip.id, player);
        }

        const clipEndTime = clip.startTime + clip.duration;
        const isActive = currentTime >= clip.startTime && currentTime <= clipEndTime;

        // Sync volume and mute state
        player.volume = track.isMuted || clip.isMuted ? 0 : (clip.volume ?? 1);
        
        if (isActive) {
          // Calculate where we should be in the media file
          const targetTime = (currentTime - clip.startTime) + (clip.trimStart || 0);
          
          // Seek if desynced by more than 150ms
          if (Math.abs(player.currentTime - targetTime) > 0.15) {
            player.currentTime = targetTime;
          }

          // Handle Play/Pause
          if (isPlaying && player.paused) {
            player.play().catch(() => {
              // Browser might block auto-play until interaction
            });
          } else if (!isPlaying && !player.paused) {
            player.pause();
          }
        } else {
          // Not active — ensure paused
          if (!player.paused) player.pause();
        }
      });
    });

    // Handle clips being removed
    const allClipIds = new Set(tracks.flatMap(t => t.clips.map(c => c.id)));
    playersRef.current.forEach((_, id) => {
      if (!allClipIds.has(id)) {
        const p = playersRef.current.get(id);
        p?.pause();
        playersRef.current.delete(id);
      }
    });

  }, [tracks, currentTime, isPlaying]);

  return null; // Invisible component
}
