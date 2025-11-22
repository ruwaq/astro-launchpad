'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ui-surface">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Navbar integrated in dashboard */}
        <Navbar />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-ui-background">
          {children}
        </main>
      </div>
    </div>
  );
}
