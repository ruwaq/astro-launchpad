/**
 * Passkey Authentication Component
 *
 * Professional UI for passkey registration and authentication
 */

'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, Loader2, Check, AlertCircle, Sparkles } from 'lucide-react';
import { PasskeyClient, type PasskeyAccount } from '@/lib/auth/passkey';
import toast from 'react-hot-toast';

interface PasskeyAuthProps {
  onSuccess?: (stellarAddress: string) => void;
  onError?: (error: string) => void;
}

export function PasskeyAuth({ onSuccess, onError }: PasskeyAuthProps) {
  const [client, setClient] = useState<PasskeyClient | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'choice' | 'register' | 'login'>('choice');
  const [username, setUsername] = useState('');
  const [accounts, setAccounts] = useState<PasskeyAccount[]>([]);

  useEffect(() => {
    // Initialize client
    const passkeyClient = new PasskeyClient({
      rpName: 'Astro Shiba',
      rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
      apiBaseUrl: '/api/passkey',
    });

    setClient(passkeyClient);
    setIsSupported(passkeyClient.isSupported());

    // Load existing accounts
    passkeyClient.listAccounts().then(setAccounts);
  }, []);

  const handleRegister = async () => {
    if (!client || !username.trim()) {
      toast.error('Please enter a username');
      return;
    }

    setIsLoading(true);

    try {
      const result = await client.register(username, {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
      });

      if (result.success && result.stellarAddress) {
        toast.success('Passkey created successfully!');
        console.log('Stellar Address:', result.stellarAddress);

        // Refresh accounts list
        const updatedAccounts = await client.listAccounts();
        setAccounts(updatedAccounts);

        // Notify parent
        onSuccess?.(result.stellarAddress);
      } else {
        throw new Error(result.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMsg = error.message || 'Failed to create passkey';
      toast.error(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (credentialId?: string) => {
    if (!client) return;

    setIsLoading(true);

    try {
      const result = await client.authenticate(credentialId);

      if (result.success && result.stellarAddress) {
        toast.success('Authenticated successfully!');
        console.log('Stellar Address:', result.stellarAddress);

        // Notify parent
        onSuccess?.(result.stellarAddress);
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      const errorMsg = error.message || 'Failed to authenticate';
      toast.error(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-2">
              Passkeys Not Supported
            </h3>
            <p className="text-sm text-red-700">
              Your browser doesn't support WebAuthn/Passkeys. Please use a modern browser
              like Chrome, Safari, or Edge with biometric authentication enabled.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary mb-4">
          <Fingerprint className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-ui-text-primary mb-2">
          Sign in with Passkey
        </h2>
        <p className="text-ui-text-secondary">
          No wallet needed. Use FaceID, TouchID, or Windows Hello.
        </p>
      </div>

      {/* Mode Selection */}
      {mode === 'choice' && (
        <div className="space-y-4">
          {accounts.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ui-text-secondary">
                Your Accounts
              </p>
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleLogin(account.credentialId)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-ui-border bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {account.displayName[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-ui-text-primary">
                        {account.displayName}
                      </p>
                      <p className="text-xs text-ui-text-secondary font-mono">
                        {account.stellarAddress.slice(0, 8)}...{account.stellarAddress.slice(-8)}
                      </p>
                    </div>
                  </div>
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
                  ) : (
                    <Fingerprint className="h-5 w-5 text-brand-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-ui-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-ui-text-secondary">or</span>
            </div>
          </div>

          <button
            onClick={() => setMode('register')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <Sparkles className="h-5 w-5" />
            Create New Passkey Account
          </button>
        </div>
      )}

      {/* Registration Mode */}
      {mode === 'register' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ui-text-primary mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., My Astro Account"
              className="w-full px-4 py-3 border border-ui-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setMode('choice')}
              disabled={isLoading}
              className="flex-1 px-6 py-3 border border-ui-border text-ui-text-primary rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleRegister}
              disabled={isLoading || !username.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Fingerprint className="h-5 w-5" />
                  Create Passkey
                </>
              )}
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900">
              <strong>What happens next:</strong> You'll be asked to use your device's
              biometric authentication (FaceID, TouchID, or Windows Hello) to create
              a secure passkey. This will generate a new Stellar account.
            </p>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="pt-6 border-t border-ui-border">
        <div className="flex items-start gap-3 text-sm text-ui-text-secondary">
          <Sparkles className="h-5 w-5 text-brand-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-ui-text-primary mb-1">
              Why Passkeys are Better
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>No seed phrases to remember or lose</li>
              <li>Phishing resistant (can't be stolen)</li>
              <li>Backed up automatically by your device</li>
              <li>Works across all your devices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
