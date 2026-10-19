import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = { title: 'TaskFlow', description: 'Team task management', manifest: '/manifest.webmanifest' };
export const viewport: Viewport = { themeColor: '#1f5f4a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <AuthProvider><AppShell>{children}</AppShell></AuthProvider>
    </body></html>
  );
}
