'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { DocumentUpload } from '@/components/shared/document-upload'
import { Header } from '@/components/shared/header'
import { SplitPaneView } from '@/components/layout/split-pane-view'
import { MiniAIChat } from '@/components/chat/mini-ai-chat'
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
import toast from 'react-hot-toast'

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

  const handleAddToContext = useCallback((documentIds: string[]) => {
    setSpaceContext(spaceId, documentIds)
  }, [spaceId, setSpaceContext])

  const bulkActionsHook = useBulkActions({
    filteredDocuments: filteringHook.filteredDocuments,
    documents,
    onAddToContext: handleAddToContext,
  })

  // Handlers for document operations
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
    const newTab = {
      id: chatId,
      title: 'AI Chat',
      type: 'ai-chat' as const,
      isActive: true,
      closable: true,
    }

    if (pane === 'left') {
      tabHook.setTabs([...tabHook.tabs.map(t => ({ ...t, isActive: false })), newTab])
    } else {
      tabHook.setRightTabs([...tabHook.rightTabs.map(t => ({ ...t, isActive: false })), newTab])
    }
  }, [tabHook])

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
      onOpenInRightPaneById={handleOpenInRightPaneById}
      onAddToContext={handleAddToContextSingle}
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
        >
          {renderLeftContent()}
        </SplitPaneView>
        {tabHook.rightTabs.length === 0 && !tabHook.tabs.some(t => t.type === 'ai-chat') && (
          <MiniAIChat
            onSend={handleMiniChatSend}
            onOpenChat={() => tabHook.handleOpenChat()}
            onOpenInPane={handleOpenChatInPane}
            documents={documents}
            selectedDocumentIds={getSpaceContext(spaceId)}
            onDocumentContextChange={(documentIds) => setSpaceContext(spaceId, documentIds)}
            spaceName={spaceName}
            spaceId={spaceId}
          />
        )}
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
