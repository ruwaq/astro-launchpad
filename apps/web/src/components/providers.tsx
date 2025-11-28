'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApolloProvider } from '@apollo/client/react';
import { ReactNode, useState } from 'react';
import { WalletProvider } from '@/contexts/WalletContext';
import { Toaster } from 'react-hot-toast';
import { apolloClient } from '@/lib/graphql';
import { InstallPrompt, MobileWalletBanner } from '@/components/pwa/InstallPrompt';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60000, // PERFORMANCE: Increased from 10s to 60s
            retry: 3,
            refetchOnWindowFocus: false, // PERFORMANCE: Disabled to prevent unnecessary refetches
          },
        },
      })
  );

  return (
    <ApolloProvider client={apolloClient}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          {children}
          <InstallPrompt />
          <MobileWalletBanner />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#1a1a1a',
                border: '1px solid #e5e5e5',
                borderRadius: '0.75rem',
                padding: '16px',
              },
              success: {
                iconTheme: {
                  primary: '#144722',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </WalletProvider>
      </QueryClientProvider>
    </ApolloProvider>
  );
}
