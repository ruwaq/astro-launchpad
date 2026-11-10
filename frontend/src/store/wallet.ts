import { create } from 'zustand'
import { Networks, StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils'
import {
  WalletConnectModule,
  WalletConnectTargetChain,
} from '@creit.tech/stellar-wallets-kit/modules/wallet-connect'
import type { Signer } from '@stellar/stellar-sdk/contract'
import { BRAND } from '../lib/brand'
import { NETWORK_NAME } from '../lib/network'
import { walletSigner } from '../lib/signer'
import {
  MAX_DEMO_ACCOUNTS,
  createDemoAccounts,
  createSingleDemoAccount,
  demoLabelForIndex,
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
  return globalThis.location?.origin ?? 'https://astrogate.local'
}

/**
 * Módulos de wallet: los nativos siempre; WalletConnect v2 (Freighter Mobile,
 * xBull móvil, etc. vía QR) solo si hay `VITE_WC_PROJECT_ID` de Reown Cloud
 * (https://cloud.reown.com, gratis). Nuestros flujos solo necesitan
 * signTransaction/signAndSubmitTransaction, y WalletConnect los cubre.
 */
function walletModules() {
  if (!wcProjectId) return defaultModules()
  const targetChain =
    NETWORK_NAME === 'mainnet'
      ? WalletConnectTargetChain.PUBLIC
      : WalletConnectTargetChain.TESTNET
  return defaultModules().concat(
    new WalletConnectModule({
      projectId: wcProjectId,
      metadata: {
        name: `${BRAND.emoji} ${BRAND.name}`,
        description: BRAND.manifestDescription,
        url: appOrigin(),
        icons: [`${appOrigin()}/icon-192.png`],
      },
      allowedChains: [targetChain],
    }),
  )
}

/**
 * Kit singleton inicializado LAZY (la llamada de la UI lo dispara).
 * Inicializarlo en import-time ejecutaría side-effects (connect eager de
 * WalletConnect) en cada carga aunque nadie use wallet.
 *
 * OJO: en kit >= 2.x `authModal`/`disconnect` son MÉTODOS ESTÁTICOS, por lo
 * que aquí se guarda la clase (`typeof StellarWalletsKit`), no una instancia.
 */
let kit: typeof StellarWalletsKit | null = null
function walletKit(): typeof StellarWalletsKit {
  if (!kit) {
    StellarWalletsKit.init({
      modules: walletModules(),
      network: NETWORK_NAME === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
    })
    kit = StellarWalletsKit
  }
  return kit
}

export type WalletMode = 'wallet' | 'demo'

type WalletState = {
  publicKey: string | null
  pending: boolean
  error: string | null
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
  addDemoAccount: () => Promise<void>
  resetDemoAccounts: () => Promise<void>
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
  return error instanceof Error ? error.message : 'Unknown error'
}

export const useWallet = create<WalletState>((set, get) => ({
  publicKey: startInDemo
    ? (storedDemo[storedDemoActive]?.publicKey ?? null)
    : null,
  pending: false,
  error: null,
  mode: startInDemo ? 'demo' : 'wallet',
  demoAccounts: storedDemo,
  demoActive: storedDemoActive,
  demoPending: false,
  demoStage: null,
  demoError: null,

  connect: async () => {
    set({ pending: true, error: null })
    try {
      const { address } = await walletKit().authModal()
      saveDemoMode(false)
      set({ publicKey: address, mode: 'wallet' })
    } catch (error) {
      const message = messageOf(error)
      const dismissed =
        /close|cancel|dismiss|abort/i.test(message) ||
        message.toLowerCase().startsWith('error: code: ')
      // Cerrar el modal no es un error de estado: se descarta silenciosamente.
      if (!dismissed) set({ error: message })
    } finally {
      set({ pending: false })
    }
  },

  disconnect: async () => {
    if (get().pending) return // anti doble-click
    set({ pending: true })
    try {
      if (get().mode === 'demo') {
        saveDemoMode(false)
        set({ mode: 'wallet', publicKey: null })
        return
      }
      await walletKit().disconnect()
      set({ publicKey: null })
    } finally {
      set({ pending: false })
    }
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
      demoStage: 'Generating testnet accounts…',
      demoError: null,
    })
    try {
      const { accounts, failed } = await createDemoAccounts(
        ({ index, status }) => {
          const label = demoLabelForIndex(index)
          set({
            demoStage:
              status === 'funding'
                ? `Funding account ${label} with 10,000 XLM…`
                : `Account ${label} ready ✓`,
          })
        },
      )
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
      if (failed > 0) {
        set({
          demoError: `Funded ${accounts.length} of ${accounts.length + failed} accounts (Friendbot rate limit). You can add more from the menu.`,
        })
      }
    } catch (error) {
      set({ demoError: messageOf(error) })
    } finally {
      set({ demoPending: false, demoStage: null })
    }
  },

  addDemoAccount: async () => {
    const { demoAccounts, demoPending } = get()
    if (demoPending) return
    if (demoAccounts.length >= MAX_DEMO_ACCOUNTS) {
      set({
        demoError: `You have reached the maximum of ${MAX_DEMO_ACCOUNTS} test accounts in this browser.`,
      })
      return
    }
    const nextIndex = demoAccounts.length
    const label = demoLabelForIndex(nextIndex)
    set({
      demoPending: true,
      demoStage: `Creating and funding account ${label} with 10,000 XLM…`,
      demoError: null,
    })
    try {
      const newAccount = await createSingleDemoAccount(label)
      const updated = [...demoAccounts, newAccount]
      saveDemoAccounts(updated)
      saveActiveDemo(nextIndex)
      saveDemoMode(true)
      set({
        demoAccounts: updated,
        demoActive: nextIndex,
        mode: 'demo',
        publicKey: newAccount.publicKey,
        demoStage: null,
      })
    } catch (error) {
      set({ demoError: messageOf(error) })
    } finally {
      set({ demoPending: false, demoStage: null })
    }
  },

  resetDemoAccounts: async () => {
    if (get().demoPending) return
    set({
      demoPending: true,
      demoStage: 'Regenerating new testnet accounts…',
      demoError: null,
    })
    try {
      const { accounts, failed } = await createDemoAccounts(
        ({ index, status }) => {
          const label = demoLabelForIndex(index)
          set({
            demoStage:
              status === 'funding'
                ? `Funding new account ${label} with 10,000 XLM…`
                : `Account ${label} ready ✓`,
          })
        },
      )
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
      if (failed > 0) {
        set({
          demoError: `Funded ${accounts.length} of ${accounts.length + failed} accounts (Friendbot rate limit).`,
        })
      }
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
