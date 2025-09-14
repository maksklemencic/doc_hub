'use client'

import * as React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  FolderClosed,
  LogOut,
  Plus,
  Check,
  X,
  Edit2,
  PanelLeftClose,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SpaceResponse } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { useSpaces, useCreateSpace, useUpdateSpace, useDeleteSpace } from '@/hooks/use-spaces'
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

  // UI state
  const [isCreatingSpace, setIsCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [editingSpaceName, setEditingSpaceName] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [spaceToDelete, setSpaceToDelete] = useState<Space | null>(null)

  // Transform spaces data to include UI state
  const pathMatch = pathname.match(/^\/spaces\/(.+)$/)
  const activeSpaceId = pathMatch ? pathMatch[1] : null

  const spaces: Space[] = spacesData.map(space => ({
    ...space,
    isActive: space.id === activeSpaceId,
    documentCount: 0 // TODO: Add document count to API response
  }))
  
  const handleCreateSpace = async () => {
    if (!newSpaceName.trim() || createSpaceMutation.isPending) return

    try {
      await createSpaceMutation.mutateAsync({ name: newSpaceName.trim() })
      setNewSpaceName('')
      setIsCreatingSpace(false)
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
      setEditingSpaceId(null)
      setEditingSpaceName('')
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

    // Find the space to get its name
    const space = spaces.find(s => s.id === spaceId)

    // Navigate to space page with space info in URL params
    const searchParams = new URLSearchParams()
    if (space) {
      searchParams.set('name', space.name)
    }

    router.push(`/spaces/${spaceId}?${searchParams.toString()}`)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    // Small delay to show spinner
    await new Promise(resolve => setTimeout(resolve, 300))
    logout()
  }

  return (
    <div className={cn(
      'flex h-full flex-col border-r border-border bg-background',
      className
    )}>
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-border px-4">
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
          <nav className="flex-1 p-4">
            {/* Spaces Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground px-2">Spaces</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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
              
              <div className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center px-2 py-2">
                    <Spinner size="sm" className="mr-2" />
                    <span className="text-sm text-muted-foreground">Loading spaces...</span>
                  </div>
                ) : spaces.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    No spaces yet
                  </div>
                ) : (
                  spaces.map((space) => (
                    <div key={space.id} className="group h-8 relative">
                    {editingSpaceId === space.id ? (
                      <div className="flex items-center h-8 px-2  pr-0">
                        <FolderClosed className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-0.5" />
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
                      <div className={cn(
                        "w-full h-8 relative group flex items-center px-3 py-2 rounded-lg transition-colors cursor-pointer",
                        space.isActive 
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                          : "hover:bg-secondary/20"
                      )}
                      onClick={() => handleSpaceClick(space.id)}
                      >
                        <FolderClosed className={cn(
                          "mr-2 h-4 w-4 flex-shrink-0",
                          space.isActive ? "text-primary-foreground" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "flex-1 text-left truncate text-sm",
                          space.isActive ? "text-primary-foreground font-medium" : ""
                        )}>
                          {space.name}
                        </span>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className={cn(
                              "h-6 w-6 p-0 flex-shrink-0 rounded hover:cursor-pointer hover:bg-black/10 flex items-center justify-center mr-1",
                              space.isActive
                                ? "text-primary-foreground/60 hover:text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
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
                              "h-6 w-6 p-0 flex-shrink-0 rounded hover:cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20 flex items-center justify-center",
                              space.isActive
                                ? "text-primary-foreground/60 hover:text-red-400"
                                : "text-muted-foreground hover:text-red-600 dark:hover:text-red-400",
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
                          space.isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}>
                          {space.documentCount}
                        </span>
                      </div>
                    )}
                  </div>
                  ))
                )}

                {/* Create new space input */}
                {isCreatingSpace && (
                  <div className="flex items-center h-8 px-2 pr-0">
                    <FolderClosed className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-0.5" />
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

                {!isLoading && spaces.length > 0 && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground text-sm"
                    size="sm"
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    See all spaces
                  </Button>
                )}
              </div>
            </div>
          </nav>

          {/* Logout */}
          <div className="border-t border-border p-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-destructive"
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