'use client'

import { useAuth } from '@/hooks/use-auth'
import { usePathname } from 'next/navigation'
import { useNavbar } from '@/contexts/navbar-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FileText, User } from 'lucide-react'

interface NavbarProps {
  title?: string
}

export function Navbar({ title: propTitle }: NavbarProps) {
  const { user } = useAuth()
  const pathname = usePathname()
  const { title: contextTitle } = useNavbar()
  
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

  const getPageTitle = () => {
    // Priority: prop title > context title > pathname-based default
    if (propTitle) return propTitle
    if (contextTitle) return contextTitle

    // Default fallback based on pathname
    if (pathname.startsWith('/spaces/') && pathname.includes('/documents/')) {
      return 'Document Viewer'
    }
    if (pathname.startsWith('/spaces/')) {
      return 'Space'
    }
    return 'Documents'
  }

  return (
    <nav className="bg-background h-16 flex items-center px-2">
      <div className="bg-gradient-to-r from-slate-700 to-primary h-12 w-full rounded-lg flex items-center justify-between px-6">
        {/* Page Title */}
        <h1 className="text-xl font-semibold text-primary-foreground">
          {getPageTitle()}
        </h1>
        
        {/* User Info */}
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white">
              {user.name || user.email}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
              <AvatarFallback className="bg-white/20 text-white text-sm font-medium">
                {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
    </nav>
  )
}