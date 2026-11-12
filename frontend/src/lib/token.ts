import { Client as AstroTokenClient } from '../contracts'
import { Client as LaunchpadClient } from '../contracts/launchpad'
import {
  executeWithRpcFailover,
  LAUNCHPAD_CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
} from './network'
import type { Signer } from '@stellar/stellar-sdk/contract'

/** Token del launchpad recién creado por el usuario. */
export interface LaunchpadToken {
  /** Id del contrato desplegado. */
  id: string
  /** Decimales del token. */
  decimals: number
  /** Símbolo si se conoce (para el arte generativo de la UI). */
  symbol?: string
}

/**
 * Cliente de un token SEP-41. Sin `signer` es de solo lectura (simulación).
 */
export function tokenClient(
  contractId: string,
  signer?: Signer,
  rpcUrl: string = RPC_URL,
): AstroTokenClient {
  return new AstroTokenClient({
    contractId,
    rpcUrl,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey: signer?.address,
    signTransaction: signer,
    signAuthEntry: signer,
  })
}

/** Balance SEP-41 de una cuenta, sin acoplar la UI al cliente generado. */
export async function fetchTokenBalance(
  contractId: string,
  account: string,
): Promise<bigint> {
  return executeWithRpcFailover(async (rpcUrl) => {
    const client = tokenClient(contractId, undefined, rpcUrl)
    const tx = await client.balance({ account })
    return tx.result
  })
}

/**
 * Cliente del launchpad atómico en testnet. Sin `signer` es de solo lectura.
 */
export function launchpadClient(
  signer?: Signer,
  rpcUrl: string = RPC_URL,
): LaunchpadClient {
  return new LaunchpadClient({
    contractId: LAUNCHPAD_CONTRACT_ID,
    rpcUrl,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey: signer?.address,
    signTransaction: signer,
    signAuthEntry: signer,
  })
}

/**
 * Single-transaction fair launch using the atomic launchpad contract:
 * Deploys the token, creates/seeds the Soroswap AMM pair, burns 100% LP to the burn address,
 * and renounces token ownership atomically in one signature.
 */
export async function launchTokenAtomic(params: {
  name: string
  symbol: string
  decimals: number
  initialSupply: bigint
  tokenLpAmount: bigint
  xlmLpAmount: bigint
  signer: Signer
  onHash?: (hash: string) => void
}): Promise<{ token: string; pair: string; lpMinted: bigint; hash?: string }> {
  const { name, symbol, decimals, initialSupply, tokenLpAmount, xlmLpAmount, signer, onHash } =
    params
  const client = launchpadClient(signer)
  const salt = crypto.getRandomValues(new Uint8Array(32))

  const tx = await client.launch_token({
    params: {
      creator: signer.address,
      name,
      symbol,
      decimals,
      initial_supply: initialSupply,
      token_lp_amount: tokenLpAmount,
      xlm_lp_amount: xlmLpAmount,
      salt,
    },
  })

  const sent = await tx.signAndSend()
  const hash = sent.sendTransactionResponse?.hash
  if (hash) onHash?.(hash)

  const unwrap = sent.result
  if (unwrap.isErr()) {
    const err = unwrap.unwrapErr()
    throw new Error(err?.message ?? `Atomic launchpad error: ${JSON.stringify(err)}`)
  }
  const result = unwrap.unwrap()
  return {
    token: result.token,
    pair: result.pair,
    lpMinted: result.lp_minted,
    hash,
  }
}

/**
 * Minimalist fair launch (`launch_fair`): supply (1B), decimals (7), and
 * 99.5% burned LP are enforced on-chain; stores optional compact JSON metadata.
 */
export async function launchFairAtomic(params: {
  name: string
  symbol: string
  xlmLpAmount: bigint
  meta?: string
  signer: Signer
  onHash?: (hash: string) => void
}): Promise<{ token: string; pair: string; lpMinted: bigint; hash?: string }> {
  const { name, symbol, xlmLpAmount, meta = '', signer, onHash } = params
  const client = launchpadClient(signer)
  const salt = crypto.getRandomValues(new Uint8Array(32))

  const tx = await client.launch_fair({
    params: {
      creator: signer.address,
      name,
      symbol,
      xlm_lp_amount: xlmLpAmount,
      meta,
      salt,
    },
  })

  const sent = await tx.signAndSend()
  const hash = sent.sendTransactionResponse?.hash
  if (hash) onHash?.(hash)

  const unwrap = sent.result
  if (unwrap.isErr()) {
    const err = unwrap.unwrapErr()
    throw new Error(err?.message ?? `Atomic launchpad error: ${JSON.stringify(err)}`)
  }
  const result = unwrap.unwrap()
  return {
    token: result.token,
    pair: result.pair,
    lpMinted: result.lp_minted,
    hash,
  }
}

/**
 * On-chain Burn-to-Chat: permanently burns holder tokens and writes a message
 * into Launchpad's persistent `TokenShouts` log + emits `ShoutEvent`.
 */
export async function burnAndShout(params: {
  tokenId: string
  amount: bigint
  message: string
  signer: Signer
  onHash?: (hash: string) => void
}): Promise<{ hash?: string }> {
  const { tokenId, amount, message, signer, onHash } = params
  const client = launchpadClient(signer)
  const tx = await client.burn_shout({
    sender: signer.address,
    token: tokenId,
    amount,
    message,
  })
  const sent = await tx.signAndSend()
  const hash = sent.sendTransactionResponse?.hash
  if (hash) onHash?.(hash)

  const unwrap = sent.result
  if (unwrap.isErr()) {
    const err = unwrap.unwrapErr()
    throw new Error(err?.message ?? `Burn shout error: ${JSON.stringify(err)}`)
  }
  return { hash }
}

/**
 * Refreshes 90-day TTL on-chain for a token contract and its Launchpad registry record.
 * Note: Permissionless `extend_ttl` / `extend_launch_ttl` calls emit zero auths and zero
 * `readWrite` keys in Soroban host simulation, so Stellar SDK flags them `isReadCall`;
 * `{ force: true }` is required to broadcast the on-chain TTL extension transaction.
 */
export async function extendTokenTtl(params: {
  tokenId: string
  signer: Signer
}): Promise<{ hash?: string }> {
  const { tokenId, signer } = params
  let lastHash: string | undefined
  let lastError: unknown

  try {
    const tokTx = await tokenClient(tokenId, signer).extend_ttl()
    const sentTok = await tokTx.signAndSend({ force: true })
    lastHash = sentTok.sendTransactionResponse?.hash ?? lastHash
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
    if (msg.includes('cancel') || msg.includes('reject') || msg.includes('declined')) {
      throw err
    }
    lastError = err
    // Non-AstroToken SACs may not expose `extend_ttl`; still extend Launchpad entry.
  }

  try {
    const lpTx = await launchpadClient(signer).extend_launch_ttl({ token: tokenId })
    const sentLp = await lpTx.signAndSend({ force: true })
    lastHash = sentLp.sendTransactionResponse?.hash ?? lastHash
  } catch (err) {
    lastError = err
    if (!lastHash) {
      throw lastError instanceof Error
        ? lastError
        : new Error('Could not extend contract TTL on-chain.')
    }
  }

  return { hash: lastHash }
}

