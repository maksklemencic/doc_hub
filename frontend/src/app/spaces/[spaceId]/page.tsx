'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentUpload } from '@/components/shared/document-upload'

interface Document {
  id: string
  name: string
  type: 'word' | 'pdf' | 'image' | 'audio' | 'video' | 'webpage'
  size: number
  dateAdded: string
}

const MOCK_DOCUMENTS: Document[] = [
  {
    id: '1',
    name: 'Project Requirements.pdf',
    type: 'pdf',
    size: 2450000,
    dateAdded: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    name: 'Meeting Notes Q1.docx',
    type: 'word',
    size: 850000,
    dateAdded: '2024-01-14T14:20:00Z'
  },
  {
    id: '3',
    name: 'Dashboard Screenshot.png',
    type: 'image',
    size: 1200000,
    dateAdded: '2024-01-13T09:15:00Z'
  },
  {
    id: '4',
    name: 'Podcast Interview.mp3',
    type: 'audio',
    size: 8500000,
    dateAdded: '2024-01-12T16:45:00Z'
  },
  {
    id: '5',
    name: 'Demo Video.mp4',
    type: 'video',
    size: 45000000,
    dateAdded: '2024-01-11T11:20:00Z'
  },
  {
    id: '6',
    name: 'React Documentation',
    type: 'webpage',
    size: 0,
    dateAdded: '2024-01-10T13:30:00Z'
  },
  {
    id: '7',
    name: 'Team Photo.jpg',
    type: 'image',
    size: 3200000,
    dateAdded: '2024-01-09T09:15:00Z'
  },
  {
    id: '8',
    name: 'Client Presentation.pdf',
    type: 'pdf',
    size: 5800000,
    dateAdded: '2024-01-08T14:30:00Z'
  }
]

type ViewMode = 'list' | 'grid'

export default function SpacePage() {
  const params = useParams()
  const spaceId = params.spaceId as string
  
  const getSpaceName = (id: string) => {
    const spaces = [
      { id: '1', name: 'Work Projects' },
      { id: '2', name: 'Personal Documents' },
      { id: '3', name: 'Team Shared' },
    ]
    return spaces.find(space => space.id === id)?.name || 'Space'
  }

  const spaceName = getSpaceName(spaceId)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  
  const filteredDocuments = MOCK_DOCUMENTS.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

  const getFileIcon = (type: Document['type']) => {
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

  const getFileTypeColor = (type: Document['type']) => {
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
    <div className="p-6 h-full bg-background flex flex-col">
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
            <Button onClick={() => setIsUploadOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
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
              {viewMode === 'list' ? (
                <div className="space-y-2">
                  {filteredDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 hover:cursor-pointer transition-colors group"
                    >
                      <div className="flex-shrink-0 text-muted-foreground">
                        {getFileIcon(document.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{document.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Added {formatDate(document.dateAdded)}
                        </p>
                      </div>
                      <Badge variant="secondary" className={cn("text-xs", getFileTypeColor(document.type))}>
                        {document.type.toUpperCase()}
                      </Badge>
                      <div className="text-sm text-muted-foreground min-w-0 text-right">
                        {formatFileSize(document.size)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div 
                className="grid gap-4" 
                style={{gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))'}}
              >
                  {filteredDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="group p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          {getFileIcon(document.type)}
                        </div>
                        <div className="text-center space-y-1 w-full">
                          <p className="font-medium text-sm truncate" title={document.name}>
                            {document.name}
                          </p>
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className={cn("text-xs", getFileTypeColor(document.type))}>
                              {document.type.toUpperCase()}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(document.size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm">
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredDocuments.length === 0 && (
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
                      Add Document
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
    <SpaceChat spaceName={spaceName} />
  )

  return (
    <>
      <SpaceLayout chat={chatContent}>
        {documentsContent}
      </SpaceLayout>
      <DocumentUpload open={isUploadOpen} onOpenChange={setIsUploadOpen} />
    </>
  )
}