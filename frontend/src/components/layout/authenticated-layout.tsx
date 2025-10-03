'use client'

import { useAuth } from '@/hooks/use-auth'
import { Sidebar } from '@/components/shared/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { usePathname } from 'next/navigation'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

const NO_SIDEBAR_PAGES = ['/login', '/auth/callback']

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()

  const shouldShowSidebar = !NO_SIDEBAR_PAGES.includes(pathname)

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

  return <>{children}</>
}