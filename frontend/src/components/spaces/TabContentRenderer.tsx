'use client'

import { SpaceChat } from '@/components/chat/space-chat'
import { DocumentViewer } from '@/components/documents/document-viewer'
import { DocumentResponse } from '@/lib/api'
import { Tab } from '@/components/shared/tab-bar'

interface TabContentRendererProps {
  activeTab: Tab | undefined
  documents: DocumentResponse[]
  spaceId: string
  spaceName: string
  chatState: 'visible' | 'hidden' | 'fullscreen'
  onChatStateChange: (state: 'visible' | 'hidden' | 'fullscreen') => void
  pane: 'left' | 'right'
  getZoomState: (tabId: string) => { scale: number; isFitToWidth: boolean } | undefined
  onZoomStateChange: (tabId: string, state: { scale: number; isFitToWidth: boolean }) => void
  documentsContent?: React.ReactNode
}

export function TabContentRenderer({
  activeTab,
  documents,
  spaceId,
  spaceName,
  chatState,
  onChatStateChange,
  pane,
  getZoomState,
  onZoomStateChange,
  documentsContent,
}: TabContentRendererProps) {
  if (!activeTab) {
    return documentsContent || null
  }

  // Documents tab
  if (activeTab.id === 'documents') {
    return documentsContent || null
  }

  // AI chat tab
  if (activeTab.type === 'ai-chat') {
    return (
      <SpaceChat
        spaceId={spaceId}
        spaceName={spaceName}
        chatState={chatState}
        onChatStateChange={onChatStateChange}
        initialMessage={activeTab.initialMessage}
        hideHeader={true}
        documents={documents}
      />
    )
  }

  // Document preview tab
  const document = documents.find(d => d.id === activeTab.id)
  if (document) {
    const zoomKey = `${pane}:${activeTab.id}`
    return (
      <DocumentViewer
        key={zoomKey}
        documentId={document.id}
        filename={document.filename}
        mimeType={document.mime_type}
        zoomState={getZoomState(zoomKey)}
        onZoomStateChange={(state) => onZoomStateChange(zoomKey, state)}
      />
    )
  }

  return documentsContent || null
}
