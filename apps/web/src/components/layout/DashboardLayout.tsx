'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { SkipLink } from '@/components/accessibility/SkipLink';

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ui-surface">
      {/* Skip to main content link for keyboard navigation */}
      <SkipLink />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Navbar integrated in dashboard */}
        <Navbar />

        {/* Page Content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 lg:p-6 bg-ui-background outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
