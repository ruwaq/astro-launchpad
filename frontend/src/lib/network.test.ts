import { describe, expect, it, vi } from 'vitest'
import {
  checkRpcHealth,
  executeWithRpcFailover,
  isRetryableRpcError,
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
    expect(RPC_POOL.length).toBeGreaterThanOrEqual(1)
    expect(SOROSWAP_FACTORY.startsWith('C')).toBe(true)
    expect(SOROSWAP_ROUTER.startsWith('C')).toBe(true)
  })

  it('performs RPC health check and parses sequence', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { sequence: 5578000 } }),
    } as Response)

    const health = await checkRpcHealth('https://fake-rpc.stellar.org')
    expect(health.ok).toBe(true)
    expect(health.sequence).toBe(5578000)
    expect(typeof health.latencyMs).toBe('number')

    fetchSpy.mockRestore()
  })

  it('parses sequence 0 as a valid RPC response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { sequence: 0 } }),
    } as Response)

    const health = await checkRpcHealth('https://fake-rpc.stellar.org')
    expect(health.ok).toBe(true)
    expect(health.sequence).toBe(0)

    fetchSpy.mockRestore()
  })

  it('reports HTTP error responses (e.g. 503) without throwing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response)

    const health = await checkRpcHealth('https://fake-rpc.stellar.org')
    expect(health.ok).toBe(false)
    expect(health.error).toContain('HTTP 503')

    fetchSpy.mockRestore()
  })

  it('reports RPC errors as unhealthy without throwing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        error: { message: 'method not found' },
      }),
    } as Response)

    const health = await checkRpcHealth('https://fake-rpc.stellar.org')
    expect(health.ok).toBe(false)
    expect(health.error).toBe('method not found')

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

  it('detects retryable RPC errors properly', () => {
    expect(isRetryableRpcError(new Error('HTTP 429 Too Many Requests'))).toBe(true)
    expect(isRetryableRpcError(new Error('503 Service Unavailable'))).toBe(true)
    expect(isRetryableRpcError(new Error('fetch failed'))).toBe(true)
    expect(isRetryableRpcError(new Error('Contract Error #100'))).toBe(false)
    expect(
      isRetryableRpcError(
        new Error('startLedger must be within the ledger range: 4500 - 5000'),
      ),
    ).toBe(false)
  })

  it('propagates non-retryable errors immediately without failover retries', async () => {
    const pool = ['https://rpc1.stellar.org', 'https://rpc2.stellar.org']
    let calls = 0
    await expect(
      executeWithRpcFailover(
        async () => {
          calls++
          throw new Error('startLedger must be within the ledger range: 4500 - 5000')
        },
        pool,
        { maxRetries: 2, initialDelayMs: 1 },
      ),
    ).rejects.toThrow(/ledger range/)
    expect(calls).toBe(1)
  })

  it('executes action with failover across the pool on error', async () => {
    const pool = ['https://rpc1.stellar.org', 'https://rpc2.stellar.org']
    let calls = 0
    const result = await executeWithRpcFailover(
      async (url) => {
        calls++
        if (url.includes('rpc1')) {
          throw new Error('429 rate limit exceeded')
        }
        return 'success-from-rpc2'
      },
      pool,
      { maxRetries: 0, initialDelayMs: 1 },
    )
    expect(result).toBe('success-from-rpc2')
    expect(calls).toBe(2)
  })
})
