'use client'

import { useEffect, useRef } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { ImperativePanelHandle } from 'react-resizable-panels'

type ChatState = 'visible' | 'hidden' | 'fullscreen'

interface SpaceLayoutProps {
  children: React.ReactNode
  chat: React.ReactNode | null
  chatState?: ChatState
  onChatStateChange?: (state: ChatState) => void
}

const DEFAULT_DOCUMENTS_SIZE = 65
const MIN_DOCUMENTS_SIZE = 40
const MAX_DOCUMENTS_SIZE = 80

export function SpaceLayout({ children, chat, chatState = 'visible', onChatStateChange }: SpaceLayoutProps) {
  const chatPanelRef = useRef<ImperativePanelHandle>(null)
  
  const handleResize = (sizes: number[]) => {
    if (!onChatStateChange) return
    
    const chatSize = sizes[1]
    // If chat is resized beyond maximum, go fullscreen
    if (chatSize > (100 - MIN_DOCUMENTS_SIZE) && chatState !== 'fullscreen') {
      onChatStateChange('fullscreen')
    }
  }

  // Handle fullscreen - no panels, just chat
  if (chatState === 'fullscreen') {
    return (
      <div className="h-full">
        {chat}
      </div>
    )
  }

  // Hidden state - show only documents
  if (chatState === 'hidden' || !chat) {
    return (
      <div className="h-full min-w-0 overflow-hidden">
        {children}
      </div>
    )
  }

  // Normal resizable layout
  return (
    <div className="h-full min-w-0">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full"
        onLayout={handleResize}
      >
        <ResizablePanel
          defaultSize={DEFAULT_DOCUMENTS_SIZE}
          minSize={MIN_DOCUMENTS_SIZE}
          maxSize={MAX_DOCUMENTS_SIZE}
          className="min-w-0 overflow-hidden"
        >
          {children}
        </ResizablePanel>
        
        {chat && <ResizableHandle withHandle />}
        
        {chat && (
          <ResizablePanel
            ref={chatPanelRef}
            defaultSize={100 - DEFAULT_DOCUMENTS_SIZE}
            minSize={100 - MAX_DOCUMENTS_SIZE}
            maxSize={100 - MIN_DOCUMENTS_SIZE}
            className="min-w-0 overflow-hidden"
          >
            {chat}
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </div>
  )
}