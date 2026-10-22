import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import type { Signer } from '@stellar/stellar-sdk/contract'

/**
 * Envoltorio de la wallet (SEP-43) como `Signer` del SDK de Stellar.
 * `StellarWalletsKit` firma con la cuenta activa, por eso fijamos `address`.
 */
export function walletSigner(address: string): Signer {
  return {
    address,
    signTransaction: (xdr, opts) =>
      StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: opts?.networkPassphrase,
        address: opts?.address ?? address,
      }),
  }
}
