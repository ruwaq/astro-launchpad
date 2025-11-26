import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

// PWA Viewport configuration for mobile
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#fa9427',
};

export const metadata: Metadata = {
  title: 'Astro Shiba - Stellar Token Launchpad',
  description: 'Create and trade meme tokens on Stellar in seconds. Fair launch, bonding curve, instant liquidity.',
  keywords: ['stellar', 'soroban', 'token', 'launchpad', 'meme coins', 'crypto', 'defi', 'bonding curve'],
  authors: [{ name: 'Astro Shiba Team' }],
  creator: 'Astro Shiba',
  publisher: 'Astro Shiba',
  icons: {
    icon: [
      { url: '/images/xshiblogo.ico' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Astro Shiba',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Astro Shiba',
    title: 'Astro Shiba - Stellar Token Launchpad',
    description: 'Create and trade meme tokens on Stellar in seconds',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Astro Shiba - Stellar Token Launchpad',
    description: 'Create and trade meme tokens on Stellar in seconds',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-gray-50">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
