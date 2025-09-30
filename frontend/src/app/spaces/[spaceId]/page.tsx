'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
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
import { SpaceLayout } from '@/components/layout/space-layout'
import { SpaceChat } from '@/components/chat/space-chat'
import {
  Plus,
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
  Filter,
  ArrowUpDown,
  ChevronDown,
  Calendar,
  HardDrive,
  X,
  ChevronUp,
  ChevronDown as ChevronDownIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentUpload } from '@/components/shared/document-upload'
import { useSpaceDocuments, useDeleteDocument, useDeleteDocumentSilent } from '@/hooks/use-documents'
import { DocumentResponse } from '@/lib/api'
import { useSpacesContext } from '@/contexts/spaces-context'
import toast from 'react-hot-toast'

enum DocumentType {
  word = 'word',
  pdf = 'pdf',
  image = 'image',
  audio = 'audio',
  video = 'video',
  web = 'web',
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
  if (mimeType.includes('html')) return DocumentType.web
  return DocumentType.other
}

export default function SpacePage() {
  const params = useParams()
  const router = useRouter()
  const { getSpaceById } = useSpacesContext()
  const spaceId = params.spaceId as string
  const space = getSpaceById(spaceId)
  const spaceName = space?.name || 'Space'

  // Fetch documents for this space
  const { data: documentsData, isLoading, error } = useSpaceDocuments(spaceId)
  const deleteDocumentMutation = useDeleteDocument()
  const deleteDocumentSilentMutation = useDeleteDocumentSilent()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
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

  const handleDocumentClick = (documentId: string) => {
    router.push(`/spaces/${spaceId}/documents/${documentId}`)
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
    <div className="p-6 h-full bg-background flex flex-col relative min-w-0">
      <div className="bg-white h-full rounded-lg flex flex-col min-w-0">
        <div className="py-3 px-6 space-y-4 flex-shrink-0 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 min-w-0 w-full">
            <div className="min-w-0 flex-1 overflow-hidden">
              <h1 className="text-2xl font-bold tracking-tight truncate" title={spaceName}>{spaceName}</h1>
              <p className="text-muted-foreground">
                {documents.length} documents • {formatFileSize(getTotalSize())}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {selectedDocuments.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedDocuments.size} document{selectedDocuments.size > 1 ? 's' : ''}
                </Button>
              )}
              {chatState === 'hidden' && (
                <Button
                  variant="outline"
                  onClick={() => setChatState('visible')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Open Chat
                </Button>
              )}
              <Button onClick={() => setIsUploadOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Documents
              </Button>
            </div>
          </div>

          {/* Search and View Toggle - Only show if there are documents */}
          {documents.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                {/* Filter by Type */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant={selectedTypes.size > 0 ? "default" : "outline"} size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      {selectedTypes.size > 0 ? (
                        <>
                          {selectedTypes.size === 1
                            ? Array.from(selectedTypes)[0].charAt(0).toUpperCase() + Array.from(selectedTypes)[0].slice(1)
                            : `${selectedTypes.size} Types`
                          }
                          <X className="h-3 w-3 ml-1 hover:text-red-600 cursor-pointer" onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            clearAllFilters()
                          }} />
                        </>
                      ) : (
                        'Type'
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2">
                    <DropdownMenuLabel className="text-sm font-medium text-gray-900 px-2 py-1">
                      Filter by Type
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="my-2" />
                    <div className="space-y-1">
                      {Object.values(DocumentType).map((type) => (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={selectedTypes.has(type as DocumentType)}
                          onCheckedChange={() => handleTypeFilter(type as DocumentType)}
                          className="cursor-pointer px-2 py-2 rounded-md hover:bg-gray-100 transition-colors duration-150 flex items-center"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-2 rounded-full", getFileTypeColor(type as DocumentType))} />
                            <span className="text-sm">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                          </div>
                        </DropdownMenuCheckboxItem>
                      ))}
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

                {/* Sort Options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Sort
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
                        className="cursor-pointer px-2 py-2 rounded-md hover:bg-gray-100 transition-colors duration-150"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-3 text-gray-500" />
                            <span className="text-sm">Date Added</span>
                          </div>
                          {sortBy === 'date' && (
                            sortOrder === 'desc' ? (
                              <ChevronDownIcon className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-blue-600" />
                            )
                          )}
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSort('name')}
                        className="cursor-pointer px-2 py-2 rounded-md hover:bg-gray-100 transition-colors duration-150"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-3 text-gray-500" />
                            <span className="text-sm">Name</span>
                          </div>
                          {sortBy === 'name' && (
                            sortOrder === 'desc' ? (
                              <ChevronDownIcon className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-blue-600" />
                            )
                          )}
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSort('size')}
                        className="cursor-pointer px-2 py-2 rounded-md hover:bg-gray-100 transition-colors duration-150"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            <HardDrive className="h-4 w-4 mr-3 text-gray-500" />
                            <span className="text-sm">File Size</span>
                          </div>
                          {sortBy === 'size' && (
                            sortOrder === 'desc' ? (
                              <ChevronDownIcon className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronUp className="h-4 w-4 text-blue-600" />
                            )
                          )}
                        </div>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

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
            <ScrollArea className="h-full px-6">
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
                <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  maxWidth: '100%'
                }}
                onClick={handleDeselectAll}>
                  {filteredDocuments.map((document) => {
                    const docType = getDocumentType(document.mime_type)
                    return (
                      <div
                        key={document.id}
                        className={cn(
                          "group rounded-lg hover:shadow-md transition-all overflow-hidden bg-white relative",
                          selectedDocuments.has(document.id) ? "border-2 border-primary" : "border border-border"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Checkbox overlay */}
                        <div className="absolute top-2 left-2 z-10">
                          <Checkbox
                            checked={selectedDocuments.has(document.id)}
                            onCheckedChange={() => handleSelectDocument(document.id)}
                            className="bg-white shadow-md"
                          />
                        </div>

                        {/* Preview Section - Top 2/3 */}
                        <div
                          className="aspect-[4/3] bg-muted/30 flex items-center justify-center border-b cursor-pointer"
                          onClick={() => handleDocumentClick(document.id)}
                        >
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                            {getFileIcon(docType)}
                          </div>
                        </div>

                        {/* Info Section - Bottom 1/3 */}
                        <div className="p-3 space-y-3">
                          <div className="space-y-1">
                            <p className="font-medium text-sm truncate" title={document.filename}>
                              {document.filename}
                            </p>
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className={cn("text-xs", getFileTypeColor(docType))}>
                                {docType.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(getFileSize(document), docType)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(document.created_at)}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleDeleteDocument(document.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
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

  return (
    <>
      <SpaceLayout 
        chat={chatState !== 'hidden' ? chatContent : null}
        chatState={chatState}
        onChatStateChange={setChatState}
      >
        {documentsContent}
      </SpaceLayout>
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