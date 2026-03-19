# Video Editor Export Logic Analysis

## 1. CURRENT EXPORT FLOW (Step-by-Step)

### Phase 1: Initialization
```
User clicks "Export for Social Media" in ExportModal.tsx
  ↓
Check if FFmpeg is loaded (useFFmpeg.ts)
  ├─ If not loaded: Download ~30MB FFmpeg.wasm from CDN (unpkg.com)
  └─ Load CoreURL (ffmpeg-core.js) and WASM binary
  ↓
Set status to 'recording'
Reset currentTime to 0
```

### Phase 2: Media Stream Capture (MediaRecorder)
```
Create single MediaStream combining:
  ├─ Canvas video track (30fps) via canvasRef.captureStream(30)
  └─ Audio stream (mixed Web Audio API output) via audioStream
  ↓
Initialize MediaRecorder with:
  ├─ Codec: VP9
  ├─ mimeType: 'video/webm;codecs=vp9'
  ├─ Bitrate: 20,000,000 bps (20 Mbps - "High bitrate for intermediate")
  └─ Collects chunks into Blob array
  ↓
Start recorder
setIsPlaying(true)
  ↓
Monitor progress every 100ms:
  ├─ Calculate: (currentTime / duration) * 100 for progress bar
  └─ When currentTime >= duration: Stop recorder & playback
```

### Phase 3: Audio/Video Sync During Recording
```
PlaybackEngine.tsx manages sync via useEffect:
  ├─ Creates Web Audio Context (if not exists)
  ├─ Creates MediaStreamAudioDestinationNode for mixing
  └─ For each clip in each track:
      ├─ Create HTMLAudioElement or HTMLVideoElement
      ├─ Route through Web Audio API graph
      │   └─ Pipes ALL audio to destinationRef.current (mono/stereo mixed)
      ├─ Sync position: Seek if desynced by >150ms
      └─ Control play/pause based on isPlaying state
```

### Phase 4: Frame Rendering (Canvas)
```
Every requestAnimationFrame (~60fps):
  ├─ PreviewCanvas.drawFrame() executes:
  │   ├─ Clear canvas with backgroundColor
  │   ├─ Get all active clips (currentTime within clip.startTime + duration)
  │   ├─ Filter out muted tracks/clips
  │   ├─ Sort by Z-order: video(1) < audio(2) < voiceover(3) < text(4)
  │   ├─ For each visible clip:
  │   │   ├─ Set globalAlpha = clip.opacity
  │   │   ├─ Draw image/video: ctx.drawImage(element, 0, 0, width, height)
  │   │   └─ Draw text: ctx.font, ctx.fillText() with shadows
  │   └─ Draw timecode overlay (bottom-right)
  ├─ Canvas is captured by MediaRecorder
  └─ Repeat until export complete

Note: Canvas renders at monitor refresh rate (usually 60fps),
      but MediaRecorder captures at 30fps
```

### Phase 5: WebM → MP4 Transcoding (FFmpeg)
```
When MediaRecorder stops:
  ├─ Create Blob from chunks (type: 'video/webm')
  ├─ Call transcode(webmFile, 'output.mp4', ffmpegArgs)
  │
  └─ FFmpeg executes:
      ├─ writeFile('input.webm', fileContent)
      ├─ exec([
      │   '-i', 'input.webm',
      │   '-c:v', 'libx264',           (H.264 codec)
      │   '-preset', 'superfast',       (Speed vs quality trade-off)
      │   '-crf', '22',                 (Constant Rate Factor: 0-51, lower=better)
      │   '-pix_fmt', 'yuv420p',        (4:2:0 chroma subsampling)
      │   '-b:v', '6M' (or 2.5M/12M),   (Bitrate for draft/high/4K)
      │   '-c:a', 'aac',                (Audio codec)
      │   '-b:a', '128k',               (Audio bitrate)
      │   '-movflags', 'faststart',     (Progressive download optimization)
      │   'output.mp4'
      │ ])
      ├─ readFile('output.mp4') → Uint8Array
      └─ Return encoded MP4 data
  ↓
Create object URL from MP4 Blob
setDownloadUrl(url)
setStatus('done')
User can download via <a href={downloadUrl} download>
```

---

## 2. TECHNOLOGIES & LIBRARIES USED

### Core Dependencies
| Technology | Purpose | Location |
|-----------|---------|----------|
| **FFmpeg.wasm** | Browser-side H.264 encoding | useFFmpeg.ts |
| **MediaRecorder API** | Capture canvas + audio streams | ExportModal.tsx |
| **Canvas API** | Real-time frame rendering | PreviewCanvas.tsx |
| **Web Audio API** | Multi-track audio mixing | PlaybackEngine.tsx |
| **MediaStream API** | Stream capture from canvas + audio | ExportModal.tsx |
| **Zustand + Zundo** | State management + undo/redo | useEditorStore.ts |

### Quality Settings & Bitrates
```typescript
Quality Options:
├─ draft   (720p):  2.5 Mbps H.264 @ VP9 intermediate
├─ high    (1080p): 6.0 Mbps H.264 @ VP9 intermediate
└─ 4k      (4K):    12.0 Mbps H.264 @ VP9 intermediate

FFmpeg Preset: "superfast"
   └─ Speed: ████░░░░░░ (Fast, some quality trade-off)
   └─ Quality: ░░░████░░░ (Good visuals, not maximum)

Audio: 128 kbps AAC (fixed, regardless of quality tier)
```

### CDN Sources
```
FFmpeg binary source: https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/
  ├─ ffmpeg-core.js (loader)
  └─ ffmpeg-core.wasm (~30MB)

Downloaded on first export → cached in browser memory
```

---

## 3. CURRENT MEMORY MANAGEMENT APPROACH

### Reference Storage
```typescript
// PlaybackEngine.tsx
const playersRef = useRef<Map<string, HTMLAudioElement | HTMLVideoElement>>()
const audioCtxRef = useRef<AudioContext>()
const destinationRef = useRef<MediaStreamAudioDestinationNode>()
const sourceNodesRef = useRef<Map<string, MediaElementAudioSourceNode>>()

// PreviewCanvas.tsx
const mediaCache = useRef<Map<string, HTMLVideoElement | HTMLImageElement>>()

// ExportModal.tsx (local state)
const chunks: Blob[] = []  // Accumulates WebM data during recording
```

### Memory Lifecycle
```
1. ON FIRST EXPORT:
   ├─ FFmpeg.wasm (~30MB) downloaded → Persists in browser for session
   └─ No cleanup between exports

2. DURING EXPORT:
   ├─ All clips cached as HTMLVideoElement/HTMLAudioElement
   ├─ All audio routed through Web Audio Graph (in GPU memory if supported)
   ├─ Canvas renders continuously (GPU texture memory)
   ├─ MediaRecorder chunks accumulate in RAM
   │   └─ Example: 1 minute @ 30fps, 1080p ≈ 200-500 MB WebM blob
   └─ No intermediate cleanup

3. AFTER EXPORT:
   ├─ HTMLMediaElement refs persist in playersRef Map (never cleaned)
   ├─ Web Audio nodes persist
   ├─ FFmpeg.wasm stays in memory
   ├─ Chunks array is GC'd when modal closes
   └─ Object URL (download link) persists until revoked manually
```

### Potential Memory Issues
```
❌ ISSUE 1: No cleanup of HTMLMediaElement caches
   └─ Each export adds more elements to playersRef Map
   └─ Editing another project → previous caches remain in memory

❌ ISSUE 2: Web Audio nodes never disconnected
   └─ sourceNodesRef Map grows unbounded
   └─ Each audio clip creates a new source node per export

❌ ISSUE 3: FFmpeg.wasm persists for session
   └─ Good for performance (single download), but no unload
   └─ 30MB RAM overhead permanently

❌ ISSUE 4: Object URLs accumulate
   └─ URL.createObjectURL() creates memory reference
   └─ No URL.revokeObjectURL() calls in code
   └─ Users must manually clean or hard refresh page

❌ ISSUE 5: Blob chunks collected in array
   └─ Large videos (10+ min) could cause OOM
   └─ No streaming to storage, all in RAM
```

---

## 4. IDENTIFIED BOTTLENECKS

### 🔴 CRITICAL - Synchronization Loop
```typescript
// ExportModal.tsx - monitors progress every 100ms
const checkProgress = setInterval(() => {
  const state = useEditorStore.getState();
  const p = Math.min(100, Math.round((state.currentTime / duration) * 100));
  setRecordProgress(p);
  // ...
}, 100);  // ⚠️ ISSUE: Decoupled from actual playback
```
**Problem**: 
- Progress is polled, not event-driven
- No guarantee realtime updates match actual recording
- If currentTime lags, progress bar won't reflect real encoding time

### 🔴 CRITICAL - All-in-Memory Recording
```typescript
const chunks: Blob[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
// ... later ...
const webmBlob = new Blob(chunks, { type: 'video/webm' });
```
**Problem**:
- ~10 minute video @ 30fps = 18,000 frames
- At 20 Mbps: 18,000 * (20M / 8 / 30) ≈ 1.5 GB peak memory
- Browser might crash on large projects
- No streaming option to IndexedDB or server

### 🟠 HIGH - Continuous Canvas Rendering
```typescript
// PreviewCanvas.tsx - every requestAnimationFrame (~60 fps)
const render = () => {
  drawFrame();  // Full redraw + text layout
  rafId = requestAnimationFrame(render);
};
```
**Problem**:
- Canvas draws at 60fps request rate, but MediaRecorder only captures 30fps
- 100% CPU on main thread during export
- No frame rate limiting to match target FPS

### 🟠 HIGH - Media Sync Loss Risk
```typescript
// PlaybackEngine.tsx
if (Math.abs(player.currentTime - targetTime) > 0.15) {  // 150ms tolerance
  player.currentTime = targetTime;
}
```
**Problem**:
- Seeks only if desynced by >150ms → audible glitches
- No pre-buffering or readyState check before seek
- Audio desync can occur with codec delays (AAC encoder lookahead ≈ 2-3 frames)

### 🟠 HIGH - FFmpeg Codec Constraints
```typescript
// ExportModal.tsx
'-preset', 'superfast',  // ⚠️ Fastest but not CPU optimal
'-crf', '22',            // Fixed quality (not adaptive)
```
**Problem**:
- `superfast` preset skips quality optimizations
- No rate control based on bandwidth caps
- No two-pass encoding for precise file size targets
- H.264 with `crf 22` can produce variable bitsizes (±20%)

### 🟡 MEDIUM - No Error Recovery
```typescript
recorder.onstop = async () => {
  // ... transcode ...
  if (mp4Data) {
    // success
  } else {
    setStatus('error');  // ⚠️ No retry mechanism
  }
};
```
**Problem**:
- Users must restart entire export on failure
- No checkpoint/resume capability
- Failed transcodes waste time + bandwidth

### 🟡 MEDIUM - Audio Mixing Not Normalized
```typescript
// PlaybackEngine.tsx
player.volume = track.isMuted || clip.isMuted ? 0 : (clip.volume ?? 1);
// ⚠️ If 5 tracks all at volume 1.0, sum = 5.0 → clipping
```
**Problem**:
- No peak normalization across all tracks
- Possible audio distortion in final export
- Volume levels not verified before recording

### 🟡 MEDIUM - No Media Preload Strategy
```typescript
video.preload = 'auto';  // Browser decides, might buffer too much
```
**Problem**:
- No forced preload of clips with timeout
- Playhead might pause if media not ready
- Export progress stalls while buffering

---

## 5. FRAME PROCESSING PIPELINE

### Rendering Stages

```
┌─────────────────────────────────────────────────────────────┐
│ 1. STATE UPDATES (Zustand) - Every 30-33ms @ 30fps          │
├─────────────────────────────────────────────────────────────┤
│   currentTime += (1 / fps) if isPlaying                       │
│   → Updates playback position automatically                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. MEDIA SYNC (PlaybackEngine.tsx) - Continuous              │
├─────────────────────────────────────────────────────────────┤
│   For each clip:                                              │
│   ├─ Calculate targetTime = (currentTime - startTime) + trim │
│   ├─ Seek if |currentTime - targetTime| > 150ms              │
│   ├─ Play/pause audio element                                │
│   └─ Route audio to Web Audio destination                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CANVAS RENDERING (PreviewCanvas.tsx) - 60fps              │
├─────────────────────────────────────────────────────────────┤
│   requestAnimationFrame(() => {                               │
│   ├─ ctx.fillRect() - Clear background                       │
│   ├─ Filter + sort clips by track Z-order                    │
│   ├─ For each visible clip:                                  │
│   │   ├─ ctx.globalAlpha = opacity                           │
│   │   ├─ ctx.drawImage() - Composite video/image             │
│   │   └─ ctx.fillText() - Render text overlays              │
│   ├─ ctx.fillText() - Timecode                               │
│   └─ Return frame in GPU memory (WebGL or Canvas 2D)         │
│   })                                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. STREAM CAPTURE (MediaRecorder) - 30fps                    │
├─────────────────────────────────────────────────────────────┤
│   canvasRef.captureStream(30)                                │
│   ├─ Extracts frames from canvas render pipeline             │
│   ├─ Encodes with VP9 codec @ 20 Mbps                        │
│   └─ Collects chunks into Blob array                         │
│                                                               │
│   audioStream (Web Audio destination)                        │
│   ├─ Mixed output from all audio clips                       │
│   └─ PCM audio frames synced to video                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. INTERMEDIATE STORAGE - WebM Blob                          │
├─────────────────────────────────────────────────────────────┤
│   Accumulates in RAM:                                         │
│   chunks[] array → Combined into single Blob                │
│   Size ≈ (bitrate * duration) / 8                           │
│   Example: 20 Mbps * 60 sec = 150 MB WebM                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. TRANSCODE TO H.264 (FFmpeg.wasm) - CPU intensive          │
├─────────────────────────────────────────────────────────────┤
│   ffmpeg.exec([                                               │
│   '-i', 'input.webm',     ← Read WebM from memory             │
│   '-c:v', 'libx264',      ← Decode VP9, encode H.264          │
│   '-preset', 'superfast', ← Speed optimization                │
│   '-crf', '22',           ← Quality (0-51)                    │
│   '-pix_fmt', 'yuv420p',  ← Mobile compatibility              │
│   '-b:v', '6M',           ← Output bitrate                    │
│   '-c:a', 'aac',          ← Re-encode audio to AAC            │
│   '-b:a', '128k',         ← Audio bitrate                     │
│   '-movflags', 'faststart', ← Streaming optimization          │
│   'output.mp4'            ← Write to memory                   │
│   ])                                                          │
│                                                               │
│   Inputs:  WebM (VP9 + PCM)    → Outputs: MP4 (H.264 + AAC)   │
│   Peak memory: WebM + MP4 + working buffer ≈ 2-3x codec RAM   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. DOWNLOAD URL GENERATION                                   │
├─────────────────────────────────────────────────────────────┤
│   URL.createObjectURL(mp4Blob)                               │
│   → Returns blob:\\ URL reference                            │
│   → User can <a href={url} download="video.mp4"> ✓           │
└─────────────────────────────────────────────────────────────┘
```

### Frame Data Transformation
```
HTMLVideoElement/Image
    ↓
    canvas.drawImage(el, 0, 0, width, height)
    ↓
    Canvas pixel buffer (RGBA)
    ↓
    canvasRef.captureStream(30)  ← 30fps video codec
    ↓
    MediaRecorder (VP9 encoder)
    ↓
    WebM Blob (chunks)
    ↓
    FFmpeg.exec()
    ├─ libvpx decoder (VP9)
    ├─ libx264 encoder (H.264)
    └─ filters (pix_fmt conversion)
    ↓
    MP4 Blob (H.264)
    ↓
    blob:// URL → Download
```

### Timing During Export
```
Timeline: 60 seconds @ 30fps target
├─ Real duration: ~60 seconds (clock time)
├─ Canvas renders: 60s × 60fps = 3,600 frames (unused, only 30fps captured)
├─ MediaRecorder captures: 60s × 30fps = 1,800 frames
├─ FFmpeg processes: 1,800 frames through H.264 encoder
└─ Total bottleneck: FFmpeg re-encodes all frames (CPU intensive, 5-20 min for HD)
```

---

## 6. OPTIMIZATION OPPORTUNITIES

### Priority Fixes
1. **Memory Management**: Implement cleanup for cached media & Web Audio nodes
2. **Stream Processing**: Support chunked FFmpeg encoding instead of all-in-memory
3. **Frame Rate Sync**: Match canvas render FPS to encoder target (30fps)
4. **Audio Level Normalization**: Implement LUFS metering & adaptive gain
5. **Checkpoint/Resume**: Save intermediate chunks to IndexedDB with progress tracking

See [EXPORT_OPTIMIZATION_PLAN.md](./EXPORT_OPTIMIZATION_PLAN.md) for detailed recommendations.
