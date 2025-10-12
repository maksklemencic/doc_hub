import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { documentsApi, DocumentResponse } from '@/lib/api'
import { GetDocumentsResponse } from '@/types'
import { useAuth } from '@/hooks/auth/use-auth'

// Query key factory for documents
export const documentsKeys = {
  all: ['documents'] as const,
  spaces: () => [...documentsKeys.all, 'spaces'] as const,
  space: (spaceId: string) => [...documentsKeys.spaces(), spaceId] as const,
  spaceDocuments: (spaceId: string, filters?: string) => [...documentsKeys.space(spaceId), { filters }] as const,
}

// Custom hook to fetch documents for a space
export function useSpaceDocuments(spaceId: string, limit = 100, offset = 0) {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: documentsKeys.spaceDocuments(spaceId, `limit=${limit}&offset=${offset}`),
    queryFn: async () => {
      const response = await documentsApi.getSpaceDocuments(spaceId, limit, offset)
      return response
    },
    enabled: isAuthenticated && !!spaceId, // Only fetch when authenticated and spaceId exists
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
}

// Base hook to delete a document with optional toast notifications
function useDeleteDocumentBase(silent = false) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) => documentsApi.deleteDocument(documentId),

    // Optimistic update
    onMutate: async (documentId) => {
      // Show loading toast (only if not silent)
      const toastId = silent ? undefined : toast.loading('Deleting document...')

      // Cancel any outgoing refetches for documents
      await queryClient.cancelQueries({ queryKey: documentsKeys.all })

      // Find the document being deleted across all cached space documents
      let deletedDocument: DocumentResponse | undefined
      let affectedSpaceId: string | undefined

      // Check all space document caches to find the document
      const queryCache = queryClient.getQueryCache()
      const queries = queryCache.findAll({ queryKey: documentsKeys.spaces() })

      queries.forEach((query) => {
        const data = query.state.data as GetDocumentsResponse | undefined
        if (data?.documents) {
          const foundDoc = data.documents.find((doc: DocumentResponse) => doc.id === documentId)
          if (foundDoc) {
            deletedDocument = foundDoc
            // Extract spaceId from query key
            const queryKey = query.queryKey as string[]
            if (queryKey.length >= 3) {
              affectedSpaceId = queryKey[2]
            }
          }
        }
      })

      // Optimistically remove from the affected space's documents
      if (affectedSpaceId) {
        queryClient.setQueriesData(
          { queryKey: documentsKeys.space(affectedSpaceId) },
          (oldData: any) => {
            if (!oldData?.documents) return oldData

            return {
              ...oldData,
              documents: oldData.documents.filter((doc: DocumentResponse) => doc.id !== documentId),
              pagination: {
                ...oldData.pagination,
                total_count: Math.max(0, oldData.pagination.total_count - 1)
              }
            }
          }
        )
      }

      return { deletedDocument, affectedSpaceId, toastId }
    },

    onError: (err, documentId, context) => {
      // Rollback optimistic update
      if (context?.affectedSpaceId) {
        queryClient.invalidateQueries({ queryKey: documentsKeys.space(context.affectedSpaceId) })
      }

      // Show error toast (only if not silent)
      if (!silent && context?.toastId) {
        const docName = context?.deletedDocument?.filename || 'document'
        toast.error(`Failed to delete "${docName}". Please try again.`, {
          id: context.toastId,
        })
      }
    },

    onSuccess: (data, documentId, context) => {
      // Show success toast (only if not silent)
      if (!silent && context?.toastId) {
        const docName = context?.deletedDocument?.filename || 'document'
        toast.success(`"${docName}" deleted successfully!`, {
          id: context.toastId,
        })
      }
    },

    onSettled: (data, error, documentId, context) => {
      // Invalidate and refetch the affected space's documents
      if (context?.affectedSpaceId) {
        queryClient.invalidateQueries({ queryKey: documentsKeys.space(context.affectedSpaceId) })
        // Also invalidate document counts to update sidebar
        queryClient.invalidateQueries({ queryKey: ['space-document-counts'] })
      }
    },
  })
}

// Custom hook to delete a document with toast notifications
export function useDeleteDocument() {
  return useDeleteDocumentBase(false)
}

// Custom hook to delete a document without toast notifications (for bulk operations)
export function useDeleteDocumentSilent() {
  return useDeleteDocumentBase(true)
}

// Hook for invalidating documents cache (useful for external updates like uploads)
export function useInvalidateSpaceDocuments() {
  const queryClient = useQueryClient()

  return (spaceId: string) => {
    queryClient.invalidateQueries({ queryKey: documentsKeys.space(spaceId) })
  }
}