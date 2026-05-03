/**
 * CreateClient Component
 *
 * Client-side token creation form.
 * Allows connected users to launch new SAC tokens on the bonding curve.
 *
 * Transaction flow (matching useTrade pattern):
 * 1. Build launch_token_v2 operation via sacFactoryService
 * 2. Build transaction with account + fee + timeout
 * 3. Simulate transaction (catch errors early)
 * 4. Assemble transaction from simulation
 * 5. Sign via wallet (signTransaction)
 * 6. Submit to network
 * 7. Poll for confirmation
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TransactionBuilder } from '@stellar/stellar-sdk';
import * as rpc from '@stellar/stellar-sdk/rpc';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useWallet } from '@/contexts/WalletContext';
import { useRateLimit, RATE_LIMIT_CONFIGS } from '@/hooks/useRateLimit';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient } from '@/lib/stellar/client';
import { getNetworkConfig } from '@/lib/config/network';
import { TRANSACTION_FEE_STROOPS } from '@/lib/constants/app';
import { extractSimulationError } from '@/components/widgets/trading/error-utils';
import { ImageUpload } from '@/components/ImageUpload';
import { logger } from '@/lib/logger';
import type { LaunchTokenParams } from '@/lib/stellar/services/sac-factory.service';
import {
  Rocket,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
} from 'lucide-react';

const createLogger = logger.child({ domain: 'create-token' });

interface FormState {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  website: string;
  telegram: string;
  twitter: string;
  discord: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  symbol: '',
  description: '',
  imageUrl: '',
  website: '',
  telegram: '',
  twitter: '',
  discord: '',
};

type Step = 'form' | 'preparing' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error';

export function CreateClient() {
  const router = useRouter();
  const { isConnected, address, connect, isConnecting, signTransaction } = useWallet();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [newTokenAddress, setNewTokenAddress] = useState<string | null>(null);

  // Prevent double submission
  const isSubmittingRef = useRef(false);

  const { checkAndRecord, canPerform, getRemainingActions } = useRateLimit({
    ...RATE_LIMIT_CONFIGS.createToken,
    onRateLimited: () => {
      setError('Rate limited. Please wait before creating another token.');
    },
  });

  const updateForm = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  // Validate form
  const isFormValid = useCallback((): boolean => {
    if (!form.name || form.name.length < 1 || form.name.length > 32) return false;
    if (!form.symbol || !/^[A-Z0-9]{1,12}$/.test(form.symbol)) return false;
    if (!form.description || form.description.length < 1) return false;
    if (!form.imageUrl) return false;
    return true;
  }, [form]);

  // Step labels for UI
  const stepLabels: Record<Step, string> = {
    form: '',
    preparing: 'Preparing transaction...',
    signing: 'Waiting for wallet signature...',
    submitting: 'Submitting to network...',
    confirming: 'Confirming on blockchain...',
    success: '',
    error: '',
  };

  // Handle token creation - full Soroban transaction flow
  const handleCreate = useCallback(async () => {
    if (!isConnected || !address) return;
    if (!isFormValid()) return;
    if (!checkAndRecord()) return;

    // Prevent double submission
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setError(null);

    try {
      // Step 1: Build launch operation
      setStep('preparing');
      createLogger.info('Building token launch operation', { symbol: form.symbol });

      const params: LaunchTokenParams = {
        name: form.name,
        symbol: form.symbol,
        imageUrl: form.imageUrl,
        description: form.description,
        ...(form.website && { website: form.website }),
        ...(form.telegram && { telegram: form.telegram }),
        ...(form.twitter && { twitter: form.twitter }),
        ...(form.discord && { discord: form.discord }),
      };

      const operation = sacFactoryService.buildLaunchTokenV2Operation(params, address);

      // Step 2: Build transaction
      const config = getNetworkConfig();
      const soroban = stellarClient.getSoroban();
      const server = soroban.getServer();

      const account = await server.getAccount(address);
      const txBuilder = new TransactionBuilder(account, {
        fee: TRANSACTION_FEE_STROOPS,
        networkPassphrase: config.networkPassphrase,
      });

      const transaction = txBuilder
        .addOperation(operation as Parameters<typeof txBuilder.addOperation>[0])
        .setTimeout(30)
        .build();

      // Step 3: Simulate transaction
      createLogger.info('Simulating transaction');
      const simulated = await server.simulateTransaction(transaction);

      if (!simulated) {
        throw new Error('No simulation response from network');
      }

      if ('error' in simulated && simulated.error) {
        const errorMsg = extractSimulationError(simulated);
        createLogger.error('Simulation error:', JSON.stringify(simulated, null, 2));
        throw new Error(errorMsg);
      }

      if (rpc.Api.isSimulationRestore(simulated)) {
        throw new Error('Transaction needs state restoration. Please try again.');
      }

      if (!rpc.Api.isSimulationSuccess(simulated)) {
        createLogger.error('Simulation failed:', simulated);
        throw new Error('Transaction simulation failed');
      }

      // Step 4: Assemble transaction from simulation
      const preparedTx = rpc.assembleTransaction(transaction, simulated).build();

      // Step 5: Sign via wallet
      setStep('signing');
      createLogger.info('Requesting wallet signature');

      const signedXDR = await signTransaction(preparedTx.toXDR());
      const signedTx = TransactionBuilder.fromXDR(signedXDR, config.networkPassphrase);

      // Step 6: Submit to network
      setStep('submitting');
      createLogger.info('Submitting transaction');

      const sendResponse = await server.sendTransaction(
        signedTx as Parameters<typeof server.sendTransaction>[0]
      );

      if (sendResponse.status === 'ERROR') {
        throw new Error('Transaction rejected by network');
      }

      // Step 7: Poll for confirmation
      setStep('confirming');
      createLogger.info('Waiting for confirmation', { hash: sendResponse.hash });

      let attempts = 0;
      let confirmed = false;

      while (attempts < 30) {
        try {
          const getResponse = await server.getTransaction(sendResponse.hash);

          if (getResponse.status === 'SUCCESS') {
            confirmed = true;

            // Try to extract the new token address from the transaction result
            // The token address is returned in the transaction metadata
            setTxHash(sendResponse.hash);
            createLogger.info('Token created successfully', { hash: sendResponse.hash });
            break;
          } else if (getResponse.status === 'FAILED') {
            throw new Error('Transaction failed on-chain');
          }
          // NOT_FOUND means still pending
        } catch (err) {
          // Some SDK versions throw on NOT_FOUND - this is expected
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (!errorMsg.includes('not found') && !errorMsg.includes('missing')) {
            createLogger.error('Transaction polling error:', err);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }

      if (!confirmed) {
        throw new Error('Transaction confirmation timed out. Your token may still have been created - check your wallet.');
      }

      setStep('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create token. Please try again.';
      setError(message);
      setStep('error');
      createLogger.error('Token creation failed:', err);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [isConnected, address, form, isFormValid, checkAndRecord, signTransaction]);

  // Not connected state
  if (!isConnected) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-ui-border shadow-sm p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-brand-blue-50 rounded-full flex items-center justify-center mb-6">
              <Rocket className="h-8 w-8 text-brand-primary" />
            </div>
            <h1 className="text-2xl font-bold text-ui-text-primary mb-2">
              Create a Token
            </h1>
            <p className="text-ui-text-secondary mb-6">
              Connect your wallet to launch a new SAC token on the bonding curve.
            </p>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary-dark transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-ui-border shadow-sm p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-ui-text-primary mb-2">
              Token Created!
            </h1>
            <p className="text-ui-text-secondary mb-4">
              {form.name} (${form.symbol}) has been launched on the bonding curve.
            </p>
            {txHash && (
              <p className="text-xs text-ui-text-secondary mb-4 font-mono">
                Tx: {txHash.slice(0, 20)}...{txHash.slice(-10)}
              </p>
            )}
            {newTokenAddress && (
              <a
                href={`/t/${newTokenAddress}`}
                className="inline-flex items-center gap-2 text-brand-primary hover:underline"
              >
                View Token <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => {
                  setForm(INITIAL_FORM);
                  setStep('form');
                  setError(null);
                  setTxHash(null);
                  setNewTokenAddress(null);
                }}
                className="px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary-dark transition-colors"
              >
                Create Another
              </button>
              <button
                onClick={() => router.push('/explore')}
                className="px-6 py-3 bg-white text-ui-text-primary border border-ui-border rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Explore Tokens
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const remainingCreations = getRemainingActions();
  const isProcessing = ['preparing', 'signing', 'submitting', 'confirming'].includes(step);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary flex items-center gap-3">
            <Rocket className="h-8 w-8 text-brand-primary" />
            Create Token
          </h1>
          <p className="text-ui-text-secondary mt-1">
            Launch your own SAC token on Stellar with a bonding curve.
          </p>
        </div>

        {/* Rate limit notice */}
        {remainingCreations <= 1 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              You can create {remainingCreations} more token{remainingCreations !== 1 ? 's' : ''} this hour.
            </p>
          </div>
        )}

        {/* Transaction progress indicator */}
        {isProcessing && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">{stepLabels[step]}</p>
                <div className="flex gap-1 mt-2">
                  {['preparing', 'signing', 'submitting', 'confirming'].map((s, i) => (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full ${
                        ['preparing', 'signing', 'submitting', 'confirming'].indexOf(step) >= i
                          ? 'bg-blue-600'
                          : 'bg-blue-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Creation Form */}
        <div className={`bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden ${isProcessing ? 'opacity-60 pointer-events-none' : ''}`}>
          <div className="p-6 space-y-5">
            {/* Token Name */}
            <div>
              <label className="block text-sm font-medium text-ui-text-secondary mb-1.5">
                Token Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="e.g. Astro Doge"
                maxLength={32}
                disabled={isProcessing}
                className="w-full px-4 py-3 rounded-xl border border-ui-border bg-white text-ui-text-primary placeholder:text-ui-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-ui-text-secondary mt-1">
                {form.name.length}/32 characters
              </p>
            </div>

            {/* Token Symbol */}
            <div>
              <label className="block text-sm font-medium text-ui-text-secondary mb-1.5">
                Symbol <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.symbol}
                onChange={(e) => updateForm('symbol', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                placeholder="e.g. ASDG"
                maxLength={12}
                disabled={isProcessing}
                className="w-full px-4 py-3 rounded-xl border border-ui-border bg-white text-ui-text-primary placeholder:text-ui-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-ui-text-secondary mt-1">
                1-12 uppercase alphanumeric characters
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-ui-text-secondary mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Describe your token..."
                rows={3}
                maxLength={500}
                disabled={isProcessing}
                className="w-full px-4 py-3 rounded-xl border border-ui-border bg-white text-ui-text-primary placeholder:text-ui-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-ui-text-secondary mt-1">
                {form.description.length}/500 characters
              </p>
            </div>

            {/* Token Image */}
            <div>
              <label className="block text-sm font-medium text-ui-text-secondary mb-1.5">
                Token Logo <span className="text-red-500">*</span>
              </label>
              <ImageUpload
                value={form.imageUrl}
                onChange={(url) => updateForm('imageUrl', url)}
                disabled={isProcessing}
              />
            </div>

            {/* Social Links (Collapsible) */}
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-ui-text-secondary hover:text-ui-text-primary">
                <span className="transition-transform group-open:rotate-90">&#9654;</span>
                Social Links (optional)
              </summary>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ui-text-secondary mb-1.5">
                    Website
                  </label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => updateForm('website', e.target.value)}
                    placeholder="https://example.com"
                    disabled={isProcessing}
                    className="w-full px-4 py-3 rounded-xl border border-ui-border bg-white text-ui-text-primary placeholder:text-ui-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ui-text-secondary mb-1.5">
                    Telegram
                  </label>
                  <input
                    type="text"
                    value={form.telegram}
                    onChange={(e) => updateForm('telegram', e.target.value)}
                    placeholder="t.me/groupname"
                    disabled={isProcessing}
                    className="w-full px-4 py-3 rounded-xl border border-ui-border bg-white text-ui-text-primary placeholder:text-ui-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ui-text-secondary mb-1.5">
                    Twitter / X
                  </label>
                  <input
                    type="text"
                    value={form.twitter}
                    onChange={(e) => updateForm('twitter', e.target.value)}
                    placeholder="@handle"
                    disabled={isProcessing}
                    className="w-full px-4 py-3 rounded-xl border border-ui-border bg-white text-ui-text-primary placeholder:text-ui-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ui-text-secondary mb-1.5">
                    Discord
                  </label>
                  <input
                    type="text"
                    value={form.discord}
                    onChange={(e) => updateForm('discord', e.target.value)}
                    placeholder="discord.gg/invite"
                    disabled={isProcessing}
                    className="w-full px-4 py-3 rounded-xl border border-ui-border bg-white text-ui-text-primary placeholder:text-ui-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </details>

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleCreate}
              disabled={!isFormValid() || isProcessing || !canPerform()}
              className="w-full px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {stepLabels[step]}
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5" />
                  Launch Token
                </>
              )}
            </button>

            {/* Info notice */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Bonding Curve Token</p>
                <p className="mt-1">
                  Tokens are launched on a bonding curve. They graduate to a DEX pool once they reach
                  the graduation threshold. A small fee applies to each trade.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}