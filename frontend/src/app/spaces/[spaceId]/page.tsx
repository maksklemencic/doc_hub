'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'
import { FileText } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DocumentUpload } from '@/components/shared/document-upload'
import { Header } from '@/components/shared/header'
import { Tab } from '@/components/shared/tab-bar'
import { SplitPaneView } from '@/components/layout/split-pane-view'
import { MiniAIChat } from '@/components/chat/mini-ai-chat'
import { SpaceChat } from '@/components/chat/space-chat'
import { DocumentViewer } from '@/components/documents/document-viewer'
import { DocumentsToolbar, SortBy, SortOrder } from '@/components/documents/documents-toolbar'
import { DocumentsGrid } from '@/components/documents/documents-grid'
import { DocumentsTable } from '@/components/documents/documents-table'
import { DeleteConfirmationDialog } from '@/components/documents/delete-confirmation-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { useSpaceDocuments, useDeleteDocument, useDeleteDocumentSilent } from '@/hooks/use-documents'
import { DocumentResponse } from '@/lib/api'
import { useSpacesContext } from '@/contexts/spaces-context'
import { getDocumentType, DocumentType, getFileSize } from '@/utils/document-utils'
import { SpaceStorage } from '@/utils/localStorage'
import toast from 'react-hot-toast'

type ViewMode = 'list' | 'grid'

export default function SpacePage() {
  const params = useParams()
  const { getSpaceById, getSpaceContext, setSpaceContext } = useSpacesContext()
  const spaceId = params.spaceId as string
  const space = getSpaceById(spaceId)
  const spaceName = space?.name || 'Space'

  // Fetch documents for this space
  const { data: documentsData, isLoading, error } = useSpaceDocuments(spaceId)
  const deleteDocumentMutation = useDeleteDocument()
  const deleteDocumentSilentMutation = useDeleteDocumentSilent()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return SpaceStorage.get<ViewMode>(spaceId, 'viewMode') ?? 'grid'
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [chatState, setChatState] = useState<'visible' | 'hidden' | 'fullscreen'>('visible')
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<Set<DocumentType>>(new Set())
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc') // newest first by default
  const [gridColumns, setGridColumns] = useState(4)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const documentsPaneRef = useRef<HTMLDivElement>(null)

  // Tab persistence types
  interface PersistentTabState {
    leftTabs: Omit<Tab, 'isActive'>[]
    rightTabs: Omit<Tab, 'isActive'>[]
    leftActiveId: string | null
    rightActiveId: string | null
  }

  // Helper function to validate stored tabs against current documents
  const validateStoredTabs = useCallback((storedTabs: Omit<Tab, 'isActive'>[], currentDocuments: DocumentResponse[]): Omit<Tab, 'isActive'>[] => {
    return storedTabs.filter(tab => {
      // Keep special tabs (documents, ai-chat)
      if (tab.id === 'documents' || tab.type === 'ai-chat') {
        return true
      }

      // For document tabs, verify document still exists
      const documentExists = currentDocuments.some(doc => doc.id === tab.id)
      if (!documentExists) {
        console.info(`Removing stale tab: ${tab.title} (document deleted)`)
      }

      return documentExists
    }).map(tab => {
      // Update document tab titles if filename changed, but keep as documents (can't search IDs)
      if (tab.id !== 'documents' && tab.type !== 'ai-chat') {
        // We'll validate document existence above, so this is safe
        // const currentDoc = currentDocuments.find(doc => doc.id === tab.id)
        // if (currentDoc && currentDoc.filename !== tab.title) {
        //   return {...tab, title: currentDoc.filename}
        // }
      }
      return tab
    })
  }, [])

  // Helper function to restore tabs with active state
  const restoreTabsWithActiveState = useCallback((tabs: Omit<Tab, 'isActive'>[], activeId: string | null): Tab[] => {
    return tabs.map(tab => ({
      ...tab,
      isActive: tab.id === activeId
    }))
  }, [])

  // Get documents from API response
  const documents: DocumentResponse[] = documentsData?.documents || []

  // Tab management for new UI with persistence
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 'documents',
      title: 'Documents',
      type: 'documents',
      isActive: true,
      closable: false,
    },
  ])

  const [rightTabs, setRightTabs] = useState<Tab[]>([])

  // Restore tabs from localStorage after documents load
  useEffect(() => {
    if (documents.length === 0) return // Wait for documents to load

    const storedTabs = SpaceStorage.get<PersistentTabState>(spaceId, 'tabs')
    if (storedTabs) {
      // Validate tabs against current documents
      const validLeftTabs = validateStoredTabs(storedTabs.leftTabs, documents)
      const validRightTabs = validateStoredTabs(storedTabs.rightTabs, documents)

      // Restore tabs with proper active state
      const tabsWithActiveState = restoreTabsWithActiveState(validLeftTabs, storedTabs.leftActiveId || 'documents')

      setTabs([{ id: 'documents', title: 'Documents', type: 'documents', isActive: storedTabs.leftActiveId === 'documents', closable: false }, ...tabsWithActiveState])
      setRightTabs(restoreTabsWithActiveState(validRightTabs, storedTabs.rightActiveId))
    }
  }, [spaceId, documents, validateStoredTabs, restoreTabsWithActiveState])

  // Zoom state persistence per TAB ID (not document ID, so same doc in different tabs has separate zoom)
  const [tabZoomStates, setTabZoomStates] = useState<Record<string, { scale: number; isFitToWidth: boolean }>>({})

  // Apply filtering and sorting
  const filteredAndSortedDocuments = documents
    .filter(doc => {
      // Search filter
      const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase())

      // Type filter
      const docType = getDocumentType(doc.mime_type)
      const matchesType = selectedTypes.size === 0 || selectedTypes.has(docType)

      return matchesSearch && matchesType
    })
    .sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'name':
          comparison = a.filename.toLowerCase().localeCompare(b.filename.toLowerCase())
          break
        case 'size':
          const aSize = getFileSize(a, getDocumentType(a.mime_type))
          const bSize = getFileSize(b, getDocumentType(b.mime_type))
          comparison = aSize - bSize
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

  // For backward compatibility, keep filteredDocuments
  const filteredDocuments = filteredAndSortedDocuments

  // Clear selections when filtering changes, but keep selections for still-visible documents
  useEffect(() => {
    if (selectedDocuments.size > 0) {
      const visibleDocumentIds = new Set(filteredDocuments.map(doc => doc.id))
      const updatedSelections = new Set(
        Array.from(selectedDocuments).filter(id => visibleDocumentIds.has(id))
      )

      // Only update if selections actually changed
      if (updatedSelections.size !== selectedDocuments.size) {
        setSelectedDocuments(updatedSelections)
      }
    }
  }, [searchTerm, selectedTypes, sortBy, sortOrder]) // Re-run when any filter changes

  // Function to update grid columns based on container width
  const updateGridColumns = () => {
    // Observe the documents pane (parent) instead of the grid itself
    const containerToMeasure = documentsPaneRef.current || gridContainerRef.current

    if (containerToMeasure) {
      const width = containerToMeasure.offsetWidth

      // Calculate optimal columns based on actual container width
      // Account for padding: px-6 on the container = 24px each side = 48px total
      const padding = 48
      const availableWidth = width - padding

      // Card width: ~280px minimum with gaps
      const minCardWidth = 280
      const gap = 16 // gap-4 in tailwind = 16px

      // Calculate how many cards can fit
      let cols = Math.floor((availableWidth + gap) / (minCardWidth + gap))
      cols = Math.max(1, Math.min(4, cols)) // Between 1 and 4

      // Only update if different to avoid unnecessary re-renders
      if (cols !== gridColumns) {
        setGridColumns(cols)
      }
    }
  }

  // Update grid columns based on container width
  useEffect(() => {
    // Small delay to ensure container has rendered
    const timer = setTimeout(updateGridColumns, 100)

    const resizeObserver = new ResizeObserver(() => {
      updateGridColumns()
    })

    // Observe the documents pane (the container that actually resizes with split pane)
    const elementToObserve = documentsPaneRef.current || gridContainerRef.current
    if (elementToObserve) {
      resizeObserver.observe(elementToObserve)
    }

    return () => {
      clearTimeout(timer)
      resizeObserver.disconnect()
    }
  }, [])

  // Recalculate grid when split pane opens/closes
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null

    // Use requestAnimationFrame to ensure DOM has updated
    const rafId = requestAnimationFrame(() => {
      updateGridColumns()

      // Double-check after layout settles
      timerId = setTimeout(() => {
        updateGridColumns()
      }, 50)
    })

    return () => {
      cancelAnimationFrame(rafId)
      if (timerId) clearTimeout(timerId)
    }
  }, [rightTabs.length])

  const handleDeleteDocument = (documentId: string) => {
    setDocumentToDelete(documentId)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!documentToDelete && selectedDocuments.size === 0) return

    if (documentToDelete) {
      // Single document delete
      setIsDeleting(true)
      try {
        await deleteDocumentMutation.mutateAsync(documentToDelete)
      } catch (error) {
        console.error('Failed to delete document:', error)
        toast.error('Failed to delete document. Please try again.')
      } finally {
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        setDocumentToDelete(null)
      }
    } else {
      // Bulk delete - show dialog with confirmation
      setIsDeleting(true)
      const count = selectedDocuments.size
      const selectedIds = Array.from(selectedDocuments)

      try {
        await Promise.all(
          selectedIds.map(docId =>
            deleteDocumentSilentMutation.mutateAsync(docId)
          )
        )
        toast.success(`${count} document${count > 1 ? 's' : ''} deleted successfully`)
      } catch (error) {
        console.error('Failed to delete documents:', error)
        toast.error('Failed to delete documents. Please try again.')
      } finally {
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        setSelectedDocuments(new Set())
      }
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setDocumentToDelete(null)
  }

  // Handle bulk delete - open dialog first
  const handleBulkDelete = () => {
    setDeleteDialogOpen(true)
  }

  const handleSelectDocument = (documentId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(documentId)) {
        newSet.delete(documentId)
      } else {
        newSet.add(documentId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set())
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)))
    }
  }

  const handleDeselectAll = () => {
    setSelectedDocuments(new Set())
  }

  const handleTypeFilter = (type: DocumentType) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  const clearAllFilters = () => {
    setSelectedTypes(new Set())
    setSearchTerm('')
  }

  const handleTabClick = (tabId: string, pane: 'left' | 'right') => {
    if (pane === 'left') {
      const newTabs = tabs.map((tab) => ({ ...tab, isActive: tab.id === tabId }))
      setTabs(newTabs)
    } else {
      const newRightTabs = rightTabs.map((tab) => ({ ...tab, isActive: tab.id === tabId }))
      setRightTabs(newRightTabs)
    }
  }

  const handleTabClose = (tabId: string, pane: 'left' | 'right') => {
    if (pane === 'left') {
      const tab = tabs.find((t) => t.id === tabId)
      if (tab?.closable === false) return

      const newTabs = tabs.filter((tab) => tab.id !== tabId)
      if (newTabs.length > 0 && tabs.find((t) => t.id === tabId)?.isActive) {
        newTabs[newTabs.length - 1].isActive = true
      }
      setTabs(newTabs)
    } else {
      const newRightTabs = rightTabs.filter((tab) => tab.id !== tabId)
      if (newRightTabs.length > 0 && rightTabs.find((t) => t.id === tabId)?.isActive) {
        newRightTabs[newRightTabs.length - 1].isActive = true
      }
      setRightTabs(newRightTabs)
    }
  }

  const handleDocumentClick = (documentId: string) => {
    const document = documents.find((d) => d.id === documentId)
    if (!document) return

    // Close document in right pane if open
    const rightTab = rightTabs.find((t) => t.id === documentId)
    if (rightTab) {
      setRightTabs(rightTabs.filter((t) => t.id !== documentId))
    }

    const existingTab = tabs.find((t) => t.id === documentId)
    if (existingTab) {
      // Tab already exists, just activate it
      const newTabs = tabs.map((tab) => ({ ...tab, isActive: tab.id === documentId }))
      setTabs(newTabs)
    } else {
      // Create new tab
      const docType = getDocumentType(document.mime_type)
      const newTabs = [
        ...tabs.map((t) => ({ ...t, isActive: false })),
        {
          id: documentId,
          title: document.filename,
          type: docType as any,
          isActive: true,
          closable: true,
        },
      ]
      setTabs(newTabs)
    }
  }

  const handleSplitRight = (tabId: string) => {
    // Find the tab in left pane
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return

    // Move tab to right pane
    setTabs(tabs.filter((t) => t.id !== tabId))
    setRightTabs([
      ...rightTabs.map((t) => ({ ...t, isActive: false })),
      { ...tab, isActive: true },
    ])
  }

  const handleMoveToLeft = (tabId: string) => {
    // Find the tab in right pane
    const tab = rightTabs.find((t) => t.id === tabId)
    if (!tab) return

    // If this is the only tab, close the right pane
    const newRightTabs = rightTabs.filter((t) => t.id !== tabId)
    setRightTabs(newRightTabs.length > 0 ? newRightTabs.map((t, i) => ({ ...t, isActive: i === newRightTabs.length - 1 })) : [])

    // Move tab to left pane
    setTabs([
      ...tabs.map((t) => ({ ...t, isActive: false })),
      { ...tab, isActive: true },
    ])
  }

  const handleTabReorder = (pane: 'left' | 'right') => (tabId: string, newIndex: number) => {
    if (pane === 'left') {
      const currentIndex = tabs.findIndex((t) => t.id === tabId)
      if (currentIndex === -1) return

      const newTabs = [...tabs]
      const [removed] = newTabs.splice(currentIndex, 1)
      newTabs.splice(newIndex, 0, removed)
      setTabs(newTabs)
    } else {
      const currentIndex = rightTabs.findIndex((t) => t.id === tabId)
      if (currentIndex === -1) return

      const newTabs = [...rightTabs]
      const [removed] = newTabs.splice(currentIndex, 1)
      newTabs.splice(newIndex, 0, removed)
      setRightTabs(newTabs)
    }
  }

  const handleTabDragBetweenPanes = (tabId: string, fromPane: 'left' | 'right', toPane: 'left' | 'right') => {
    if (fromPane === toPane) return

    if (fromPane === 'left' && toPane === 'right') {
      // Moving from left to right
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab || tab.id === 'documents') return // Don't allow moving documents tab

      // Remove from left
      const newLeftTabs = tabs.filter((t) => t.id !== tabId)
      if (newLeftTabs.length > 0 && tab.isActive) {
        newLeftTabs[newLeftTabs.length - 1].isActive = true
      }
      setTabs(newLeftTabs)

      // Add to right
      setRightTabs([
        ...rightTabs.map((t) => ({ ...t, isActive: false })),
        { ...tab, isActive: true },
      ])
    } else {
      // Moving from right to left
      const tab = rightTabs.find((t) => t.id === tabId)
      if (!tab) return

      // Remove from right (and close right pane if it was the only tab)
      const newRightTabs = rightTabs.filter((t) => t.id !== tabId)
      if (newRightTabs.length > 0 && tab.isActive) {
        newRightTabs[newRightTabs.length - 1].isActive = true
      }
      setRightTabs(newRightTabs)

      // Add to left
      setTabs([
        ...tabs.map((t) => ({ ...t, isActive: false })),
        { ...tab, isActive: true },
      ])
    }
  }

  const handleOpenChat = (initialMessage?: string) => {
    // Open AI chat in right pane
    const chatId = `ai-chat-${Date.now()}`

    if (rightTabs.length === 0) {
      setRightTabs([
        {
          id: chatId,
          title: 'AI Chat',
          type: 'ai-chat',
          isActive: true,
          closable: true,
          initialMessage: initialMessage, // Pass the message to the chat if provided
        },
      ])
    } else {
      // Check if AI chat tab already exists
      const existingChat = rightTabs.find((t) => t.type === 'ai-chat')
      if (existingChat) {
        // Activate existing chat and optionally send message
        setRightTabs(rightTabs.map((tab) =>
          tab.id === existingChat.id
            ? { ...tab, isActive: true, initialMessage: initialMessage }
            : { ...tab, isActive: false }
        ))
      } else {
        // Add new chat tab
        setRightTabs([
          ...rightTabs.map((t) => ({ ...t, isActive: false })),
          {
            id: chatId,
            title: 'AI Chat',
            type: 'ai-chat',
            isActive: true,
            closable: true,
            initialMessage: initialMessage,
          },
        ])
      }
    }
  }

  const handleMiniChatSend = (message: string) => {
    handleOpenChat(message)
  }

  const handleSort = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new sort field with appropriate default order
      setSortBy(newSortBy)
      setSortOrder(newSortBy === 'date' ? 'desc' : 'asc') // Date defaults to newest first
    }
  }

  const handleOpenInRightPane = (document: DocumentResponse) => {
    // Close document in left pane if open
    const leftTab = tabs.find((t) => t.id === document.id)
    if (leftTab) {
      setTabs(tabs.filter((t) => t.id !== document.id))
    }

    // Open document in right pane
    const docType = getDocumentType(document.mime_type)
    const existingTab = rightTabs.find((t) => t.id === document.id)
    if (existingTab) {
      setRightTabs(rightTabs.map((tab) => ({ ...tab, isActive: tab.id === document.id })))
    } else {
      setRightTabs([
        ...rightTabs.map((t) => ({ ...t, isActive: false })),
        {
          id: document.id,
          title: document.filename,
          type: docType as any,
          isActive: true,
          closable: true,
        },
      ])
    }
  }

  const handleOpenInRightPaneById = (documentId: string) => {
    const document = documents.find(d => d.id === documentId)
    if (document) {
      handleOpenInRightPane(document)
    }
  }

  const handleAddToContext = (documentId: string) => {
    setSpaceContext(spaceId, [documentId])
    const document = documents.find(d => d.id === documentId)
    toast.success(`Set chat context to ${document?.filename || 'document'}`)
  }

  // Bulk open selected documents in tabs - open ALL selected documents that aren't already open
  const handleBulkOpen = () => {
    const selectedIds = Array.from(selectedDocuments)

    setTabs(currentTabs => {
      let updatedTabs = currentTabs

      selectedIds.forEach((docId) => {
        const document = documents.find((d) => d.id === docId)
        if (!document) return

        // Check if document already has a tab open in left pane
        const existingTabIndex = updatedTabs.findIndex((t) => t.id === docId)
        if (existingTabIndex !== -1) {
          // If already open, just activate it
          updatedTabs = updatedTabs.map((tab, index) =>
            index === existingTabIndex
              ? { ...tab, isActive: true }
              : { ...tab, isActive: false }
          )
        } else {
          // Create new tab
          const docType = getDocumentType(document.mime_type)
          updatedTabs = [
            ...updatedTabs.map((t) => ({ ...t, isActive: false })),
            {
              id: docId,
              title: document.filename,
              type: docType as any,
              isActive: true,
              closable: true,
            },
          ]
        }
      })

      return updatedTabs
    })
  }

  // Bulk open selected documents in right pane
  const handleBulkOpenInRightPane = () => {
    const selectedIds = Array.from(selectedDocuments)
    selectedIds.forEach((docId, index) => {
      setTimeout(() => {
        const doc = documents.find(d => d.id === docId)
        if (doc) handleOpenInRightPane(doc)
      }, index * 50)
    })
  }

  // Bulk add selected documents to chat context
  const handleBulkAddToContext = () => {
    const selectedIds = Array.from(selectedDocuments)
    setSpaceContext(spaceId, selectedIds)
    toast.success(`Added ${selectedIds.length} documents to chat context`)
  }

  // Bulk download selected documents - skip web-based ones
  const handleBulkDownload = async () => {
    const selectedIds = Array.from(selectedDocuments)

    // Filter out web-based documents (they have URLs instead of downloadable files)
    const downloadableDocuments = documents.filter(doc => {
      const docType = getDocumentType(doc.mime_type)
      return !(docType === DocumentType.youtube || docType === DocumentType.web) && selectedIds.includes(doc.id)
    })

    if (downloadableDocuments.length === 0) {
      toast.error('No downloadable documents selected. Web and YouTube documents cannot be downloaded.')
      return
    }

    let successCount = 0
    let failedCount = 0

    // Download documents sequentially to avoid overwhelming the browser
    for (const doc of downloadableDocuments) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const downloadUrl = `${baseUrl}/documents/view/${doc.id}`

        const response = await fetch(downloadUrl, {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        })

        if (!response.ok) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()
        const contentDisposition = response.headers.get('content-disposition')
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || doc.filename
          : doc.filename

        // Create blob URL and trigger download
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Clean up the blob URL after download
        URL.revokeObjectURL(blobUrl)

        successCount++

        // Small delay between downloads to prevent browser issues
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Failed to download ${doc.filename}:`, error)
        failedCount++
      }
    }

    // Show success/error message
    if (successCount === downloadableDocuments.length) {
      toast.success(`Downloaded ${successCount} document${successCount > 1 ? 's' : ''} successfully`)
    } else if (successCount > 0) {
      toast.error(`Downloaded ${successCount} document${successCount > 1 ? 's' : ''}, ${failedCount} failed`)
    } else {
      toast.error('Failed to download documents. Please try again.')
    }
  }

  const documentsContent = (
    <div ref={documentsPaneRef} className="h-full flex flex-col relative min-w-0 bg-background">
      <div className="h-full flex flex-col min-w-0">
        {documents.length > 0 && (
          <DocumentsToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSort}
            selectedTypes={selectedTypes}
            onTypeFilterChange={handleTypeFilter}
            onClearFilters={clearAllFilters}
            selectedDocumentsCount={selectedDocuments.size}
            onDeselectAll={handleDeselectAll}
          />
        )}

        {/* Scrollable Documents Display */}
        <div className="flex-1 overflow-hidden">
          {documents.length === 0 && !isLoading && !error ? (
            // Centered no documents message when no documents exist
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={FileText}
                title="No documents found"
                description="Get started by adding your first document"
              />
            </div>
          ) : (
            <ScrollArea className="h-full px-6 scrollbar-thin">
              <div className="pb-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner className="mr-2" />
                    <span className="text-muted-foreground">Loading documents...</span>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <EmptyState
                      icon={FileText}
                      title="Failed to load documents"
                      description="There was an error loading the documents for this space."
                    />
                  </div>
                ) : viewMode === 'list' ? (
                  <DocumentsTable
                    documents={filteredDocuments}
                    selectedDocuments={selectedDocuments}
                    onDocumentClick={handleDocumentClick}
                    onSelectDocument={handleSelectDocument}
                    onSelectAll={handleSelectAll}
                    onDeleteDocument={handleDeleteDocument}
                    onDeleteSelected={handleBulkDelete}
                    onBulkOpen={handleBulkOpen}
                    onBulkOpenInRightPane={handleBulkOpenInRightPane}
                    onBulkAddToContext={handleBulkAddToContext}
                    onBulkDownload={handleBulkDownload}
                    onOpenInRightPane={handleOpenInRightPaneById}
                    onAddToContext={handleAddToContext}
                  />
                ) : (
                  <DocumentsGrid
                    documents={filteredDocuments}
                    selectedDocuments={selectedDocuments}
                    gridColumns={gridColumns}
                    onDocumentClick={handleDocumentClick}
                    onSelectDocument={handleSelectDocument}
                    onDeleteDocument={handleDeleteDocument}
                    onDeleteSelected={handleBulkDelete}
                    onBulkOpen={handleBulkOpen}
                    onBulkOpenInRightPane={handleBulkOpenInRightPane}
                    onBulkAddToContext={handleBulkAddToContext}
                    onBulkDownload={handleBulkDownload}
                    onDeselectAll={handleDeselectAll}
                    onOpenInRightPane={handleOpenInRightPane}
                    onAddToContext={handleAddToContext}
                  />
                )}

                {filteredDocuments.length === 0 && !isLoading && !error && searchTerm && (
                  <div className="text-center py-12">
                    <EmptyState
                      icon={FileText}
                      title="No documents found"
                      description="Try adjusting your search terms"
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  )

  const chatContent = (
    <SpaceChat
      spaceId={spaceId}
      spaceName={spaceName}
      chatState={chatState}
      onChatStateChange={setChatState}
      documents={documents}
    />
  )

  // Create stable callback for zoom state changes
  const handleZoomStateChange = useCallback((tabId: string, state: { scale: number; isFitToWidth: boolean }) => {
    setTabZoomStates(prev => ({
      ...prev,
      [tabId]: state
    }))
  }, [])

  // Persist view mode changes
  useEffect(() => {
    SpaceStorage.set(spaceId, 'viewMode', viewMode)
  }, [spaceId, viewMode])

  // Debounced save for tab state
  const debouncedSaveTabs = useMemo(
    () => {
      let timeoutId: NodeJS.Timeout
      return () => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          const leftActiveId = tabs.find(t => t.isActive)?.id || null
          const rightActiveId = rightTabs.find(t => t.isActive)?.id || null

          const persistentState: PersistentTabState = {
            leftTabs: tabs
              .filter(t => t.id !== 'documents') // Don't persist the documents tab
              .map(t => ({ id: t.id, title: t.title, type: t.type, closable: t.closable })),
            rightTabs: rightTabs.map(t => ({ id: t.id, title: t.title, type: t.type, closable: t.closable })),
            leftActiveId,
            rightActiveId
          }

          SpaceStorage.set(spaceId, 'tabs', persistentState)
        }, 500)
      }
    },
    [spaceId, tabs, rightTabs]
  )

  // Save tab changes to localStorage
  useEffect(() => {
    debouncedSaveTabs()
  }, [tabs, rightTabs, debouncedSaveTabs])

  // Handle document deletion cleanup - remove from tabs and localStorage
  useEffect(() => {
    const documentIds = new Set(documents.map(d => d.id))

    // Clean up left tabs
    const cleanedLeftTabs = tabs.filter(tab => {
      if (tab.id === 'documents' || tab.type === 'ai-chat') return true
      return documentIds.has(tab.id)
    })

    // Clean up right tabs
    const cleanedRightTabs = rightTabs.filter(tab => {
      if (tab.type === 'ai-chat') return true
      return documentIds.has(tab.id)
    })

    // Update state if necessary
    if (cleanedLeftTabs.length !== tabs.length) {
      setTabs(cleanedLeftTabs)
    }
    if (cleanedRightTabs.length !== rightTabs.length) {
      setRightTabs(cleanedRightTabs)
    }
  }, [documents])

  // Render content based on active tab
  const renderLeftContent = () => {
    const activeTab = tabs.find(t => t.isActive)

    if (!activeTab) {
      return documentsContent
    }

    if (activeTab.id === 'documents') {
      return documentsContent
    }

    // AI chat tab
    if (activeTab.type === 'ai-chat') {
      return (
        <SpaceChat
          spaceId={spaceId}
          spaceName={spaceName}
          chatState={chatState}
          onChatStateChange={setChatState}
          initialMessage={activeTab.initialMessage}
          hideHeader={true}
          documents={documents}
        />
      )
    }

    // Document preview tab
    const document = documents.find(d => d.id === activeTab.id)
    if (document) {
      const zoomKey = `left:${activeTab.id}` // Unique per pane + tab
      return (
        <DocumentViewer
          key={zoomKey}
          documentId={document.id}
          filename={document.filename}
          mimeType={document.mime_type}
          zoomState={tabZoomStates[zoomKey]}
          onZoomStateChange={(state) => handleZoomStateChange(zoomKey, state)}
        />
      )
    }

    return documentsContent
  }

  const renderRightContent = () => {
    const activeTab = rightTabs.find(t => t.isActive)
    if (!activeTab) return null

    if (activeTab.type === 'ai-chat') {
      return (
        <SpaceChat
          spaceId={spaceId}
          spaceName={spaceName}
          chatState={chatState}
          onChatStateChange={setChatState}
          initialMessage={activeTab.initialMessage}
          hideHeader={true}
          documents={documents}
        />
      )
    }

    // Document preview in right pane
    const document = documents.find(d => d.id === activeTab.id)
    if (document) {
      const zoomKey = `right:${activeTab.id}` // Unique per pane + tab
      return (
        <DocumentViewer
          key={zoomKey}
          documentId={document.id}
          filename={document.filename}
          mimeType={document.mime_type}
          zoomState={tabZoomStates[zoomKey]}
          onZoomStateChange={(state) => handleZoomStateChange(zoomKey, state)}
        />
      )
    }

    return (
      <SpaceChat
        spaceId={spaceId}
        spaceName={spaceName}
        chatState={chatState}
        onChatStateChange={setChatState}
        hideHeader={true}
        documents={documents}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <Header
          spaceName={spaceName}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onUploadClick={() => setIsUploadOpen(true)}
        />
        <SplitPaneView
          leftTabs={tabs}
          rightTabs={rightTabs.length > 0 ? rightTabs : undefined}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onSplitRight={handleSplitRight}
          onMoveToLeft={handleMoveToLeft}
          onTabReorderLeft={handleTabReorder('left')}
          onTabReorderRight={handleTabReorder('right')}
          onTabDragBetweenPanes={handleTabDragBetweenPanes}
          onPanelResize={updateGridColumns}
          rightContent={rightTabs.length > 0 ? renderRightContent() : undefined}
        >
          {renderLeftContent()}
        </SplitPaneView>
        {rightTabs.length === 0 && !tabs.some(t => t.type === 'ai-chat') && (
          <MiniAIChat
            onSend={handleMiniChatSend}
            onOpenChat={() => handleOpenChat()}
            onOpenInPane={(pane) => {
              const chatId = `ai-chat-${Date.now()}`
              const newTab = {
                id: chatId,
                title: 'AI Chat',
                type: 'ai-chat' as any,
                isActive: true,
                closable: true,
              }

              if (pane === 'left') {
                setTabs([...tabs.map((t) => ({ ...t, isActive: false })), newTab])
              } else {
                setRightTabs([...rightTabs.map((t) => ({ ...t, isActive: false })), newTab])
              }
            }}
            documents={documents}
            selectedDocumentIds={getSpaceContext(spaceId)}
            onDocumentContextChange={(documentIds) => setSpaceContext(spaceId, documentIds)}
            spaceName={spaceName}
            spaceId={spaceId}
          />
        )}
      </div>
      <DocumentUpload open={isUploadOpen} onOpenChange={setIsUploadOpen} spaceId={spaceId} />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        documentName={documentToDelete ? documents.find(d => d.id === documentToDelete)?.filename : undefined}
        selectedCount={!documentToDelete ? selectedDocuments.size : undefined}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  )
}
