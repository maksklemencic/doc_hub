import { useEffect, useCallback, useMemo } from 'react'
import { DocumentResponse } from '@/lib/api'
import { getDocumentType } from '@/utils/document-utils'
import { Tab } from '@/components/shared/tab-bar'
import { SpaceStorage } from '@/utils/local-storage'
import { useTabState } from './use-tab-state'
import { tabLogger } from '@/utils/logger'

interface PersistentTabState {
  leftTabs: Omit<Tab, 'isActive'>[]
  rightTabs: Omit<Tab, 'isActive'>[]
  leftActiveId: string | null
  rightActiveId: string | null
}

interface UseTabManagementProps {
  spaceId: string
  documents: DocumentResponse[]
}

export function useTabManagement({ spaceId, documents }: UseTabManagementProps) {
  // Use the reusable tab state hooks for both panes
  const leftPane = useTabState({
    initialTabs: [
      {
        id: 'documents',
        title: 'Documents',
        type: 'documents',
        isActive: true,
        closable: false,
      },
    ],
  })

  const rightPane = useTabState()

  // Helper function to validate stored tabs against current documents
  const validateStoredTabs = useCallback((
    storedTabs: Omit<Tab, 'isActive'>[],
    currentDocuments: DocumentResponse[]
  ): Omit<Tab, 'isActive'>[] => {
    return storedTabs.filter(tab => {
      // Keep special tabs (documents, ai-chat)
      if (tab.id === 'documents' || tab.type === 'ai-chat') {
        return true
      }

      // For document tabs, verify document still exists
      const documentExists = currentDocuments.some(doc => doc.id === tab.id)
      if (!documentExists) {
        tabLogger.info('Removing stale tab due to document deletion', {
          action: 'removeStaleTab',
          tabId: tab.id,
          tabTitle: tab.title,
          tabType: tab.type,
          reason: 'document_deleted',
          spaceId
        })
      }

      return documentExists
    })
  }, [])

  // Helper function to restore tabs with active state
  const restoreTabsWithActiveState = useCallback((
    tabs: Omit<Tab, 'isActive'>[],
    activeId: string | null
  ): Tab[] => {
    return tabs.map(tab => ({
      ...tab,
      isActive: tab.id === activeId
    }))
  }, [])

  // Phase 1: Immediately restore tabs from localStorage on mount
  useEffect(() => {
    const storedTabs = SpaceStorage.get<PersistentTabState>(spaceId, 'tabs')
    if (storedTabs) {
      const tabsWithActiveState = restoreTabsWithActiveState(
        storedTabs.leftTabs,
        storedTabs.leftActiveId || 'documents'
      )

      leftPane.replaceTabs([
        {
          id: 'documents',
          title: 'Documents',
          type: 'documents',
          isActive: storedTabs.leftActiveId === 'documents',
          closable: false
        },
        ...tabsWithActiveState
      ])
      rightPane.replaceTabs(restoreTabsWithActiveState(storedTabs.rightTabs, storedTabs.rightActiveId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId])

  // Phase 2: Validate and clean up stale tabs after documents load
  useEffect(() => {
    if (documents.length === 0) return

    const storedTabs = SpaceStorage.get<PersistentTabState>(spaceId, 'tabs')
    if (storedTabs) {
      const validLeftTabs = validateStoredTabs(storedTabs.leftTabs, documents)
      const validRightTabs = validateStoredTabs(storedTabs.rightTabs, documents)

      // Only update if validation removed stale tabs
      const currentLeftDocTabs = leftPane.tabs.filter(t => t.id !== 'documents')
      const currentRightDocTabs = rightPane.tabs

      if (currentLeftDocTabs.length !== validLeftTabs.length) {
        const tabsWithActiveState = restoreTabsWithActiveState(
          validLeftTabs,
          storedTabs.leftActiveId || 'documents'
        )

        leftPane.replaceTabs([
          {
            id: 'documents',
            title: 'Documents',
            type: 'documents',
            isActive: storedTabs.leftActiveId === 'documents',
            closable: false
          },
          ...tabsWithActiveState
        ])
      }

      if (currentRightDocTabs.length !== validRightTabs.length) {
        rightPane.replaceTabs(restoreTabsWithActiveState(validRightTabs, storedTabs.rightActiveId))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, documents.length])

  // Debounced save for tab state
  const debouncedSaveTabs = useMemo(() => {
    let timeoutId: NodeJS.Timeout
    return () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        const leftActiveId = leftPane.tabs.find(t => t.isActive)?.id || null
        const rightActiveId = rightPane.tabs.find(t => t.isActive)?.id || null

        const persistentState: PersistentTabState = {
          leftTabs: leftPane.tabs
            .filter(t => t.id !== 'documents')
            .map(t => ({ id: t.id, title: t.title, type: t.type, closable: t.closable })),
          rightTabs: rightPane.tabs.map(t => ({ id: t.id, title: t.title, type: t.type, closable: t.closable })),
          leftActiveId,
          rightActiveId
        }

        SpaceStorage.set(spaceId, 'tabs', persistentState)
      }, 500)
    }
  }, [spaceId, leftPane.tabs, rightPane.tabs])

  // Save tab changes to localStorage
  useEffect(() => {
    debouncedSaveTabs()
  }, [leftPane.tabs, rightPane.tabs, debouncedSaveTabs])

  // Handle document deletion cleanup
  useEffect(() => {
    const documentIds = new Set(documents.map(d => d.id))

    const cleanedLeftTabs = leftPane.tabs.filter(tab => {
      if (tab.id === 'documents' || tab.type === 'ai-chat') return true
      return documentIds.has(tab.id)
    })

    const cleanedRightTabs = rightPane.tabs.filter(tab => {
      if (tab.type === 'ai-chat') return true
      return documentIds.has(tab.id)
    })

    if (cleanedLeftTabs.length !== leftPane.tabs.length) {
      leftPane.replaceTabs(cleanedLeftTabs)
    }
    if (cleanedRightTabs.length !== rightPane.tabs.length) {
      rightPane.replaceTabs(cleanedRightTabs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents])

  const handleTabClick = useCallback((tabId: string, pane: 'left' | 'right') => {
    if (pane === 'left') {
      leftPane.activateTab(tabId)
    } else {
      rightPane.activateTab(tabId)
    }
  }, [leftPane, rightPane])

  const handleTabClose = useCallback((tabId: string, pane: 'left' | 'right') => {
    if (pane === 'left') {
      leftPane.closeTab(tabId)
    } else {
      rightPane.closeTab(tabId)
    }
  }, [leftPane, rightPane])

  const handleDocumentClick = useCallback((documentId: string) => {
    const document = documents.find(d => d.id === documentId)
    if (!document) return

    // Close document in right pane if open
    rightPane.removeTab(documentId)

    // Open/activate in left pane
    const docType = getDocumentType(document.mime_type)
    leftPane.upsertTab({
      id: documentId,
      title: document.filename,
      type: docType as any,
      isActive: true,
      closable: true,
    })
  }, [documents, leftPane, rightPane])

  const handleSplitRight = useCallback((tabId: string) => {
    const tab = leftPane.tabs.find(t => t.id === tabId)
    if (!tab) return

    // Remove from left pane
    leftPane.removeTab(tabId)

    // Add to right pane and activate
    rightPane.addTab({ ...tab, isActive: true })
  }, [leftPane, rightPane])

  const handleMoveToLeft = useCallback((tabId: string) => {
    const tab = rightPane.tabs.find(t => t.id === tabId)
    if (!tab) return

    // Close tab in right pane (this handles activating the last remaining tab)
    rightPane.closeTab(tabId)

    // Add to left pane and activate
    leftPane.addTab({ ...tab, isActive: true })
  }, [leftPane, rightPane])

  const handleTabReorder = useCallback((pane: 'left' | 'right') => (tabId: string, newIndex: number) => {
    if (pane === 'left') {
      leftPane.reorderTab(tabId, newIndex)
    } else {
      rightPane.reorderTab(tabId, newIndex)
    }
  }, [leftPane, rightPane])

  const handleTabDragBetweenPanes = useCallback((
    tabId: string,
    fromPane: 'left' | 'right',
    toPane: 'left' | 'right'
  ) => {
    if (fromPane === toPane) return

    if (fromPane === 'left' && toPane === 'right') {
      const tab = leftPane.tabs.find(t => t.id === tabId)
      if (!tab || tab.id === 'documents') return

      // Close in left pane (handles activation of last remaining tab)
      leftPane.closeTab(tabId)

      // Add to right pane
      rightPane.addTab({ ...tab, isActive: true })
    } else {
      const tab = rightPane.tabs.find(t => t.id === tabId)
      if (!tab) return

      // Close in right pane
      rightPane.closeTab(tabId)

      // Add to left pane
      leftPane.addTab({ ...tab, isActive: true })
    }
  }, [leftPane, rightPane])

  const handleOpenInRightPane = useCallback((document: DocumentResponse) => {
    // Close document in left pane if open
    leftPane.removeTab(document.id)

    // Open in right pane
    const docType = getDocumentType(document.mime_type)
    rightPane.upsertTab({
      id: document.id,
      title: document.filename,
      type: docType as any,
      isActive: true,
      closable: true,
    })
  }, [leftPane, rightPane])

  const handleOpenChat = useCallback((initialMessage?: string) => {
    const chatId = `ai-chat-${Date.now()}`

    if (rightPane.tabs.length === 0) {
      rightPane.addTab({
        id: chatId,
        title: 'AI Chat',
        type: 'ai-chat',
        isActive: true,
        closable: true,
        initialMessage: initialMessage,
      })
    } else {
      const existingChat = rightPane.tabs.find(t => t.type === 'ai-chat')
      if (existingChat) {
        // Update existing chat with new initial message and activate it
        rightPane.updateTab(existingChat.id, { initialMessage: initialMessage })
        rightPane.activateTab(existingChat.id)
      } else {
        rightPane.addTab({
          id: chatId,
          title: 'AI Chat',
          type: 'ai-chat',
          isActive: true,
          closable: true,
          initialMessage: initialMessage,
        })
      }
    }
  }, [rightPane])

  const handleOpenChatInLeftPane = useCallback((initialMessage?: string) => {
    const chatId = `ai-chat-${Date.now()}`
    const existingChat = leftPane.tabs.find(t => t.type === 'ai-chat')

    if (existingChat) {
      // Update existing chat with new initial message and activate it
      leftPane.updateTab(existingChat.id, { initialMessage: initialMessage })
      leftPane.activateTab(existingChat.id)
    } else {
      leftPane.addTab({
        id: chatId,
        title: 'AI Chat',
        type: 'ai-chat',
        isActive: true,
        closable: true,
        initialMessage: initialMessage,
      })
    }
  }, [leftPane])

  const handleBulkOpen = useCallback((selectedDocuments: Set<string>) => {
    const selectedIds = Array.from(selectedDocuments)

    selectedIds.forEach(docId => {
      const document = documents.find(d => d.id === docId)
      if (!document) return

      const docType = getDocumentType(document.mime_type)
      leftPane.upsertTab({
        id: docId,
        title: document.filename,
        type: docType as any,
        isActive: true,
        closable: true,
      })
    })
  }, [documents, leftPane])

  const handleBulkOpenInRightPane = useCallback((selectedDocuments: Set<string>) => {
    const selectedIds = Array.from(selectedDocuments)
    selectedIds.forEach((docId, index) => {
      setTimeout(() => {
        const doc = documents.find(d => d.id === docId)
        if (doc) handleOpenInRightPane(doc)
      }, index * 50)
    })
  }, [documents, handleOpenInRightPane])

  return {
    tabs: leftPane.tabs,
    rightTabs: rightPane.tabs,
    setTabs: leftPane.setTabs,
    setRightTabs: rightPane.setTabs,
    handleTabClick,
    handleTabClose,
    handleDocumentClick,
    handleSplitRight,
    handleMoveToLeft,
    handleTabReorder,
    handleTabDragBetweenPanes,
    handleOpenInRightPane,
    handleOpenChat,
    handleOpenChatInLeftPane,
    handleBulkOpen,
    handleBulkOpenInRightPane,
  }
}
