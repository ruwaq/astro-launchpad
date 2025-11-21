'use client';

import { AlertCircle, Download, ExternalLink, X } from 'lucide-react';

interface FreighterInstallGuideProps {
  onClose: () => void;
}

export function FreighterInstallGuide({ onClose }: FreighterInstallGuideProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 relative" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-ui-text-secondary hover:text-ui-text-primary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className="p-2 bg-brand-primary-50 rounded-lg">
            <AlertCircle className="h-6 w-6 text-brand-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-ui-text-primary mb-1">
              Freighter Wallet Required
            </h3>
            <p className="text-sm text-ui-text-secondary">
              You need to install Freighter wallet extension to connect to Astro Shiba
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm text-ui-text-primary font-medium mb-2">
                Install Freighter Extension
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href="https://chrome.google.com/webstore/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Chrome/Brave</span>
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
                <a
                  href="https://addons.mozilla.org/en-US/firefox/addon/freighter/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Firefox</span>
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm text-ui-text-primary font-medium mb-1">
                Create or Import Wallet
              </p>
              <p className="text-xs text-ui-text-secondary">
                Follow Freighter&apos;s setup wizard to create a new wallet or import an existing one
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm text-ui-text-primary font-medium mb-1">
                Switch to Testnet
              </p>
              <p className="text-xs text-ui-text-secondary">
                In Freighter, go to Settings → Network → Select &quot;Testnet&quot;
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
              4
            </div>
            <div className="flex-1">
              <p className="text-sm text-ui-text-primary font-medium mb-1">
                Get Test XLM
              </p>
              <p className="text-xs text-ui-text-secondary mb-2">
                Fund your testnet account with free test XLM
              </p>
              <a
                href="https://laboratory.stellar.org/#account-creator?network=test"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-600 transition-colors text-xs"
              >
                <span>Stellar Laboratory</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Refresh Notice */}
          <div className="bg-brand-green-50 border border-brand-green-200 rounded-lg p-4">
            <p className="text-xs text-brand-green-800">
              <strong>After installing:</strong> Refresh this page and click &quot;Connect Wallet&quot; again
            </p>
          </div>
        </div>

        {/* Close Note */}
        <div className="mt-6 pt-4 border-t border-ui-border text-center">
          <p className="text-xs text-ui-text-secondary">
            Already have Freighter? Make sure it&apos;s unlocked and try connecting again
          </p>
        </div>
      </div>
    </div>
  );
}
