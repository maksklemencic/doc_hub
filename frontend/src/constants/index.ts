// API endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  CALLBACK: '/auth/callback',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
  
  // Spaces
  SPACES: '/spaces',
  SPACE: (id: string) => `/spaces/${id}`,
  
  // Documents
  DOCUMENTS: (spaceId: string) => `/spaces/${spaceId}/documents`,
  DOCUMENT: (id: string) => `/documents/${id}`,
  DOCUMENT_VIEW: (id: string) => `/documents/view/${id}`,
  
  // Messages
  MESSAGES: (spaceId: string) => `/${spaceId}/messages`,
  MESSAGE: (spaceId: string, messageId: string) => `/${spaceId}/messages/${messageId}`,
  
  // Upload
  UPLOAD_BASE64: '/upload/base64',
  UPLOAD_FILE: '/upload/file',
  UPLOAD_WEB: '/upload/web',
} as const

// Storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  USER: 'user',
  THEME: 'theme',
} as const

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  // DASHBOARD: '/dashboard',
  AUTH_CALLBACK: '/auth/callback',
  SPACES: '/spaces',
  SPACE: (id: string) => `/spaces/${id}`,
  DOCUMENTS: '/documents',
  SETTINGS: '/settings',
} as const

// Limits
export const LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_FILES_PER_UPLOAD: 10,
  PAGINATION_DEFAULT_LIMIT: 20,
  PAGINATION_MAX_LIMIT: 100,
} as const