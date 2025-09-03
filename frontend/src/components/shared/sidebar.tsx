'use client'

import * as React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { 
  FileText, 
  Folder, 
  LogOut,
  Plus,
  Check,
  X,
  Edit2,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  className?: string
}

interface Space {
  id: string
  name: string
  isActive: boolean
  documentCount: number
}

export function Sidebar({ className }: SidebarProps) {
  const { user, logout } = useAuth()
  
  // Mock data - replace with actual state management/API calls
  const [spaces, setSpaces] = useState<Space[]>([
    { id: '1', name: 'Work Projects', isActive: true, documentCount: 12 },
    { id: '2', name: 'Personal Documents', isActive: false, documentCount: 8 },
    { id: '3', name: 'Team Shared', isActive: false, documentCount: 24 },
  ])
  
  const [isCreatingSpace, setIsCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [editingSpaceName, setEditingSpaceName] = useState('')
  
  const handleCreateSpace = () => {
    if (newSpaceName.trim()) {
      const newSpace: Space = {
        id: Date.now().toString(), // In real app, this would come from API
        name: newSpaceName.trim(),
        isActive: false,
        documentCount: 0
      }
      setSpaces([...spaces, newSpace])
      setNewSpaceName('')
      setIsCreatingSpace(false)
    }
  }
  
  const handleCancelCreate = () => {
    setNewSpaceName('')
    setIsCreatingSpace(false)
  }
  
  const handleStartEdit = (space: Space) => {
    setEditingSpaceId(space.id)
    setEditingSpaceName(space.name)
  }
  
  const handleSaveEdit = () => {
    if (editingSpaceName.trim() && editingSpaceId) {
      setSpaces(spaces.map(space => 
        space.id === editingSpaceId 
          ? { ...space, name: editingSpaceName.trim() }
          : space
      ))
      setEditingSpaceId(null)
      setEditingSpaceName('')
    }
  }
  
  const handleCancelEdit = () => {
    setEditingSpaceId(null)
    setEditingSpaceName('')
  }
  
  const handleSpaceClick = (spaceId: string) => {
    // Set active space
    setSpaces(spaces.map(space => ({
      ...space,
      isActive: space.id === spaceId
    })))
  }

  return (
    <div className={cn(
      'flex h-full w-64 flex-col border-r border-border bg-accent ',
      className
    )}>
      {/* Header */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Doc Hub</span>
        </div>
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
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsCreatingSpace(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="space-y-1">
            {spaces.map((space) => (
              <div key={space.id} className="group relative">
                {editingSpaceId === space.id ? (
                  <div className="flex items-center gap-1 px-2">
                    <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      value={editingSpaceName}
                      onChange={(e) => setEditingSpaceName(e.target.value)}
                      className="h-7 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                      onClick={handleSaveEdit}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant={space.isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start relative group",
                      space.isActive 
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground border-l-4 border-secondary" 
                        : "hover:bg-secondary/20"
                    )}
                    size="sm"
                    onClick={() => handleSpaceClick(space.id)}
                  >
                    <Folder className={cn(
                      "mr-2 h-4 w-4",
                      space.isActive ? "text-primary-foreground" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "flex-1 text-left truncate",
                      space.isActive ? "text-primary-foreground font-medium" : ""
                    )}>
                      {space.name}
                    </span>
                    <span className={cn(
                      "text-xs ml-2",
                      space.isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                      {space.documentCount}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1",
                        space.isActive 
                          ? "text-primary-foreground/60 hover:text-primary-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartEdit(space)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </Button>
                )}
              </div>
            ))}
            
            {/* Create new space input */}
            {isCreatingSpace && (
              <div className="flex items-center gap-1 px-2">
                <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="Space name..."
                  className="h-7 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSpace()
                    if (e.key === 'Escape') handleCancelCreate()
                  }}
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                  onClick={handleCreateSpace}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                  onClick={handleCancelCreate}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground text-sm"
              size="sm"
            >
              <Plus className="mr-2 h-3 w-3" />
              See all spaces
            </Button>
          </div>
        </div>
      </nav>

      {/* User Profile & Logout */}
      <div className="border-t border-border p-4">
        {/* <div className="flex items-center gap-3 mb-3">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div> */}
        
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={() => logout()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}