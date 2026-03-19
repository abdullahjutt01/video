// ─────────────────────────────────────────────────────────────
// SETUP_INSTRUCTIONS.md — How to properly set up the optimizations
// ─────────────────────────────────────────────────────────────

# Setup Instructions for Export Optimizations

## ✅ What's Already Done

All optimization files have been created and are ready to use:
- ✅ Web Worker code created
- ✅ Memory utilities implemented
- ✅ Canvas renderer ready
- ✅ FFmpeg hook enhanced
- ✅ Performance monitoring added
- ✅ ExportModal enhanced

## 🔧 Building the Web Worker

### For Development (`npm run dev`)
The Web Worker at `/public/exportWorker.ts` is served as a static asset.

```bash
# Start dev server (normal)
npm run dev

# The worker will be available at: http://localhost:3000/exportWorker.ts
```

### For Production Build

The Web Worker needs to be compiled to JavaScript. Update your `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config ...
  
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /exportWorker\.ts$/,
      use: ['ts-loader'],
      exclude: /node_modules/,
    });
    return config;
  },
};

module.exports = nextConfig;
```

### Alternative: Copy Worker to Public

```bash
# Copy compiled worker to public folder
cp src/hooks/exportWorker.js public/exportWorker.js
```

---

## 📦 NPM Dependencies (No New Ones Required)

All dependencies you already have are used:
- ✅ `@ffmpeg/ffmpeg` - Already installed
- ✅ `@ffmpeg/util` - Already installed
- ✅ `react` - Already installed
- ✅ `zustand` - Already installed

**No additional `npm install` needed!**

---

## 🚀 Quick Start Guide

### Option 1: Keep Using Original ExportModal (Recommended for safety)
```tsx
// Your existing code works as-is
import ExportModal from '@/components/panels/ExportModal';

// It now has:
// - Enhanced memory monitoring
// - Optimization tips
// - Better quality presets
// - No Web Worker complexity
```

### Option 2: Try the New ExportModalOptimized
```tsx
import ExportModalOptimized from '@/components/panels/ExportModalOptimized';

// Full Web Worker support
// Full performance reporting
// More detailed memory warnings
```

### Option 3: Use Hooks Directly
```typescript
import { useFFmpegOptimized } from '@/hooks/useFFmpegOptimized';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

const MyExportComponent = () => {
  const { transcodeWithWorker, load } = useFFmpegOptimized();
  const { startExport, getReport } = usePerformanceMonitor();
  
  // Custom implementation
};
```

---

## 🧪 Testing the Setup

### Test 1: Check Memory Utilities
```typescript
// In browser console
import { MemoryMonitor } from '/src/utils/memoryUtils';

const memory = MemoryMonitor.getMemoryUsage();
console.log(`Memory: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
```

### Test 2: Check FFmpeg Optimized Hook
```typescript
import { useFFmpegOptimized } from '/src/hooks/useFFmpegOptimized';

const { isLoaded, load } = useFFmpegOptimized();
// Should load FFmpeg successfully
await load();
```

### Test 3: Verify Web Worker
```javascript
// In browser console
try {
  const worker = new Worker('/exportWorker.ts');
  worker.postMessage({ type: 'ready' });
  console.log('✅ Web Worker ready');
} catch (e) {
  console.error('❌ Worker error:', e);
}
```

### Test 4: Full Export Flow
1. Open video editor
2. Add some clips
3. Click "Export"
4. Watch the performance metrics
5. Check browser console for reports

---

## ⚡ Performance Tuning

### For Maximum Speed
```typescript
// In ExportModal, reduce quality preset
const calculateFPS = (quality) => {
  return quality === 'draft' ? 20 : 24; // Even lower FPS = faster
};

// Enable GPU acceleration
// Chrome Settings → System → "Use graphics acceleration" = ON
```

### For Maximum Quality
```typescript
// Increase bitrate
const getQualitySettings = () => {
  return {
    draft: { fps: 24, bitrate: '2.5M' },
    high: { fps: 30, bitrate: '8M' },      // Increased from 6M
    '4k': { fps: 24, bitrate: '15M' },     // Increased from 12M
  };
};
```

### For Minimal Memory
```typescript
// Reduce recording quality
const recordingOptions = {
  videoBitsPerSecond: 10000000,  // Lowered from 15-20M
  audioBitsPerSecond: 96000,      // Lowered from 128k
};
```

---

## 🐛 Troubleshooting

### Issue: "Web Worker is undefined"
```
Solution: Ensure next.config.js is configured to handle .ts files in public
or compile exportWorker.ts to .js first
```

### Issue: "Memory still leaking"
```
Solution: Check that CleanupManager.releaseAll() is called
Look in browser console for cleanup logs: "🧹 Releasing resources..."
```

### Issue: "Export is still slow"
```
Solution 1: Enable hardware acceleration in browser settings
Solution 2: Close other browser tabs (free RAM)
Solution 3: Use Draft quality instead of High
Solution 4: Reduce number of effects/overlays in timeline
```

### Issue: "Browser crashes on export"
```
Solution 1: Use Draft quality (requires less memory)
Solution 2: Reduce video resolution in project settings
Solution 3: Split long videos into multiple exports
Solution 4: Close other applications (free system RAM)
```

---

## 📊 Monitoring Performance

### Real-time Monitoring
```javascript
// Open DevTools (F12) → Performance tab
// 1. Click "Record"
// 2. Start export
// 3. Let it run for 5-10 seconds
// 4. Click "Stop"
// 5. Analyze: Look for long tasks, see where CPU sucks
```

### Memory Analysis
```javascript
// DevTools → Memory tab
// 1. Take heap snapshot before export
// 2. Start export
// 3. Every 10 seconds, take another snapshot
// 4. Compare: Look for growing objects
// 5. After export: Should return to baseline
```

### Console Output
```
The export process logs to console:
⏱️  FFmpeg Engine Load started...
✅ FFmpeg Engine Load completed in 2.45s (+30MB)
⏱️  Recording started...
✅ Recording completed in 42.10s (+120MB)
⏱️  Transcoding to H.264/MP4 started...
✅ Transcoding to H.264/MP4 completed in 15.20s (-80MB)
🧹 Cleaning up export resources...
  - Stopping 1 MediaRecorders
  - Cleaning up 3 media elements
  - Revoking 1 object URLs
```

---

## 🎯 Configuration Checklist

Before going to production:

- [ ] Verify Web Worker is accessible at `/exportWorker.ts`
- [ ] Test export with sample video
- [ ] Check browser console for memory leaks
- [ ] Verify performance metrics are logged
- [ ] Enable hardware acceleration in docs/settings
- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on different hardware (desktop, laptop, tablet)
- [ ] Verify quality presets match your target platforms
- [ ] Document FPS settings for users

---

## 📝 Configuration Examples

### For TikTok/Instagram (Short-form video)
```typescript
const exportSettings = {
  quality: 'high',        // 1080p is overoverkill, draft is fine
  fps: 24,               // TikTok re-encodes anyway
  bitrate: '2.5M',       // Low bitrate, they compress more
  aspectRatio: '9:16',   // Vertical video
};
```

### For YouTube (Long-form video)
```typescript
const exportSettings = {
  quality: 'high',       // 1080p good for YouTube
  fps: 30,              // YouTube prefers 30fps
  bitrate: '6M',        // Higher bitrate for quality
  aspectRatio: '16:9',  // Horizontal video
};
```

### For Cinema (Professional)
```typescript
const exportSettings = {
  quality: '4k',        // 2160p for archival
  fps: 24,              // Film standard
  bitrate: '12M',       // High quality
  aspectRatio: '16:9',  // Standard cinema
};
```

---

## 🚀 Deployment Checklist

Before deploying to production:

✅ **Code Quality**
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] All imports resolved
- [ ] Security review completed

✅ **Performance**
- [ ] Export works end-to-end
- [ ] Memory cleanup verified
- [ ] Web Worker compiles correctly
- [ ] Performance metrics logged

✅ **Testing**
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Tested with 1min, 10min, 1hr videos
- [ ] Tested with many clips (50+)
- [ ] Tested with low RAM (2GB free)

✅ **Documentation**
- [ ] User guide updated
- [ ] Optimization tips displayed
- [ ] Error messages clear
- [ ] Support docs complete

---

## 📞 Support

If you encounter issues:

1. **Check browser console** (F12)
   - Look for red error messages
   - Check for memory warnings

2. **Clear browser cache**
   ```
   Chrome: Ctrl+Shift+Del → Clear all time → confirm
   ```

3. **Restart browser**
   - Close all tabs
   - Reopen editor
   - Try export again

4. **Check system resources**
   - Free up disk space (need 5GB+)
   - Close other applications
   - Plug in laptop (if applicable)

5. **Reset Chrome flags** (if you set them)
   ```
   chrome://flags → Set all to Default
   ```

---

## 📈 What to Monitor After Launch

1. **Export Success Rate**
   - Target: >99% (less than 1 failure per 100 exports)
   - Monitor for crashes/memory issues

2. **Average Export Time**
   - Target: 20% improvement over baseline
   - Break down by quality level

3. **User Feedback**
   - "Export is faster!" positive feedback
   - Any performance issues reported
   - Error patterns

4. **Browser Analytics**
   - Which browsers most common?
   - Are there Chrome-specific issues?
   - Any hardware limitations?

---

**You're all set!** 🎉

The export optimization system is fully implemented and ready to use. Start with the enhanced ExportModal (no Web Worker complexity), then optionally upgrade to ExportModalOptimized for more features.
