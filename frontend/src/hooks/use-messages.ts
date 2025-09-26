import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  messagesApi,
  MessageResponse,
  CreateMessageRequest,
  UpdateMessageRequest,
  MessageResponseWrapper,
  GetMessagesResponse
} from '@/lib/api'
import { useAuth } from './use-auth'

// Query key factory for messages
export const messagesKeys = {
  all: ['messages'] as const,
  lists: () => [...messagesKeys.all, 'list'] as const,
  list: (spaceId: string, filters?: string) => [...messagesKeys.lists(), spaceId, { filters }] as const,
  details: () => [...messagesKeys.all, 'detail'] as const,
  detail: (spaceId: string, id: string) => [...messagesKeys.details(), spaceId, id] as const,
}

// Custom hook to fetch messages for a space
export function useMessages(spaceId: string, limit = 50, offset = 0) {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: messagesKeys.list(spaceId),
    queryFn: async () => {
      const response = await messagesApi.getMessages(spaceId, limit, offset)
      return response
    },
    enabled: isAuthenticated && !!spaceId, // Only fetch when authenticated and spaceId exists
    staleTime: 1 * 60 * 1000, // Consider data stale after 1 minute
    gcTime: 3 * 60 * 1000, // Keep in cache for 3 minutes
  })
}

// Custom hook to create a message (send chat)
export function useCreateMessage(spaceId: string) {
  const queryClient = useQueryClient()

  // Define the context type for this mutation
  type MutationContext = {
    previousMessages: GetMessagesResponse | undefined
    optimisticUserMessage: MessageResponse
  }

  return useMutation<MessageResponseWrapper, Error, CreateMessageRequest, MutationContext>({
    mutationFn: async (data: CreateMessageRequest) => {
      console.log('🚀 Sending message to API:', { spaceId, data })
      const response = await messagesApi.createMessage(spaceId, data)
      console.log('📥 Raw API response:', response)
      return response
    },

    // Optimistic update
    onMutate: async (newMessage) => {
      console.log('⚡ Starting optimistic update for:', newMessage.content)

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: messagesKeys.list(spaceId) })

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<GetMessagesResponse>(messagesKeys.list(spaceId))
      console.log('📋 Previous messages in cache:', previousMessages)

      // Create optimistic user message
      const optimisticUserMessage: MessageResponse = {
        id: `temp-user-${Date.now()}`,
        space_id: spaceId,
        user_id: 'current-user',
        content: newMessage.content,
        created_at: new Date().toISOString(),
      }
      console.log('💫 Created optimistic message:', optimisticUserMessage)

      // Optimistically update to include the user message
      queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
        if (!old) return { messages: [optimisticUserMessage], pagination: { limit: 50, offset: 0, total_count: 1 } }
        const updated = {
          ...old,
          messages: [...old.messages, optimisticUserMessage],
          pagination: {
            ...old.pagination,
            total_count: old.pagination.total_count + 1
          }
        }
        console.log('✨ Updated cache with optimistic message:', updated)
        return updated
      })

      return { previousMessages, optimisticUserMessage }
    },

    // On success, replace optimistic update with real data
    onSuccess: (data, variables, context) => {
      console.log('🎉 Mutation successful! Processing response...')
      console.log('📦 Full response data:', data)
      console.log('💬 Message data:', data.message)
      console.log('🤖 Assistant response:', data.data?.response)

      // Update with real server data
      queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
        if (!old || !context?.optimisticUserMessage) {
          console.log('❌ No old data or optimistic message found')
          return old
        }

        console.log('🔄 Replacing optimistic message with real data...')
        console.log('🗑️  Removing optimistic message with ID:', context.optimisticUserMessage.id)

        // Remove optimistic message and add real message with response
        const filteredMessages = old.messages.filter(msg => msg.id !== context.optimisticUserMessage.id)
        console.log('📝 Filtered messages (without optimistic):', filteredMessages)

        // Add the real message with response from server
        const realMessage = {
          ...data.message,
          response: data.data?.response || data.message.response
        }
        console.log('✅ Final real message to add:', realMessage)

        const finalResult = {
          ...old,
          messages: [...filteredMessages, realMessage],
          pagination: {
            ...old.pagination,
            total_count: filteredMessages.length + 1
          }
        }
        console.log('🏁 Final messages cache result:', finalResult)
        return finalResult
      })
    },

    // If mutation fails, use the context to roll back
    onError: (err, variables, context) => {
      console.log('❌ Mutation failed:', err)
      console.log('🔙 Rolling back optimistic update...')

      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKeys.list(spaceId), context.previousMessages)
        console.log('↩️  Restored previous messages:', context.previousMessages)
      }

      toast.error('Failed to send message. Please try again.')
    },

    // Always refetch after error or success (but avoid double refetch on success since we already updated)
    onSettled: (data, error) => {
      if (error) {
        // Only invalidate on error to ensure we have fresh data
        console.log('🔄 Invalidating cache due to error...')
        queryClient.invalidateQueries({ queryKey: messagesKeys.list(spaceId) })
      }
    },
  })
}

// Custom hook to update a message
export function useUpdateMessage(spaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ messageId, data }: { messageId: string; data: UpdateMessageRequest }) =>
      messagesApi.updateMessage(spaceId, messageId, data),

    // Optimistic update
    onMutate: async ({ messageId, data }) => {
      await queryClient.cancelQueries({ queryKey: messagesKeys.list(spaceId) })

      const previousMessages = queryClient.getQueryData<GetMessagesResponse>(messagesKeys.list(spaceId))

      // Optimistically update
      queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
        if (!old) return old

        return {
          ...old,
          messages: old.messages.map(message =>
            message.id === messageId
              ? { ...message, content: data.content, response: data.response }
              : message
          )
        }
      })

      return { previousMessages }
    },

    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKeys.list(spaceId), context.previousMessages)
      }

      toast.error('Failed to update message. Please try again.')
    },

    onSuccess: (data) => {
      // Update with real server data
      queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
        if (!old) return old

        return {
          ...old,
          messages: old.messages.map(message =>
            message.id === data.id ? data : message
          )
        }
      })

      toast.success('Message updated successfully!')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.list(spaceId) })
    },
  })
}

// Custom hook to delete a message
export function useDeleteMessage(spaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (messageId: string) => messagesApi.deleteMessage(spaceId, messageId),

    // Optimistic update
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: messagesKeys.list(spaceId) })

      const previousMessages = queryClient.getQueryData<GetMessagesResponse>(messagesKeys.list(spaceId))

      // Find the message being deleted for potential rollback
      const deletedMessage = previousMessages?.messages.find(msg => msg.id === messageId)

      // Optimistically remove from UI
      queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
        if (!old) return old
        return {
          ...old,
          messages: old.messages.filter(message => message.id !== messageId),
          pagination: {
            ...old.pagination,
            total_count: Math.max(0, old.pagination.total_count - 1)
          }
        }
      })

      return { previousMessages, deletedMessage }
    },

    onError: (err, messageId, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKeys.list(spaceId), context.previousMessages)
      }

      toast.error('Failed to delete message. Please try again.')
    },

    onSuccess: () => {
      toast.success('Message deleted successfully!')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: messagesKeys.list(spaceId) })
    },
  })
}

// Hook for invalidating messages cache (useful for external updates)
export function useInvalidateMessages(spaceId: string) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: messagesKeys.list(spaceId) })
  }
}