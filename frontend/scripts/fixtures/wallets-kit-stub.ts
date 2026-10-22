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

export default { Networks, StellarWalletsKit, defaultModules }
