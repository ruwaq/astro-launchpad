import {
  StellarWalletsKit,
  type ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit'

export type WalletsDetection = {
  /** Detected and installed in this browser. */
  available: ISupportedWallet[]
  /** Supported by the kit but not installed locally. */
  notInstalled: ISupportedWallet[]
}

/**
 * Detects Soroban wallets available in this browser environment.
 */
export async function detectWallets(): Promise<WalletsDetection> {
  const all = await StellarWalletsKit.refreshSupportedWallets()
  const isAvailable = all.filter((wallet) => wallet.isAvailable)
  const notInstalled = all.filter(
    (wallet) => !wallet.isAvailable && !wallet.isPlatformWrapper,
  )
  return { available: isAvailable, notInstalled }
}

const RECOMMENDATION: Record<
  string,
  { label: string; why: string; priority: number }
> = {
  freighter: {
    label: 'Freighter',
    why: 'Recommended — official SDF wallet, full Soroban support.',
    priority: 1,
  },
  xbull: {
    label: 'xBull',
    why: 'Open source, lightweight with Soroban support.',
    priority: 2,
  },
  lobstr: {
    label: 'LOBSTR',
    why: 'Popular Stellar community wallet.',
    priority: 3,
  },
  albedo: {
    label: 'Albedo',
    why: 'No installation required: opens in web browser.',
    priority: 4,
  },
  wallet_connect: {
    label: 'WalletConnect',
    why: 'Freighter Mobile and others via mobile QR scan.',
    priority: 5,
  },
}

export type RecommendedWallet = ISupportedWallet & {
  label: string
  why: string
}

/** Returns sorted list of wallets with recommendation details. */
export function withRecommendation(
  wallets: ISupportedWallet[],
): RecommendedWallet[] {
  return wallets
    .map((wallet) => {
      const known =
        RECOMMENDATION[wallet.id.toLowerCase()] ?? {
          label: wallet.name,
          why: 'Soroban compatible.',
          priority: 99,
        }
      return { ...wallet, ...known }
    })
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
}
