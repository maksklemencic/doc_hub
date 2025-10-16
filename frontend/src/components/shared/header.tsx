'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Grid3X3, List, Plus, User, ChevronRight, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { memo } from 'react'
import { useAuth } from '@/hooks/auth/use-auth'
import { ProfileAvatar } from '@/components/ui/profile-avatar'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/constants'

interface HeaderProps {
  spaceName?: string
  documentName?: string
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  onUploadClick?: () => void
  onLogout?: () => void
  isSettingsPage?: boolean
}

export const Header = memo(function Header({
  spaceName,
  documentName,
  viewMode = 'grid',
  onViewModeChange,
  onUploadClick,
  onLogout,
  isSettingsPage = false
}: HeaderProps) {
  const isDocumentsView = !documentName && !isSettingsPage
  const { user } = useAuth()
  const router = useRouter()

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isSettingsPage ? (
          <div className="flex items-center gap-3">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground text-sm">Settings</span>
          </div>
        ) : (
          <>
            <span className="font-medium text-foreground">{spaceName}</span>
            {documentName && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span>{documentName}</span>
              </>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {isDocumentsView && onViewModeChange && onUploadClick && (
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
            <Button variant="ghost" size="icon" className=" ml-4 rounded-full h-9 w-9 p-0">
              <ProfileAvatar user={user} size="md" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isSettingsPage && (
              <DropdownMenuItem onClick={() => router.push(ROUTES.SETTINGS)} className="focus:bg-teal-50 focus:text-teal-900">
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </DropdownMenuItem>
            )}
            {onLogout && (
              <>
                {!isSettingsPage && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={onLogout} className="focus:bg-teal-50 focus:text-teal-900">
                  Logout
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
})
