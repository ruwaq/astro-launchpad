import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Astro Shiba - Stellar Token Launchpad',
  description: 'Fair launch tokens on Stellar with bonding curves and automatic AMM graduation',
  icons: {
    icon: '/images/xshiblogo.ico',
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
