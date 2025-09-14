import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { spacesApi, SpaceResponse, CreateSpaceRequest, UpdateSpaceRequest } from '@/lib/api'
import { useAuth } from './use-auth'

// Query key factory for spaces
export const spacesKeys = {
  all: ['spaces'] as const,
  lists: () => [...spacesKeys.all, 'list'] as const,
  list: (filters: string) => [...spacesKeys.lists(), { filters }] as const,
  details: () => [...spacesKeys.all, 'detail'] as const,
  detail: (id: string) => [...spacesKeys.details(), id] as const,
}

// Custom hook to fetch spaces
export function useSpaces() {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: spacesKeys.lists(),
    queryFn: async () => {
      const response = await spacesApi.getSpaces()
      return response.spaces
    },
    enabled: isAuthenticated, // Only fetch when authenticated
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
}

// Custom hook to create a space
export function useCreateSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateSpaceRequest) => spacesApi.createSpace(data),

    // Optimistic update
    onMutate: async (newSpace) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: spacesKeys.lists() })

      // Snapshot the previous value
      const previousSpaces = queryClient.getQueryData<SpaceResponse[]>(spacesKeys.lists())

      // Optimistically update to the new value
      const optimisticSpace: SpaceResponse = {
        id: `temp-${Date.now()}`, // Temporary ID
        name: newSpace.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueryData<SpaceResponse[]>(spacesKeys.lists(), (old) =>
        old ? [...old, optimisticSpace] : [optimisticSpace]
      )

      // Return context with previous and optimistic values
      return { previousSpaces, optimisticSpace }
    },

    // If mutation fails, use the context to roll back
    onError: (err, variables, context) => {
      if (context?.previousSpaces) {
        queryClient.setQueryData(spacesKeys.lists(), context.previousSpaces)
      }
    },

    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: spacesKeys.lists() })
    },

    // On success, replace optimistic update with real data
    onSuccess: (data, variables, context) => {
      // Update the optimistic entry with real data
      queryClient.setQueryData<SpaceResponse[]>(spacesKeys.lists(), (old) => {
        if (!old || !context?.optimisticSpace) return old

        return old.map(space =>
          space.id === context.optimisticSpace.id ? data : space
        )
      })
    },
  })
}

// Custom hook to update a space
export function useUpdateSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ spaceId, data }: { spaceId: string; data: UpdateSpaceRequest }) =>
      spacesApi.updateSpace(spaceId, data),

    // Optimistic update
    onMutate: async ({ spaceId, data }) => {
      await queryClient.cancelQueries({ queryKey: spacesKeys.lists() })

      const previousSpaces = queryClient.getQueryData<SpaceResponse[]>(spacesKeys.lists())

      // Optimistically update
      queryClient.setQueryData<SpaceResponse[]>(spacesKeys.lists(), (old) => {
        if (!old) return old

        return old.map(space =>
          space.id === spaceId
            ? { ...space, name: data.name, updated_at: new Date().toISOString() }
            : space
        )
      })

      return { previousSpaces }
    },

    onError: (err, variables, context) => {
      if (context?.previousSpaces) {
        queryClient.setQueryData(spacesKeys.lists(), context.previousSpaces)
      }
    },

    onSuccess: (data) => {
      // Update with real server data
      queryClient.setQueryData<SpaceResponse[]>(spacesKeys.lists(), (old) => {
        if (!old) return old

        return old.map(space =>
          space.id === data.id ? data : space
        )
      })
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: spacesKeys.lists() })
    },
  })
}

// Custom hook to delete a space
export function useDeleteSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (spaceId: string) => spacesApi.deleteSpace(spaceId),

    // Optimistic update
    onMutate: async (spaceId) => {
      await queryClient.cancelQueries({ queryKey: spacesKeys.lists() })

      const previousSpaces = queryClient.getQueryData<SpaceResponse[]>(spacesKeys.lists())

      // Optimistically remove from UI
      queryClient.setQueryData<SpaceResponse[]>(spacesKeys.lists(), (old) => {
        if (!old) return old
        return old.filter(space => space.id !== spaceId)
      })

      return { previousSpaces, deletedSpaceId: spaceId }
    },

    onError: (err, spaceId, context) => {
      if (context?.previousSpaces) {
        queryClient.setQueryData(spacesKeys.lists(), context.previousSpaces)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: spacesKeys.lists() })
    },
  })
}

// Hook for invalidating spaces cache (useful for external updates)
export function useInvalidateSpaces() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: spacesKeys.lists() })
  }
}