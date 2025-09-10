'use client'

import { useAuth } from '@/hooks/use-auth'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { FileText } from 'lucide-react'

interface NavbarProps {
  title?: string
}

export function Navbar({ title }: NavbarProps) {
  const { user } = useAuth()
  const pathname = usePathname()
  
  // Get page title based on pathname if not provided
  // const getPageTitle = () => {
  //   if (title) return title
    
  //   switch (pathname) {
  //     case '/':
  //       return 'Dashboard'
  //     case '/spaces':
  //       return 'Spaces'
  //     case '/documents':
  //       return 'Documents'
  //     case '/settings':
  //       return 'Settings'
  //     default:
  //       if (pathname.startsWith('/spaces/')) {
  //         return 'Space'
  //       }
  //       return 'Doc Hub'
  //   }
  // }

  return (
    <nav className="bg-background h-16 flex items-center px-2">
      <div className="bg-gradient-to-r from-gray-300 to-primary h-12 w-full rounded-lg flex items-center justify-between px-6">
        {/* Page Title */}
        <h1 className="text-xl font-semibold text-secondary-foreground">
          Documents
        </h1>
        
        {/* User Info */}
        {user && (
          <div className="flex items-center gap-3">
            {user.picture ? (
              <Image
                src={user.picture}
                alt={user.name || 'User'}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            <span className="text-sm font-medium text-white">
              {user.name || user.email}
            </span>
          </div>
        )}
      </div>
    </nav>
  )
}