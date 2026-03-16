'use client';
// ─────────────────────────────────────────────────────────────
// VoiceoverModal.tsx — AI Voiceover generation via ElevenLabs
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

interface Props { onClose: () => void; }

const VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', accent: 'American', style: 'Calm' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',   accent: 'American', style: 'Strong' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',  accent: 'American', style: 'Soft' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', accent: 'American', style: 'Warm' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli',   accent: 'American', style: 'Emotional' },
];

const MAX_CHARS_FREE = 500;
const MAX_CHARS_PRO  = 100_000;

export default function VoiceoverModal({ onClose }: Props) {
  const { tracks, addTrack, addClip } = useEditorStore();
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const userPlan = 'FREE'; // Replace with real auth context
  const maxChars = userPlan === 'FREE' ? MAX_CHARS_FREE : MAX_CHARS_PRO;

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setStatus('generating');
    setErrorMsg('');

    try {
      // In production: POST /api/v1/voiceover with { text, voice_id }
      // and poll for completion. Here we simulate:
      await new Promise((r) => setTimeout(r, 2000));

      // Create a dummy voiceover clip
      let voTrack = tracks.find((t) => t.type === 'voiceover' && !t.isLocked);
      if (!voTrack) {
        addTrack('voiceover');
        voTrack = useEditorStore.getState().tracks.find((t) => t.type === 'voiceover');
      }
      if (!voTrack) throw new Error('Could not create voiceover track');

      const occupied = voTrack.clips.map((c) => c.startTime + c.duration);
      const startTime = occupied.length > 0 ? Math.max(...occupied) + 0.1 : 0;
      const estDuration = text.split(' ').length / 3; // rough: 3 words/sec

      addClip(voTrack.id, {
        src: '', // real: S3 URL of generated MP3
        name: `Voiceover — ${VOICES.find((v) => v.id === voiceId)?.name}`,
        startTime,
        duration: estDuration,
        trimStart: 0,
        trimEnd: estDuration,
        volume: 1,
        opacity: 1,
        playbackRate: 1,
        effects: [],
        isLocked: false,
        isMuted: false,
        waveformData: Array.from({ length: 60 }, () => 20 + Math.random() * 60),
      });

      setStatus('done');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-100">🎙️ AI Voiceover</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Voice selector */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Voice</label>
          <div className="grid grid-cols-3 gap-2">
            {VOICES.map((v) => (
              <button key={v.id} onClick={() => setVoiceId(v.id)}
                className={`px-3 py-2 rounded-lg border text-xs transition-all ${voiceId === v.id ? 'border-purple-500 bg-purple-500/10 text-purple-300' : 'border-[var(--editor-border)] text-slate-400 hover:border-white/20'}`}>
                <p className="font-semibold">{v.name}</p>
                <p className="text-slate-600 text-[10px]">{v.style}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Text input */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Script</label>
            <span className={`text-xs ${text.length > maxChars ? 'text-red-400' : 'text-slate-500'}`}>
              {text.length} / {maxChars.toLocaleString()} chars
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxChars))}
            placeholder={`Enter your voiceover script here…\n\nFREE plan: up to ${MAX_CHARS_FREE} characters\nPRO plan: up to ${(MAX_CHARS_PRO).toLocaleString()} characters`}
            rows={6}
            className="w-full bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-xl p-3 text-sm text-slate-300 resize-none outline-none focus:border-purple-500 transition-colors placeholder:text-slate-700"
          />
        </div>

        {userPlan === 'FREE' && text.length >= MAX_CHARS_FREE && (
          <div className="mb-3 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2 flex items-center gap-2">
            ⚠️ <span>FREE plan limit reached. <button className="underline">Upgrade to PRO</button> for long-form voiceovers up to 100K chars.</span>
          </div>
        )}

        {status === 'error' && (
          <p className="text-xs text-red-400 mb-3">❌ {errorMsg}</p>
        )}

        {status === 'done' && (
          <div className="mb-4 text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
            ✅ Voiceover added to timeline! Check your voiceover track.
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1 text-sm">Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={!text.trim() || status === 'generating'}
            className="btn flex-1 text-sm py-2.5 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white' }}
          >
            {status === 'generating' ? (
              <><div className="spinner" style={{ width: 14, height: 14 }} /> Generating…</>
            ) : '🎙️ Generate Voiceover'}
          </button>
        </div>
      </div>
    </div>
  );
}
