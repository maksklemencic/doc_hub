import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import toast from 'react-hot-toast'
import {
  messagesApi,
  MessageResponse,
  CreateMessageRequest,
  UpdateMessageRequest,
  MessageResponseWrapper,
  GetMessagesResponse,
  StreamingEvent,
  MessageStartEvent,
  ChunkEvent,
  MessageCompleteEvent,
  ErrorEvent
} from '@/lib/api'
import { useAuth } from '@/hooks/auth/use-auth'

// Type for infinite query data structure
type InfiniteMessagesData = {
  pages: GetMessagesResponse[]
  pageParams: number[]
}

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

// Custom hook for infinite scroll loading of messages (newest first)
export function useMessagesInfinite(spaceId: string, pageSize = 10) {
  const { isAuthenticated } = useAuth()

  return useInfiniteQuery({
    queryKey: messagesKeys.list(spaceId, 'infinite'),
    queryFn: async ({ pageParam = 0 }) => {
      const response = await messagesApi.getMessages(spaceId, pageSize, pageParam)
      return response
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, page) => sum + page.messages.length, 0)
      const hasMore = loadedCount < lastPage.pagination.total_count
      return hasMore ? loadedCount : undefined
    },
    enabled: isAuthenticated && !!spaceId,
    staleTime: 1 * 60 * 1000,
    gcTime: 3 * 60 * 1000,
    initialPageParam: 0,
  })
}

// Custom hook to create a message with streaming
export function useCreateMessage(spaceId: string) {
  const queryClient = useQueryClient()
  const abortControllerRef = useRef<AbortController | null>(null)

  type MutationContext = {
    previousMessages: GetMessagesResponse | undefined
    optimisticUserMessage: MessageResponse
    streamingAssistantMessage: MessageResponse | null
  }

  const mutation = useMutation<void, Error, CreateMessageRequest, MutationContext>({
    mutationFn: async (data: CreateMessageRequest) => {
      // Stop any existing streaming operation first
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      return new Promise((resolve, reject) => {
        let tempAssistantId: string | null = null
        let streamingContent = ''

        // Create abort controller for this request
        const abortController = new AbortController()
        abortControllerRef.current = abortController

        messagesApi.createMessage(spaceId, data, (event: StreamingEvent) => {

          switch (event.type) {
            case 'message_start': {
              const startEvent = event as MessageStartEvent

              // Replace the optimistic user message with the real one from backend
              // This message will hold both the user query AND the streaming AI response
              // Update both regular and infinite query caches
              queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
                if (!old) return old

                // Find and replace the temp user message with real one
                const updatedMessages = old.messages.map(msg =>
                  msg.id.startsWith('temp-user-')
                    ? {
                        id: startEvent.message_id,
                        space_id: spaceId,
                        user_id: msg.user_id,
                        content: startEvent.content,
                        response: '', // Will be updated as chunks arrive
                        created_at: new Date().toISOString()
                      }
                    : msg
                )

                // Set the temp assistant ID to the real message ID for updates
                tempAssistantId = startEvent.message_id

                return {
                  ...old,
                  messages: updatedMessages
                  // Don't change pagination count - we're just replacing, not adding
                }
              })

              // Also update infinite query cache
              queryClient.setQueryData<InfiniteMessagesData>(messagesKeys.list(spaceId, 'infinite'), (old) => {
                if (!old) return old

                return {
                  ...old,
                  pages: old.pages.map((page, index) => {
                    // Only update the first page (newest messages)
                    if (index === 0) {
                      return {
                        ...page,
                        messages: page.messages.map((msg) =>
                          msg.id.startsWith('temp-user-')
                            ? {
                                id: startEvent.message_id,
                                space_id: spaceId,
                                user_id: msg.user_id,
                                content: startEvent.content,
                                response: '',
                                created_at: new Date().toISOString()
                              }
                            : msg
                        )
                      }
                    }
                    return page
                  })
                }
              })
              break
            }

            case 'chunk': {
              const chunkEvent = event as ChunkEvent
              streamingContent += chunkEvent.content

              // Update the message's response field in real-time
              if (tempAssistantId) {
                queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
                  if (!old) return old

                  return {
                    ...old,
                    messages: old.messages.map(msg =>
                      msg.id === tempAssistantId
                        ? { ...msg, response: streamingContent }
                        : msg
                    )
                  }
                })

                // Also update infinite query cache
                queryClient.setQueryData<InfiniteMessagesData>(messagesKeys.list(spaceId, 'infinite'), (old) => {
                  if (!old) return old

                  return {
                    ...old,
                    pages: old.pages.map((page, index) => {
                      if (index === 0) {
                        return {
                          ...page,
                          messages: page.messages.map((msg) =>
                            msg.id === tempAssistantId
                              ? { ...msg, response: streamingContent }
                              : msg
                          )
                        }
                      }
                      return page
                    })
                  }
                })
              }
              break
            }

            case 'message_complete': {
              const completeEvent = event as MessageCompleteEvent

              // Final update with complete response
              if (tempAssistantId) {
                queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
                  if (!old) return old

                  return {
                    ...old,
                    messages: old.messages.map(msg =>
                      msg.id === tempAssistantId
                        ? {
                            ...msg,
                            response: completeEvent.final_response
                          }
                        : msg
                    )
                  }
                })

                // Also update infinite query cache
                queryClient.setQueryData<InfiniteMessagesData>(messagesKeys.list(spaceId, 'infinite'), (old) => {
                  if (!old) return old

                  return {
                    ...old,
                    pages: old.pages.map((page, index) => {
                      if (index === 0) {
                        return {
                          ...page,
                          messages: page.messages.map((msg) =>
                            msg.id === tempAssistantId
                              ? {
                                  ...msg,
                                  response: completeEvent.final_response
                                }
                              : msg
                          )
                        }
                      }
                      return page
                    })
                  }
                })
              }

              resolve()
              break
            }

            case 'error': {
              const errorEvent = event as ErrorEvent & { partial_response?: string }

              // If we have a partial response, save it before rejecting
              if (errorEvent.partial_response && tempAssistantId) {
                queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
                  if (!old) return old

                  return {
                    ...old,
                    messages: old.messages.map(msg =>
                      msg.id === tempAssistantId
                        ? {
                            ...msg,
                            response: errorEvent.partial_response
                          }
                        : msg
                    )
                  }
                })

                // Also update infinite query cache
                queryClient.setQueryData<InfiniteMessagesData>(messagesKeys.list(spaceId, 'infinite'), (old) => {
                  if (!old) return old

                  return {
                    ...old,
                    pages: old.pages.map((page, index) => {
                      if (index === 0) {
                        return {
                          ...page,
                          messages: page.messages.map((msg) =>
                            msg.id === tempAssistantId
                              ? {
                                  ...msg,
                                  response: errorEvent.partial_response
                                }
                              : msg
                          )
                        }
                      }
                      return page
                    })
                  }
                })
              }

              reject(new Error(errorEvent.error))
              break
            }
          }
        }, abortController).catch((error) => {
          if (error.message.includes('aborted')) {
            // Save partial response if we have any streaming content
            if (streamingContent && tempAssistantId) {
              queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
                if (!old) return old

                return {
                  ...old,
                  messages: old.messages.map(msg =>
                    msg.id === tempAssistantId
                      ? {
                          ...msg,
                          response: streamingContent
                        }
                      : msg
                  )
                }
              })

              // Also update infinite query cache
              queryClient.setQueryData<InfiniteMessagesData>(messagesKeys.list(spaceId, 'infinite'), (old) => {
                if (!old) return old

                return {
                  ...old,
                  pages: old.pages.map((page, index) => {
                    if (index === 0) {
                      return {
                        ...page,
                        messages: page.messages.map((msg) =>
                          msg.id === tempAssistantId
                            ? {
                                ...msg,
                                response: streamingContent
                              }
                            : msg
                        )
                      }
                    }
                    return page
                  })
                }
              })
            }

            // Don't treat abort as an error - just resolve
            resolve()
          } else {
            reject(error)
          }
        })
      })
    },

    // Optimistic update - only add user message (backend creates the real one)
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey: messagesKeys.list(spaceId) })
      await queryClient.cancelQueries({ queryKey: messagesKeys.list(spaceId, 'infinite') })

      const previousMessages = queryClient.getQueryData<GetMessagesResponse>(messagesKeys.list(spaceId))

      // Create optimistic user message (will be replaced by real one from backend)
      const optimisticUserMessage: MessageResponse = {
        id: `temp-user-${Date.now()}`,
        space_id: spaceId,
        user_id: 'current-user',
        content: newMessage.content,
        created_at: new Date().toISOString(),
      }

      // DON'T create assistant message yet - backend will tell us when to create it

      // Add only user message to cache
      queryClient.setQueryData<GetMessagesResponse>(messagesKeys.list(spaceId), (old) => {
        if (!old) return {
          messages: [optimisticUserMessage],
          pagination: { limit: 50, offset: 0, total_count: 1 }
        }

        return {
          ...old,
          messages: [...old.messages, optimisticUserMessage],
          pagination: {
            ...old.pagination,
            total_count: old.pagination.total_count + 1
          }
        }
      })

      // Also add to infinite query cache (first page only)
      queryClient.setQueryData<InfiniteMessagesData>(messagesKeys.list(spaceId, 'infinite'), (old) => {
        if (!old) return {
          pages: [{
            messages: [optimisticUserMessage],
            pagination: { limit: 10, offset: 0, total_count: 1 }
          }],
          pageParams: [0]
        }

        return {
          ...old,
          pages: old.pages.map((page, index) => {
            // Add to first page (newest messages)
            if (index === 0) {
              return {
                ...page,
                messages: [...page.messages, optimisticUserMessage],
                pagination: {
                  ...page.pagination,
                  total_count: page.pagination.total_count + 1
                }
              }
            }
            return page
          })
        }
      })

      return { previousMessages, optimisticUserMessage, streamingAssistantMessage: null }
    },

    // On success, the streaming has completed successfully
    onSuccess: () => {
    },

    // If mutation fails, roll back
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKeys.list(spaceId), context.previousMessages)
      }

      toast.error('Failed to send message. Please try again.')
    },

    onSettled: (data, error) => {
      // Clear abort controller when done
      abortControllerRef.current = null

      if (error) {
        queryClient.invalidateQueries({ queryKey: messagesKeys.list(spaceId) })
        queryClient.invalidateQueries({ queryKey: messagesKeys.list(spaceId, 'infinite') })
      }
    },
  })

  // Add stop streaming function
  const stopStreaming = () => {
    let stopped = false

    // Try both abort methods for reliability
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
        stopped = true
      } catch (error) {
      }
    }

    // Also use React Query's built-in reset method as backup
    if (mutation.isPending) {
      try {
        mutation.reset()
        stopped = true
      } catch (error) {
      }
    }
  }

  return {
    ...mutation,
    stopStreaming
  }
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