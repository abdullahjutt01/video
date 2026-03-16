import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#0d0d1a' }}>
      {/* Gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div style={{
          position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)',
          width: '80vw', height: '60vh',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)',
        }} />
      </div>

      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto animate-fade-in">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-4 py-1.5 rounded-full text-indigo-400 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse-slow" />
          No Resolution Limits — Up to 4K Export
        </div>

        {/* Heading */}
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight" style={{
          background: 'linear-gradient(135deg, #e2e8f0 0%, #a5b4fc 50%, #818cf8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Professional Video Editing
          <br />
          <span style={{ color: '#6366f1', WebkitTextFillColor: '#6366f1' }}>Without Limits</span>
        </h1>

        <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
          Edit, render, and export stunning 4K videos in your browser.
          AI voiceovers, auto-captions, multi-track timeline — powered by WebAssembly and GPU cloud rendering.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/editor/demo" className="btn btn-primary text-base px-8 py-3 shadow-lg shadow-indigo-500/20">
            🎬 Open Editor
          </Link>
          <Link href="/dashboard" className="btn btn-ghost text-base px-8 py-3">
            📁 My Projects
          </Link>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          {[
            '✨ Multi-Track Timeline', '🎙️ AI Voiceover', '📝 Auto-Captions',
            '⚡ GPU 4K Export', '🔄 Undo/Redo', '🎵 Audio Mixing',
          ].map((f) => (
            <span key={f} className="text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              {f}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
