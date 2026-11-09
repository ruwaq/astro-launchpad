import { describe, expect, it, vi } from 'vitest'
import {
  checkRpcHealth,
  NETWORK_NAME,
  NETWORK_PASSPHRASE,
  RPC_URL,
  SOROSWAP_FACTORY,
  SOROSWAP_ROUTER,
} from './network'

describe('network configuration', () => {
  it('defaults to testnet and Soroswap canonical contracts', () => {
    expect(NETWORK_NAME).toBe('testnet')
    expect(NETWORK_PASSPHRASE).toContain('Test SDF Network')
    expect(RPC_URL).toContain('soroban-testnet.stellar.org')
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

  it('parses sequence 0 as a valid RPC response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { sequence: 0 } }),
    } as Response)

    const health = await checkRpcHealth('https://fake-rpc.stellar.org')
    expect(health.ok).toBe(true)
    expect(health.sequence).toBe(0)

    fetchSpy.mockRestore()
  })

  it('reports RPC errors as unhealthy without throwing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
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
})
