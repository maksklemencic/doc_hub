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
}

export { ApiError }