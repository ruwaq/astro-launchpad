import {
  StellarWalletsKit,
  type ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit'

export type WalletsDetection = {
  /** Detectadas e instaladas en este navegador app/bwrapper. */
  available: ISupportedWallet[]
  /** Conocidas por la kit pero no instaladas aquí (traen `url` de descarga). */
  notInstalled: ISupportedWallet[]
}

/**
 * Detección de wallets Soroban: la kit pregunta a cada módulo si está
 * disponible en este entorno (<1 s por checkout garantizado). Cada entrada
 * incluye `url`, el link oficial de descarga/página del wallet.
 */
export async function detectWallets(): Promise<WalletsDetection> {
  const all = await StellarWalletsKit.refreshSupportedWallets()
  const isAvailable = all.filter((wallet) => wallet.isAvailable)
  const notInstalled = all.filter(
    (wallet) => !wallet.isAvailable && !wallet.isPlatformWrapper,
  )
  return { available: isAvailable, notInstalled }
}

/** Orden y copy de recomendación por id de módulo del kit (minúsculas). */
const RECOMMENDATION: Record<
  string,
  { label: string; why: string; priority: number }
> = {
  freighter: {
    label: 'Freighter',
    why: 'Recomendada — oficial de SDF, Soroban completo.',
    priority: 1,
  },
  xbull: {
    label: 'xBull',
    why: 'Open source, ligera y con Soroban.',
    priority: 2,
  },
  lobstr: {
    label: 'LOBSTR',
    why: 'La wallet popular de la comunidad.',
    priority: 3,
  },
  albedo: {
    label: 'Albedo',
    why: 'Sin instalación: se abre desde el navegador.',
    priority: 4,
  },
  wallet_connect: {
    label: 'WalletConnect',
    why: 'Freighter Mobile, etc. por QR en el teléfono.',
    priority: 5,
  },
}

export type RecommendedWallet = ISupportedWallet & {
  label: string
  why: string
}

/** Wallets con nuestra recomendación (orden: Freighter primero, etc.). */
export function withRecommendation(
  wallets: ISupportedWallet[],
): RecommendedWallet[] {
  return wallets
    .map((wallet) => {
      const known =
        RECOMMENDATION[wallet.id.toLowerCase()] ?? {
          label: wallet.name,
          why: 'Compatible con Soroban.',
          priority: 99,
        }
      return { ...wallet, ...known }
    })
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
}
