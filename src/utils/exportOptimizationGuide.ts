// ─────────────────────────────────────────────────────────────
// exportOptimizationGuide.ts — Browser & system optimization tips
// ─────────────────────────────────────────────────────────────
'use client';

/**
 * Browser optimization tips for faster video export
 * These are recommendations that users can follow for best performance
 */

export const OPTIMIZATION_GUIDE = {
  hardwareAcceleration: {
    title: '⚡ Enable Hardware Acceleration',
    description:
      'GPU acceleration offloads video rendering to graphics hardware, significantly speeding up export.',
    instructions: [
      'Chrome: Settings → System → Toggle "Use hardware acceleration" ON',
      'Firefox: Preferences → Performance → Check "Use hardware acceleration"',
      'Safari: Automatically enabled on Mac',
      'Edge: Settings → System and performance → "Use hardware acceleration" ON',
    ],
    impact: '30-50% faster rendering',
  },

  tabFocus: {
    title: '🎯 Keep Tab in Focus During Export',
    description:
      'Browsers throttle background tasks to save battery. An unfocused tab will have export speed limited to 10-15%.',
    instructions: [
      'Do NOT switch tabs or minimize window during export',
      'Keep the video editor tab active and visible',
      'Close other browser tabs to free up resources',
      'Disable browser extensions temporarily (they consume CPU)',
    ],
    impact: '10-15x slower if tab is backgrounded',
  },

  resolutionFPS: {
    title: '🎥 Optimize Resolution & FPS Settings',
    description:
      'Lower resolution and FPS significantly reduce export time. Start with a lower quality preset.',
    presets: [
      {
        name: 'Draft (Fastest)',
        resolution: '720p',
        fps: 24,
        quality: 'Low',
        estimatedTime: '2-5x faster',
        use: 'Previews, quick exports, social media shorts',
      },
      {
        name: 'High (Balanced)',
        resolution: '1080p',
        fps: 30,
        quality: 'Medium',
        estimatedTime: '4-8x baseline',
        use: 'YouTube, Instagram, TikTok',
      },
      {
        name: '4K (Professional)',
        resolution: '2160p',
        fps: 60,
        quality: 'High',
        estimatedTime: '8-16x baseline',
        use: 'Cinema, archival, professional use',
      },
    ],
    tip: 'Exporting 1080p@30fps is 2x faster than 4K@60fps',
  },

  systemOptimization: {
    title: '🖥️ System-Level Optimizations',
    steps: [
      'Close unnecessary applications (Discord, Spotify, Chrome tabs)',
      'Disable live wallpapers and visual effects',
      'Disable auto-updates temporarily',
      'Plug in power adapter (laptop)',
      'Ensure adequate free disk space (at least 8GB for 1080p)',
      'Check CPU/GPU temperatures (thermal throttling reduces speed)',
      'Use a fast SSD instead of HDD',
    ],
    impact: '20-40% faster overall',
  },

  networkOptimization: {
    title: '🌐 Network Considerations',
    note: 'Export is local - no internet needed. But if background sync is enabled:',
    steps: [
      'Disable cloud sync temporarily (Google Drive, Dropbox)',
      'Disable automatic backups',
      'Close video streaming services',
      'Use wired connection if available (more stable)',
    ],
  },

  browserSettings: {
    title: '⚙️ Browser-Specific Settings',
    chrome: [
      'Open chrome://settings/system',
      'Ensure "Use hardware acceleration when available" is TRUE',
      'Set Process priority: "Normal" or "High"',
      'Disable "Preload search results"',
    ],
    firefox: [
      'about:preferences → Performance',
      'Check "Use hardware acceleration"',
      'Increase "Content process limit" if available',
      'Disable automatic updates during export',
    ],
    edge: [
      'Settings → System and performance',
      'Toggle "Use hardware acceleration" ON',
      'Set efficiency mode OFF during export',
    ],
  },

  perfTips: {
    title: '⚡ Performance Tips for This Video Editor',
    tips: [
      {
        tip: 'Use Draft quality for previewing edits',
        reason: 'Fast feedback loop',
      },
      {
        tip: 'Export at night or when CPU is free',
        reason: 'Less system contention',
      },
      {
        tip: 'Reduce timeline complexity before export',
        reason: 'Fewer effects = faster preview rendering',
      },
      {
        tip: 'Trim unused clips',
        reason: 'Smaller timeline = less data to process',
      },
      {
        tip: 'Use preset colors instead of custom gradients',
        reason: 'Reduces GPU load',
      },
      {
        tip: 'Limit text overlays',
        reason: 'Text rendering is CPU-intensive',
      },
      {
        tip: 'Use standard aspect ratios (16:9, 9:16, 1:1)',
        reason: 'Avoids pixel scaling overhead',
      },
    ],
  },

  commandLineFlags: {
    title: '🔧 Advanced: Chrome Launch Flags',
    description:
      'For advanced users: Launch Chrome with these flags for additional performance',
    flags: [
      '--enable-gpu-rasterization',
      '--enable-features=VaapiVideoDecoder,VaapiVideoEncoder',
      '--disable-power-saving-mode',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--enable-precise-memory-info',
    ],
    usage: 'chrome.exe --enable-gpu-rasterization --disable-renderer-backgrounding',
  },

  memoryManagement: {
    title: '💾 Memory Management',
    tips: [
      'Close unnecessary browser tabs before export',
      'Restart browser if memory usage is high (>4GB)',
      'Monitor memory with Chrome DevTools (F12 → Memory)',
      'Watch for memory leaks during long exports',
    ],
  },

  troubleshooting: {
    title: '🔧 Troubleshooting',
    issues: [
      {
        problem: 'Export is very slow',
        solutions: [
          'Check: Hardware acceleration enabled?',
          'Check: Is tab in focus?',
          'Check: System CPU/GPU temperature?',
          'Try: Restart browser and export again',
          'Try: Use Draft quality first',
        ],
      },
      {
        problem: 'Browser crashes during export',
        solutions: [
          'Out of memory - try lower resolution/FPS',
          'Close other applications',
          'Check available disk space',
          'Update GPU drivers',
        ],
      },
      {
        problem: 'Exported video has glitches',
        solutions: [
          'Disable hardware acceleration temporarily',
          'Try a different quality setting',
          'Reduce number of effects/overlays',
          'Ensure stable power (plug in laptop)',
        ],
      },
      {
        problem: 'Export gets stuck at 0%',
        solutions: [
          'Refresh page and try again',
          'Check browser console (F12) for errors',
          'Try Draft quality',
          'Clear browser cache',
        ],
      },
    ],
  },
};

/**
 * Get optimization tips for current system
 */
export function getOptimizationScore(): {
  score: number;
  recommendations: string[];
} {
  const recommendations: string[] = [];
  let score = 100;

  // Check hardware acceleration
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('webgl');
  if (!ctx) {
    recommendations.push('Enable GPU/WebGL support in your browser for 30-50% faster export');
    score -= 20;
  }

  // Check memory
  if (performance.memory) {
    const heapLimit = performance.memory.jsHeapSizeLimit;
    if (heapLimit < 500 * 1024 * 1024) {
      // < 500MB
      recommendations.push('Close other browser tabs to free up RAM');
      score -= 10;
    }
  }

  // Check available disk space (proxy check)
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then(({ quota, usage }) => {
      const available = quota - usage;
      if (available < 5 * 1024 * 1024 * 1024) {
        // < 5GB
        recommendations.push('Ensure at least 5GB free disk space for export');
      }
    });
  }

  return { score: Math.max(0, score), recommendations };
}

/**
 * Generate personalized optimization report
 */
export function generateOptimizationReport(): string {
  const { score, recommendations } = getOptimizationScore();

  const report = `
╔════════════════════════════════════════════════════════════════╗
║           EXPORT OPTIMIZATION CHECKLIST                        ║
╚════════════════════════════════════════════════════════════════╝

System Score: ${score}/100

BEFORE EXPORTING, ENSURE:
${OPTIMIZATION_GUIDE.tabFocus.instructions.map((i) => `  ✓ ${i}`).join('\n')}

QUALITY RECOMMENDATIONS:
${OPTIMIZATION_GUIDE.resolutionFPS.presets
  .map(
    (p) =>
      `  • ${p.name}: ${p.resolution} @ ${p.fps}fps (${p.estimatedTime})`
  )
  .join('\n')}

SYSTEM CHECKS:
${OPTIMIZATION_GUIDE.systemOptimization.steps
  .slice(0, 3)
  .map((s) => `  □ ${s}`)
  .join('\n')}

${recommendations.length > 0 ? `\nRECOMMENDATIONS:\n${recommendations.map((r) => `  ⚠️  ${r}`).join('\n')}` : ''}

For more details, see OPTIMIZATION_GUIDE constant.
  `;

  return report;
}
