import './globals.css';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: 'Distributed Cache Simulator',
  description:
    'Interactive consistent-hashing cache simulator with LRU/LFU eviction, replication, TTL and live cluster visualization.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${mono.variable} ${grotesk.variable}`}>
      <body className="bg-[#0A0A0A] text-white antialiased">{children}</body>
    </html>
  );
}
