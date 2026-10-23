import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Identity Gateway - Pre-Screening Biometrik & Liveness Wawancara Online',
  description:
    'Sistem Pre-Screening Identity Gateway berbasis Client-Side 3D Liveness Detection & Dashboard Audit Visual untuk rekrutmen kerja online.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-background text-foreground bg-ambient-maroon selection:bg-rose-500/30 selection:text-rose-200 antialiased">
        {children}
      </body>
    </html>
  );
}
