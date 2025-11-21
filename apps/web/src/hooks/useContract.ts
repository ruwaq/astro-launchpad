/**
 * React Hooks para datos reales del contrato
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { getContractClient } from '@/lib/stellar/contract';

/**
 * Hook para obtener el total de tokens creados (DATOS REALES)
 */
export function useTokenCount() {
  return useQuery({
    queryKey: ['tokenCount'],
    queryFn: async () => {
      const client = getContractClient();
      return await client.getTokenCount();
    },
    refetchInterval: 30000, // Actualizar cada 30 segundos
  });
}

/**
 * Hook para obtener información de un token (DATOS REALES)
 */
export function useTokenInfo(tokenAddress: string | null) {
  return useQuery({
    queryKey: ['tokenInfo', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null;
      const client = getContractClient();
      return await client.getTokenInfo(tokenAddress);
    },
    enabled: !!tokenAddress,
    refetchInterval: 10000, // Actualizar cada 10 segundos
  });
}

/**
 * Hook para obtener precio actual (DATOS REALES)
 */
export function useTokenPrice(tokenAddress: string | null) {
  return useQuery({
    queryKey: ['tokenPrice', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null;
      const client = getContractClient();
      return await client.getPrice(tokenAddress);
    },
    enabled: !!tokenAddress,
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });
}

/**
 * Hook para progreso de graduación (DATOS REALES)
 */
export function useGraduationProgress(tokenAddress: string | null) {
  return useQuery({
    queryKey: ['graduation', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null;
      const client = getContractClient();
      return await client.getGraduationProgress(tokenAddress);
    },
    enabled: !!tokenAddress,
    refetchInterval: 15000,
  });
}

/**
 * Hook para tokens del creator (DATOS REALES)
 */
export function useCreatorTokens(creatorAddress: string | null) {
  return useQuery({
    queryKey: ['creatorTokens', creatorAddress],
    queryFn: async () => {
      if (!creatorAddress) return [];
      const client = getContractClient();
      return await client.getCreatorTokens(creatorAddress);
    },
    enabled: !!creatorAddress,
    refetchInterval: 30000,
  });
}
