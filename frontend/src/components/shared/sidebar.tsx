'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  User
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
  const router = useRouter()
  const pathname = usePathname()
  
  // Initialize with correct active state based on current URL
  const initializeSpaces = () => {
    const pathMatch = pathname.match(/^\/spaces\/(.+)$/)
    const activeSpaceId = pathMatch ? pathMatch[1] : null
    
    return [
      { id: '1', name: 'Work Projects', isActive: activeSpaceId === '1', documentCount: 12 },
      { id: '2', name: 'Personal Documents', isActive: activeSpaceId === '2', documentCount: 8 },
      { id: '3', name: 'Team Shared', isActive: activeSpaceId === '3', documentCount: 24 },
    ]
  }
  
  const [spaces, setSpaces] = useState<Space[]>(initializeSpaces)
  
  const [isCreatingSpace, setIsCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [editingSpaceName, setEditingSpaceName] = useState('')

  // Update active space based on current URL
  useEffect(() => {
    const pathMatch = pathname.match(/^\/spaces\/(.+)$/)
    const activeSpaceId = pathMatch ? pathMatch[1] : null
    
    setSpaces(prevSpaces => 
      prevSpaces.map(space => ({
        ...space,
        isActive: space.id === activeSpaceId
      }))
    )
  }, [pathname])
  
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
    // Cancel any ongoing space creation
    if (isCreatingSpace) {
      setIsCreatingSpace(false)
      setNewSpaceName('')
    }
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
    // Cancel any ongoing edit
    if (editingSpaceId) {
      setEditingSpaceId(null)
      setEditingSpaceName('')
    }
    
    // Navigate to space page
    router.push(`/spaces/${spaceId}`)
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
                {spaces.map((space) => (
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
                        >
                          <Check className="h-3 w-3" />
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
                        "w-full relative group flex items-center px-3 py-2 rounded-lg transition-colors cursor-pointer",
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
                        <button
                          className={cn(
                            "h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-8 flex-shrink-0 rounded hover:bg-black/10 flex items-center justify-center",
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
                        </button>
                        <span className={cn(
                          "text-xs w-6 text-right flex-shrink-0",
                          space.isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}>
                          {space.documentCount}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                
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
                    >
                      <Check className="h-3 w-3" />
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
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            
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