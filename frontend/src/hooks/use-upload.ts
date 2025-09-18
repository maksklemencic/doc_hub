'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadApi, ApiError, UploadResponse, WebDocumentUploadRequest } from '@/lib/api'
import toast from 'react-hot-toast'
import { documentsKeys } from './use-documents'

export function useUploadFile() {
  const queryClient = useQueryClient()

  return useMutation<UploadResponse, ApiError, { file: File; spaceId: string }>({
    mutationFn: ({ file, spaceId }) => uploadApi.uploadFile(file, spaceId),
    onSuccess: (data, variables) => {
      toast.success(`Successfully uploaded ${data.document_name}`)

      // Invalidate space documents query to refresh the list
      queryClient.invalidateQueries({
        queryKey: documentsKeys.space(variables.spaceId)
      })

      // Also invalidate spaces query and document counts to update sidebar
      queryClient.invalidateQueries({
        queryKey: ['spaces']
      })
      queryClient.invalidateQueries({
        queryKey: ['space-document-counts']
      })
    },
    onError: (error, variables) => {
      console.error('Upload error:', error)
      toast.error(`Failed to upload ${variables.file.name}: ${error.message}`)
    },
  })
}

export function useUploadWebDocument() {
  const queryClient = useQueryClient()

  return useMutation<UploadResponse, ApiError, WebDocumentUploadRequest>({
    mutationFn: (request) => uploadApi.uploadWebDocument(request),
    onSuccess: (data, variables) => {
      toast.success(`Successfully imported ${data.document_name}`)

      // Invalidate space documents query to refresh the list
      queryClient.invalidateQueries({
        queryKey: documentsKeys.space(variables.space_id)
      })

      // Also invalidate spaces query and document counts to update sidebar
      queryClient.invalidateQueries({
        queryKey: ['spaces']
      })
      queryClient.invalidateQueries({
        queryKey: ['space-document-counts']
      })
    },
    onError: (error, variables) => {
      console.error('Web upload error:', error)
      toast.error(`Failed to import from URL: ${error.message}`)
    },
  })
}