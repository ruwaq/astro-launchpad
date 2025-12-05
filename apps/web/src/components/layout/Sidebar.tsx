'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlusCircle, Compass, Wallet, Settings, Trophy } from 'lucide-react';
import Image from 'next/image';

const navigation = [
  { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { name: 'Create Token', href: '/create', icon: PlusCircle },
  { name: 'Explore', href: '/explore', icon: Compass },
  { name: 'Portfolio', href: '/portfolio', icon: Wallet },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  // On mobile, navigation is handled by MobileBottomNav
  // This sidebar is only visible on desktop (lg+)
  return (
    <>
      {/* Sidebar - Desktop only */}
      <aside
        id="main-navigation"
        role="navigation"
        aria-label="Main navigation"
        className="hidden lg:block w-64 bg-white border-r border-ui-border"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-ui-border">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/images/xshiblogo.ico"
                alt="Astro Shiba"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <h1 className="text-xl font-bold text-brand-primary">
                  Astro Shiba
                </h1>
                <p className="text-xs text-ui-text-secondary">
                  Token Launchpad
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1" aria-label="Primary">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-150
                    ${
                      isActive
                        ? 'bg-brand-primary text-white'
                        : 'text-ui-text-secondary hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Network Badge */}
          <div className="p-4 border-t border-ui-border">
            <div className="px-4 py-2 bg-brand-blue-50 rounded-lg">
              <p className="text-xs font-medium text-brand-blue">
                Network: Testnet
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
