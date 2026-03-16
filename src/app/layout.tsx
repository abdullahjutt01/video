import type { Metadata } from 'next';
import './globals.css';
import './components.css';

export const metadata: Metadata = {
  title: 'NoLimit Video Editor — Professional 4K Online Editing',
  description: 'A high-performance online video editing platform with no resolution limits, AI voiceovers, auto-captions, and GPU-powered 4K exports.',
  keywords: ['video editor', 'online video editor', '4K', 'AI voiceover', 'auto captions', 'GPU rendering'],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-[#0d0d1a] text-slate-100 antialiased h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
