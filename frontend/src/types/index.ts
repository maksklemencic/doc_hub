export interface User {
  id: string
  email: string
  name: string
  picture?: string
  created_at: string
}

export interface Space {
  id: string
  name: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  space_id: string
  filename: string
  file_path: string
  mime_type: string
  uploaded_by: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  space_id: string
  user_id: string
  content: string
  response?: string
  created_at: string
}

export interface AuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    limit: number
    offset: number
    total_count: number
  }
}

export interface ApiError {
  detail: string
  status_code: number
}