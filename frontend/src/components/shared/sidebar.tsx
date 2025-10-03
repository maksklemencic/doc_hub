'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/hooks/use-auth'
import { useRouter, usePathname } from 'next/navigation'
import {
  FileText,
  Video,
  Mic,
  Sparkles,
  Plus,
  Check,
  X,
  Edit2,
  Trash2,
  Settings,
  PanelLeftClose,
  PanelLeft,
  MoreVertical,
  ImageIcon
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { useSpaces, useCreateSpace, useUpdateSpace, useDeleteSpace } from '@/hooks/use-spaces'
import { useSpaceDocumentCounts } from '@/hooks/use-space-document-counts'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SidebarProps {
  className?: string
}

// Icon and color mapping for different space types
const spaceIconColors = [
  { icon: FileText, color: 'text-teal-600 bg-teal-50' },
  { icon: Video, color: 'text-purple-600 bg-purple-50' },
  { icon: Mic, color: 'text-blue-600 bg-blue-50' },
  { icon: Sparkles, color: 'text-amber-600 bg-amber-50' },
]

const STORAGE_KEY = 'sidebar-pinned'

export function Sidebar({ className }: SidebarProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Sidebar state - pinned or collapsed
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'true'
  })

  // TanStack Query hooks
  const { data: spacesData = [], isLoading } = useSpaces()
  const createSpaceMutation = useCreateSpace()
  const updateSpaceMutation = useUpdateSpace()
  const deleteSpaceMutation = useDeleteSpace()

  // UI state
  const [isCreatingSpace, setIsCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [editingSpaceName, setEditingSpaceName] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [spaceToDelete, setSpaceToDelete] = useState<any>(null)

  // Save pinned state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, isPinned.toString())
    }
  }, [isPinned])

  const togglePinned = () => {
    setIsPinned(prev => !prev)
  }

  // Determine if sidebar should be expanded (only when pinned)
  const isExpanded = isPinned

  // Get document counts for all spaces
  const spaceIds = spacesData.map(space => space.id)
  const { data: documentCounts = {} } = useSpaceDocumentCounts(spaceIds)

  // Determine active space
  const pathMatch = pathname.match(/^\/spaces\/([^/]+)/)
  const activeSpaceId = pathMatch ? pathMatch[1] : null

  const spaces = spacesData.map((space, index) => ({
    ...space,
    isActive: space.id === activeSpaceId,
    documentCount: documentCounts[space.id] || 0,
    iconConfig: spaceIconColors[index % spaceIconColors.length]
  }))

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim() || createSpaceMutation.isPending) return

    try {
      const newSpace = await createSpaceMutation.mutateAsync({ name: newSpaceName.trim() })
      setNewSpaceName('')
      setIsCreatingSpace(false)
      if (newSpace?.id) {
        router.push(`/spaces/${newSpace.id}`)
      }
    } catch (error) {
      console.error('Failed to create space:', error)
    }
  }

  const handleStartEdit = (space: any) => {
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
      setEditingSpaceId(null)
      setEditingSpaceName('')
    } catch (error) {
      console.error('Failed to update space:', error)
    }
  }

  const handleDeleteSpaceClick = (space: any) => {
    setSpaceToDelete(space)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!spaceToDelete) return

    try {
      await deleteSpaceMutation.mutateAsync(spaceToDelete.id)
      if (activeSpaceId === spaceToDelete.id) {
        router.push('/')
      }
      setDeleteDialogOpen(false)
      setSpaceToDelete(null)
    } catch (error) {
      console.error('Failed to delete space:', error)
    }
  }

  const handleSpaceClick = (spaceId: string) => {
    if (editingSpaceId) {
      setEditingSpaceId(null)
      setEditingSpaceName('')
    }
    router.push(`/spaces/${spaceId}`)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    logout()
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-background border-r border-border transition-all duration-200',
        isExpanded ? 'w-[240px]' : 'w-[64px]',
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex h-14 items-center border-b border-border",
        isExpanded ? "justify-between px-4" : "justify-center px-2"
      )}>
        {isExpanded && <h2 className="text-sm font-semibold text-foreground">Spaces</h2>}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={togglePinned}
          title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
        >
          {isPinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Spaces List */}
      <ScrollArea className="flex-1">
        <TooltipProvider delayDuration={300}>
          <div>
            {/* Create space button - first item with tab height */}
            {!isLoading && (
              !isExpanded ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "group flex items-center cursor-pointer transition-all duration-200 h-10 hover:bg-muted justify-center"
                      )}
                      onClick={() => {
                        if (editingSpaceId) {
                          setEditingSpaceId(null)
                          setEditingSpaceName('')
                        }
                        setIsCreatingSpace(true)
                      }}
                    >
                      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Create Space</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div
                  className={cn(
                    "group flex items-center cursor-pointer transition-all duration-200 h-10 hover:bg-muted gap-3 px-3"
                  )}
                  onClick={() => {
                    if (editingSpaceId) {
                      setEditingSpaceId(null)
                      setEditingSpaceName('')
                    }
                    setIsCreatingSpace(true)
                  }}
                >
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Create Space</span>
                </div>
              )
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : spaces.length === 0 && !isCreatingSpace ? (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                No spaces yet
              </div>
            ) : (
              spaces.map((space) => {
              const IconComponent = space.iconConfig.icon

              if (editingSpaceId === space.id) {
                return (
                  <div key={space.id} className="flex items-center gap-1 px-1 py-1">
                    <Input
                      value={editingSpaceName}
                      onChange={(e) => setEditingSpaceName(e.target.value)}
                      className="h-9 text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') {
                          setEditingSpaceId(null)
                          setEditingSpaceName('')
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={handleSaveEdit}
                      disabled={updateSpaceMutation.isPending}
                    >
                      {updateSpaceMutation.isPending ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setEditingSpaceId(null)
                        setEditingSpaceName('')
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              }

              const spaceContent = (
                <div
                  key={space.id}
                  className={cn(
                    "group relative flex items-center cursor-pointer transition-all duration-200 h-[56px]",
                    isExpanded ? "gap-3 px-3" : "justify-center",
                    space.isActive
                      ? "bg-teal-50 text-teal-900 border-l-2 border-teal-600"
                      : "hover:bg-muted text-foreground"
                  )}
                  onClick={() => handleSpaceClick(space.id)}
                >
                  {/* Icon - no background, just the icon */}
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    <IconComponent className={cn(
                      "w-4 h-4 transition-none",
                      space.iconConfig.color.split(' ')[0]
                    )} />
                  </div>

                  {/* Space name and count - only visible when expanded */}
                  {isExpanded && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          space.isActive ? "text-teal-900" : "text-foreground"
                        )}>
                          {space.name}
                        </p>
                        <p className={cn(
                          "text-xs",
                          space.isActive ? "text-teal-600" : "text-muted-foreground"
                        )}>
                          {space.documentCount} documents
                        </p>
                      </div>

                      {/* Dots menu - shown on hover */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                            title="Space actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-52">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartEdit(space)
                            }}
                            className="focus:bg-teal-50 focus:text-teal-900"
                          >
                            <Edit2 className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                            className="focus:bg-teal-50 focus:text-teal-900"
                          >
                            <ImageIcon className="mr-2 h-4 w-4" />
                            Change Icon
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteSpaceClick(space)
                            }}
                            className="text-destructive focus:bg-red-50 focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Space
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              )

              const contextMenuContent = (
                <ContextMenu key={space.id}>
                  <ContextMenuTrigger asChild>
                    {spaceContent}
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    <ContextMenuItem
                      onClick={() => handleStartEdit(space)}
                      className="focus:bg-teal-50 focus:text-teal-900"
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                      }}
                      className="focus:bg-teal-50 focus:text-teal-900"
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Change Icon
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => handleDeleteSpaceClick(space)}
                      className="text-destructive focus:bg-red-50 focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Space
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )

              // Wrap with tooltip when collapsed
              if (!isExpanded) {
                return (
                  <Tooltip key={space.id}>
                    <TooltipTrigger asChild>
                      {contextMenuContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover text-popover-foreground">
                      <div>
                        <p className="font-medium">{space.name}</p>
                        <p className="text-xs text-muted-foreground">{space.documentCount} documents</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return contextMenuContent
            })
          )}

          {/* Create new space input - only when expanded */}
          {isCreatingSpace && isExpanded && (
            <div className="flex items-center gap-1 px-1 py-1">
              <Input
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Space name..."
                className="h-9 text-sm flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSpace()
                  if (e.key === 'Escape') {
                    setIsCreatingSpace(false)
                    setNewSpaceName('')
                  }
                }}
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={handleCreateSpace}
                disabled={createSpaceMutation.isPending}
              >
                {createSpaceMutation.isPending ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  setIsCreatingSpace(false)
                  setNewSpaceName('')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          </div>
        </TooltipProvider>
      </ScrollArea>

      {/* Settings at bottom */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full text-foreground hover:text-foreground hover:bg-muted",
            isExpanded ? "justify-start" : "justify-center p-2"
          )}
          onClick={handleLogout}
          disabled={isLoggingOut}
          title={!isExpanded ? "Settings" : undefined}
        >
          {isLoggingOut ? (
            <Spinner size="sm" className={cn(isExpanded && "mr-2")} />
          ) : (
            <Settings className={cn("h-4 w-4", isExpanded && "mr-2")} />
          )}
          {isExpanded && "Settings"}
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
              onClick={() => {
                setDeleteDialogOpen(false)
                setSpaceToDelete(null)
              }}
              disabled={deleteSpaceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteSpaceMutation.isPending}
            >
              {deleteSpaceMutation.isPending ? (
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
