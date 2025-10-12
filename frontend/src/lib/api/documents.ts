import { apiRequest } from './client'
import { DocumentResponse, GetDocumentsResponse } from '../../types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const documentsApi = {
  getSpaceDocuments: async (spaceId: string, limit = 100, offset = 0): Promise<GetDocumentsResponse> => {
    return apiRequest<GetDocumentsResponse>(`/spaces/${spaceId}/documents?limit=${limit}&offset=${offset}`)
  },
  deleteDocument: async (documentId: string): Promise<void> => {
    return apiRequest<void>(`/documents/${documentId}`, {
      method: 'DELETE',
    })
  },
  getDocumentMarkdown: async (documentId: string): Promise<string> => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null
    const response = await fetch(`${API_BASE_URL}/documents/view/${documentId}/markdown`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch markdown: ${response.statusText}`)
    }
    return response.text()
  },
  getDocumentText: async (documentId: string): Promise<string> => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null
    const response = await fetch(`${API_BASE_URL}/documents/view/${documentId}/text`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch text: ${response.statusText}`)
    }
    return response.text()
  },
  getDocumentPdfUrl: (documentId: string): string => {
    return `${API_BASE_URL}/documents/view/${documentId}`
  },
  getDocumentFile: async (documentId: string): Promise<{url: string, docType: string, originalFilename: string}> => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null
    const response = await fetch(`${API_BASE_URL}/documents/view/${documentId}`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`)
    }
    const docType = response.headers.get('X-Document-Type') || 'other'
    const originalFilename = response.headers.get('X-Original-Filename') || 'document'
    const blob = await response.blob()
    return {
      url: URL.createObjectURL(blob),
      docType,
      originalFilename
    }
  },
}
