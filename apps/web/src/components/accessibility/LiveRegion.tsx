'use client';

import { useEffect, useState, useRef } from 'react';

interface LiveRegionProps {
  /** The message to announce to screen readers */
  message: string;
  /** Politeness level: 'polite' for non-urgent, 'assertive' for important updates */
  politeness?: 'polite' | 'assertive';
  /** Clear the message after this many ms (default: 0 = don't clear) */
  clearAfter?: number;
  /** Additional CSS classes for styling */
  className?: string;
  /** Whether to visually show the message (default: false = sr-only) */
  visible?: boolean;
}

/**
 * LiveRegion - Announces dynamic content changes to screen readers
 *
 * WCAG 4.1.3: Status Messages
 * Use this component to announce:
 * - Form submission results
 * - Search results count
 * - Loading states
 * - Transaction status updates
 * - Error messages
 */
export function LiveRegion({
  message,
  politeness = 'polite',
  clearAfter = 0,
  className = '',
  visible = false,
}: LiveRegionProps) {
  const [currentMessage, setCurrentMessage] = useState(message);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Update message
    setCurrentMessage(message);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout if clearAfter is specified
    if (clearAfter > 0 && message) {
      timeoutRef.current = setTimeout(() => {
        setCurrentMessage('');
      }, clearAfter);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, clearAfter]);

  const baseClasses = visible
    ? className
    : 'sr-only';

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={baseClasses}
    >
      {currentMessage}
    </div>
  );
}

/**
 * SearchResultsAnnouncer - Specialized for search result counts
 */
interface SearchResultsAnnouncerProps {
  count: number;
  isLoading?: boolean;
  searchTerm?: string;
}

export function SearchResultsAnnouncer({
  count,
  isLoading = false,
  searchTerm = '',
}: SearchResultsAnnouncerProps) {
  const message = isLoading
    ? 'Searching...'
    : searchTerm
      ? `${count} result${count !== 1 ? 's' : ''} found for "${searchTerm}"`
      : `${count} item${count !== 1 ? 's' : ''} available`;

  return <LiveRegion message={message} politeness="polite" />;
}

/**
 * TransactionStatusAnnouncer - Specialized for transaction status
 */
interface TransactionStatusAnnouncerProps {
  status: 'idle' | 'pending' | 'success' | 'error';
  errorMessage?: string;
  transactionType?: string;
}

export function TransactionStatusAnnouncer({
  status,
  errorMessage,
  transactionType = 'Transaction',
}: TransactionStatusAnnouncerProps) {
  let message = '';

  switch (status) {
    case 'pending':
      message = `${transactionType} in progress, please wait...`;
      break;
    case 'success':
      message = `${transactionType} completed successfully`;
      break;
    case 'error':
      message = errorMessage
        ? `${transactionType} failed: ${errorMessage}`
        : `${transactionType} failed. Please try again.`;
      break;
    default:
      message = '';
  }

  return (
    <LiveRegion
      message={message}
      politeness={status === 'error' ? 'assertive' : 'polite'}
    />
  );
}
