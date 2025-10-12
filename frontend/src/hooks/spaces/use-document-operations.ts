import { useCallback } from 'react'
import { DocumentResponse } from '@/lib/api'
import { Tab } from '@/components/shared/tab-bar'
import toast from 'react-hot-toast'

interface UseDocumentOperationsProps {
  spaceId: string
  documents: DocumentResponse[]
  tabHook: any
  setSpaceContext: (spaceId: string, documentIds: string[]) => void
}

export function useDocumentOperations({
  spaceId,
  documents,
  tabHook,
  setSpaceContext
}: UseDocumentOperationsProps) {
  const handleAddToContextSingle = useCallback((documentId: string) => {
    setSpaceContext(spaceId, [documentId])
    const document = documents.find(d => d.id === documentId)
    if (document) {
      toast.success(`Set chat context to ${document.filename}`)
    }
  }, [spaceId, documents, setSpaceContext])

  const handleOpenInRightPaneById = useCallback((documentId: string) => {
    const document = documents.find(d => d.id === documentId)
    if (document) {
      tabHook.handleOpenInRightPane(document)
    }
  }, [documents, tabHook])

  const handleMiniChatSend = useCallback((message: string) => {
    tabHook.handleOpenChat(message)
  }, [tabHook])

  const handleOpenChatInPane = useCallback((pane: 'left' | 'right') => {
    const chatId = `ai-chat-${Date.now()}`
    const newTab: Tab = {
      id: chatId,
      title: 'AI Chat',
      type: 'ai-chat' as const,
      isActive: true,
      closable: true,
    }

    if (pane === 'left') {
      const updatedTabs = [...tabHook.tabs.map((t: Tab) => ({ ...t, isActive: false })), newTab]
      tabHook.setTabs(updatedTabs)
    } else {
      const updatedTabs = [...tabHook.rightTabs.map((t: Tab) => ({ ...t, isActive: false })), newTab]
      tabHook.setRightTabs(updatedTabs)
    }
  }, [tabHook])

  return {
    handleAddToContextSingle,
    handleOpenInRightPaneById,
    handleMiniChatSend,
    handleOpenChatInPane,
  }
}
