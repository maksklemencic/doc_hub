'use client'

import { ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/auth-context'

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
        {children}
        <Toaster
          position="bottom-left"
          toastOptions={{
            // Default options for all toasts
            duration: 4000,
            className: '',
            style: {
              background: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 4px 12px hsl(var(--shadow) / 0.15)',
            },
            // Success toasts
            success: {
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--success) / 0.2)',
              },
              iconTheme: {
                primary: '#22c55e', // Green-500
                secondary: '#ffffff',
              },
            },
            // Error toasts
            error: {
              duration: 6000,
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--destructive) / 0.2)',
              },
              iconTheme: {
                primary: '#ef4444', // Red-500
                secondary: '#ffffff',
              },
            },
            // Loading toasts
            loading: {
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--muted-foreground) / 0.2)',
              },
              iconTheme: {
                primary: 'hsl(var(--muted-foreground))',
                secondary: 'hsl(var(--background))',
              },
            },
          }}
          containerStyle={{
            bottom: '80px', // Position above the signout button
            left: '20px',
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}