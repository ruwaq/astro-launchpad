'use client';

/**
 * SkipLink - Skip to main content link for keyboard navigation
 *
 * WCAG 2.4.1: Bypass Blocks
 * Allows keyboard users to skip navigation and go directly to main content.
 *
 * Usage:
 * 1. Add <SkipLink /> at the start of your layout (before nav)
 * 2. Add id="main-content" to your main content area
 */

interface SkipLinkProps {
  /** Target element ID to skip to (default: 'main-content') */
  targetId?: string;
  /** Link text (default: 'Skip to main content') */
  text?: string;
}

export function SkipLink({
  targetId = 'main-content',
  text = 'Skip to main content',
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-lg focus:shadow-lg focus:font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
    >
      {text}
    </a>
  );
}
