import { useMemo, useState } from 'react'
import { MessageResponse } from '@/types'
import { chatLogger } from '@/utils/logger'

interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
  context?: string
}

interface UseChatMessagesOptions {
  backendMessages: MessageResponse[]
  messageContexts: Record<string, string>
}

interface UseChatMessagesReturn {
  messages: ChatMessage[]
  editingMessageId: string | null
  editValue: string
  copiedMessageId: string | null
  handleStartEdit: (messageId: string, currentContent: string) => void
  handleCancelEdit: () => void
  handleSaveEdit: (messageId: string) => Promise<string | undefined>
  handleCopyMessage: (messageId: string, content: string) => void
  formatTime: (timestamp: string) => string
}

// Transform backend MessageResponse to ChatMessage format
const transformMessage = (msg: MessageResponse, role: 'user' | 'assistant' = 'user'): ChatMessage => ({
  id: msg.id,
  content: role === 'user' ? msg.content : (msg.response || msg.content),
  role,
  timestamp: msg.created_at
})

export function useChatMessages({
  backendMessages,
  messageContexts
}: UseChatMessagesOptions): UseChatMessagesReturn {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  // Transform backend messages to chat format with memoization
  const messages: ChatMessage[] = useMemo(() => {
    if (backendMessages.length === 0) {
      return [
        {
          id: 'welcome',
          content: 'Hello! I can help you find information from your documents in this space. What would you like to know?',
          role: 'assistant' as const,
          timestamp: new Date().toISOString()
        }
      ]
    }

    return backendMessages.flatMap((msg, index) => {
      const chatMessages: ChatMessage[] = []

      // Add user message (from content field)
      chatMessages.push(transformMessage(msg, 'user'))

      // Add assistant response if exists (from response field)
      if (msg.response) {
        const responseId = `${msg.id}-response-${index}`
        chatMessages.push({
          id: responseId,
          content: msg.response,
          role: 'assistant',
          timestamp: msg.created_at,
          context: messageContexts[msg.id]
        })
      }

      return chatMessages
    })
  }, [backendMessages, messageContexts])

  const handleStartEdit = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId)
    setEditValue(currentContent)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditValue('')
  }

  const handleSaveEdit = async (messageId: string) => {
    if (!editValue.trim() || editValue === editingMessageId) return

    // This would typically trigger a mutation to save the edit
    // For now, we just reset the state - the actual save logic will be handled by the parent
    const currentEditValue = editValue.trim()

    setEditingMessageId(null)
    setEditValue('')

    // The actual save logic will be handled by the parent component
    // Return the edit value so parent can use it
    return currentEditValue
  }

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      chatLogger.error('Failed to copy message to clipboard', error, {
        action: 'copyMessage',
        messageId,
        contentLength: content.length
      })
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    const isToday = date.toDateString() === now.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()
    const isThisWeek = (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000

    // Get user locale, default to European format if not available
    const userLocale = typeof navigator !== 'undefined' ? navigator.language : 'de-DE'

    const timeStr = date.toLocaleTimeString(userLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    if (isToday) {
      return timeStr
    } else if (isYesterday) {
      return `Yesterday, ${timeStr}`
    } else if (isThisWeek) {
      const dayName = date.toLocaleDateString(userLocale, { weekday: 'long' })
      return `${dayName}, ${timeStr}`
    } else {
      // European format DD.MM.YYYY
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}.${month}.${year}, ${timeStr}`
    }
  }

  return {
    messages,
    editingMessageId,
    editValue,
    copiedMessageId,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleCopyMessage,
    formatTime
  }
}
