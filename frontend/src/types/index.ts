// Compatibility alias for legacy imports
export type MessageResponse = Message;
// Upload response type
export interface UploadResponse {
  status: string
  document_id: string
  document_name: string
  chunk_count: number
  file_path?: string
  url?: string
}
// Upload request types
export interface WebDocumentUploadRequest {
  url: string
  space_id: string
}
export interface YouTubeUploadRequest {
  url: string
  space_id: string
  segment_duration?: number
  languages?: string[]
}
// Message creation request type
export interface CreateMessageRequest {
  content: string
  top_k?: number
  use_context?: boolean
  only_space_documents?: boolean
  async_processing?: boolean
  document_ids?: string[]
}
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

// API types for spaces
export interface SpaceResponse {
  id: string
  name: string
  icon?: string
  icon_color?: string
  display_order?: number
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
  icon: string
  icon_color: string
}
export interface UpdateSpaceRequest {
  name?: string
  icon?: string
  icon_color?: string
  display_order?: number
}

// API types for documents
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

// API types for messages
export interface MessageResponseWrapper {
  data: {
    query: string
    response: string
    context: string
  }
  message: Message
}
export interface GetMessagesResponse {
  messages: Message[]
  pagination: PaginationMetadata
}
export interface UpdateMessageRequest {
  content: string
  response?: string
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

// Chat layout types
export type ChatPosition =
  | 'bottom-full'      // Bottom of entire viewport, full width
  | 'bottom-left'      // Bottom of left pane only
  | 'bottom-right'     // Bottom of right pane only
  | 'tab-left'         // As a tab in left pane
  | 'tab-right'        // As a tab in right pane
  | 'hidden'           // Chat is hidden/minimized

export interface ChatLayoutState {
  position: ChatPosition
  showHistory: boolean  // Whether history overlay is expanded (for bottom positions)
}