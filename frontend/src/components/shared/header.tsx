'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Grid3X3, List, Plus, User, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  spaceName: string
  documentName?: string
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onUploadClick: () => void
  onLogout?: () => void
}

export function Header({
  spaceName,
  documentName,
  viewMode,
  onViewModeChange,
  onUploadClick,
  onLogout
}: HeaderProps) {
  const isDocumentsView = !documentName

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{spaceName}</span>
        {documentName && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span>{documentName}</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isDocumentsView && (
          <>
            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  viewMode === 'grid'
                    ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    : "hover:bg-teal-50 hover:text-teal-900"
                )}
                onClick={() => onViewModeChange('grid')}
                title="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  viewMode === 'list'
                    ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    : "hover:bg-teal-50 hover:text-teal-900"
                )}
                onClick={() => onViewModeChange('list')}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Upload button */}
            <Button onClick={onUploadClick}>
              <Plus className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </>
        )}

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="focus:bg-teal-50 focus:text-teal-900">Profile</DropdownMenuItem>
            <DropdownMenuItem className="focus:bg-teal-50 focus:text-teal-900">Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="focus:bg-teal-50 focus:text-teal-900">Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
