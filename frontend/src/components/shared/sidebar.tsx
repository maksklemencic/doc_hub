'use client'

import * as React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/hooks/use-auth'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  FolderClosed,
  FolderOpen,
  LogOut,
  Plus,
  Check,
  X,
  Edit2,
  PanelLeftClose,
  Trash2,
  FileText,
  ChevronRight,
  ChevronDown,
  CornerDownRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SpaceResponse } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { useSpaces, useCreateSpace, useUpdateSpace, useDeleteSpace } from '@/hooks/use-spaces'
import { useSpaceDocumentCounts } from '@/hooks/use-space-document-counts'
import { documentsKeys } from '@/hooks/use-documents'
import { useQueryClient } from '@tanstack/react-query'
import { GetSpaceDocumentsResponse } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SidebarProps {
  className?: string
}

interface Space extends SpaceResponse {
  isActive: boolean
  documentCount: number
}

export function Sidebar({ className }: SidebarProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // TanStack Query hooks
  const { data: spacesData = [], isLoading, error } = useSpaces()
  const createSpaceMutation = useCreateSpace()
  const updateSpaceMutation = useUpdateSpace()
  const deleteSpaceMutation = useDeleteSpace()
  const queryClient = useQueryClient()

  // UI state
  const [isCreatingSpace, setIsCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [editingSpaceName, setEditingSpaceName] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [spaceToDelete, setSpaceToDelete] = useState<Space | null>(null)
  const [expandedSpaceIds, setExpandedSpaceIds] = useState<Set<string>>(new Set())

  // Get document counts for all spaces
  const spaceIds = spacesData.map(space => space.id)
  const { data: documentCounts = {} } = useSpaceDocumentCounts(spaceIds)

  // Force re-render when document cache changes
  const [, forceUpdate] = React.useReducer(x => x + 1, 0)

  // Transform spaces data to include UI state
  const pathMatch = pathname.match(/^\/spaces\/([^/]+)/)
  const activeSpaceId = pathMatch ? pathMatch[1] : null
  const docMatch = pathname.match(/^\/spaces\/[^/]+\/documents\/(.+)$/)
  const activeDocId = docMatch ? docMatch[1] : null

  // Auto-expand active space
  React.useEffect(() => {
    if (activeSpaceId) {
      setExpandedSpaceIds((prev) => new Set(prev).add(activeSpaceId))
    }
  }, [activeSpaceId])

  // Subscribe to document cache changes to update sidebar
  React.useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Listen for successful mutations or invalidations of document queries
      if (
        event.type === 'updated' &&
        event.query.queryKey[0] === 'documents'
      ) {
        forceUpdate()
      }
    })

    return () => unsubscribe()
  }, [queryClient])

  const spaces: Space[] = spacesData.map(space => ({
    ...space,
    isActive: space.id === activeSpaceId,
    documentCount: documentCounts[space.id] || 0
  }))
  
  const handleCreateSpace = async () => {
    if (!newSpaceName.trim() || createSpaceMutation.isPending) return

    try {
      const newSpace = await createSpaceMutation.mutateAsync({ name: newSpaceName.trim() })
      setNewSpaceName('')
      setIsCreatingSpace(false)
      // Auto-select the newly created space
      if (newSpace?.id) {
        router.push(`/spaces/${newSpace.id}`)
      }
    } catch (error) {
      console.error('Failed to create space:', error)
      // Error is handled by the mutation hook with toast notifications
    }
  }
  
  const handleCancelCreate = () => {
    setNewSpaceName('')
    setIsCreatingSpace(false)
  }
  
  const handleStartEdit = (space: Space) => {
    // Cancel any ongoing space creation
    if (isCreatingSpace) {
      setIsCreatingSpace(false)
      setNewSpaceName('')
    }
    setEditingSpaceId(space.id)
    setEditingSpaceName(space.name)
  }
  
  const handleSaveEdit = async () => {
    if (!editingSpaceName.trim() || !editingSpaceId || updateSpaceMutation.isPending) return

    try {
      await updateSpaceMutation.mutateAsync({
        spaceId: editingSpaceId,
        data: { name: editingSpaceName.trim() }
      })
      const previousEditingSpaceId = editingSpaceId
      setEditingSpaceId(null)
      setEditingSpaceName('')
      // Auto-select the edited space
      router.push(`/spaces/${previousEditingSpaceId}`)
    } catch (error) {
      console.error('Failed to update space:', error)
      // Error is handled by the mutation hook with toast notifications
    }
  }
  
  const handleCancelEdit = () => {
    setEditingSpaceId(null)
    setEditingSpaceName('')
  }

  const handleDeleteSpaceClick = (space: Space) => {
    setSpaceToDelete(space)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!spaceToDelete) return

    try {
      await deleteSpaceMutation.mutateAsync(spaceToDelete.id)

      // If we're currently viewing the deleted space, redirect to home
      const pathMatch = pathname.match(/^\/spaces\/(.+)$/)
      const currentSpaceId = pathMatch ? pathMatch[1] : null
      if (currentSpaceId === spaceToDelete.id) {
        router.push('/')
      }

      // Close dialog
      setDeleteDialogOpen(false)
      setSpaceToDelete(null)
    } catch (error) {
      console.error('Failed to delete space:', error)
      // Error is handled by the mutation hook with toast notifications
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setSpaceToDelete(null)
  }
  
  const handleSpaceClick = (spaceId: string) => {
    // Cancel any ongoing edit
    if (editingSpaceId) {
      setEditingSpaceId(null)
      setEditingSpaceName('')
    }

    // Close the previously active space when navigating to a new one
    if (activeSpaceId && activeSpaceId !== spaceId) {
      setExpandedSpaceIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(activeSpaceId)
        newSet.add(spaceId)
        return newSet
      })
    }

    // Navigate to the space
    router.push(`/spaces/${spaceId}`)
  }

  const toggleSpaceExpansion = (spaceId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedSpaceIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(spaceId)) {
        newSet.delete(spaceId) // Collapse if already expanded
      } else {
        newSet.add(spaceId) // Expand this space
      }
      return newSet
    })
  }

  const handleDocumentClick = (spaceId: string, docId: string) => {
    router.push(`/spaces/${spaceId}/documents/${docId}`)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // Small delay to show spinner
    await new Promise(resolve => setTimeout(resolve, 300))
    logout()
  }

  return (
    <div className={cn(
      'flex h-full flex-col text-white',
      className
    )}>
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-slate-600 px-4">
            <div className="flex items-center gap-2">
              {/* <Image 
                src="/doc-hub-180.png" 
                alt="Doc Hub Logo" 
                width={46} 
                height={46} 
                className="rounded-md" 
              /> */}
              <span className='text-2xl'>📄</span>
              <span className="text-lg font-semibold">Doc Hub</span>
            </div>
            <Button 
              variant="ghost"
              size="icon"
              >
              <PanelLeftClose/>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-hidden flex flex-col">
            {/* Spaces Section */}
            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-300 px-2">Spaces</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-800"
                  onClick={() => {
                    // Cancel any ongoing edit
                    if (editingSpaceId) {
                      setEditingSpaceId(null)
                      setEditingSpaceName('')
                    }
                    setIsCreatingSpace(true)
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center px-2 py-2">
                    <Spinner size="sm" className="mr-2" />
                    <span className="text-sm text-slate-300">Loading spaces...</span>
                  </div>
                ) : spaces.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-slate-300">
                    No spaces yet
                  </div>
                ) : (
                  spaces.map((space) => {
                    const isExpanded = expandedSpaceIds.has(space.id)

                    // Get documents from cache for this space (already loaded by space page)
                    const spaceDocuments = isExpanded
                      ? queryClient.getQueryData<GetSpaceDocumentsResponse>(
                          documentsKeys.spaceDocuments(space.id, 'limit=100&offset=0')
                        )
                      : null
                    const documents = spaceDocuments?.documents || []

                    // Document type enum matching the main page
                    enum DocumentType {
                      word = 'word',
                      pdf = 'pdf',
                      image = 'image',
                      audio = 'audio',
                      video = 'video',
                      web = 'web',
                      other = 'other'
                    }

                    // Helper to determine document type from mime_type (matching main page)
                    const getDocumentType = (mimeType: string): DocumentType => {
                      if (mimeType.includes('pdf')) return DocumentType.pdf
                      if (mimeType.includes('word') || mimeType.includes('document')) return DocumentType.word
                      if (mimeType.startsWith('image/')) return DocumentType.image
                      if (mimeType.startsWith('audio/')) return DocumentType.audio
                      if (mimeType.startsWith('video/')) return DocumentType.video
                      if (mimeType.includes('html')) return DocumentType.web
                      return DocumentType.other
                    }

                    // Helper to get file type color (matching main page)
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
                          return 'bg-cyan-100 text-cyan-800'
                        default:
                          return 'bg-gray-100 text-gray-800'
                      }
                    }

                    return (
                    <div key={space.id} className="group relative">
                    {editingSpaceId === space.id ? (
                      <div className="flex items-center h-8 px-2  pr-0">
                        <FolderClosed className="h-4 w-4 text-slate-400 flex-shrink-0 ml-0.5" />
                        <Input
                          value={editingSpaceName}
                          onChange={(e) => setEditingSpaceName(e.target.value)}
                          className="h-7 text-sm mx-2"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') handleCancelEdit()
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 mr-1 text-green-600 hover:text-green-700"
                          onClick={handleSaveEdit}
                          disabled={updateSpaceMutation.isPending}
                        >
                          {updateSpaceMutation.isPending ? <Spinner size="sm" className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                      <div className={cn(
                        "w-full h-8 relative group flex items-center px-3 py-2 rounded-md transition-colors cursor-pointer",
                        space.isActive
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                          : "hover:bg-slate-700/50"
                      )}
                      onClick={() => handleSpaceClick(space.id)}
                      >
                        {/* Chevron for expand/collapse */}
                        <button
                          onClick={(e) => toggleSpaceExpansion(space.id, e)}
                          className={cn(
                            "mr-1 h-4 w-4 flex-shrink-0 flex items-center justify-center",
                            space.isActive ? "text-primary-foreground" : "text-slate-400"
                          )}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                        {isExpanded ? (
                          <FolderOpen className={cn(
                            "mr-2 h-4 w-4 flex-shrink-0",
                            space.isActive ? "text-primary-foreground" : "text-slate-400"
                          )} />
                        ) : (
                          <FolderClosed className={cn(
                            "mr-2 h-4 w-4 flex-shrink-0",
                            space.isActive ? "text-primary-foreground" : "text-slate-400"
                          )} />
                        )}
                        <span className={cn(
                          "flex-1 text-left truncate text-sm",
                          space.isActive ? "text-primary-foreground font-medium" : ""
                        )}>
                          {space.name}
                        </span>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className={cn(
                              "h-6 w-6 p-0 flex-shrink-0 rounded hover:cursor-pointer hover:bg-slate-600/50 flex items-center justify-center mr-1",
                              space.isActive
                                ? "text-primary-foreground/60 hover:text-primary-foreground"
                                : "text-slate-400 hover:text-white"
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartEdit(space)
                            }}
                            title="Edit space"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            className={cn(
                              "h-6 w-6 p-0 flex-shrink-0 rounded hover:cursor-pointer hover:bg-red-800/50 flex items-center justify-center",
                              space.isActive
                                ? "text-primary-foreground/60 hover:text-red-400"
                                : "text-slate-400 hover:text-red-400",
                              deleteSpaceMutation.isPending && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!deleteSpaceMutation.isPending) {
                                handleDeleteSpaceClick(space)
                              }
                            }}
                            title="Delete space"
                            disabled={deleteSpaceMutation.isPending}
                          >
                            {deleteSpaceMutation.isPending && deleteSpaceMutation.variables === space.id ? (
                              <Spinner size="sm" className="h-3 w-3" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        <span className={cn(
                          "text-xs w-6 text-right flex-shrink-0 ml-1",
                          space.isActive ? "text-primary-foreground/80" : "text-slate-400"
                        )}>
                          {space.documentCount}
                        </span>
                      </div>

                      {/* Documents list - shown when expanded */}
                      {isExpanded && (
                        <div className="ml-5 mt-1 mb-2 space-y-0.5 border-l border-slate-700 pl-2">
                          {documents.length === 0 ? (
                            <div className="px-2 py-1 text-xs text-slate-400">
                              No documents
                            </div>
                          ) : (
                          <ScrollArea className="max-h-[256px]">
                            <div className="space-y-0.5 pr-2">
                            {documents.slice(0, 8).map((doc) => {
                              const docType = getDocumentType(doc.mime_type)
                              return (
                              <div
                                key={doc.id}
                                className="flex items-center gap-1"
                              >
                                {/* Arrow icon - outside the hover area */}
                                <CornerDownRight className="h-3 w-3 flex-shrink-0 text-slate-600" />

                                {/* Document item */}
                                <div
                                  className={cn(
                                    "flex items-center h-7 px-2 py-1 rounded-md cursor-pointer text-xs transition-colors gap-1.5 flex-1 overflow-hidden",
                                    activeDocId === doc.id
                                      ? "bg-slate-600 text-white"
                                      : "hover:bg-slate-700/30 text-slate-300"
                                  )}
                                  onClick={() => handleDocumentClick(space.id, doc.id)}
                                >
                                  <span
                                    className="block truncate flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                                    title={doc.filename}
                                    style={{ minWidth: 0 }}
                                  >
                                    {doc.filename}
                                  </span>
                                  <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0.5 flex-shrink-0", getFileTypeColor(docType))}>
                                    {docType.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                              )
                            })}
                            </div>
                            {documents.length > 8 && (
                              <div className="px-2 py-1 text-xs text-slate-400 text-center">
                                +{documents.length - 8} more
                              </div>
                            )}
                          </ScrollArea>
                          )}
                        </div>
                      )}
                      </>
                    )}
                  </div>
                    )
                  })
                )}

                {/* Create new space input */}
                {isCreatingSpace && (
                  <div className="flex items-center h-8 px-2 pr-0">
                    <FolderClosed className="h-4 w-4 text-slate-400 flex-shrink-0 ml-0.5" />
                    <Input
                      value={newSpaceName}
                      onChange={(e) => setNewSpaceName(e.target.value)}
                      placeholder="Space name..."
                      className="h-7 text-sm mx-2"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateSpace()
                        if (e.key === 'Escape') handleCancelCreate()
                      }}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 mr-1 text-green-600 hover:text-green-700"
                      onClick={handleCreateSpace}
                      disabled={createSpaceMutation.isPending}
                    >
                      {createSpaceMutation.isPending ? <Spinner size="sm" className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      onClick={handleCancelCreate}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

              </div>
            </div>
          </nav>

          {/* Logout */}
          <div className="border-t border-slate-600 p-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-white hover:text-red-400"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <Spinner size="sm" className="mr-2 h-4 w-4" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Sign Out
            </Button>
          </div>

      {/* Delete Space Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Space</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "<strong>{spaceToDelete?.name}</strong>"?
              This action cannot be undone and will permanently remove the space and all its contents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={deleteSpaceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteSpaceMutation.isPending}
            >
              {deleteSpaceMutation.isPending && deleteSpaceMutation.variables === spaceToDelete?.id ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Space
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}