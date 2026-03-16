'use client';
import Link from 'next/link';
import { useEditorStore } from '@/store/useEditorStore';

export default function DashboardPage() {
  const { settings } = useEditorStore();

  return (
    <main className="min-h-screen p-8 bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            My Projects
          </h1>
          <Link href="/editor/new" className="btn btn-primary">
             + Create New Project
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Demo Project Card */}
          <Link href="/editor/demo" className="group block">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all hover:shadow-2xl hover:shadow-indigo-500/10">
              <div className="aspect-video bg-slate-800 flex items-center justify-center relative">
                <span className="text-4xl text-slate-700 group-hover:scale-110 transition-transform">🎬</span>
                <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">Demo Project</h3>
                <p className="text-xs text-slate-500 mt-1">Last edited 2 mins ago</p>
                <div className="flex gap-2 mt-4">
                  <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">1080p</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">30 fps</span>
                </div>
              </div>
            </div>
          </Link>

          {/* New Project Placeholder */}
          <Link href="/editor/new" className="border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-900/50 hover:border-slate-700 transition-all p-8 group">
            <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 group-hover:bg-slate-800 transition-all">
              <span className="text-2xl">+</span>
            </div>
            <p className="text-sm font-medium text-slate-500">New Project</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
