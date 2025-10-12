'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadApi, ApiError, UploadResponse, WebDocumentUploadRequest, YouTubeUploadRequest } from '@/lib/api'
import toast from 'react-hot-toast'
import { documentsKeys } from './use-documents'

export function useUploadFile() {
  const queryClient = useQueryClient()

  return useMutation<UploadResponse, ApiError, { file: File; spaceId: string; signal?: AbortSignal }>({
    mutationFn: ({ file, spaceId, signal }) => uploadApi.uploadFile(file, spaceId, signal),
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
      // Silently ignore abort errors - they're expected when cancelling
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        return
      }
      console.error('Upload error:', error)
      toast.error(`Failed to upload ${variables.file.name}: ${error.message}`)
    },
  })
}

export function useUploadWebDocument() {
  const queryClient = useQueryClient()

  return useMutation<UploadResponse, ApiError, WebDocumentUploadRequest & { signal?: AbortSignal }>({
    mutationFn: ({ signal, ...request }) => uploadApi.uploadWebDocument(request, signal),
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

export function useUploadYouTubeVideo() {
  const queryClient = useQueryClient()

  return useMutation<UploadResponse, ApiError, YouTubeUploadRequest & { signal?: AbortSignal }>({
    mutationFn: ({ signal, ...request }) => uploadApi.uploadYouTubeVideo(request, signal),
    onSuccess: (data, variables) => {
      toast.success(`Successfully imported transcript from YouTube video`)

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
      console.error('YouTube upload error:', error)
      toast.error(`Failed to import YouTube video: ${error.message}`)
    },
  })
}