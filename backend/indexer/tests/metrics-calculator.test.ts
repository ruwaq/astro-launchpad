/**
 * Metrics Calculator Tests
 *
 * Tests the metrics calculation logic for tokens.
 */

import { describe, it, expect, vi } from 'vitest'

describe('Metrics Calculator Logic', () => {
  describe('Volume Calculation', () => {
    it('should calculate 24h volume correctly', () => {
      const calculate24hVolume = (transactions: { amount: bigint; timestamp: Date }[]): bigint => {
        const now = new Date()
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        return transactions
          .filter((tx) => tx.timestamp >= oneDayAgo)
          .reduce((sum, tx) => sum + tx.amount, BigInt(0))
      }

      const now = new Date()
      const transactions = [
        { amount: BigInt(100), timestamp: now }, // Within 24h
        { amount: BigInt(200), timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000) }, // Within 24h
        { amount: BigInt(300), timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000) }, // Outside 24h
      ]

      const volume = calculate24hVolume(transactions)
      expect(volume).toBe(BigInt(300)) // 100 + 200
    })
  })

  describe('Price Change Calculation', () => {
    it('should calculate percentage change correctly', () => {
      const calculatePriceChange = (
        currentPrice: number,
        previousPrice: number
      ): number => {
        if (previousPrice === 0) return 0
        return ((currentPrice - previousPrice) / previousPrice) * 100
      }

      expect(calculatePriceChange(110, 100)).toBeCloseTo(10) // 10% increase
      expect(calculatePriceChange(90, 100)).toBeCloseTo(-10) // 10% decrease
      expect(calculatePriceChange(100, 100)).toBeCloseTo(0) // No change
      expect(calculatePriceChange(200, 100)).toBeCloseTo(100) // 100% increase
      expect(calculatePriceChange(100, 0)).toBe(0) // Avoid division by zero
    })
  })

  describe('Market Cap Calculation', () => {
    it('should calculate market cap correctly', () => {
      const calculateMarketCap = (
        totalSupply: bigint,
        pricePerToken: bigint,
        decimals: number = 7
      ): bigint => {
        const divisor = BigInt(10 ** decimals)
        return (totalSupply * pricePerToken) / divisor
      }

      // 1,000,000 tokens at 0.1 XLM each = 100,000 XLM market cap
      const totalSupply = BigInt(1000000) * BigInt(10 ** 7) // 1M tokens with 7 decimals
      const price = BigInt(1000000) // 0.1 XLM with 7 decimals
      const marketCap = calculateMarketCap(totalSupply, price, 7)

      expect(marketCap).toBe(BigInt(10000000000000)) // 100,000 XLM in stroops
    })
  })

  describe('Holder Count Logic', () => {
    it('should count unique holders correctly', () => {
      const countUniqueHolders = (balances: { address: string; balance: bigint }[]): number => {
        const holdersWithBalance = balances.filter((b) => b.balance > BigInt(0))
        const uniqueAddresses = new Set(holdersWithBalance.map((b) => b.address))
        return uniqueAddresses.size
      }

      const balances = [
        { address: 'GABC...', balance: BigInt(100) },
        { address: 'GDEF...', balance: BigInt(200) },
        { address: 'GABC...', balance: BigInt(50) }, // Duplicate address
        { address: 'GHIJ...', balance: BigInt(0) }, // Zero balance (shouldn't count)
      ]

      expect(countUniqueHolders(balances)).toBe(2) // GABC and GDEF only
    })
  })

  describe('Trending Score Calculation', () => {
    it('should calculate trending score based on volume and transactions', () => {
      const calculateTrendingScore = (
        volume24h: bigint,
        txCount24h: number,
        holderCount: number,
        ageInHours: number
      ): number => {
        // Simple trending formula
        const volumeScore = Number(volume24h) / 1e7 // Convert to XLM
        const txScore = txCount24h * 10
        const holderScore = holderCount * 5
        const recencyBoost = Math.max(0, 100 - ageInHours) // Newer tokens get boost

        return volumeScore + txScore + holderScore + recencyBoost
      }

      const score1 = calculateTrendingScore(BigInt(100e7), 50, 20, 12)
      const score2 = calculateTrendingScore(BigInt(50e7), 25, 10, 48)

      expect(score1).toBeGreaterThan(score2) // Higher volume/tx/holders should score higher
    })
  })

  describe('Time Window Calculations', () => {
    it('should correctly identify time windows', () => {
      const isWithinWindow = (timestamp: Date, windowMs: number): boolean => {
        const now = new Date()
        return timestamp.getTime() >= now.getTime() - windowMs
      }

      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

      const ONE_DAY_MS = 24 * 60 * 60 * 1000

      expect(isWithinWindow(oneHourAgo, ONE_DAY_MS)).toBe(true)
      expect(isWithinWindow(twoDaysAgo, ONE_DAY_MS)).toBe(false)
    })
  })

  describe('Stats Aggregation', () => {
    it('should aggregate global stats correctly', () => {
      interface TokenStats {
        volume24h: bigint
        txCount: number
        holders: number
      }

      const aggregateGlobalStats = (
        tokens: TokenStats[]
      ): { totalVolume: bigint; totalTx: number; avgHolders: number } => {
        const totalVolume = tokens.reduce((sum, t) => sum + t.volume24h, BigInt(0))
        const totalTx = tokens.reduce((sum, t) => sum + t.txCount, 0)
        const avgHolders = tokens.length > 0
          ? tokens.reduce((sum, t) => sum + t.holders, 0) / tokens.length
          : 0

        return { totalVolume, totalTx, avgHolders }
      }

      const tokens: TokenStats[] = [
        { volume24h: BigInt(1000), txCount: 10, holders: 50 },
        { volume24h: BigInt(2000), txCount: 20, holders: 100 },
        { volume24h: BigInt(3000), txCount: 30, holders: 150 },
      ]

      const stats = aggregateGlobalStats(tokens)

      expect(stats.totalVolume).toBe(BigInt(6000))
      expect(stats.totalTx).toBe(60)
      expect(stats.avgHolders).toBe(100)
    })
  })

  describe('Bonding Curve Progress', () => {
    it('should calculate progress towards graduation', () => {
      const calculateProgress = (
        currentMarketCap: bigint,
        graduationThreshold: bigint
      ): number => {
        if (graduationThreshold === BigInt(0)) return 0
        const progress = (Number(currentMarketCap) / Number(graduationThreshold)) * 100
        return Math.min(progress, 100) // Cap at 100%
      }

      const threshold = BigInt(69000) * BigInt(10 ** 7) // $69,000 in stroops

      expect(calculateProgress(BigInt(34500) * BigInt(10 ** 7), threshold)).toBeCloseTo(50)
      expect(calculateProgress(BigInt(69000) * BigInt(10 ** 7), threshold)).toBe(100)
      expect(calculateProgress(BigInt(100000) * BigInt(10 ** 7), threshold)).toBe(100) // Capped
    })
  })
})
