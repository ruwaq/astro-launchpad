import { create } from 'zustand'
import { Networks, StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils'
import {
  WalletConnectModule,
  WalletConnectTargetChain,
} from '@creit.tech/stellar-wallets-kit/modules/wallet-connect'
import { BRAND } from '../lib/brand'

const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID?.trim() ?? ''

/** Origin tolerante a SSR (el smoke test renderiza en node sin window). */
function appOrigin(): string {
  return globalThis.location?.origin ?? 'https://floodgate.local'
}

/**
 * Módulos de wallet: los nativos siempre; WalletConnect v2 (Freighter Mobile,
 * xBull móvil, etc. vía QR) solo si hay `VITE_WC_PROJECT_ID` de Reown Cloud
 * (https://cloud.reown.com, gratis). Nuestros flujos solo necesitan
 * signTransaction/signAndSubmitTransaction, y WalletConnect los cubre.
 */
function walletModules() {
  if (!wcProjectId) return defaultModules()
  return defaultModules().concat(
    new WalletConnectModule({
      projectId: wcProjectId,
      metadata: {
        name: `${BRAND.emoji} ${BRAND.name}`,
        description: BRAND.manifestDescription,
        url: appOrigin(),
        icons: [`${appOrigin()}/icon-192.png`],
      },
      allowedChains: [WalletConnectTargetChain.TESTNET],
    }),
  )
}

// La kit es un singleton: se inicializa una sola vez por sesión de la app.
StellarWalletsKit.init({
  modules: walletModules(),
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
