'use client';

/**
 * PWA Install Prompt Component
 *
 * Shows install instructions for mobile users:
 * - iOS: Instructions to use Share > Add to Home Screen
 * - Android: Native install prompt via beforeinstallprompt
 * - Desktop: Browser install button
 */

import { useState, useEffect } from 'react';
import { X, Download, Share, Plus, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const wasDismissed = localStorage.getItem('pwa_install_dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /android/.test(userAgent);

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Check if running as PWA
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isPWA);

    // Don't show if already installed
    if (isPWA) {
      return;
    }

    // Listen for Android install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!wasDismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // MEMORY LEAK FIX: Track timeout for cleanup
    let iosPromptTimeout: ReturnType<typeof setTimeout> | null = null;

    // Show iOS prompt after delay
    if (isIOSDevice && !isPWA && !wasDismissed) {
      iosPromptTimeout = setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      // MEMORY LEAK FIX: Clear timeout on unmount
      if (iosPromptTimeout) {
        clearTimeout(iosPromptTimeout);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  // Don't show if already installed or dismissed
  if (isStandalone || dismissed || !showPrompt) {
    return null;
  }

  // iOS Instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg animate-slide-up">
        <div className="max-w-lg mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-brand-blue rounded-xl flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Install Astro Shiba</h3>
                <p className="text-sm text-gray-500">Add to your home screen</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-700 mb-3">
              Install this app on your iPhone for the best experience:
            </p>
            <ol className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>Tap the <Share className="inline h-4 w-4 text-brand-blue" /> Share button</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>Scroll and tap <Plus className="inline h-4 w-4" /> Add to Home Screen</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>Tap Add to confirm</span>
              </li>
            </ol>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full py-3 text-sm text-gray-500 hover:text-gray-700"
          >
            Maybe later
          </button>
        </div>
      </div>
    );
  }

  // Android / Desktop Install Button
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-4 inset-x-4 z-50 md:bottom-8 md:right-8 md:left-auto md:w-auto">
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-w-sm mx-auto md:mx-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-brand-blue rounded-xl flex items-center justify-center">
                <Download className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Install App</h3>
                <p className="text-sm text-gray-500">Quick access, works offline</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 py-2.5 px-4 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary-600 transition-colors"
            >
              Install Now
            </button>
            <button
              onClick={handleDismiss}
              className="py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Mobile wallet banner for users without wallet connected
export function MobileWalletBanner() {
  const [show, setShow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setIsMobile(mobile);

    // Show banner after a delay for mobile users
    if (mobile) {
      const dismissed = localStorage.getItem('mobile_wallet_banner_dismissed');
      if (!dismissed) {
        setTimeout(() => setShow(true), 5000);
      }
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('mobile_wallet_banner_dismissed', 'true');
  };

  if (!isMobile || !show) {
    return null;
  }

  return (
    <div className="fixed top-0 inset-x-0 z-50 p-4 bg-gradient-to-r from-brand-primary to-brand-blue text-white">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Smartphone className="h-5 w-5" />
          <div className="text-sm">
            <p className="font-medium">Get the best experience!</p>
            <p className="text-white/80">Install LOBSTR or xBull wallet</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-white/20 rounded"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
