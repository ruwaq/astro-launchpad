'use client';

import { Bell, Wallet, LogOut, AlertTriangle } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useBalance } from '@/hooks/useBalance';
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import FocusTrap from 'focus-trap-react';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLocale } from '@/i18n/useLocale';
import { formatAddress } from '@/lib/utils/format';

export function Navbar() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const { t } = useLocale();
  const { balance, isLoading: isLoadingBalance } = useBalance(address);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success(t('common.walletConnected'));
    } catch (error: unknown) {
      // Stellar Wallets Kit handles wallet selection modal
      // User will see available wallets in the modal
      const message = error instanceof Error ? error.message : 'Failed to connect wallet';
      toast.error(message);
    }
  };

  const handleDisconnectClick = useCallback(() => {
    setShowDisconnectConfirm(true);
    setShowDropdown(false);
  }, []);

  const handleDisconnectConfirm = useCallback(() => {
    disconnect();
    setShowDisconnectConfirm(false);
    toast.success(t('common.walletDisconnected'));
  }, [disconnect, t]);

  const handleDisconnectCancel = useCallback(() => {
    setShowDisconnectConfirm(false);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left: Empty space or page title can go here */}
          <div className="flex-1">
            {/* Page title or breadcrumbs can be added here later */}
          </div>

          {/* Right: User Actions */}
          <div className="flex items-center gap-4">
          {/* Language Selector */}
          <LanguageSelector />

          {/* Notifications */}
          <button
            aria-label={t('common.notifications')}
            className="relative p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-ui-text-secondary hover:text-ui-text-primary hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-brand-primary rounded-full" aria-hidden="true" />
            <span className="sr-only">{t('common.newNotifications')}</span>
          </button>

          {/* Wallet Connection */}
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              aria-label={isConnecting ? t('common.connecting') : t('common.connect')}
              aria-busy={isConnecting}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-brand-primary to-brand-blue text-white px-4 sm:px-6 py-2.5 sm:py-2 rounded-lg font-medium hover:shadow-lg active:scale-95 sm:hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-h-[44px]"
            >
              <Wallet className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isConnecting ? t('common.connecting') : t('common.connect')}
              </span>
              <span className="sm:hidden text-sm">
                {isConnecting ? '...' : t('common.connect').split(' ')[0]}
              </span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                aria-expanded={showDropdown}
                aria-haspopup="true"
                aria-label={`Wallet menu for ${formatAddress(address!)}`}
                className="flex items-center gap-2 sm:gap-3 bg-green-50 border border-green-200 px-3 sm:px-4 py-2 rounded-lg hover:bg-green-100 transition-colors min-h-[44px]"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <div className="flex flex-col items-start">
                  <span className="font-mono text-sm text-gray-900">
                    {formatAddress(address!)}
                  </span>
                  <span className="text-xs text-gray-600 font-medium">
                    {isLoadingBalance ? (
                      <span className="inline-block w-16 h-3 bg-gray-200 animate-pulse rounded" />
                    ) : (
                      `${parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 2 })} XLM`
                    )}
                  </span>
                </div>
              </button>

              {/* Dropdown */}
              {showDropdown && (
                <FocusTrap
                  focusTrapOptions={{
                    escapeDeactivates: true,
                    onDeactivate: () => setShowDropdown(false),
                    clickOutsideDeactivates: true,
                    returnFocusOnDeactivate: true,
                  }}
                >
                  <div>
                    {/* Backdrop */}
                    <div
                      role="presentation"
                      aria-hidden="true"
                      className="fixed inset-0 z-40"
                      onClick={() => setShowDropdown(false)}
                    />

                    {/* Dropdown Menu */}
                    <div
                      role="menu"
                      aria-orientation="vertical"
                      aria-label="Wallet options"
                      className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-64 max-w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                    >
                      <div className="p-4 border-b border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">
                          {t('common.connectedWallet')}
                        </p>
                        <p className="font-mono text-sm text-gray-900 break-all mb-3">
                          {address}
                        </p>
                        <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
                          <span className="text-xs text-gray-600">{t('trading.balance')}</span>
                          <span className="font-bold text-sm text-gray-900">
                            {isLoadingBalance ? (
                              <span className="inline-block w-20 h-4 bg-gray-200 animate-pulse rounded" />
                            ) : (
                              `${parseFloat(balance).toLocaleString('en-US', { maximumFractionDigits: 2 })} XLM`
                            )}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleDisconnectClick}
                        role="menuitem"
                        aria-label={t('common.disconnect')}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-900 hover:bg-gray-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4 text-gray-600" aria-hidden="true" />
                        <span>{t('common.disconnect')}</span>
                      </button>
                    </div>
                  </div>
                </FocusTrap>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <FocusTrap
          focusTrapOptions={{
            escapeDeactivates: true,
            onDeactivate: handleDisconnectCancel,
            initialFocus: false,
            returnFocusOnDeactivate: true,
          }}
        >
          <div
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={handleDisconnectCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="disconnect-dialog-title"
          >
            <div
              className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <h3 id="disconnect-dialog-title" className="font-bold text-lg">
                  {t('common.disconnectWallet')}
                </h3>
              </div>
              <p className="text-gray-600 mb-6">
                {t('common.disconnectConfirmMessage')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDisconnectCancel}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDisconnectConfirm}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  {t('common.disconnect')}
                </button>
              </div>
            </div>
          </div>
        </FocusTrap>
      )}
    </header>
  );
}
