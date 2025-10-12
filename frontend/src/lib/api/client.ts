const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(
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
        errorMessage = errorText || errorMessage
      }
      throw new ApiError(errorMessage, response.status, errorText)
    }
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
