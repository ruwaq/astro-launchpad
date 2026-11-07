import { useQuery } from '@tanstack/react-query'
import {
  getLocalTokenMetadata,
  type EnrichedTokenMetadata,
} from '../lib/token-metadata'

export function useTokenMetadata(tokenId: string | null | undefined) {
  return useQuery<EnrichedTokenMetadata | null>({
    queryKey: ['token-metadata', tokenId],
    queryFn: () => (tokenId ? getLocalTokenMetadata(tokenId) : null),
    staleTime: 60_000,
  })
}
