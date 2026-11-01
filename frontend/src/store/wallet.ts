import { create } from 'zustand'
import { Networks, StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils'
import {
  WalletConnectModule,
  WalletConnectTargetChain,
} from '@creit.tech/stellar-wallets-kit/modules/wallet-connect'
import type { Signer } from '@stellar/stellar-sdk/contract'
import { BRAND } from '../lib/brand'
import { walletSigner } from '../lib/signer'
import {
  DEMO_LABELS,
  createDemoAccounts,
  demoSigner,
  loadActiveDemo,
  loadDemoAccounts,
  loadDemoMode,
  saveActiveDemo,
  saveDemoAccounts,
  saveDemoMode,
  type DemoAccount,
} from '../lib/demo'

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

export type WalletMode = 'wallet' | 'demo'

type WalletState = {
  publicKey: string | null
  pending: boolean
  mode: WalletMode
  /** Cuentas desechables de testnet (modo prueba, sin wallet). */
  demoAccounts: DemoAccount[]
  demoActive: number
  demoPending: boolean
  demoStage: string | null
  demoError: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  startDemo: () => Promise<void>
  selectDemo: (index: number) => void
  /** Firmante de la cuenta activa (wallet real o cuenta demo). */
  getSigner: () => Signer | null
}

const storedDemo = loadDemoAccounts()
const storedDemoActive = Math.min(
  loadActiveDemo(),
  Math.max(storedDemo.length - 1, 0),
)
// Si había cuentas demo y el modo seguía activo, se retoma la sesión.
const startInDemo = storedDemo.length > 0 && loadDemoMode()

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido'
}

export const useWallet = create<WalletState>((set, get) => ({
  publicKey: startInDemo
    ? (storedDemo[storedDemoActive]?.publicKey ?? null)
    : null,
  pending: false,
  mode: startInDemo ? 'demo' : 'wallet',
  demoAccounts: storedDemo,
  demoActive: storedDemoActive,
  demoPending: false,
  demoStage: null,
  demoError: null,

  connect: async () => {
    set({ pending: true })
    try {
      const { address } = await StellarWalletsKit.authModal()
      saveDemoMode(false)
      set({ publicKey: address, mode: 'wallet' })
    } finally {
      set({ pending: false })
    }
  },

  disconnect: async () => {
    if (get().mode === 'demo') {
      saveDemoMode(false)
      set({ mode: 'wallet', publicKey: null })
      return
    }
    await StellarWalletsKit.disconnect()
    set({ publicKey: null })
  },

  startDemo: async () => {
    const { demoAccounts, demoActive } = get()
    if (demoAccounts.length > 0) {
      const index = Math.min(demoActive, demoAccounts.length - 1)
      saveActiveDemo(index)
      saveDemoMode(true)
      set({
        mode: 'demo',
        demoActive: index,
        publicKey: demoAccounts[index].publicKey,
        demoError: null,
      })
      return
    }

    set({
      demoPending: true,
      demoStage: 'Generando cuentas de testnet…',
      demoError: null,
    })
    try {
      const accounts = await createDemoAccounts(({ index, status }) => {
        set({
          demoStage:
            status === 'funding'
              ? `Fondeando cuenta ${DEMO_LABELS[index]} con 10 000 XLM…`
              : `Cuenta ${DEMO_LABELS[index]} lista ✓`,
        })
      })
      saveDemoAccounts(accounts)
      saveActiveDemo(0)
      saveDemoMode(true)
      set({
        demoAccounts: accounts,
        demoActive: 0,
        mode: 'demo',
        publicKey: accounts[0].publicKey,
        demoStage: null,
      })
    } catch (error) {
      set({ demoError: messageOf(error) })
    } finally {
      set({ demoPending: false, demoStage: null })
    }
  },

  selectDemo: (index) => {
    const account = get().demoAccounts[index]
    if (!account) return
    saveActiveDemo(index)
    saveDemoMode(true)
    set({
      mode: 'demo',
      demoActive: index,
      publicKey: account.publicKey,
      demoError: null,
    })
  },

  getSigner: () => {
    const { mode, publicKey, demoAccounts, demoActive } = get()
    if (!publicKey) return null
    if (mode === 'demo') {
      const account = demoAccounts[demoActive]
      return account ? demoSigner(account) : null
    }
    return walletSigner(publicKey)
  },
}))
