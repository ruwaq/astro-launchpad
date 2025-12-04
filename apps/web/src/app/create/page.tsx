'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Info, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useSyncToken } from '@/hooks/useApi';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient } from '@/lib/stellar/client';
import { TransactionBuilder, rpc, Address } from '@stellar/stellar-sdk';
import { getNetworkConfig } from '@/lib/config/network';
import toast from 'react-hot-toast';
import nextDynamic from 'next/dynamic';
import { ImageUpload } from '@/components/ImageUpload';
import type { TransactionStep, StepStatus } from '@/components/TransactionProgress';
import { logger } from '@/lib/logger';

// Force dynamic rendering to avoid build-time errors with contract service
export const dynamic = 'force-dynamic';

// PERFORMANCE: Dynamic import for TransactionProgress (uses framer-motion)
const TransactionProgress = nextDynamic(
  () => import('@/components/TransactionProgress').then((mod) => ({ default: mod.TransactionProgress })),
  { ssr: false }
);

// PERFORMANCE: Dynamic import for confetti - only loaded on successful token creation
const triggerConfetti = () => {
  import('canvas-confetti').then((confettiModule) => {
    confettiModule.default({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6'],
    });
  });
};

// Form states
type FormState = 'idle' | 'validating' | 'building' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error';

// Session storage key for form persistence
const FORM_STORAGE_KEY = 'astro_create_token_form';

// Helper to safely access sessionStorage
const getStoredForm = () => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export default function CreatePage() {
  const router = useRouter();
  const { address, isConnected, connect, isConnecting, signTransaction } = useWallet();

  // GraphQL mutation for automatic token sync
  const [syncToken] = useSyncToken();

  // Form fields - initialize from sessionStorage to persist across reloads
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  // Optional social links
  const [website, setWebsite] = useState('');
  const [telegram, setTelegram] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore form from sessionStorage on mount
  useEffect(() => {
    const stored = getStoredForm();
    if (stored) {
      if (stored.name) setName(stored.name);
      if (stored.symbol) setSymbol(stored.symbol);
      if (stored.imageUrl) setImageUrl(stored.imageUrl);
      if (stored.description) setDescription(stored.description);
      if (stored.website) setWebsite(stored.website);
      if (stored.telegram) setTelegram(stored.telegram);
    }
    setIsHydrated(true);
  }, []);

  // Save form to sessionStorage whenever it changes
  useEffect(() => {
    if (!isHydrated) return;
    try {
      sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify({
        name,
        symbol,
        imageUrl,
        description,
        website,
        telegram,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [name, symbol, imageUrl, description, website, telegram, isHydrated]);

  // Clear form storage on successful creation
  const clearFormStorage = useCallback(() => {
    try {
      sessionStorage.removeItem(FORM_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // State management
  const [formState, setFormState] = useState<FormState>('idle');
  const [createdTokenAddress, setCreatedTokenAddress] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  // CRITICAL: Ref to prevent double-submission race condition
  // State updates are async, but ref updates are immediate
  const isSubmittingRef = useRef(false);

  // Transaction progress steps (V2: no admin step needed - factory is already admin)
  const [txSteps, setTxSteps] = useState<TransactionStep[]>([
    { id: 'build', label: 'Building transaction', status: 'pending' },
    { id: 'sign', label: 'Sign to create token', description: 'Approve in wallet', status: 'pending' },
    { id: 'submit', label: 'Submitting to network', status: 'pending' },
    { id: 'confirm', label: 'Confirming on chain', status: 'pending' },
    { id: 'sync', label: 'Syncing to database', status: 'pending' },
  ]);

  // Update step status helper
  const updateStep = (stepId: string, status: StepStatus) => {
    setTxSteps(prev => prev.map(s =>
      s.id === stepId ? { ...s, status } : s
    ));
  };

  // Reset all steps to pending
  const resetSteps = () => {
    setTxSteps(prev => prev.map(s => ({ ...s, status: 'pending' as StepStatus })));
  };

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected! You can now create tokens.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect wallet');
    }
  };

  const validateForm = (): boolean => {
    if (!name || name.length === 0 || name.length > 32) {
      setError('Token name must be 1-32 characters');
      return false;
    }

    if (!symbol || symbol.length === 0 || symbol.length > 12) {
      setError('Symbol must be 1-12 characters');
      return false;
    }

    if (!/^[A-Z0-9]+$/.test(symbol)) {
      setError('Symbol must be uppercase alphanumeric only');
      return false;
    }

    if (!imageUrl) {
      setError('Image URL is required');
      return false;
    }

    if (!description) {
      setError('Description is required');
      return false;
    }

    setError('');
    return true;
  };

  const handleCreateToken = useCallback(async () => {
    // CRITICAL: Immediate check to prevent double-submission race condition
    // Ref check happens before any async operation or state update
    if (isSubmittingRef.current) {
      logger.warn('Prevented double submission - transaction already in progress');
      return;
    }
    isSubmittingRef.current = true;

    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      isSubmittingRef.current = false;
      return;
    }

    // Validate form
    if (!validateForm()) {
      toast.error(error);
      isSubmittingRef.current = false;
      return;
    }

    try {
      // Reset and start progress
      resetSteps();

      // Step 1: Building transaction
      setFormState('building');
      setError('');
      updateStep('build', 'active');

      logger.info('Creating token with V2 (pure Soroban token)');

      const config = getNetworkConfig();
      const soroban = stellarClient.getSoroban();
      const server = soroban.getServer();

      // Get account for transaction source
      const account = await server.getAccount(address);

      // Build launch token V2 operation (no issuer keypair needed - factory is admin)
      const launchOperation = sacFactoryService.buildLaunchTokenV2Operation(
        {
          name,
          symbol,
          imageUrl,
          description,
          // Optional social links (stored in metadata on-chain)
          website: website || undefined,
          telegram: telegram || undefined,
        },
        address
      );

      // Create transaction
      const transaction = new TransactionBuilder(account, {
        fee: '1000000', // 0.1 XLM fee
        networkPassphrase: config.passphrase,
      })
        .addOperation(launchOperation as any)
        .setTimeout(30)
        .build();

      // Simulate transaction
      const simulated = await server.simulateTransaction(transaction);

      if (!simulated || 'error' in simulated) {
        throw new Error(
          `Simulation failed: ${simulated && 'error' in simulated ? simulated.error : 'Unknown error'}`
        );
      }

      // Prepare transaction with simulation results
      const preparedTx = rpc.assembleTransaction(
        transaction,
        simulated
      ).build();

      // Step 2: Sign transaction
      setFormState('signing');
      updateStep('build', 'completed');
      updateStep('sign', 'active');

      const signedXDR = await signTransaction(preparedTx.toXDR());
      const signedTx = TransactionBuilder.fromXDR(signedXDR, config.passphrase);

      // Step 3: Submit transaction
      setFormState('submitting');
      updateStep('sign', 'completed');
      updateStep('submit', 'active');

      const sendResponse = await server.sendTransaction(signedTx as any);

      if (sendResponse.status === 'ERROR') {
        throw new Error(`Transaction failed: ${sendResponse.errorResult?.toXDR('base64')}`);
      }

      setTransactionHash(sendResponse.hash);

      // Step 4: Wait for confirmation
      setFormState('confirming');
      updateStep('submit', 'completed');
      updateStep('confirm', 'active');

      let attempts = 0;
      const maxAttempts = 30;
      let transactionSuccess = false;

      // Track extracted token address locally (React state doesn't update immediately)
      let extractedTokenAddress: string | null = null;

      // Poll for transaction with error handling for SDK incompatibility
      while (attempts < maxAttempts) {
        try {
          const getResponse: any = await server.getTransaction(sendResponse.hash);

          if (getResponse.status === 'SUCCESS') {
            transactionSuccess = true;

            // Try to extract token address from result
            const resultValue = getResponse.returnValue;
            if (resultValue) {
              try {
                // Convert ScVal to native value (address string)
                extractedTokenAddress = Address.fromScVal(resultValue).toString();
                setCreatedTokenAddress(extractedTokenAddress);
                logger.info('Token created successfully', { tokenAddress: extractedTokenAddress });
              } catch (err) {
                logger.warn('Could not parse return value, will try fallback', { error: err });
              }
            }
            break;
          } else if (getResponse.status === 'FAILED') {
            throw new Error('Transaction failed on the network');
          } else if (getResponse.status !== 'NOT_FOUND') {
            logger.warn('Unexpected transaction status', { status: getResponse.status });
          }
        } catch (err: any) {
          // Handle "Bad union switch" error from SDK version incompatibility
          // This error means the SDK can't parse the response, NOT that the tx failed
          // We need to use Horizon API as fallback to verify transaction status
          if (err.message?.includes('Bad union switch')) {
            logger.warn('SDK version incompatibility detected, verifying via Horizon API');
            try {
              // Use Horizon API to check transaction status directly
              const horizonUrl = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
                ? 'https://horizon.stellar.org'
                : 'https://horizon-testnet.stellar.org';
              const horizonResponse = await fetch(`${horizonUrl}/transactions/${sendResponse.hash}`);
              if (horizonResponse.ok) {
                const txData = await horizonResponse.json();
                if (txData.successful === true) {
                  transactionSuccess = true;
                  logger.info('Transaction verified successful via Horizon');
                  break;
                } else {
                  throw new Error('Transaction failed on chain');
                }
              }
              // If Horizon doesn't have it yet, continue polling
            } catch (horizonErr) {
              logger.warn('Horizon fallback check failed, continuing to poll', { error: horizonErr });
            }
          } else if (err.message?.includes('NOT_FOUND')) {
            // Transaction not yet processed, continue polling
          } else {
            throw err;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (transactionSuccess) {
        // Success!
        setFormState('success');
        updateStep('confirm', 'completed');
        updateStep('sync', 'active');
        toast.success('Token created successfully! Syncing to database...');

        // PERFORMANCE: Confetti celebration loaded dynamically
        triggerConfetti();

        // V2: No admin setup needed - factory is already the admin!
        // Just sync the token to database with fallback data
        if (extractedTokenAddress) {
          try {
            logger.info('Syncing new token to database', { tokenAddress: extractedTokenAddress });
            await syncToken({
              variables: {
                tokenAddress: extractedTokenAddress,
                // Provide fallback data in case contract lookup fails
                name,
                symbol,
                creator: address,
                imageUrl,
                description,
                website,
                telegram,
              }
            });
            logger.info('Token synced successfully');
            updateStep('sync', 'completed');
            toast.success('Token synced! It will appear in Explore.');
          } catch (syncError: any) {
            logger.error('Failed to sync token', { error: syncError });
            updateStep('sync', 'error');
            toast.error('Token created but sync may have failed.');
          }
        }

        // FALLBACK: If we couldn't extract token address from transaction result,
        // fetch the creator's newest token and sync only that one.
        if (!extractedTokenAddress && address) {
          logger.info('Using fallback: fetching newest creator token');
          try {
            // Wait a moment for blockchain to index the new token
            await new Promise(resolve => setTimeout(resolve, 3000));

            const creatorTokens = await sacFactoryService.getCreatorTokensPaginated(address, 0, 100);
            logger.info('Creator tokens found', { count: creatorTokens?.length || 0 });

            if (creatorTokens && creatorTokens.length > 0) {
              // The newest token is at the END of the array (contract returns oldest first)
              extractedTokenAddress = creatorTokens[creatorTokens.length - 1];
              setCreatedTokenAddress(extractedTokenAddress);
              logger.info('Newest token address found', { tokenAddress: extractedTokenAddress });

              // V2: No admin setup needed - factory is already the admin!
              // Just sync the token to database with fallback data
              logger.info('Syncing newest token to database');
              try {
                await syncToken({
                  variables: {
                    tokenAddress: extractedTokenAddress,
                    // Provide fallback data in case contract lookup fails
                    name,
                    symbol,
                    creator: address,
                    imageUrl,
                    description,
                    website,
                    telegram,
                  }
                });
                logger.info('Token synced successfully');
                updateStep('sync', 'completed');
                toast.success('Token synced! It will appear in Explore.');
              } catch (syncErr) {
                logger.warn('Sync failed, indexer will handle it', { error: syncErr });
                updateStep('sync', 'completed'); // Still mark as done - indexer will handle
                toast.success('Token created! It will appear in Explore shortly.');
              }
            }
          } catch (fallbackErr) {
            logger.error('Fallback method failed', { error: fallbackErr });
            // Token was still created on blockchain - indexer will sync it
            updateStep('sync', 'completed'); // Mark as done - indexer handles it
            toast.success('Token created! The indexer will sync it automatically.');
          }
        }

        // Final check - if we still don't have a token address, show error
        if (!extractedTokenAddress) {
          logger.warn('Could not extract token address, manual sync may be needed');
          setCreatedTokenAddress('Check Stellar Expert for contract address');
          toast.success('Token created! Check Stellar Expert for the contract address.');
        }

        // Clear saved form data and redirect to explore page
        clearFormStorage();
        setTimeout(() => {
          router.push('/explore');
        }, 3000);
      } else if (attempts >= maxAttempts) {
        throw new Error('Transaction confirmation timeout - please check Stellar Expert');
      }

    } catch (err: any) {
      logger.error('Error creating token', { error: err });
      setFormState('error');

      // Mark current active step as error
      setTxSteps(prev => prev.map(s =>
        s.status === 'active' ? { ...s, status: 'error' as StepStatus } : s
      ));

      let errorMessage = 'Failed to create token';

      if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      toast.error(errorMessage);

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setFormState('idle');
        setError('');
        resetSteps();
        // Reset submission ref to allow retry
        isSubmittingRef.current = false;
      }, 5000);
    }
  }, [address, isConnected, name, symbol, imageUrl, description, website, telegram, error, signTransaction, syncToken, clearFormStorage, router]);

  const isProcessing = ['validating', 'building', 'signing', 'submitting', 'confirming'].includes(formState);
  const isSuccess = formState === 'success';
  const isError = formState === 'error';

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-ui-text-primary">
            Create Token
          </h1>
          <p className="text-ui-text-secondary mt-1">
            Launch your token on Soroban with bonding curve pricing
          </p>
        </div>

        {/* Connection Required */}
        {!isConnected && (
          <div className="bg-brand-blue-50 border border-brand-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-brand-blue rounded-lg">
                <Info className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-blue-900 mb-2">
                  Connect Wallet Required
                </h3>
                <p className="text-sm text-brand-blue-700 mb-4">
                  Connect your Stellar wallet (Freighter, xBull, Lobstr, etc.) to create tokens on Stellar Testnet.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="px-6 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {isSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-2">
                  🎉 Token Created Successfully!
                </h3>
                <p className="text-sm text-green-700 mb-4">
                  Your token has been deployed! Redirecting you to Explore to see your token...
                </p>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <button
                    onClick={() => router.push('/explore')}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors font-medium"
                  >
                    View in Explore
                  </button>
                  {transactionHash && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      View on Stellar Expert
                    </a>
                  )}
                </div>

                {createdTokenAddress && createdTokenAddress !== 'Transaction successful - Check Stellar Expert' && createdTokenAddress !== 'Check Stellar Expert for contract address' && (
                  <div className="bg-white rounded-lg p-3 mb-2">
                    <p className="text-xs text-gray-600 mb-1">Token Address:</p>
                    <p className="text-sm font-mono break-all">{createdTokenAddress}</p>
                  </div>
                )}
                {transactionHash && (
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Transaction Hash:</p>
                    <p className="text-sm font-mono break-all">{transactionHash}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">
                  Transaction Failed
                </h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div className={`bg-white rounded-xl border border-ui-border p-6 ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="space-y-6">
            {/* Token Details */}
            <div>
              <h2 className="text-lg font-bold text-ui-text-primary mb-4">
                Token Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="token-name" className="block text-sm font-medium text-ui-text-primary mb-2">
                    Token Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="token-name"
                    type="text"
                    placeholder="Doge Shiba"
                    maxLength={32}
                    required
                    aria-required="true"
                    aria-describedby="token-name-hint"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3.5 sm:py-3 min-h-[48px] border border-ui-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-base sm:text-sm"
                    disabled={!isConnected || isProcessing}
                  />
                  <p id="token-name-hint" className="text-xs text-gray-500 mt-1">Max 32 characters ({name.length}/32)</p>
                </div>
                <div>
                  <label htmlFor="token-symbol" className="block text-sm font-medium text-ui-text-primary mb-2">
                    Symbol <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="token-symbol"
                    type="text"
                    placeholder="DSHIB"
                    maxLength={12}
                    required
                    aria-required="true"
                    aria-describedby="token-symbol-hint"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3.5 sm:py-3 min-h-[48px] border border-ui-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-base sm:text-sm"
                    disabled={!isConnected || isProcessing}
                  />
                  <p id="token-symbol-hint" className="text-xs text-gray-500 mt-1">1-12 uppercase alphanumeric ({symbol.length}/12)</p>
                </div>
              </div>
            </div>

            {/* Image & Description */}
            <div>
              <h2 className="text-lg font-bold text-ui-text-primary mb-4">
                Image & Description
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-ui-text-primary mb-2">
                  Token Image <span className="text-red-500">*</span>
                </label>
                <ImageUpload
                  value={imageUrl}
                  onChange={setImageUrl}
                  disabled={!isConnected || isProcessing}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Upload your token image. It will be stored on IPFS for permanent availability.
                </p>
              </div>

              <div>
                <label htmlFor="token-description" className="block text-sm font-medium text-ui-text-primary mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="token-description"
                  rows={4}
                  maxLength={500}
                  required
                  aria-required="true"
                  aria-describedby="token-description-hint"
                  placeholder="Tell the community about your token..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3.5 sm:py-3 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-base sm:text-sm"
                  disabled={!isConnected || isProcessing}
                />
                <p id="token-description-hint" className="text-xs text-gray-500 mt-1">{description.length}/500 characters</p>
              </div>
            </div>

            {/* Social Links (Optional) */}
            <div>
              <h2 className="text-lg font-bold text-ui-text-primary mb-4">
                Social Links <span className="text-ui-text-secondary text-sm font-normal">(Optional)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="token-website" className="block text-sm font-medium text-ui-text-primary mb-2">
                    Website
                  </label>
                  <input
                    id="token-website"
                    type="url"
                    placeholder="https://yourtoken.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-4 py-3.5 sm:py-3 min-h-[48px] border border-ui-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-base sm:text-sm"
                    disabled={!isConnected || isProcessing}
                  />
                </div>
                <div>
                  <label htmlFor="token-telegram" className="block text-sm font-medium text-ui-text-primary mb-2">
                    Telegram
                  </label>
                  <input
                    id="token-telegram"
                    type="url"
                    placeholder="https://t.me/yourtoken"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    className="w-full px-4 py-3.5 sm:py-3 min-h-[48px] border border-ui-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-base sm:text-sm"
                    disabled={!isConnected || isProcessing}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                These links will be stored on-chain in the token metadata
              </p>
            </div>

            {/* Fair Launch Info */}
            <div className="bg-brand-green-50 border border-brand-green-200 rounded-xl p-6">
              <h3 className="font-bold text-brand-green-900 mb-3">
                Soroban Token Features
              </h3>
              <ul className="space-y-2 text-sm text-brand-green-800">
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Pure Soroban token (SEP-41 compatible)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Factory-managed (no trustlines needed)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Bonding curve pricing (constant product)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Single signature token creation
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Auto-graduation to DEX at $69k market cap
                </li>
              </ul>
            </div>

            {/* Processing Status - Accessible live region */}
            {isProcessing && (
              <div
                role="status"
                aria-live="polite"
                aria-label="Transaction progress"
                className="bg-blue-50 border border-blue-200 rounded-xl p-6"
              >
                <div className="flex items-center gap-4">
                  <Loader2 className="h-6 w-6 text-blue-600 animate-spin flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-blue-900">
                      {formState === 'validating' && 'Validating transaction...'}
                      {formState === 'building' && 'Building transaction...'}
                      {formState === 'signing' && 'Please sign in your wallet...'}
                      {formState === 'submitting' && 'Submitting to network...'}
                      {formState === 'confirming' && 'Waiting for confirmation...'}
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      This may take a few moments
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={handleCreateToken}
              className="w-full py-4 bg-brand-primary text-white rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-primary-600 transition-colors flex items-center justify-center gap-2"
              disabled={!isConnected || isProcessing || isSuccess}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Token Created!
                </>
              ) : (
                'Create Token (0.01 XLM Fee)'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Progress Indicator */}
      <TransactionProgress
        steps={txSteps}
        isVisible={isProcessing || formState === 'success'}
        title="Creating Token"
      />
    </DashboardLayout>
  );
}
