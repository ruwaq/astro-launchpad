'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Upload, Info, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useSyncToken } from '@/hooks/useApi';
import { sacFactoryService } from '@/lib/stellar/services/sac-factory.service';
import { stellarClient } from '@/lib/stellar/client';
import { TransactionBuilder, SorobanRpc, Address, scValToNative } from '@stellar/stellar-sdk';
import { getNetworkConfig } from '@/lib/config/network';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { ImageUpload } from '@/components/ImageUpload';

// Form states
type FormState = 'idle' | 'validating' | 'building' | 'signing' | 'submitting' | 'confirming' | 'success' | 'error';

export default function CreatePage() {
  const router = useRouter();
  const { address, isConnected, connect, isConnecting, signTransaction } = useWallet();

  // GraphQL mutation for automatic token sync
  const [syncToken] = useSyncToken();

  // Form fields
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');

  // State management
  const [formState, setFormState] = useState<FormState>('idle');
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [createdTokenAddress, setCreatedTokenAddress] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Fetch token count on mount (for unique issuer generation)
  useEffect(() => {
    if (isConnected) {
      fetchTokenCount();
    }
  }, [isConnected]);

  const fetchTokenCount = async () => {
    try {
      const count = await sacFactoryService.getTokenCount();
      setTokenCount(count);
    } catch (error) {
      console.error('Error fetching token count:', error);
      // Default to timestamp-based uniqueness if fetch fails
      setTokenCount(Date.now());
    }
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

  const handleCreateToken = async () => {
    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Validate form
    if (!validateForm()) {
      toast.error(error);
      return;
    }

    try {
      // Step 1: Validating
      setFormState('validating');
      setError('');

      // Fetch latest token count for unique issuer
      await fetchTokenCount();

      // Step 2: Building transaction
      setFormState('building');

      const config = getNetworkConfig();
      const soroban = stellarClient.getSoroban();
      const server = soroban.getServer();

      // Get account for transaction source
      const account = await server.getAccount(address);

      // Build launch token operation
      const launchOperation = sacFactoryService.buildLaunchTokenOperation(
        {
          name,
          symbol,
          imageUrl,
          description,
        },
        address,
        tokenCount
      );

      // Create transaction
      const transaction = new TransactionBuilder(account, {
        fee: '1000000', // 0.1 XLM fee
        networkPassphrase: config.passphrase,
      })
        .addOperation(launchOperation as any)
        .setTimeout(30)
        .build();

      // Step 3: Simulate transaction
      const simulated = await server.simulateTransaction(transaction);

      if (!simulated || 'error' in simulated) {
        throw new Error(
          `Simulation failed: ${simulated && 'error' in simulated ? simulated.error : 'Unknown error'}`
        );
      }

      // Prepare transaction with simulation results
      const preparedTx = SorobanRpc.assembleTransaction(
        transaction,
        simulated
      ).build();

      // Step 4: Sign transaction
      setFormState('signing');

      const signedXDR = await signTransaction(preparedTx.toXDR());
      const signedTx = TransactionBuilder.fromXDR(signedXDR, config.passphrase);

      // Step 5: Submit transaction
      setFormState('submitting');

      const sendResponse = await server.sendTransaction(signedTx as any);

      if (sendResponse.status === 'ERROR') {
        throw new Error(`Transaction failed: ${sendResponse.errorResult?.toXDR('base64')}`);
      }

      setTransactionHash(sendResponse.hash);

      // Step 6: Wait for confirmation
      setFormState('confirming');

      let attempts = 0;
      const maxAttempts = 30;
      let getResponse: any = null;
      let transactionSuccess = false;

      // Poll for transaction with error handling for SDK incompatibility
      while (attempts < maxAttempts) {
        try {
          getResponse = await server.getTransaction(sendResponse.hash);

          if (getResponse.status === 'SUCCESS') {
            transactionSuccess = true;

            // Try to extract token address from result
            const resultValue = getResponse.returnValue;
            if (resultValue) {
              try {
                // Convert ScVal to native value (address string)
                const tokenAddr = Address.fromScVal(resultValue).toString();
                setCreatedTokenAddress(tokenAddr);
              } catch (err) {
                console.error('Error parsing token address:', err);
                // Set a placeholder - user can check on Stellar Expert
                setCreatedTokenAddress('Check Stellar Expert for contract address');
              }
            }
            break;
          } else if (getResponse.status === 'FAILED') {
            throw new Error('Transaction failed on the network');
          } else if (getResponse.status !== 'NOT_FOUND') {
            // Unexpected status
            console.warn('Unexpected transaction status:', getResponse.status);
          }
        } catch (err: any) {
          // Handle "Bad union switch" error from SDK version incompatibility
          if (err.message?.includes('Bad union switch')) {
            console.warn('SDK version incompatibility detected. Assuming transaction succeeded.');
            // If we got past submission, it likely succeeded
            transactionSuccess = true;
            setCreatedTokenAddress('Transaction successful - Check Stellar Expert');
            break;
          } else if (err.message?.includes('NOT_FOUND')) {
            // Transaction not yet processed, continue polling
          } else {
            // Other error, rethrow
            throw err;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (transactionSuccess) {
        // Success!
        setFormState('success');
        toast.success('🎉 Token created successfully! Syncing to database...');

        // Confetti celebration!
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6'],
        });

        // AUTOMATICALLY SYNC TOKEN TO DATABASE
        if (createdTokenAddress && createdTokenAddress !== 'Check Stellar Expert for contract address') {
          try {
            console.log('🔄 Syncing token to database:', createdTokenAddress);
            await syncToken({
              variables: { tokenAddress: createdTokenAddress }
            });
            console.log('✅ Token synced successfully!');
            toast.success('Token synced to database!');
          } catch (syncError) {
            console.error('❌ Failed to sync token:', syncError);
            // Don't fail the whole operation, just log it
            toast.error('Token created but sync failed. It will appear after next sync.');
          }
        }

        // Redirect to explore page after 3 seconds to see the new token
        setTimeout(() => {
          router.push('/explore');
        }, 3000);
      } else if (attempts >= maxAttempts) {
        throw new Error('Transaction confirmation timeout - please check Stellar Expert');
      }

    } catch (err: any) {
      console.error('Error creating token:', err);
      setFormState('error');

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
      }, 5000);
    }
  };

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
            Launch your SAC token with Real Transferable Assets
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
                  <label className="block text-sm font-medium text-ui-text-primary mb-2">
                    Token Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Doge Shiba"
                    maxLength={32}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    disabled={!isConnected || isProcessing}
                  />
                  <p className="text-xs text-gray-500 mt-1">Max 32 characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ui-text-primary mb-2">
                    Symbol <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="DSHIB"
                    maxLength={12}
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    disabled={!isConnected || isProcessing}
                  />
                  <p className="text-xs text-gray-500 mt-1">1-12 uppercase alphanumeric</p>
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
                <label className="block text-sm font-medium text-ui-text-primary mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Tell the community about your token..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-ui-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  disabled={!isConnected || isProcessing}
                />
              </div>
            </div>

            {/* Fair Launch Info */}
            <div className="bg-brand-green-50 border border-brand-green-200 rounded-xl p-6">
              <h3 className="font-bold text-brand-green-900 mb-3">
                ✅ Real SAC Token Deployment
              </h3>
              <ul className="space-y-2 text-sm text-brand-green-800">
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Real transferable Stellar Asset Contract
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Visible in all Stellar wallets (Freighter, xBull, Lobstr, Rabet)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Compatible with all Stellar DEXs
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Bonding curve pricing (constant product)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-brand-green-600">✓</span>
                  Auto-graduation to AMM at $69k market cap
                </li>
              </ul>
            </div>

            {/* Processing Status */}
            {isProcessing && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <Loader2 className="h-6 w-6 text-blue-600 animate-spin flex-shrink-0" />
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
    </DashboardLayout>
  );
}
