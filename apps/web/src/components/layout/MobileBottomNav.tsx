/**
 * Mobile Bottom Navigation
 *
 * Pump.fun style bottom tab navigation for mobile:
 * - Persistent visibility (always shown)
 * - 48x48dp touch targets minimum
 * - 4-5 core navigation items
 * - Active state with animation
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  PlusCircle,
  Compass,
  Wallet,
  User,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Explore', href: '/explore', icon: Compass },
  { name: 'Create', href: '/create', icon: PlusCircle },
  { name: 'Portfolio', href: '/portfolio', icon: Wallet },
  { name: 'Profile', href: '/settings', icon: User },
];

export const MobileBottomNav = memo(function MobileBottomNav() {
  const pathname = usePathname();

  // Check if we're on a token page (hide nav for focused trading experience)
  const isTokenPage = pathname?.startsWith('/t/');

  // Hide on token pages for more screen real estate during trading
  if (isTokenPage) {
    return null;
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-ui-border shadow-lg safe-area-inset-bottom"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const isCreate = item.href === '/create';

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                relative flex flex-col items-center justify-center
                min-w-[48px] min-h-[48px] px-3 py-1
                rounded-xl transition-colors
                ${isActive
                  ? 'text-brand-primary'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Special create button styling */}
              {isCreate ? (
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-gradient-to-br from-brand-primary to-orange-500 text-white shadow-lg"
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </motion.div>
              ) : (
                <>
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="relative"
                  >
                    <Icon
                      className={`h-6 w-6 ${isActive ? 'stroke-[2.5]' : ''}`}
                      aria-hidden="true"
                    />
                    {/* Active indicator dot */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-primary"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </motion.div>
                  <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-brand-primary' : ''}`}>
                    {item.name}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </div>

      {/* Safe area padding for iOS */}
      <div className="h-safe-area-inset-bottom bg-white" />
    </nav>
  );
});

export default MobileBottomNav;
