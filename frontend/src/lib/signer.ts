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
        address: signerAddress(address, opts?.address),
      }),
    signAuthEntry: (authEntry, opts) =>
      StellarWalletsKit.signAuthEntry(authEntry, {
        networkPassphrase: opts?.networkPassphrase,
        address: signerAddress(address, opts?.address),
      }),
  }
}

/**
 * El SDK puede pedir firmar con otra cuenta si el usuario cambió de wallet a
 * mitad de una transacción. Firmar con una cuenta distinta a la esperada
 * produciría auths inválidas; fallamos explícitamente y el usuario reconecta.
 */
function signerAddress(expected: string, provided?: string): string {
  if (provided && provided !== expected) {
    throw new Error(
      `Active wallet (${provided.slice(0, 6)}…${provided.slice(-4)}) does not match expected account (${expected.slice(0, 6)}…${expected.slice(-4)}). Please reconnect your wallet and try again.`,
    )
  }
  return expected
}
