import { StrKey } from '@stellar/stellar-sdk'

/**
 * Valida una cuenta Stellar (G...) antes de enviar una transferencia o un
 * mint. Los contratos (C...) no se aceptan aquí: el destino es una wallet.
 */
export function isValidStellarAddress(value: string): boolean {
  const address = value.trim()
  if (!address) return false
  return StrKey.isValidEd25519PublicKey(address)
}
