'use client'

import { useAuth } from '@/hooks/auth/use-auth'
import { Sidebar } from '@/components/shared/sidebar'
import { Header } from '@/components/shared/header'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DocumentUpload } from '@/components/shared/document-upload'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ROUTES } from '@/constants'
import { useSpacesContext } from '@/contexts/spaces-context'
import { useLayoutContext } from '@/contexts/layout-context'
import { LogOut } from 'lucide-react'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  onUploadClick?: () => void
}

const PUBLIC_PAGES = ['/auth/callback', '/']

export function AuthenticatedLayout({
  children,
  viewMode: propViewMode,
  onViewModeChange: propOnViewModeChange,
  onUploadClick: propOnUploadClick
}: AuthenticatedLayoutProps) {
  const { isAuthenticated, isLoading, logout } = useAuth()
  const { getSpaceById } = useSpacesContext()
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()

  // Logout confirmation state
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  const isPublicPage = PUBLIC_PAGES.includes(pathname)
  const isSettingsPage = pathname === ROUTES.SETTINGS
  const shouldShowSidebar = isAuthenticated && !isPublicPage

  // Handle logout with confirmation
  const handleLogout = () => {
    setShowLogoutDialog(true)
  }

  const confirmLogout = () => {
    logout()
  }

  // Extract space information for space pages
  const pathMatch = pathname.match(/^\/spaces\/([^/]+)/)
  const spaceId = pathMatch?.[1] || (params?.spaceId as string)
  const space = spaceId ? getSpaceById(spaceId) : null
  const spaceName = space?.name || 'Space'

  // Use layout context for global state management
  const { getViewMode, setViewMode } = useLayoutContext()
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  // Determine which props to use (passed props or auto-detected for space pages)
  const viewMode = propViewMode || (spaceId ? getViewMode(spaceId) : 'grid')
  const onViewModeChange = propOnViewModeChange || (spaceId ? (mode: 'grid' | 'list') => setViewMode(spaceId, mode) : undefined)
  const onUploadClick = propOnUploadClick || (() => setIsUploadOpen(true))

  // Redirect unauthenticated users to landing page for protected routes
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicPage) {
      router.push(ROUTES.LANDING)
    }
  }, [isAuthenticated, isLoading, isPublicPage, router])

  if (shouldShowSidebar) {
    return (
      <div className="flex h-screen bg-background min-w-0">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <Header
            spaceName={!isSettingsPage ? spaceName : undefined}
            isSettingsPage={isSettingsPage}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            onUploadClick={onUploadClick}
            onLogout={handleLogout}
          />

          <main className="flex-1 overflow-auto min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Spinner size="lg" />
              </div>
            ) : (
              children
            )}
          </main>
        </div>

        {/* Logout Confirmation Dialog */}
        <ConfirmDialog
          open={showLogoutDialog}
          onOpenChange={setShowLogoutDialog}
          title="Logout"
          description="Are you sure you want to logout? You will need to sign in again to access your account."
          confirmText="Logout"
          cancelText="Cancel"
          onConfirm={confirmLogout}
          icon={LogOut}
          variant="default"
        />

        {/* Document Upload Dialog for space pages */}
        {spaceId && (
          <DocumentUpload
            open={isUploadOpen}
            onOpenChange={setIsUploadOpen}
            spaceId={spaceId}
          />
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // For public pages (landing, auth callback), render without sidebar
  if (isPublicPage) {
    return <>{children}</>
  }

  // For protected pages when not authenticated, show loading while redirecting
  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner size="lg" />
    </div>
  )
}