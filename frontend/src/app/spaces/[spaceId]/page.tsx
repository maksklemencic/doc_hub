'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { DocumentUpload } from '@/components/shared/document-upload'
import { Header } from '@/components/shared/header'
import { SplitPaneView } from '@/components/layout/split-pane-view'
import { MiniAIChat } from '@/components/chat/mini-ai-chat'
import { BottomChatBar } from '@/components/chat/bottom-chat-bar'
import { DeleteConfirmationDialog } from '@/components/documents/delete-confirmation-dialog'
import { DocumentsPane } from '@/components/spaces/DocumentsPane'
import { TabContentRenderer } from '@/components/spaces/TabContentRenderer'
import { useSpaceDocuments } from '@/hooks/documents/use-documents'
import { useSpacesContext } from '@/contexts/spaces-context'
import { useDocumentFiltering } from '@/hooks/spaces/use-document-filtering'
import { useLayoutPersistence } from '@/hooks/spaces/use-layout-persistence'
import { useZoomPersistence } from '@/hooks/spaces/use-zoom-persistence'
import { useBulkActions } from '@/hooks/spaces/use-bulk-actions'
import { useTabManagement } from '@/hooks/spaces/use-tab-management'
import { useDocumentOperations } from '@/hooks/spaces/use-document-operations'
import { useChatLayout } from '@/hooks/chat/use-chat-layout'
import { useChatLayoutContext } from '@/contexts/chat-layout-context'

export default function SpacePage() {
  const params = useParams()
  const { getSpaceById, getSpaceContext, setSpaceContext } = useSpacesContext()
  const spaceId = params.spaceId as string
  const space = getSpaceById(spaceId)
  const spaceName = space?.name || 'Space'

  // Fetch documents for this space
  const { data: documentsData, isLoading, error } = useSpaceDocuments(spaceId)
  const documents = documentsData?.documents || []

  // UI state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [chatState, setChatState] = useState<'visible' | 'hidden' | 'fullscreen'>('visible')

  // Custom hooks for state management
  const filteringHook = useDocumentFiltering({ documents })
  const layoutHook = useLayoutPersistence({ spaceId })
  const zoomHook = useZoomPersistence({ spaceId })
  const tabHook = useTabManagement({ spaceId, documents })
  const chatLayout = useChatLayout({ spaceId })
  const chatLayoutContext = useChatLayoutContext()

  const handleAddToContext = useCallback((documentIds: string[]) => {
    setSpaceContext(spaceId, documentIds)
  }, [spaceId, setSpaceContext])

  const bulkActionsHook = useBulkActions({
    filteredDocuments: filteringHook.filteredDocuments,
    documents,
    onAddToContext: handleAddToContext,
  })

  // Document operations hook
  const operationsHook = useDocumentOperations({
    spaceId,
    documents,
    tabHook,
    setSpaceContext,
  })

  // Render documents pane content
  const documentsContent = (
    <DocumentsPane
      documents={documents}
      filteredDocuments={filteringHook.filteredDocuments}
      isLoading={isLoading}
      error={error}
      viewMode={layoutHook.viewMode}
      searchTerm={filteringHook.searchTerm}
      onSearchChange={filteringHook.setSearchTerm}
      sortBy={filteringHook.sortBy}
      sortOrder={filteringHook.sortOrder}
      onSortChange={filteringHook.handleSort}
      selectedTypes={filteringHook.selectedTypes}
      onTypeFilterChange={filteringHook.handleTypeFilter}
      onClearFilters={filteringHook.clearAllFilters}
      selectedDocuments={bulkActionsHook.selectedDocuments}
      onDeselectAll={bulkActionsHook.handleDeselectAll}
      onDocumentClick={tabHook.handleDocumentClick}
      onSelectDocument={bulkActionsHook.handleSelectDocument}
      onSelectAll={bulkActionsHook.handleSelectAll}
      onDeleteDocument={bulkActionsHook.handleDeleteDocument}
      onDeleteSelected={bulkActionsHook.handleBulkDelete}
      onBulkOpen={() => tabHook.handleBulkOpen(bulkActionsHook.selectedDocuments)}
      onBulkOpenInRightPane={() => tabHook.handleBulkOpenInRightPane(bulkActionsHook.selectedDocuments)}
      onBulkAddToContext={bulkActionsHook.handleBulkAddToContext}
      onBulkDownload={bulkActionsHook.handleBulkDownload}
      onOpenInRightPane={tabHook.handleOpenInRightPane}
      onOpenInRightPaneById={operationsHook.handleOpenInRightPaneById}
      onAddToContext={operationsHook.handleAddToContextSingle}
      gridColumns={layoutHook.gridColumns}
    />
  )

  // Render left pane content
  const renderLeftContent = () => {
    const activeTab = tabHook.tabs.find(t => t.isActive)
    return (
      <TabContentRenderer
        activeTab={activeTab}
        documents={documents}
        spaceId={spaceId}
        spaceName={spaceName}
        chatState={chatState}
        onChatStateChange={setChatState}
        pane="left"
        getZoomState={zoomHook.getZoomState}
        onZoomStateChange={zoomHook.handleZoomStateChange}
        documentsContent={documentsContent}
      />
    )
  }

  // Render right pane content
  const renderRightContent = () => {
    const activeTab = tabHook.rightTabs.find(t => t.isActive)
    if (!activeTab) return null

    return (
      <TabContentRenderer
        activeTab={activeTab}
        documents={documents}
        spaceId={spaceId}
        spaceName={spaceName}
        chatState={chatState}
        onChatStateChange={setChatState}
        pane="right"
        getZoomState={zoomHook.getZoomState}
        onZoomStateChange={zoomHook.handleZoomStateChange}
      />
    )
  }

  // Determine where to render bottom chat (only if not in tabs)
  const chatInLeftTab = tabHook.tabs.some(t => t.type === 'ai-chat')
  const chatInRightTab = tabHook.rightTabs.some(t => t.type === 'ai-chat')
  const chatInAnyTab = chatInLeftTab || chatInRightTab
  const hasRightPane = tabHook.rightTabs.length > 0

  // Handler for moving chat to a tab
  const handleMoveToTab = useCallback((pane: 'left' | 'right') => {
    // This will be called before the position state changes
    // We need to open the chat tab in the specified pane
    if (pane === 'left') {
      tabHook.handleOpenChatInLeftPane()
    } else {
      operationsHook.handleOpenChatInPane('right')
    }
  }, [tabHook, operationsHook])

  // Watch for chat tab closure and reset to bottom-full
  useEffect(() => {
    // If chat is in tab mode position state but not actually in any tab, reset to bottom-full
    if (!chatInAnyTab && (chatLayout.isTabLeft || chatLayout.isTabRight)) {
      chatLayout.moveToBottomFull()
    }
  }, [chatInAnyTab, chatLayout])

  // Watch for right pane closure and reset chat if it was in bottom-right
  useEffect(() => {
    // If chat is in bottom-right but right pane no longer exists, move to bottom-full
    if (!hasRightPane && chatLayout.isBottomRight) {
      chatLayout.moveToBottomFull()
    }
  }, [hasRightPane, chatLayout])

  // Handler for moving chat from tab to bottom (from context menu)
  const handleMoveChatToBottom = useCallback((position: 'bottom-full' | 'bottom-left' | 'bottom-right') => {
    // First close any open chat tabs
    const leftChatTab = tabHook.tabs.find(t => t.type === 'ai-chat')
    const rightChatTab = tabHook.rightTabs.find(t => t.type === 'ai-chat')

    if (leftChatTab) {
      tabHook.handleTabClose(leftChatTab.id, 'left')
    }
    if (rightChatTab) {
      tabHook.handleTabClose(rightChatTab.id, 'right')
    }

    // Then move to the requested position
    if (position === 'bottom-full') {
      chatLayout.moveToBottomFull()
    } else if (position === 'bottom-left') {
      chatLayout.moveToBottomLeft()
    } else if (position === 'bottom-right') {
      chatLayout.moveToBottomRight()
    }
  }, [tabHook, chatLayout])

  // Handler for chat drag and drop
  const handleChatDragEnd = useCallback((position: 'bottom-full' | 'bottom-left' | 'bottom-right' | 'tab-left' | 'tab-right') => {
    // Get current chat position to prevent redundant drops
    const currentLayout = chatLayoutContext.getChatLayout(spaceId)
    const currentPosition = currentLayout.position

    // Prevent dropping in the same position
    if (currentPosition === position) {
      return
    }

    // If moving to tab mode, need to handle tab creation
    if (position === 'tab-left' || position === 'tab-right') {
      const pane = position === 'tab-left' ? 'left' : 'right'

      // Check if chat already exists in target pane
      const existingChatTab = pane === 'left'
        ? tabHook.tabs.find(t => t.type === 'ai-chat')
        : tabHook.rightTabs.find(t => t.type === 'ai-chat')

      console.log('Existing chat tab check:', {
        targetPane: pane,
        existingChatTab: existingChatTab?.id,
        leftChatTabCount: tabHook.tabs.filter(t => t.type === 'ai-chat').length,
        rightChatTabCount: tabHook.rightTabs.filter(t => t.type === 'ai-chat').length
      })

      if (existingChatTab) {
        // Chat already exists in this pane, just update position
        chatLayoutContext.handleChatDragEnd(spaceId, position)
        return
      }

      // First close any existing chat tabs in other panes
      const leftChatTab = tabHook.tabs.find(t => t.type === 'ai-chat')
      const rightChatTab = tabHook.rightTabs.find(t => t.type === 'ai-chat')

      console.log('Closing existing chat tabs:', {
        leftChatTab: leftChatTab?.id,
        rightChatTab: rightChatTab?.id
      })

      if (leftChatTab) {
        tabHook.handleTabClose(leftChatTab.id, 'left')
      }
      if (rightChatTab) {
        tabHook.handleTabClose(rightChatTab.id, 'right')
      }

      // Open chat tab in the requested pane
      if (pane === 'left') {
        console.log('Opening chat in left pane')
        tabHook.handleOpenChatInLeftPane()
      } else {
        console.log('Opening chat in right pane')
        operationsHook.handleOpenChatInPane('right')
      }
    }

    // Use the chat layout context to handle the position change
    chatLayoutContext.handleChatDragEnd(spaceId, position)
  }, [chatLayoutContext, spaceId, tabHook, operationsHook, chatLayout])

  // Always render chat - either in tabs or in bottom
  const renderBottomChat = () => {
    // If chat is in a tab, don't render bottom chat
    if (chatInAnyTab) return { full: undefined, left: undefined, right: undefined }

    const chatComponent = (
      <BottomChatBar
        spaceId={spaceId}
        spaceName={spaceName}
        documents={documents}
        selectedDocumentIds={getSpaceContext(spaceId)}
        onDocumentContextChange={(documentIds) => setSpaceContext(spaceId, documentIds)}
        hasRightPane={hasRightPane}
        onMoveToTab={handleMoveToTab}
      />
    )

    // Return chat for the appropriate position based on layout state
    if (chatLayout.isBottomFull) return { full: chatComponent, left: undefined, right: undefined }
    if (chatLayout.isBottomLeft) return { full: undefined, left: chatComponent, right: undefined }
    if (chatLayout.isBottomRight) return { full: undefined, left: undefined, right: chatComponent }

    // Default to full if position is undefined or hidden
    return { full: chatComponent, left: undefined, right: undefined }
  }

  const bottomChat = renderBottomChat()

  return (
    <>
      <div className="flex flex-col h-full">
        <Header
          spaceName={spaceName}
          viewMode={layoutHook.viewMode}
          onViewModeChange={layoutHook.setViewMode}
          onUploadClick={() => setIsUploadOpen(true)}
        />
        <SplitPaneView
          key={spaceId}
          spaceId={spaceId}
          leftTabs={tabHook.tabs}
          rightTabs={tabHook.rightTabs.length > 0 ? tabHook.rightTabs : undefined}
          onTabClick={tabHook.handleTabClick}
          onTabClose={tabHook.handleTabClose}
          onSplitRight={tabHook.handleSplitRight}
          onMoveToLeft={tabHook.handleMoveToLeft}
          onTabReorderLeft={tabHook.handleTabReorder('left')}
          onTabReorderRight={tabHook.handleTabReorder('right')}
          onTabDragBetweenPanes={tabHook.handleTabDragBetweenPanes}
          onPanelResize={() => {}}
          onLeftPaneWidthChange={layoutHook.handlePaneWidthChange}
          rightContent={tabHook.rightTabs.length > 0 ? renderRightContent() : undefined}
          bottomChatFull={bottomChat.full}
          bottomChatLeft={bottomChat.left}
          bottomChatRight={bottomChat.right}
          onMoveChatToBottom={handleMoveChatToBottom}
          onChatDragEnd={handleChatDragEnd}
        >
          {renderLeftContent()}
        </SplitPaneView>
      </div>
      <DocumentUpload open={isUploadOpen} onOpenChange={setIsUploadOpen} spaceId={spaceId} />

      <DeleteConfirmationDialog
        open={bulkActionsHook.deleteDialogOpen}
        onOpenChange={bulkActionsHook.setDeleteDialogOpen}
        documentName={
          bulkActionsHook.documentToDelete
            ? documents.find(d => d.id === bulkActionsHook.documentToDelete)?.filename
            : undefined
        }
        selectedCount={!bulkActionsHook.documentToDelete ? bulkActionsHook.selectedDocuments.size : undefined}
        isDeleting={bulkActionsHook.isDeleting}
        onConfirm={bulkActionsHook.handleConfirmDelete}
        onCancel={bulkActionsHook.handleCancelDelete}
      />
    </>
  )
}
