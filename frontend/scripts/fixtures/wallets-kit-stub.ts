/**
 * Stub de `@creit.tech/stellar-wallets-kit` para el smoke test de render.
 * El paquete real solo funciona en navegador; aquí solo queremos pintar el
 * árbol de componentes.
 */
export const Networks = {
  TESTNET: 'TESTNET',
  PUBLIC: 'PUBLIC',
}

export const StellarWalletsKit = {
  init() {},
  async disconnect() {},
  async authModal() {
    return { address: 'GCONECTADO' }
  },
  async signTransaction() {
    return { signedTxXdr: '' }
  },
  async signAuthEntry() {
    return { signedAuthEntry: '' }
  },
}

export const defaultModules = () => []

// El módulo WalletConnect se referencia en store/wallet.ts aunque el env no
// traiga projectId: aquí basta con una forma inerte para pintar el árbol.
export const WalletConnectModule = class WalletConnectStubModule {
  constructor(_wcParams: unknown) {
    void _wcParams
  }
}

export const WalletConnectTargetChain = {
  PUBLIC: 'stellar:pubnet',
  TESTNET: 'stellar:testnet',
} as const

export default {
  Networks,
  StellarWalletsKit,
  defaultModules,
  WalletConnectModule,
  WalletConnectTargetChain,
}
