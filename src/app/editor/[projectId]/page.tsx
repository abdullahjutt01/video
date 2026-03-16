'use client';
// ─────────────────────────────────────────────────────────────
// /editor/[projectId]/page.tsx — Full Editor Layout
// Three-column: MediaLibrary | Preview + Timeline | Properties
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

// Components
import Toolbar from '@/components/editor/Toolbar';
import Timeline from '@/components/editor/Timeline';
import PreviewCanvas from '@/components/editor/PreviewCanvas';
import MediaLibrary from '@/components/panels/MediaLibrary';
import PropertiesPanel from '@/components/panels/PropertiesPanel';
import ExportModal from '@/components/panels/ExportModal';
import VoiceoverModal from '@/components/panels/VoiceoverModal';
import PlaybackEngine from '@/components/editor/PlaybackEngine';

export default function EditorPage() {
  const { settings, loadProject } = useEditorStore();
  const [showExport, setShowExport] = useState(false);
  const [showVoiceover, setShowVoiceover] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(280); // px — user can resize

  // Load a demo project on first mount
  useEffect(() => {
    loadProject('demo', {
      name: 'My First Project',
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      aspectRatio: '16:9',
      backgroundColor: '#000000',
    }, []);
  }, []); // eslint-disable-line

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--editor-bg)]">
      {/* ── Top Toolbar ──────────────────────────────────── */}
      <Toolbar
        onExport={() => setShowExport(true)}
        onVoiceover={() => setShowVoiceover(true)}
        onCaptions={() => alert('Auto-captions: Connect to Whisper API endpoint')}
      />

      <PlaybackEngine />

      {/* ── Main Body ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Media Library (fixed width) */}
        <div style={{ width: 220 }} className="shrink-0 border-r border-[var(--editor-border)] overflow-hidden">
          <MediaLibrary />
        </div>

        {/* Center: Preview + Timeline (flex col, resizable split) */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Preview Area */}
          <div
            style={{ height: previewHeight, minHeight: 160 }}
            className="bg-[var(--editor-bg)] border-b border-[var(--editor-border)] overflow-hidden shrink-0 relative"
          >
            <PreviewCanvas />

            {/* Vertical resize handle */}
            <div
              onMouseDown={(e) => {
                const startY = e.clientY;
                const startH = previewHeight;
                const onMove = (me: MouseEvent) => {
                  setPreviewHeight(Math.max(120, Math.min(600, startH + me.clientY - startY)));
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-indigo-500/40 transition-colors"
              style={{ background: 'transparent' }}
            />
          </div>

          {/* Timeline Area */}
          <div className="flex-1 overflow-hidden">
            <Timeline />
          </div>
        </div>

        {/* Right: Properties Panel (fixed width) */}
        <div style={{ width: 220 }} className="shrink-0 border-l border-[var(--editor-border)] overflow-hidden">
          <PropertiesPanel />
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      {showExport    && <ExportModal    onClose={() => setShowExport(false)} />}
      {showVoiceover && <VoiceoverModal onClose={() => setShowVoiceover(false)} />}
    </div>
  );
}
