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
}): Promise<string> {
  const { name, symbol, decimals, initialSupply, signer } = params

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
  const { result } = await tx.signAndSend()
  return result.options.contractId
}
