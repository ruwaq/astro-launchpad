/**
 * Enlaces al explorador Stellar.Expert en testnet.
 */
export const EXPLORER_BASE = 'https://stellar.expert/explorer/testnet'

export function explorerContractUrl(contractId: string): string {
  return `${EXPLORER_BASE}/contract/${contractId}`
}

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`
}

export function explorerAccountUrl(account: string): string {
  return `${EXPLORER_BASE}/account/${account}`
}

export function horizonAccountUrl(account: string): string {
  return `https://horizon-testnet.stellar.org/accounts/${account}`
}
