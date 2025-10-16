import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Check, Edit3, X as XIcon, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
  context?: string
}

interface ChatMessagesProps {
  messages: ChatMessage[]
  editingMessageId: string | null
  editValue: string
  copiedMessageId: string | null
  isLoadingMore: boolean
  isLoading: boolean
  onStartEdit: (messageId: string, currentContent: string) => void
  onCancelEdit: () => void
  onSaveEdit: (messageId: string, editValue: string) => Promise<void>
  onUpdateEditValue: (value: string) => void
  onCopyMessage: (messageId: string, content: string) => void
  onStopStreaming?: () => void
  formatTime: (timestamp: string) => string
}

export const ChatMessages = memo(function ChatMessages({
  messages,
  editingMessageId,
  editValue,
  copiedMessageId,
  isLoadingMore,
  isLoading,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onUpdateEditValue,
  onCopyMessage,
  onStopStreaming,
  formatTime
}: ChatMessagesProps) {
  return (
    <div className="p-4 flex justify-center">
      <div className="space-y-4 w-full" style={{ maxWidth: 'min(100%, 800px)' }}>
        {/* Loading indicator for older messages */}
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <Spinner size="sm" />
          </div>
        )}

        {messages.map((message: ChatMessage) => {
          if (message.role === 'user') {
            // User messages with edit functionality
            const isEditing = editingMessageId === message.id

            return (
              <div key={message.id} className="flex gap-3 max-w-full justify-end">
                <div className="rounded-lg px-3 py-2 max-w-[80%] bg-background border border-primary/20 ml-auto group relative">
                  {isEditing ? (
                    // Edit mode
                    <div className="space-y-3">
                      <textarea
                        value={editValue}
                        onChange={(e) => onUpdateEditValue(e.target.value)}
                        className="w-full text-sm resize-none border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-w-[300px]"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => onSaveEdit(message.id, editValue)}
                          disabled={!editValue.trim() || editValue === message.content}
                          className="h-7 px-3 text-xs"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Save & Re-generate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onCancelEdit}
                          className="h-7 px-3 text-xs"
                        >
                          <XIcon className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <>
                      {/* Edit button - positioned outside bubble, top right with outline */}
                      <button
                        onClick={() => onStartEdit(message.id, message.content)}
                        className="absolute -top-6 right-0 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 px-2 py-1 rounded group-hover:outline group-hover:outline-1 group-hover:outline-border"
                      >
                        Edit
                      </button>

                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {formatTime(message.timestamp)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )
          } else {
            // AI messages: clean full-width layout with padding
            return (
              <div key={message.id} className="w-full space-y-2 group">
                {/* AI Response */}
                <div className="w-full px-4">
                  <article className="prose prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:font-bold prose-strong:text-gray-900 prose-code:bg-gray-100 prose-code:text-gray-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-3 prose-pre:rounded prose-pre:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </article>
                </div>

                {/* Copy button - below content, left aligned */}
                <div className="w-full px-4">
                  <button
                    onClick={() => onCopyMessage(message.id, message.content)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-2 py-1 rounded hover:bg-gray-100 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    title="Copy message"
                  >
                    {copiedMessageId === message.id ? (
                      <>
                        <Check className="w-3 h-3 text-green-600" />
                        <span className="text-green-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Context Section */}
                {message.context && (
                  <div className="w-full">
                    <div className="mb-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Context Used
                      </h4>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-amber-700 hover:text-amber-800 font-medium">
                          Click to view context ({message.context.length} characters)
                        </summary>
                        <div className="mt-2 pt-2 border-t border-amber-200">
                          <pre className="text-xs text-amber-800 whitespace-pre-wrap font-mono bg-amber-100 p-2 rounded max-h-40 overflow-y-auto">
                            {message.context}
                          </pre>
                        </div>
                      </details>
                    </div>
                  </div>
                )}
              </div>
            )
          }
        })}

        {isLoading && (
          <div className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-sm text-muted-foreground">
                  {isLoading
                    ? "Streaming response..."
                    : "Analyzing your documents..."
                  }
                </span>
              </div>

              {onStopStreaming && isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStopStreaming}
                  className="h-8 px-3 text-xs"
                >
                  <XIcon className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
