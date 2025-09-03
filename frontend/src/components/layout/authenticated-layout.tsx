'use client'

import { useAuth } from '@/hooks/use-auth'
import { Sidebar } from '@/components/shared/sidebar'
import { Navbar } from '@/components/shared/navbar'
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
        <Sidebar />
        <div className="flex flex-col flex-1">
          <Navbar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return <>{children}</>
}