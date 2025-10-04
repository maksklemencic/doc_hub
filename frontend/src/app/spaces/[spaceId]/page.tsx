'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { DocumentCard, DocumentType as DocCardType } from '@/components/documents/document-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { SpaceChat } from '@/components/chat/space-chat'
import {
  Plus,
  Minus,
  Grid3X3,
  List,
  FileText,
  Image as ImageIcon,
  FileVideo,
  Volume2,
  Globe,
  MoreHorizontal,
  Download,
  Edit3,
  Search,
  MessageSquare,
  Trash2,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  Calendar,
  HardDrive,
  X,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentUpload } from '@/components/shared/document-upload'
import { Header } from '@/components/shared/header'
import { Tab } from '@/components/shared/tab-bar'
import { SplitPaneView } from '@/components/layout/split-pane-view'
import { MiniAIChat } from '@/components/chat/mini-ai-chat'
import { useSpaceDocuments, useDeleteDocument, useDeleteDocumentSilent } from '@/hooks/use-documents'
import { DocumentResponse, documentsApi } from '@/lib/api'
import { useSpacesContext } from '@/contexts/spaces-context'
import toast from 'react-hot-toast'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import Image from 'next/image'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

// Document Viewer Component for Right Pane
function DocumentViewer({ documentId, filename, mimeType }: { documentId: string; filename: string; mimeType?: string }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [docType, setDocType] = useState<string>('pdf')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.0)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Handle wheel zoom (Ctrl/Cmd + scroll)
  useEffect(() => {
   const handleWheel = (e: Event) => {
  const wheelEvent = e as WheelEvent
  if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
    wheelEvent.preventDefault()
    const delta = wheelEvent.deltaY
    const zoomChange = delta > 0 ? -0.1 : 0.1
    setScale(prev => Math.min(2.0, Math.max(0.5, prev + zoomChange)))
  }
}


    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')

    if (scrollElement) {
      scrollElement.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      if (scrollElement) {
        scrollElement.removeEventListener('wheel', handleWheel)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let currentUrl: string | null = null

    const loadDocument = async () => {
      setIsLoading(true)
      setError(null)

      // Check if document type is supported for preview
      const unsupportedTypes = ['text/youtube', 'audio/', 'video/', 'html']
      const isUnsupported = unsupportedTypes.some(type => mimeType?.includes(type))

      if (isUnsupported) {
        if (mounted) {
          setIsLoading(false)
          setDocType('unsupported')
        }
        return
      }

      try {
        const result = await documentsApi.getDocumentFile(documentId)
        currentUrl = result.url

        if (mounted) {
          setPdfUrl(result.url)
          setDocType(result.docType)
        } else {
          URL.revokeObjectURL(result.url)
        }
      } catch (err: any) {
        console.error('Failed to load document:', err)
        if (mounted) {
          setError('Failed to load document')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadDocument()

    return () => {
      mounted = false
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [documentId, mimeType])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner className="mr-2" />
        <span className="text-muted-foreground">Loading document...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Failed to load document</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (docType === 'unsupported') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Preview not supported</h3>
          <p className="text-muted-foreground">
            This document type cannot be previewed in the browser.
          </p>
        </div>
      </div>
    )
  }

  if (!pdfUrl) return null

  const getScaledWidth = () => {
    if (typeof window === 'undefined') return 600
    const containerWidth = window.innerWidth - 100

    if (scale === -1) {
      // Fit to screen mode
      return containerWidth
    }

    const baseWidth = Math.min(600, containerWidth)
    return baseWidth * scale
  }

  const scaledWidth = getScaledWidth()

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Zoom Controls - Floating overlay on the right side */}
      {docType !== 'image' && docType !== 'web' && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale(Math.min(2.0, scale === -1 ? 1.1 : scale + 0.1))}
            disabled={scale >= 2.0}
            className="h-8 w-8 p-0"
            title="Zoom in (10%)"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <div className="text-xs font-medium text-center py-1 min-w-[40px]">
            {scale === -1 ? 'Fit' : `${Math.round(scale * 100)}%`}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale(Math.max(0.5, scale === -1 ? 0.9 : scale - 0.1))}
            disabled={scale <= 0.5 && scale !== -1}
            className="h-8 w-8 p-0"
            title="Zoom out (10%)"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="h-px bg-border my-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale(-1)}
            className="h-8 w-8 p-0"
            title="Fit to screen"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale(1.0)}
            className="h-8 w-8 p-0 text-xs"
            title="Reset to 100%"
          >
            1:1
          </Button>
        </div>
      )}

      <ScrollArea className="h-full">
        <div className="p-6 flex flex-col items-center" ref={scrollAreaRef}>
          {docType === 'image' || docType === 'web' || mimeType?.startsWith('image/') ? (
            <div className="w-full flex flex-col items-center justify-center">
              <div className="relative w-full max-w-4xl">
                <Image
                  src={pdfUrl}
                  alt={filename}
                  width={0}
                  height={0}
                  sizes="100vw"
                  style={{ width: '100%', height: 'auto' }}
                  className="rounded-lg shadow-lg"
                  unoptimized
                />
              </div>
            </div>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-12">
                  <Spinner className="mr-2" />
                  <span className="text-muted-foreground">Loading PDF...</span>
                </div>
              }
              error={
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Failed to render document</h3>
                </div>
              }
            >
              {Array.from(new Array(numPages), (el, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  className="mb-4 shadow-lg"
                  width={scaledWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              ))}
            </Document>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

enum DocumentType {
  word = 'word',
  pdf = 'pdf',
  image = 'image',
  audio = 'audio',
  video = 'video',
  web = 'web',
  youtube = 'youtube',
  other = 'other'
}
type ViewMode = 'list' | 'grid'
type SortBy = 'date' | 'name' | 'size'
type SortOrder = 'asc' | 'desc'

// Helper function to determine document type from mime_type
const getDocumentType = (mimeType: string): DocumentType => {
  if (mimeType.includes('pdf')) return DocumentType.pdf
  if (mimeType.includes('word') || mimeType.includes('document')) return DocumentType.word
  if (mimeType.startsWith('image/')) return DocumentType.image
  if (mimeType.startsWith('audio/')) return DocumentType.audio
  if (mimeType.startsWith('video/')) return DocumentType.video
  if (mimeType.includes('youtube')) return DocumentType.youtube
  if (mimeType.includes('html')) return DocumentType.web
  return DocumentType.other
}

export default function SpacePage() {
  const params = useParams()
  const { getSpaceById } = useSpacesContext()
  const spaceId = params.spaceId as string
  const space = getSpaceById(spaceId)
  const spaceName = space?.name || 'Space'

  // Fetch documents for this space
  const { data: documentsData, isLoading, error } = useSpaceDocuments(spaceId)
  const deleteDocumentMutation = useDeleteDocument()
  const deleteDocumentSilentMutation = useDeleteDocumentSilent()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [chatState, setChatState] = useState<'visible' | 'hidden' | 'fullscreen'>('visible')
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<Set<DocumentType>>(new Set())
  const [typeFilterSearch, setTypeFilterSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc') // newest first by default

  // Tab management for new UI
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

  // Get documents from API response
  const documents: DocumentResponse[] = documentsData?.documents || []

  // Helper function to get file size from backend
  const getFileSize = (document: DocumentResponse): number => {
    return document.file_size || 0
  }

  // Calculate total size of all documents
  const getTotalSize = (): number => {
    return documents.reduce((total, doc) => total + getFileSize(doc), 0)
  }

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
          comparison = getFileSize(a) - getFileSize(b)
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
      // Bulk delete - close dialog immediately and show promise toast
      const count = selectedDocuments.size
      const selectedIds = Array.from(selectedDocuments)

      setDeleteDialogOpen(false)
      setDocumentToDelete(null)
      setSelectedDocuments(new Set())

      // Use promise toast for bulk operations
      toast.promise(
        Promise.all(
          selectedIds.map(docId =>
            deleteDocumentSilentMutation.mutateAsync(docId)
          )
        ),
        {
          loading: `Deleting ${count} document${count > 1 ? 's' : ''}...`,
          success: `${count} document${count > 1 ? 's' : ''} deleted successfully`,
          error: 'Failed to delete documents. Please try again.',
        }
      )
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setDocumentToDelete(null)
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

  const handleBulkDelete = () => {
    if (selectedDocuments.size === 0) return
    setDeleteDialogOpen(true)
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

  // Get available document types from current documents
  const availableTypes = Array.from(new Set(documents.map(doc => getDocumentType(doc.mime_type))))

  const getTypeIcon = (type: DocumentType) => {
    switch (type) {
      case DocumentType.pdf: return <FileText className="h-4 w-4 text-red-600" />
      case DocumentType.word: return <FileText className="h-4 w-4 text-blue-600" />
      case DocumentType.image: return <ImageIcon className="h-4 w-4 text-green-600" />
      case DocumentType.audio: return <Volume2 className="h-4 w-4 text-yellow-600" />
      case DocumentType.video: return <FileVideo className="h-4 w-4 text-purple-600" />
      case DocumentType.web: return <Globe className="h-4 w-4 text-indigo-600" />
      default: return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const getTypeName = (type: DocumentType) => {
    switch (type) {
      case DocumentType.pdf: return 'PDF'
      case DocumentType.word: return 'Word'
      case DocumentType.image: return 'Image'
      case DocumentType.audio: return 'Audio'
      case DocumentType.video: return 'Video'
      case DocumentType.web: return 'web'
      default: return 'Other'
    }
  }

  const formatFileSize = (bytes: number | null | undefined, docType?: DocumentType): string => {
    // For web documents, show "Link" instead of size
    if (docType === DocumentType.web) return 'Link'

    // Handle invalid or missing file sizes
    if (bytes === null || bytes === undefined) return 'Unknown'

    // Convert to number if it's a string
    const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes

    if (isNaN(numBytes)) return 'Unknown'

    // Handle zero bytes
    if (numBytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(numBytes) / Math.log(k))
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getPageCount = (document: DocumentResponse, docType: DocumentType): string | undefined => {
    // Only show page count for PDF and Word documents
    if (docType !== DocumentType.pdf && docType !== DocumentType.word) {
      return undefined
    }

    // Check if document has page_count metadata

    // if (document.page_count && document.page_count > 0) {
    //   return `${document.page_count} pages`
    // }

    return undefined
  }

  const getFileIcon = (type: DocumentType) => {
    switch (type) {
      case DocumentType.pdf:
      case DocumentType.word:
        return <FileText className="h-5 w-5" />
      case DocumentType.image:
        return <ImageIcon className="h-5 w-5" />
      case DocumentType.audio:
        return <Volume2 className="h-5 w-5" />
      case DocumentType.video:
        return <FileVideo className="h-5 w-5" />
      case DocumentType.web:
        return <Globe className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  const getFileTypeColor = (type: DocumentType) => {
    switch (type) {
      case DocumentType.pdf:
        return 'bg-red-100 text-red-800'
      case DocumentType.word:
        return 'bg-blue-100 text-blue-800'
      case DocumentType.image:
        return 'bg-green-100 text-green-800'
      case DocumentType.audio:
        return 'bg-yellow-100 text-yellow-800'
      case DocumentType.video:
        return 'bg-purple-100 text-purple-800'
      case DocumentType.web:
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const documentsContent = (
    <div className="h-full flex flex-col relative min-w-0 bg-background">
      <div className="h-full flex flex-col min-w-0">
        {documents.length > 0 && (
          <div className="px-6 pt-4 pb-3 border-b border-border flex-shrink-0 min-w-0">
            {/* Search and Filter Row */}
            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 bg-white"
                />
              </div>

              {/* Sort and Filter */}
              <div className="flex items-center gap-2 flex-1">
                {/* Selected documents indicator */}
                {selectedDocuments.size > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-900 rounded-md text-sm ml-auto">
                    <span className="font-medium">{selectedDocuments.size} selected</span>
                    <button
                      onClick={handleDeselectAll}
                      className="text-teal-600 hover:text-teal-800 transition-colors"
                      title="Clear selection"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Sort Options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 bg-white">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      {sortBy === 'date' ? 'Date' : sortBy === 'name' ? 'Name' : 'Size'}
                      {sortOrder === 'asc' ? ' ↑' : ' ↓'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 p-2">
                    <DropdownMenuLabel className="text-sm font-medium text-gray-900 px-2 py-1">
                      Sort by
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="my-2" />
                    <div className="space-y-1">
                      <DropdownMenuItem
                        onClick={() => handleSort('date')}
                        className="cursor-pointer px-2 py-2 rounded-md hover:bg-teal-50 hover:text-teal-900 transition-colors duration-150"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-3 text-gray-500" />
                            <span className="text-sm">Date Added</span>
                          </div>
                          {sortBy === 'date' && (
                            sortOrder === 'desc' ? (
                              <ChevronDownIcon className="h-4 w-4 text-teal-600" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-teal-600" />
                            )
                          )}
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSort('name')}
                        className="cursor-pointer px-2 py-2 rounded-md hover:bg-teal-50 hover:text-teal-900 transition-colors duration-150"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-3 text-gray-500" />
                            <span className="text-sm">Name</span>
                          </div>
                          {sortBy === 'name' && (
                            sortOrder === 'desc' ? (
                              <ChevronDownIcon className="h-4 w-4 text-teal-600" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-teal-600" />
                            )
                          )}
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSort('size')}
                        className="cursor-pointer px-2 py-2 rounded-md hover:bg-teal-50 hover:text-teal-900 transition-colors duration-150"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            <HardDrive className="h-4 w-4 mr-3 text-gray-500" />
                            <span className="text-sm">File Size</span>
                          </div>
                          {sortBy === 'size' && (
                            sortOrder === 'desc' ? (
                              <ChevronDownIcon className="h-4 w-4 text-teal-600" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-teal-600" />
                            )
                          )}
                        </div>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Filter by Type */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={selectedTypes.size > 0 ? "default" : "outline"}
                      size="sm"
                      className={selectedTypes.size > 0 ? "h-9" : "h-9 bg-white"}
                    >
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      Filter
                      {selectedTypes.size > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-white/20 text-white border-0">
                          {selectedTypes.size}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2">
                    <DropdownMenuLabel className="text-sm font-medium text-gray-900 px-2 py-1">
                      Filter by Type
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="my-2" />

                    {/* Search Input */}
                    <div className="px-2 pb-2">
                      <Input
                        placeholder="Search types..."
                        value={typeFilterSearch}
                        onChange={(e) => setTypeFilterSearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {Object.values(DocumentType)
                        .filter((type) =>
                          type.toLowerCase().includes(typeFilterSearch.toLowerCase())
                        )
                        .map((type) => {
                          const typeColor = getFileTypeColor(type as DocumentType)
                          const isSelected = selectedTypes.has(type as DocumentType)
                          return (
                            <div
                              key={type}
                              onClick={() => handleTypeFilter(type as DocumentType)}
                              className="cursor-pointer px-2 py-2 rounded-md hover:bg-teal-50 transition-colors duration-150 flex items-center justify-between"
                            >
                              <Badge variant="secondary" className={cn("text-xs px-2 py-0.5", typeColor)}>
                                {type.toUpperCase()}
                              </Badge>
                              {isSelected && (
                                <Check className="h-4 w-4 text-teal-600" />
                              )}
                            </div>
                          )
                        })}
                    </div>
                    {selectedTypes.size > 0 && (
                      <>
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuItem
                          onClick={clearAllFilters}
                          className="cursor-pointer px-2 py-2 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear All Filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Documents Display */}
        <div className="flex-1 overflow-hidden">
          {documents.length === 0 && !isLoading && !error ? (
            // Centered no documents message when no documents exist
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No documents found</h3>
                <p className="text-muted-foreground">
                  Get started by adding your first document
                </p>
              </div>
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
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Failed to load documents</h3>
                  <p className="text-muted-foreground mb-4">
                    There was an error loading the documents for this space.
                  </p>
                </div>
              ) : viewMode === 'list' ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={selectedDocuments.size === filteredDocuments.length && filteredDocuments.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead className="min-w-[200px]">Name</TableHead>
                        <TableHead className="w-[80px]">Type</TableHead>
                        <TableHead className="w-[100px]">Size</TableHead>
                        <TableHead className="w-[120px]">Date Added</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((document) => {
                      const docType = getDocumentType(document.mime_type)
                      return (
                        <TableRow
                          key={document.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleDocumentClick(document.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedDocuments.has(document.id)}
                              onCheckedChange={() => handleSelectDocument(document.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="text-muted-foreground">
                              {getFileIcon(docType)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium max-w-0">
                            <div className="truncate" title={document.filename}>
                              {document.filename}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn("text-xs", getFileTypeColor(docType))}>
                              {docType.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatFileSize(getFileSize(document), docType)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(document.created_at)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(document.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                // Grid View
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-0 py-6"
                  onClick={handleDeselectAll}
                >
                  {filteredDocuments.map((document) => {
                    const docType = getDocumentType(document.mime_type)
                    return (
                      <DocumentCard
                        key={document.id}
                        id={document.id}
                        filename={document.filename}
                        type={docType as DocCardType}
                        size={formatFileSize(getFileSize(document), docType)}
                        timestamp={formatDate(document.created_at)}
                        pageCount={getPageCount(document, docType)}
                        url={document.url}
                        isSelected={selectedDocuments.has(document.id)}
                        onSelect={() => handleSelectDocument(document.id)}
                        onClick={() => handleDocumentClick(document.id)}
                        onDelete={() => handleDeleteDocument(document.id)}
                        onOpenInRightPane={() => {
                          // Close document in left pane if open
                          const leftTab = tabs.find((t) => t.id === document.id)
                          if (leftTab) {
                            setTabs(tabs.filter((t) => t.id !== document.id))
                          }

                          // Open document in right pane
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
                        }}
                        onAddToContext={() => {
                          toast.success(`Added ${document.filename} to chat context`)
                        }}
                      />
                    )
                  })}
                </div>
              )}

              {filteredDocuments.length === 0 && !isLoading && !error && searchTerm && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No documents found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search terms
                  </p>
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
    />
  )

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
        />
      )
    }

    // Document preview tab
    const document = documents.find(d => d.id === activeTab.id)
    if (document) {
      return <DocumentViewer documentId={document.id} filename={document.filename} mimeType={document.mime_type} />
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
        />
      )
    }

    // Document preview in right pane
    const document = documents.find(d => d.id === activeTab.id)
    if (document) {
      return <DocumentViewer documentId={document.id} filename={document.filename} mimeType={document.mime_type} />
    }

    return (
      <SpaceChat
        spaceId={spaceId}
        spaceName={spaceName}
        chatState={chatState}
        onChatStateChange={setChatState}
        hideHeader={true}
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
          rightContent={rightTabs.length > 0 ? renderRightContent() : undefined}
        >
          {renderLeftContent()}
        </SplitPaneView>
        {rightTabs.length === 0 && !tabs.some(t => t.type === 'ai-chat') && (
          <MiniAIChat
            contextText={`All in ${spaceName}`}
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
          />
        )}
      </div>
      <DocumentUpload open={isUploadOpen} onOpenChange={setIsUploadOpen} spaceId={spaceId} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document{selectedDocuments.size > 1 || (!documentToDelete && selectedDocuments.size > 0) ? 's' : ''}</DialogTitle>
            <DialogDescription>
              {documentToDelete ? (
                <>
                  Are you sure you want to delete "<strong>{documents.find(d => d.id === documentToDelete)?.filename}</strong>"?
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong>{selectedDocuments.size} document{selectedDocuments.size > 1 ? 's' : ''}</strong>?
                  This action cannot be undone and will permanently remove {selectedDocuments.size > 1 ? 'these documents' : 'this document'}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {documentToDelete ? 'Document' : `${selectedDocuments.size} Document${selectedDocuments.size > 1 ? 's' : ''}`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}