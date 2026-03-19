// ─────────────────────────────────────────────────────────────
// VERIFICATION_CHECKLIST.md — Test that all optimizations work
// ─────────────────────────────────────────────────────────────

# ✅ Verification Checklist for Export Optimizations

Use this checklist to verify that all optimizations are working correctly.

---

## 🎯 PHASE 1: File Structure Verification

Run this in your terminal:

```bash
# Verify all new files exist
ls -la src/utils/memoryUtils.ts
ls -la src/utils/offscreenCanvasRenderer.ts
ls -la src/utils/exportOptimizationGuide.ts
ls -la src/hooks/useFFmpegOptimized.ts
ls -la src/hooks/usePerformanceMonitor.ts
ls -la public/exportWorker.ts
ls -la src/components/panels/ExportModalOptimized.tsx
```

**Expected**: All files exist
**Action if fails**: Check file creation outputs above

---

## 🔍 PHASE 2: TypeScript Compilation Check

```bash
# Check for TypeScript errors
npm run build

# Expected output:
# info  - Linting and checking validity of types...
# ✓ Type checking passed
```

**Expected**: No errors, all imports resolve
**Action if fails**: 
- Run: `npm install` (in case of missing deps)
- Check console for specific error messages
- Ensure `.tsx` file references are correct

---

## 🧪 PHASE 3: Runtime Memory Check

1. **Open the video editor** (`npm run dev`)
2. **Add some clips** to the timeline
3. **Open browser DevTools** (F12)
4. **Go to Console tab**
5. **Create new video project** (if not already created)
6. **Look for these messages**:

```
✅ Expected Console Output During Startup:
(normal - no special messages needed on startup)
```

**✅ Success**: No red errors in console
**❌ Failure**: Red error messages about imports or missing modules

---

## 🚀 PHASE 4: Export Modal Test

### 4A: Create Test Video
```
1. Click "+" to add media
2. Upload a test video (30 seconds)
3. Drag to timeline to create a clip
4. Make sure you have at least 1 visible clip
```

### 4B: Basic Export
```
1. Click "Export" button
2. Select "Draft" quality (safest test)
3. Click "Start Export"
4. Watch the progress bar
```

### 4C: Check Export Modal Features
Look for these UI elements:
- ✅ Project info badge (name, resolution, duration)
- ✅ Memory usage display (if available)
- ✅ Optimization tips box (blue background)
- ✅ Three quality options (Draft, High, 4K)
- ✅ Export button changes to "Start Optimized Export"

**✅ Success**: All UI elements visible and clickable
**❌ Failure**: Missing elements or errors on screen

---

## 📊 PHASE 5: Performance Monitoring

While export is running:

### During Recording Phase (🎥 symbol)
```
Expected: Progress bar fills 0% → 100%
Check console for:
  ⏱️  Recording started...
  
✅ Success: Progress visible, no freezing
❌ Failure: No progress, UI frozen, or errors
```

### During Transcoding Phase (⚙️ symbol)
```
Expected: Progress bar fills again
Check console for:
  ⏱️  Transcoding to H.264/MP4 started...
  
✅ Success: Separate progress bar, UI responsive
❌ Failure: Main thread blocked, no progress update
```

### Check Console Logs
```bash
# Open DevTools Console (F12)
# You should see timing information like:

⏱️  FFmpeg Engine Load started...
✅ FFmpeg Engine Load completed in 2.45s (+30MB)
⏱️  Recording started...
✅ Recording completed in 42.10s (+120MB)
⏱️  Transcoding to H.264/MP4 started...
✅ Transcoding to H.264/MP4 completed in 15.20s (-80MB)
🧹 Releasing resources...
  - Stopping 1 MediaRecorders
  - Cleaning up 3 media elements
  - Revoking 1 object URLs
  - Memory after cleanup: 45.23MB
```

**✅ Success**: Clear progress through all phases
**❌ Failure**: Stuck on one phase, missing logs

---

## 🎯 PHASE 6: Memory Leak Test

### Test 1: Single Export Cleanup
```
1. Note initial memory (DevTools → Memory)
2. Do one full export (Draft quality)
3. After completion, click "Close"
4. Wait 5 seconds
5. Check memory again

Expected: Memory returns to baseline (within 10MB)
```

### Test 2: Multiple Export Sequence
```
1. Check initial memory: X MB
2. Do 5 exports in a row (all Draft quality)
3. After all complete, close modal
4. Wait 10 seconds
5. Check final memory: Should be ~X MB (not 5X MB)

Expected: Memory returns to original value
Not expected: Memory keeps increasing
```

**✅ Success**: Memory returns to baseline
**❌ Failure**: Memory keeps growing (memory leak)

---

## ⚡ PHASE 7: Quality Settings Test

### Test Draft Quality
```
1. Create a 1-minute test video
2. Select "Draft" (720p, 24FPS)
3. Start export
4. Time how long it takes
5. Expected: 5-10 minutes for 1-hour video
```

### Test High Quality
```
1. Same video
2. Select "High" (1080p, 30FPS)
3. Start export
4. Time how long it takes
5. Expected: 10-15 minutes for 1-hour video
```

### Verify FPS is Different
```
1. In browser console, during export:
   // Check the frame rate being used
   console.log(document.elementsFromPoint(0, 0)); // Watch FPS counter
   
2. Draft should be faster than High
3. Expected speed difference: High takes ~30% longer

✅ Success: Draft is noticeably faster
❌ Failure: Both qualities take same time
```

---

## 🔊 PHASE 8: Audio Sync Test

```
1. Create video with music/voiceover
2. Export using optimized export
3. Download and play the exported video
4. Listen for audio sync issues

Expected: Audio stays in sync with video
Not expected: Audio ahead or behind video
```

**✅ Success**: Audio perfectly synced
**❌ Failure**: Audio drift or desync

---

## 📈 PHASE 9: Performance Report Test

```
1. Complete an export
2. In modal showing "Export Successful!"
3. Look for "📊 View Performance Report" button
4. Click it
5. Read the report

Expected Report Should Show:
  - Total Duration: X seconds
  - Recording Duration: Y seconds
  - Transcoding Duration: Z seconds
  - Input Size: size of WebM
  - Output Size: size of MP4
  - Compression: percentage
  - Bitrate: e.g., "8.5 Mbps"
  - Peak Memory: e.g., "380MB"
  - Average Memory: e.g., "250MB"

✅ Success: Report shows all metrics
❌ Failure: Report missing or errors
```

---

## 🌐 PHASE 10: Browser Compatibility Test

Test export on different browsers:

### Chrome (Primary)
```
✅ Start export
✅ Check performance report
✅ Verify Web Worker logs in console
```

### Firefox
```
✅ Start export
✅ Video exports successfully
✅ No console errors
```

### Safari (Mac)
```
✅ Start export
✅ Web Audio API works
✅ MediaRecorder supports VP9
```

### Edge
```
✅ Start export
✅ Hardware acceleration available
✅ Export completes
```

**✅ Success**: Works on all 4 browsers
**⚠️  Acceptable**: Works on Chrome + 2 others
**❌ Failure**: Only works on one browser

---

## 💾 PHASE 11: Memory Monitoring Display

```
1. During export
2. Look for memory usage in export modal
3. Should show something like:
   "💾 Memory Usage
    380.2MB
    47% of heap"

Expected: Memory monitoring displays correctly
```

---

## 🎨 PHASE 12: UI/UX Polish Check

```
□ Export button has proper hover states
□ Progress bars animate smoothly
□ Buttons are clickable during export
□ No text is cut off or overlapping
□ Color scheme is consistent
□ Animations feel responsive
□ Error messages are clear and helpful
□ Success message is celebratory (✨)
□ Tips box can be dismissed
□ All icons display correctly
```

**✅ Success**: 8+ checkboxes marked
**❌ Failure**: Less than 5 items working

---

## 🔧 PHASE 13: Error Recovery Test

### Test Insufficient Memory
```
1. Open DevTools Network tab
2. Throttle network to "Offline"
3. Try to export
4. Expected: Error message about offline/network
5. Click "Try Again"
6. Re-enable network
7. Try export again
8. Expected: Works after retry
```

### Test Interrupt Export
```
1. Start export
2. During recording, click close (X)
3. Click "Cancel" when asked
4. Click Export again
5. Expected: Can export again without issues
```

**✅ Success**: Error recovery works
**❌ Failure**: Stuck in error state

---

## 📋 Final Verification Scores

### Score Card

Mark each section as ✅ Pass or ❌ Fail:

```
Phase 1: File Structure          [  ]
Phase 2: TypeScript Compilation  [  ]
Phase 3: Runtime Memory Check    [  ]
Phase 4: Export Modal Test       [  ]
Phase 5: Performance Monitoring  [  ]
Phase 6: Memory Leak Test        [  ]
Phase 7: Quality Settings Test   [  ]
Phase 8: Audio Sync Test         [  ]
Phase 9: Performance Report Test [  ]
Phase 10: Browser Compatibility  [  ]
Phase 11: Memory Monitoring      [  ]
Phase 12: UI/UX Polish Check     [  ]
Phase 13: Error Recovery Test    [  ]

TOTAL: ___ / 13 phases passed
```

### Success Criteria
- **13/13 (100%)**: Perfect! All optimizations working
- **11-12/13 (85-92%)**: Great! Minor UI issues only
- **9-10/13 (69-77%)**: Good! Core features working
- **7-8/13 (54-62%)**: Okay! Some issues to fix
- **<7 (< 54%)**: Needs work! Debug each failure

---

## 🐛 If Tests Fail

### Check 1: Console for Errors
```
Open DevTools (F12) → Console tab
Look for red error messages
Note the exact error text
```

### Check 2: Network Issues
```
DevTools → Network tab
Filter: "export"
Look for failed requests
Check: Is worker loading? (/exportWorker.ts)
```

### Check 3: Code Issues
```
Verify all imports use correct paths:
✓ src/utils/memoryUtils.ts (not utils/memory.ts)
✓ src/hooks/useFFmpegOptimized.ts
✓ src/components/panels/ExportModalOptimized.tsx
```

### Check 4: Browser Support
```
Some features require:
- ES2020+ support (modern browsers)
- Web Workers support (all modern browsers)
- SharedArrayBuffer (Chrome/Firefox)
- Web Audio API (all modern browsers)

If using old browser, upgrade to:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
```

---

## 🎉 Success!

When all tests pass (13/13):

✅ Congratulations! All export optimizations are working perfectly.

You can now:
1. **Deploy to production** with confidence
2. **Monitor real-world performance** with the built-in metrics
3. **Gather user feedback** on export speed improvements
4. **Iterate** with additional optimizations if needed

---

## 📞 Quick Reference

### Critical Files to Test
- `/src/components/panels/ExportModal.tsx` - Main export UI
- `/src/hooks/useFFmpegOptimized.ts` - FFmpeg worker support
- `/public/exportWorker.ts` - Background Worker

### Key Imports to Check
```typescript
import { MemoryMonitor } from '@/utils/memoryUtils';
import { useFFmpegOptimized } from '@/hooks/useFFmpegOptimized';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
```

### Performance Thresholds
```
✅ Good:     Export <20s, Memory <300MB
⚠️  Okay:    Export <60s, Memory <400MB
❌ Bad:      Export >2min, Memory >500MB
```

---

**Last Updated**: March 2026
**Status**: Complete Verification Guide
**Expected Time**: 30-45 minutes to complete full checklist
