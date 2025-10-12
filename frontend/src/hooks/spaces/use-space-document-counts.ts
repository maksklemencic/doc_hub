'use client'

import { useQuery } from '@tanstack/react-query'
import { documentsApi } from '@/lib/api'
import { useAuth } from '@/hooks/auth/use-auth'

// Hook to get document counts for multiple spaces
export function useSpaceDocumentCounts(spaceIds: string[]) {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: ['space-document-counts', ...spaceIds.sort()],
    queryFn: async () => {
      const counts: Record<string, number> = {}

      // Fetch document count for each space
      await Promise.all(
        spaceIds.map(async (spaceId) => {
          try {
            const response = await documentsApi.getSpaceDocuments(spaceId, 1, 0) // Only fetch 1 doc to get total count
            counts[spaceId] = response.pagination.total_count
          } catch (error) {
            console.error(`Failed to fetch document count for space ${spaceId}:`, error)
            counts[spaceId] = 0
          }
        })
      )

      return counts
    },
    enabled: isAuthenticated && spaceIds.length > 0,
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
}