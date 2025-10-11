'use client'

import { ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/auth-context'
import { SpacesProvider } from '@/contexts/spaces-context'
import { PaneWidthProvider } from '@/contexts/pane-width-context'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  // Create QueryClient instance with optimized settings
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache data for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Keep data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Refetch on window focus
            refetchOnWindowFocus: true,
            // Retry failed requests 3 times
            retry: 3,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SpacesProvider>
          <PaneWidthProvider>
            {children}
          </PaneWidthProvider>
        </SpacesProvider>
        <Toaster
          position="top-right"
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
