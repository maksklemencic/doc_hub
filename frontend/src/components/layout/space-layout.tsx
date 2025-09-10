'use client'

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'

interface SpaceLayoutProps {
  children: React.ReactNode
  chat: React.ReactNode
}

const DEFAULT_DOCUMENTS_SIZE = 65
const MIN_DOCUMENTS_SIZE = 40
const MAX_DOCUMENTS_SIZE = 80

export function SpaceLayout({ children, chat }: SpaceLayoutProps) {
  return (
    <div className="h-full">
      <ResizablePanelGroup 
        direction="horizontal" 
        className="h-full"
      >
        <ResizablePanel 
          defaultSize={DEFAULT_DOCUMENTS_SIZE}
          minSize={MIN_DOCUMENTS_SIZE}
          maxSize={MAX_DOCUMENTS_SIZE}
        >
          {children}
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel 
          defaultSize={100 - DEFAULT_DOCUMENTS_SIZE}
          minSize={100 - MAX_DOCUMENTS_SIZE}
          maxSize={100 - MIN_DOCUMENTS_SIZE}
        >
          {chat}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}