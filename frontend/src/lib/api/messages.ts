import { apiRequest } from './client'
import {
  CreateMessageRequest,
  MessageResponseWrapper,
  GetMessagesResponse,
  UpdateMessageRequest,
  StreamingEvent,
  TaskStatusResponse
} from '../../types'
import { apiLogger } from '@/utils/logger'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const messagesApi = {
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
        const abortHandler = () => {
          reader.cancel()
          reject(new Error('Streaming aborted by user'))
        }
        if (abortController) {
          abortController.signal.addEventListener('abort', abortHandler)
        }
        try {
          while (true) {
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
                  const eventData = line.slice(6)
                  if (eventData.trim()) {
                    const data = JSON.parse(eventData)
                    onEvent(data)
                    if (data.type === 'message_complete' || data.type === 'error') {
                      resolve()
                      return
                    }
                  }
                } catch (error) {
                  apiLogger.warn('Failed to parse SSE data', error, {
                    action: 'parseSSEData',
                    spaceId,
                    line: line.substring(0, 100), // Truncate line to avoid logging too much data
                    streamingType: 'message'
                  })
                }
              }
            }
          }
        } finally {
          if (abortController) {
            abortController.signal.removeEventListener('abort', abortHandler)
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  },
  createMessageLegacy: async (spaceId: string, request: CreateMessageRequest): Promise<MessageResponseWrapper> => {
    return apiRequest<MessageResponseWrapper>(`/spaces/${spaceId}/messages`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },
  getMessages: async (spaceId: string, limit = 10, offset = 0): Promise<GetMessagesResponse> => {
    return apiRequest<GetMessagesResponse>(`/spaces/${spaceId}/messages?limit=${limit}&offset=${offset}`)
  },
  updateMessage: async (spaceId: string, messageId: string, request: UpdateMessageRequest): Promise<any> => {
    return apiRequest<any>(`/spaces/${spaceId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    })
  },
  deleteMessage: async (spaceId: string, messageId: string): Promise<void> => {
    return apiRequest<void>(`/spaces/${spaceId}/messages/${messageId}`, {
      method: 'DELETE',
    })
  },
  getTaskStatus: async (taskId: string): Promise<TaskStatusResponse> => {
    return apiRequest<TaskStatusResponse>(`/tasks/${taskId}`)
  },
}
