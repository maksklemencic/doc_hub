'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants'

export default function Home() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN)
    }
  }, [isAuthenticated, isLoading, router])

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Show authenticated home page
  if (isAuthenticated && user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome to Doc Hub</CardTitle>
            <p className="text-muted-foreground">
              Hello, {user.name}!
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>Email:</strong> {user.email}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>User ID:</strong> {user.id}
              </p>
            </div>
            <div className="space-y-2">
              <Button className="w-full" disabled>
                Go to Dashboard (Coming Soon)
              </Button>
              <Button variant="outline" className="w-full" onClick={logout}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  // If not authenticated, show redirecting (this should rarely be seen due to useEffect redirect)
  return (
    <main className="min-h-screen flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-muted-foreground">Redirecting to login...</p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}