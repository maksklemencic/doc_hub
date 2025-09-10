'use client'

import { useAuth } from '@/hooks/use-auth'
import { Sidebar } from '@/components/shared/sidebar'
import { Navbar } from '@/components/shared/navbar'
import { Spinner } from '@/components/ui/spinner'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { usePathname } from 'next/navigation'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

const NO_SIDEBAR_PAGES = ['/login', '/auth/callback']

const DEFAULT_SIDEBAR_SIZE = 15
const MIN_SIDEBAR_SIZE = 12
const MAX_SIDEBAR_SIZE = 25

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()
  
  const shouldShowSidebar = !NO_SIDEBAR_PAGES.includes(pathname)

  if (shouldShowSidebar) {
    return (
      <div className="flex h-screen bg-background">
        <ResizablePanelGroup 
          direction="horizontal" 
          className="h-full"
        >
          <ResizablePanel 
            defaultSize={DEFAULT_SIDEBAR_SIZE} 
            minSize={MIN_SIDEBAR_SIZE} 
            maxSize={MAX_SIDEBAR_SIZE}
            className="min-w-64"
          >
            <Sidebar />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={100 - DEFAULT_SIDEBAR_SIZE}>
            <div className="flex flex-col h-full">
              <Navbar />
              <main className="flex-1 overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner size="lg" />
                  </div>
                ) : (
                  children
                )}
              </main>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
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