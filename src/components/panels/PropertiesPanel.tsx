'use client';
// ─────────────────────────────────────────────────────────────
// Properties panel: shows selected clip properties for editing
// ─────────────────────────────────────────────────────────────
import { useEditorStore, useSelectedClip } from '@/store/useEditorStore';

// ── Timing Helpers ───────────────────────────────────────────
function secsToHMS(totalSecs: number) {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return { h, m, s };
}

function hmsToSecs(h: number, m: number, s: number) {
  return (h * 3600) + (m * 60) + s;
}

interface HMSInputProps {
  label: string;
  totalSeconds: number;
  onChange: (secs: number) => void;
  min?: number;
}

function HMSInput({ label, totalSeconds, onChange, min = 0 }: HMSInputProps) {
  const { h, m, s } = secsToHMS(totalSeconds);

  const update = (field: 'h' | 'm' | 's', val: string) => {
    const v = parseFloat(val) || 0;
    let newH = h, newM = m, newS = s;
    if (field === 'h') newH = v;
    if (field === 'm') newM = v;
    if (field === 's') newS = v;
    onChange(Math.max(min, hmsToSecs(newH, newM, newS)));
  };

  return (
    <div>
      <span className="text-[10px] text-slate-600 block mb-1">{label} (HH:MM:SS.ms)</span>
      <div className="flex items-center gap-1">
        <input
          type="number" min={0} placeholder="HH"
          value={h} onChange={(e) => update('h', e.target.value)}
          className="input w-full text-[10px] px-1 h-7 text-center"
        />
        <span className="text-slate-700">:</span>
        <input
          type="number" min={0} max={59} placeholder="MM"
          value={m} onChange={(e) => update('m', e.target.value)}
          className="input w-full text-[10px] px-1 h-7 text-center"
        />
        <span className="text-slate-700">:</span>
        <input
          type="number" min={0} step={0.1} placeholder="SS"
          value={s.toFixed(2)} onChange={(e) => update('s', e.target.value)}
          className="input w-full text-[10px] px-0.5 h-7 text-center"
        />
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const { updateClip, removeClip } = useEditorStore();
  const clip = useSelectedClip();

  if (!clip) {
    return (
      <div className="flex flex-col h-full bg-[var(--editor-surface)]">
        <div className="px-3 py-2 border-b border-[var(--editor-border)] shrink-0">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Properties</h2>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-slate-600 text-xs text-center px-4">
          <p className="text-2xl mb-2">🖱️</p>
          <p>Select a clip to edit properties</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--editor-surface)] overflow-y-auto">
      <div className="px-3 py-2 border-b border-[var(--editor-border)] shrink-0 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Properties</h2>
        <button onClick={() => removeClip(clip.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
          🗑 Remove
        </button>
      </div>

      <div className="flex-1 px-3 py-3 space-y-4">
        {/* Clip Name */}
        <div>
          <label className="label">Name</label>
          <input
            value={clip.name}
            onChange={(e) => updateClip(clip.id, { name: e.target.value })}
            className="input w-full"
          />
        </div>

        {/* Timing */}
        <div className="space-y-3">
          <label className="label text-indigo-400/80">⏱ Timing Control</label>
          <HMSInput
            label="Start At"
            totalSeconds={clip.startTime}
            onChange={(val) => updateClip(clip.id, { startTime: val })}
          />
          <HMSInput
            label="Duration"
            totalSeconds={clip.duration}
            min={0.1}
            onChange={(val) => updateClip(clip.id, { duration: val })}
          />
        </div>

        {/* Volume */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="label">Volume</label>
            <span className="text-xs text-slate-500">{Math.round(clip.volume * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={clip.volume}
            onChange={(e) => updateClip(clip.id, { volume: parseFloat(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </div>

        {/* Opacity (video only) */}
        {clip.opacity !== undefined && (
          <div>
            <div className="flex justify-between mb-1">
              <label className="label">Opacity</label>
              <span className="text-xs text-slate-500">{Math.round(clip.opacity * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01}
              value={clip.opacity}
              onChange={(e) => updateClip(clip.id, { opacity: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>
        )}

        {/* Playback Speed */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="label">Speed</label>
            <span className="text-xs text-slate-500">{clip.playbackRate}x</span>
          </div>
          <input
            type="range" min={0.25} max={4} step={0.25}
            value={clip.playbackRate}
            onChange={(e) => updateClip(clip.id, { playbackRate: parseFloat(e.target.value) })}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
            <span>0.25x</span><span>1x</span><span>2x</span><span>4x</span>
          </div>
        </div>

        {/* Quick Actions (Smart Tools) */}
        {clip.type === 'image' && (
          <div className="border-t border-[var(--editor-border)] pt-4 space-y-2">
            <label className="label text-indigo-400/80">⚡ Smart Tools</label>
            <button
              onClick={() => {
                const projectDuration = useEditorStore.getState().duration;
                if (projectDuration > clip.startTime) {
                  updateClip(clip.id, { duration: projectDuration - clip.startTime });
                }
              }}
              className="w-full py-2 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <span>📏</span> Fill to Project End
            </button>
            <p className="text-[9px] text-slate-600 text-center px-2">
              Instantly matches the image length to your longest audio/video track.
            </p>
          </div>
        )}

        {/* Text clip options */}
        {clip.text !== undefined && (
          <div className="space-y-3 border-t border-[var(--editor-border)] pt-3">
            <label className="label">Text</label>
            <textarea
              value={clip.text}
              onChange={(e) => updateClip(clip.id, { text: e.target.value })}
              rows={3}
              className="input w-full text-sm resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-600 block mb-1">Font Size</span>
                <input
                  type="number" min={8} max={200}
                  value={clip.fontSize || 48}
                  onChange={(e) => updateClip(clip.id, { fontSize: parseInt(e.target.value) })}
                  className="input w-full text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-600 block mb-1">Color</span>
                <input
                  type="color"
                  value={clip.textColor || '#ffffff'}
                  onChange={(e) => updateClip(clip.id, { textColor: e.target.value })}
                  className="w-full h-8 rounded border border-[var(--editor-border)] bg-[var(--editor-bg)] cursor-pointer"
                />
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-600 block mb-1">Alignment</span>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button key={align} onClick={() => updateClip(clip.id, { textAlign: align })}
                    className={`flex-1 py-1.5 rounded text-xs border transition-colors ${clip.textAlign === align ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10' : 'border-[var(--editor-border)] text-slate-500'}`}>
                    {align === 'left' ? '⬅' : align === 'center' ? '⬛' : '➡'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Toggles */}
        <div className="flex gap-2 border-t border-[var(--editor-border)] pt-3">
          <button
            onClick={() => updateClip(clip.id, { isMuted: !clip.isMuted })}
            className={`btn text-xs px-3 py-1.5 flex-1 ${clip.isMuted ? 'btn-danger' : 'btn-ghost'}`}
          >
            {clip.isMuted ? '🔇 Muted' : '🔊 Mute'}
          </button>
          <button
            onClick={() => updateClip(clip.id, { isLocked: !clip.isLocked })}
            className={`btn text-xs px-3 py-1.5 flex-1 ${clip.isLocked ? 'btn-danger' : 'btn-ghost'}`}
          >
            {clip.isLocked ? '🔒 Locked' : '🔓 Lock'}
          </button>
        </div>
      </div>
    </div>
  );
}
