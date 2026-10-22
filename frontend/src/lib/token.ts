import { Client as AstroTokenClient } from '../contracts'
import { ASTRO_TOKEN_ID, NETWORK_PASSPHRASE, RPC_URL } from './network'
import type { Signer } from '@stellar/stellar-sdk/contract'

/**
 * Cliente del token desplegado. Sin `signer` es de solo lectura (simulación).
 */
export function astroTokenClient(signer?: Signer): AstroTokenClient {
  return new AstroTokenClient({
    contractId: ASTRO_TOKEN_ID,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey: signer?.address,
    signTransaction: signer,
  })
}
