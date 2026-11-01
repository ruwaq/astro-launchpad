import { Client as AstroTokenClient } from '../contracts'
import {
  ASTRO_TOKEN_ID,
  ASTRO_WASM_HASH,
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
): AstroTokenClient {
  return new AstroTokenClient({
    contractId,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey: signer?.address,
    signTransaction: signer,
    signAuthEntry: signer,
  })
}

/** Cliente del token de ejemplo desplegado en testnet. */
export function astroTokenClient(signer?: Signer): AstroTokenClient {
  return tokenClient(ASTRO_TOKEN_ID, signer)
}

/** Balance SEP-41 de una cuenta, sin acoplar la UI al cliente generado. */
export async function fetchTokenBalance(
  contractId: string,
  account: string,
): Promise<bigint> {
  const client = tokenClient(contractId)
  const tx = await client.balance({ account })
  return tx.result
}

/**
 * Despliega una instancia nueva del contrato del launchpad.
 *
 * El wasm ya está subido a la red, así que solo se crea una instancia nueva
 * (cada token del launchpad es su propio contrato). Devuelve el id del
 * contrato recién creado.
 */
export async function deployToken(params: {
  name: string
  symbol: string
  decimals: number
  initialSupply: bigint
  signer: Signer
  /** Se invoca con el hash en cuanto la tx se envía a la red. */
  onHash?: (hash: string) => void
}): Promise<string> {
  const { name, symbol, decimals, initialSupply, signer, onHash } = params

  const tx = await AstroTokenClient.deploy(
    {
      name,
      symbol,
      decimals,
      owner: signer.address,
      initial_supply: initialSupply,
    },
    {
      wasmHash: ASTRO_WASM_HASH,
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      publicKey: signer.address,
      address: signer.address,
      signTransaction: signer,
      signAuthEntry: signer,
    },
  )
  const sent = await tx.signAndSend()
  const hash = sent.sendTransactionResponse?.hash
  if (hash) onHash?.(hash)
  return sent.result.options.contractId
}
