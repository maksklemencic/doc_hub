// API layer has been split into multiple files for maintainability.
export { ApiError, apiRequest } from './api/client'
export * from './api/types'
export * from './api/spaces'
export * from './api/documents'
export * from './api/upload'
export * from './api/messages'