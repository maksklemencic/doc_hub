'use client'

import { useAuth } from '@/hooks/auth/use-auth'
import { Sidebar } from '@/components/shared/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROUTES } from '@/constants'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

const PUBLIC_PAGES = ['/auth/callback', '/']

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isPublicPage = PUBLIC_PAGES.includes(pathname)
  const shouldShowSidebar = isAuthenticated && !isPublicPage

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

        {/* Main content area - no navbar, header is in page */}
        <div className="flex-1 flex flex-col min-w-0">
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