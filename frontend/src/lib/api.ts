const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// API Response types matching backend models
export interface SpaceResponse {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface PaginationMetadata {
  limit: number
  offset: number
  total_count: number
}

export interface GetSpacesResponse {
  spaces: SpaceResponse[]
  pagination: PaginationMetadata
}

export interface CreateSpaceRequest {
  name: string
}

export interface UpdateSpaceRequest {
  name: string
}

// Documents API types
export interface DocumentResponse {
  id: string
  filename: string
  mime_type: string
  file_size: number
  space_id: string
  url?: string
  created_at: string
  updated_at?: string
}

export interface GetDocumentsResponse {
  documents: DocumentResponse[]
  pagination: PaginationMetadata
}

// Upload API types
export interface UploadResponse {
  status: string
  document_id: string
  document_name: string
  chunk_count: number
  file_path?: string
  url?: string
}

export interface WebDocumentUploadRequest {
  url: string
  space_id: string
}

// Messages API types
export interface MessageResponse {
  id: string
  space_id: string
  user_id: string
  content: string
  response?: string
  created_at: string
}

export interface CreateMessageRequest {
  content: string
  top_k?: number
  use_context?: boolean
  only_space_documents?: boolean
  async_processing?: boolean
}

export interface MessageResponseWrapper {
  data: {
    query: string
    response: string
    context: string
  }
  message: MessageResponse
}

export interface GetMessagesResponse {
  messages: MessageResponse[]
  pagination: PaginationMetadata
}

export interface UpdateMessageRequest {
  content: string
  response?: string
}

export interface AsyncMessageResponse {
  task_id: string
  status: string
  message: string
}

export interface TaskStatusResponse {
  task_id: string
  status: string
  progress: number
  result?: object
  error?: string
  created_at?: string
  started_at?: string
  completed_at?: string
}

// Streaming event types
export interface StreamingEvent {
  type: 'message_start' | 'chunk' | 'message_complete' | 'error'
}

export interface MessageStartEvent extends StreamingEvent {
  type: 'message_start'
  message_id: string
  content: string
}

export interface ChunkEvent extends StreamingEvent {
  type: 'chunk'
  content: string
  chunk_number: number
}

export interface MessageCompleteEvent extends StreamingEvent {
  type: 'message_complete'
  message_id: string
  final_response: string
  context: string
  total_chunks: number
}

export interface ErrorEvent extends StreamingEvent {
  type: 'error'
  error: string
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('access_token')
    : null

  const url = `${API_BASE_URL}${endpoint}`

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, config)

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Request failed: ${response.status} ${response.statusText}`

      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail || errorMessage
      } catch {
        // If parsing fails, use the text as is
        errorMessage = errorText || errorMessage
      }

      throw new ApiError(errorMessage, response.status, errorText)
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return undefined as T
    }

    const data = await response.json()
    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      0
    )
  }
}

// Spaces API
export const spacesApi = {
  // Get all spaces for the user
  getSpaces: async (limit = 100, offset = 0): Promise<GetSpacesResponse> => {
    return apiRequest<GetSpacesResponse>(`/spaces?limit=${limit}&offset=${offset}`)
  },

  // Create a new space
  createSpace: async (request: CreateSpaceRequest): Promise<SpaceResponse> => {
    return apiRequest<SpaceResponse>('/spaces', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  // Update a space
  updateSpace: async (spaceId: string, request: UpdateSpaceRequest): Promise<SpaceResponse> => {
    return apiRequest<SpaceResponse>(`/spaces/${spaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    })
  },

  // Delete a space
  deleteSpace: async (spaceId: string): Promise<void> => {
    return apiRequest<void>(`/spaces/${spaceId}`, {
      method: 'DELETE',
    })
  },
}

// Documents API
export const documentsApi = {
  // Get documents for a specific space
  getSpaceDocuments: async (spaceId: string, limit = 100, offset = 0): Promise<GetDocumentsResponse> => {
    return apiRequest<GetDocumentsResponse>(`/spaces/${spaceId}/documents?limit=${limit}&offset=${offset}`)
  },

  // Delete a document
  deleteDocument: async (documentId: string): Promise<void> => {
    return apiRequest<void>(`/documents/${documentId}`, {
      method: 'DELETE',
    })
  },

  // Get document markdown content
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
      throw new ApiError(`Failed to fetch markdown: ${response.statusText}`, response.status)
    }

    return response.text()
  },

  // Get document text content
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
      throw new ApiError(`Failed to fetch text: ${response.statusText}`, response.status)
    }

    return response.text()
  },

  // Get document PDF URL (for embedding)
  getDocumentPdfUrl: (documentId: string): string => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null

    const url = `${API_BASE_URL}/documents/view/${documentId}`

    // For PDF viewer, we need to include auth token in URL or header
    // react-pdf will handle the URL directly
    return url
  },

  // Get document file with auth headers (for react-pdf)
  getDocumentFile: async (documentId: string): Promise<string> => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null

    const response = await fetch(`${API_BASE_URL}/documents/view/${documentId}`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })

    if (!response.ok) {
      throw new ApiError(`Failed to fetch document: ${response.statusText}`, response.status)
    }

    // Return blob URL instead of ArrayBuffer/Uint8Array to avoid detachment issues with Workers
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  },
}

// Upload API
export const uploadApi = {
  // Upload file via multipart form data
  uploadFile: async (file: File, spaceId: string): Promise<UploadResponse> => {
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

      throw new ApiError(errorMessage, response.status, errorText)
    }

    return response.json()
  },

  // Upload web document from URL
  uploadWebDocument: async (request: WebDocumentUploadRequest): Promise<UploadResponse> => {
    return apiRequest<UploadResponse>('/upload/web', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },
}

// Messages API
export const messagesApi = {
  // Create message with streaming (now the default)
  createMessage: (
    spaceId: string,
    request: CreateMessageRequest,
    onEvent: (event: StreamingEvent) => void,
    abortController?: AbortController
  ): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null

      try {
        const response = await fetch(`${API_BASE_URL}/spaces/${spaceId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify(request),
          signal: abortController?.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        // Handle abortion
        const abortHandler = () => {
          reader.cancel()
          reject(new Error('Streaming aborted by user'))
        }

        if (abortController) {
          abortController.signal.addEventListener('abort', abortHandler)
        }

        try {
          while (true) {
            // Check if aborted before each read
            if (abortController?.signal.aborted) {
              throw new Error('Streaming aborted by user')
            }

            const { done, value } = await reader.read()

            if (done) {
              resolve()
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const eventData = line.slice(6) // Remove 'data: ' prefix
                  if (eventData.trim()) {
                    const data = JSON.parse(eventData)
                    onEvent(data)

                    if (data.type === 'message_complete' || data.type === 'error') {
                      resolve()
                      return
                    }
                  }
                } catch (error) {
                  console.warn('Failed to parse SSE data:', line, error)
                }
              }
            }
          }
        } finally {
          // Cleanup abort listener
          if (abortController) {
            abortController.signal.removeEventListener('abort', abortHandler)
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  },

  // Legacy create message (kept for backward compatibility, but now also streams)
  createMessageLegacy: async (spaceId: string, request: CreateMessageRequest): Promise<MessageResponseWrapper> => {
    return apiRequest<MessageResponseWrapper>(`/spaces/${spaceId}/messages`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  // Get chat history
  getMessages: async (spaceId: string, limit = 10, offset = 0): Promise<GetMessagesResponse> => {
    return apiRequest<GetMessagesResponse>(`/spaces/${spaceId}/messages?limit=${limit}&offset=${offset}`)
  },

  // Update message
  updateMessage: async (spaceId: string, messageId: string, request: UpdateMessageRequest): Promise<MessageResponse> => {
    return apiRequest<MessageResponse>(`/spaces/${spaceId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    })
  },

  // Delete message
  deleteMessage: async (spaceId: string, messageId: string): Promise<void> => {
    return apiRequest<void>(`/spaces/${spaceId}/messages/${messageId}`, {
      method: 'DELETE',
    })
  },

  // Get task status (for async processing)
  getTaskStatus: async (taskId: string): Promise<TaskStatusResponse> => {
    return apiRequest<TaskStatusResponse>(`/tasks/${taskId}`)
  },
}

export { ApiError }