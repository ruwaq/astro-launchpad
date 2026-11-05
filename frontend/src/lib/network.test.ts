import { describe, expect, it, vi } from 'vitest'
import {
  checkRpcHealth,
  executeWithRpcFailover,
  NETWORK_NAME,
  NETWORK_PASSPHRASE,
  RPC_POOL,
  RPC_URL,
  SOROSWAP_FACTORY,
  SOROSWAP_ROUTER,
} from './network'

describe('network configuration', () => {
  it('defaults to testnet and Soroswap canonical contracts', () => {
    expect(NETWORK_NAME).toBe('testnet')
    expect(NETWORK_PASSPHRASE).toContain('Test SDF Network')
    expect(RPC_URL).toContain('soroban-testnet.stellar.org')
    expect(RPC_POOL.length).toBeGreaterThanOrEqual(2)
    expect(SOROSWAP_FACTORY.startsWith('C')).toBe(true)
    expect(SOROSWAP_ROUTER.startsWith('C')).toBe(true)
  })

  it('performs RPC health check and parses sequence', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { sequence: 5578000 } }),
    } as Response)

    const health = await checkRpcHealth('https://fake-rpc.stellar.org')
    expect(health.ok).toBe(true)
    expect(health.sequence).toBe(5578000)
    expect(typeof health.latencyMs).toBe('number')

    fetchSpy.mockRestore()
  })

  it('handles unreachable RPC gracefully without throwing', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Connection refused'))

    const health = await checkRpcHealth('https://bad-rpc.stellar.org')
    expect(health.ok).toBe(false)
    expect(health.error).toBe('Connection refused')

    fetchSpy.mockRestore()
  })

  it('executes with failover across the RPC pool', async () => {
    const pool = ['https://fail-1.com', 'https://fail-2.com', 'https://ok-3.com']
    let attempts = 0
    const result = await executeWithRpcFailover(async (url) => {
      attempts++
      if (url.includes('fail')) {
        throw new Error(`Failed at ${url}`)
      }
      return `Success at ${url}`
    }, pool)

    expect(attempts).toBe(3)
    expect(result).toBe('Success at https://ok-3.com')
  })

  it('throws last error if all RPC nodes in pool fail', async () => {
    const pool = ['https://fail-a.com', 'https://fail-b.com']
    await expect(
      executeWithRpcFailover(async (url) => {
        throw new Error(`Reverted at ${url}`)
      }, pool),
    ).rejects.toThrow('Reverted at https://fail-b.com')
  })
})
