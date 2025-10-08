'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { QueryBar } from './query-bar'
import { cn } from '@/lib/utils'

interface MiniAIChatProps {
  contextText?: string
  onSend: (message: string) => void
  onOpenChat: () => void
  onOpenInPane?: (pane: 'left' | 'right') => void
  isMinimized?: boolean
  onExpand?: () => void
  documents?: Array<{ id: string; filename: string }>
  selectedDocumentIds?: string[]
  onDocumentContextChange?: (documentIds: string[]) => void
  spaceName?: string
  spaceId?: string
}

export function MiniAIChat({
  contextText,
  onSend,
  onOpenChat,
  onOpenInPane,
  isMinimized = false,
  onExpand,
  documents = [],
  selectedDocumentIds = [],
  onDocumentContextChange,
  spaceName = 'Space',
  spaceId,
}: MiniAIChatProps) {
  const [message, setMessage] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false)

  const handleSend = () => {
    if (message.trim()) {
      onSend(message)
      setMessage('')
      setIsManuallyExpanded(false)
    }
  }

  const handleOpenChat = () => {
    onOpenChat()
    setIsManuallyExpanded(false)
  }

  const handleExpand = () => {
    if (onExpand) {
      onExpand()
    } else {
      setIsManuallyExpanded(true)
    }
  }

  const showExpanded = isHovered || !isMinimized || isManuallyExpanded

  const chatContent = (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 transition-all duration-200',
        showExpanded ? 'w-[450px] cursor-default' : 'w-12 h-12 cursor-pointer'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => !isManuallyExpanded && setIsHovered(false)}
      onClick={() => !showExpanded && handleExpand()}
    >
      {showExpanded ? (
        <QueryBar
          value={message}
          onChange={setMessage}
          onSend={handleSend}
          contextText={contextText}
          variant="mini"
          onOpenInPane={onOpenInPane}
          className="relative bg-white border border-border rounded-2xl shadow-xl hover:shadow-2xl transition-shadow"
          documents={documents}
          selectedDocumentIds={selectedDocumentIds}
          onDocumentContextChange={onDocumentContextChange}
          spaceName={spaceName}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-white border border-border rounded-2xl shadow-xl">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
        </div>
      )}
    </div>
  )

  return chatContent
}
