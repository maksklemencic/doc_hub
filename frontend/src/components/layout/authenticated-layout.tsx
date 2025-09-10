'use client'

import { useAuth } from '@/hooks/use-auth'
import { Sidebar } from '@/components/shared/sidebar'
import { Navbar } from '@/components/shared/navbar'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

const NO_SIDEBAR_PAGES = ['/login', '/auth/callback']

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()
  const [hasMounted, setHasMounted] = useState(false)
  
  useEffect(() => {
    setHasMounted(true)
  }, [])
  
  if (!hasMounted) {
    return <>{children}</>
  }
  
  const shouldShowSidebar = isAuthenticated && !isLoading && !NO_SIDEBAR_PAGES.includes(pathname)

  if (shouldShowSidebar) {
    return (
      <div className="flex h-screen bg-background">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel 
            defaultSize={16} 
            minSize={10} 
            maxSize={25}
            className="min-w-64"
          >
            <Sidebar />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={75}>
            <div className="flex flex-col h-full">
              <Navbar />
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    )
  }

  return <>{children}</>
}