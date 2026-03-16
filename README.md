# 🎬 NoLimit Video Editor

> Professional-grade online video editing platform — No Resolution Limits, up to 4K GPU export.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- (Optional for GPU features) Python 3.11+, Redis, Docker

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) then click **Open Editor**.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── editor/[projectId]/page.tsx  # Main editor layout
│   ├── layout.tsx                    # Root layout
│   └── globals.css                   # Design system CSS
├── components/
│   ├── editor/
│   │   ├── Timeline.tsx              # ⭐ Core timeline (playback, ruler, keys)
│   │   ├── TimelineTrack.tsx         # Track row with drag-and-drop
│   │   ├── TimelineClip.tsx          # Clip (resize, drag, waveform)
│   │   ├── PlayheadCursor.tsx        # Draggable red playhead
│   │   ├── PreviewCanvas.tsx         # Canvas preview
│   │   └── Toolbar.tsx               # Top bar
│   └── panels/
│       ├── MediaLibrary.tsx          # File upload + add to timeline
│       ├── PropertiesPanel.tsx       # Selected clip properties
│       ├── ExportModal.tsx           # Export with quality tiers
│       └── VoiceoverModal.tsx        # AI voiceover (ElevenLabs)
├── store/
│   └── useEditorStore.ts             # ⭐ Zustand + Immer + Zundo state
├── hooks/
│   └── useFFmpeg.ts                  # FFmpeg.wasm browser hook
└── types/
    └── editor.ts                     # TypeScript domain types
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `S` | Split clip at playhead |
| `Ctrl+D` | Duplicate clip |
| `Delete` / `Backspace` | Remove selected clip |
| `Home` | Jump to start |
| `End` | Jump to end |
| `← →` | Advance by 1 frame |
| `Shift+← →` | Advance by 5 seconds |
| `Ctrl+Scroll` | Zoom timeline |

---

## 🔑 Environment Variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | AI Voiceover generation |
| `OPENAI_API_KEY` | Whisper auto-captions |
| `AWS_*` | S3 storage for uploads/exports |
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL |
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Job queue (Celery) |

---

## 🏗️ Architecture

**Browser** → FFmpeg.wasm (proxy preview) → Zustand state  
**Export** → FastAPI → Redis queue → EC2 G4dn GPU worker → h264_nvenc → S3 output

See `video_editor_blueprint.md` for the full technical blueprint.
