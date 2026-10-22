import { create } from 'zustand'
import { Networks, StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils'

// La kit es un singleton: se inicializa una sola vez por sesión de la app.
StellarWalletsKit.init({
  modules: defaultModules(),
  network: Networks.TESTNET,
})

type WalletState = {
  publicKey: string | null
  pending: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

export const useWallet = create<WalletState>((set) => ({
  publicKey: null,
  pending: false,
  connect: async () => {
    set({ pending: true })
    try {
      const { address } = await StellarWalletsKit.authModal()
      set({ publicKey: address })
    } finally {
      set({ pending: false })
    }
  },
  disconnect: async () => {
    await StellarWalletsKit.disconnect()
    set({ publicKey: null })
  },
}))
