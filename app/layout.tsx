import type { Metadata, Viewport } from 'next';
import { Alfa_Slab_One, Bitter, Courier_Prime } from 'next/font/google';
import './globals.css';

const display = Alfa_Slab_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const body = Bitter({
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-body-loaded',
  display: 'swap',
});

const mono = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'R-Land Hunt',
  description: 'Geofenced scavenger hunts for campus clubs. No volunteer at every clue.',
};

export const viewport: Viewport = {
  themeColor: '#241a12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body
        style={{
          // The loaded webfonts take over the tokens declared in globals.css.
          ['--font-display' as string]: `var(--font-display-loaded), Georgia, serif`,
          ['--font-body' as string]: `var(--font-body-loaded), Georgia, serif`,
          ['--font-mono' as string]: `var(--font-mono-loaded), 'Courier New', monospace`,
        }}
      >
        {children}
      </body>
    </html>
  );
}
