import { apiRequest } from './client'
import {
  UploadResponse,
  WebDocumentUploadRequest,
  YouTubeUploadRequest
} from './types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const uploadApi = {
  uploadFile: async (file: File, spaceId: string, signal?: AbortSignal): Promise<UploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('space_id', spaceId)
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null
    const response = await fetch(`${API_BASE_URL}/upload/file`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
      signal,
    })
    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Upload failed: ${response.status} ${response.statusText}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      throw new Error(errorMessage)
    }
    return response.json()
  },
  uploadWebDocument: async (request: WebDocumentUploadRequest, signal?: AbortSignal): Promise<UploadResponse> => {
    return apiRequest<UploadResponse>('/upload/web', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    })
  },
  uploadYouTubeVideo: async (request: YouTubeUploadRequest, signal?: AbortSignal): Promise<UploadResponse> => {
    return apiRequest<UploadResponse>('/upload/youtube', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    })
  },
}
