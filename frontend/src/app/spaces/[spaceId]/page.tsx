'use client'

import { useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
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
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentUpload } from '@/components/shared/document-upload'
import { useSpaceDocuments, useDeleteDocument } from '@/hooks/use-documents'
import { DocumentResponse } from '@/lib/api'

type DocumentType = 'word' | 'pdf' | 'image' | 'audio' | 'video' | 'webpage' | 'other'
type ViewMode = 'list' | 'grid'

// Helper function to determine document type from mime_type
const getDocumentType = (mimeType: string): DocumentType => {
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'word'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.includes('html')) return 'webpage'
  return 'other'
}

export default function SpacePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const spaceId = params.spaceId as string
  const spaceName = searchParams.get('name') || 'Space'

  // Fetch documents for this space
  const { data: documentsData, isLoading, error } = useSpaceDocuments(spaceId)
  const deleteDocumentMutation = useDeleteDocument()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [chatState, setChatState] = useState<'visible' | 'hidden' | 'fullscreen'>('visible')

  // Get documents from API response
  const documents: DocumentResponse[] = documentsData?.documents || []

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDeleteDocument = async (documentId: string) => {
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      try {
        await deleteDocumentMutation.mutateAsync(documentId)
      } catch (error) {
        console.error('Failed to delete document:', error)
      }
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return 'Link'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
      case 'pdf':
      case 'word':
        return <FileText className="h-5 w-5" />
      case 'image':
        return <ImageIcon className="h-5 w-5" />
      case 'audio':
        return <Volume2 className="h-5 w-5" />
      case 'video':
        return <FileVideo className="h-5 w-5" />
      case 'webpage':
        return <Globe className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  const getFileTypeColor = (type: DocumentType) => {
    switch (type) {
      case 'pdf':
        return 'bg-red-100 text-red-800'
      case 'word':
        return 'bg-blue-100 text-blue-800'
      case 'image':
        return 'bg-green-100 text-green-800'
      case 'audio':
        return 'bg-yellow-100 text-yellow-800'
      case 'video':
        return 'bg-purple-100 text-purple-800'
      case 'webpage':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const documentsContent = (
    <div className="p-6 h-full bg-background flex flex-col relative">
      <div className="bg-white h-full rounded-lg flex flex-col">
        <div className="py-4 px-6 space-y-6 flex-shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{spaceName}</h1>
              <p className="text-muted-foreground">
                {filteredDocuments.length} documents
              </p>
            </div>
            <div className="flex items-center gap-3">
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

          {/* Search and View Toggle */}
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
        </div>

        {/* Scrollable Documents Display */}
        <div className="flex-1 overflow-hidden">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Date Added</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((document) => {
                      const docType = getDocumentType(document.mime_type)
                      return (
                        <TableRow key={document.id} className="hover:bg-muted/50 cursor-pointer">
                          <TableCell>
                            <div className="text-muted-foreground">
                              {getFileIcon(docType)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {document.filename}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn("text-xs", getFileTypeColor(docType))}>
                              {docType.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatFileSize(document.file_size)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(document.created_at)}
                          </TableCell>
                          <TableCell>
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
              ) : (
                <div 
                className="grid gap-4" 
                style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))'}}>
                  {filteredDocuments.map((document) => {
                    const docType = getDocumentType(document.mime_type)
                    return (
                      <div
                        key={document.id}
                        className="group rounded-lg border hover:shadow-md transition-all cursor-pointer overflow-hidden bg-white"
                      >
                        {/* Preview Section - Top 2/3 */}
                        <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center border-b">
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
                                {formatFileSize(document.file_size)}
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

              {filteredDocuments.length === 0 && !isLoading && !error && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No documents found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first document'}
                  </p>
                  {!searchTerm && (
                    <>
                    <Button onClick={() => setIsUploadOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Documents
                    </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
      
    </div>
  )

  const chatContent = (
    <SpaceChat 
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
      <DocumentUpload open={isUploadOpen} onOpenChange={setIsUploadOpen} />
    </>
  )
}