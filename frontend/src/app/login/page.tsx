'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ROUTES } from '@/constants'
import type { GoogleOneTapCredentialResponse, GoogleOneTapNotification } from '@/types/google'

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const router = useRouter()
  const oneTapInitialized = useRef(false)
  const [devModeBypass, setDevModeBypass] = useState(false)
  
  // Check if we're in dev mode with auth bypass (client-side only)
  useEffect(() => {
    setDevModeBypass(process.env.NEXT_PUBLIC_DEV_MODE_BYPASS_AUTH === 'true')
  }, [])

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(ROUTES.HOME)
    }
  }, [isAuthenticated, isLoading, router])

  // Initialize Google One Tap
  useEffect(() => {
    if (oneTapInitialized.current || isAuthenticated || isLoading) return

    const initializeGoogleOneTap = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        console.log('Initializing Google One Tap...')
        
        // Cancel any existing prompts and reset state
        try {
          window.google.accounts.id.cancel()
        } catch (e) {
          console.log('No existing One Tap to cancel')
        }
        
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '857769039470-qsvau0fmapps8ef132q5rra9cnvfltmb.apps.googleusercontent.com',
          callback: handleGoogleOneTapResponse,
          auto_select: false,
          cancel_on_tap_outside: false,
        })

        oneTapInitialized.current = true
      } else {
        console.log('Google One Tap API not loaded yet')
      }
    }

    // Load Google One Tap script
    if (!document.getElementById('google-one-tap-script')) {
      const script = document.createElement('script')
      script.id = 'google-one-tap-script'
      script.src = 'https://accounts.google.com/gsi/client'
      script.onload = initializeGoogleOneTap
      document.head.appendChild(script)
    } else {
      initializeGoogleOneTap()
    }
  }, [isAuthenticated, isLoading])

  const handleGoogleOneTapResponse = (response: GoogleOneTapCredentialResponse) => {
    handleGoogleLogin()
  }

  const handleGoogleLogin = () => {
    const loginUrl = `${process.env.NEXT_PUBLIC_API_URL}/auth/login`
    window.location.href = loginUrl
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Doc Hub</CardTitle>
          <p className="text-muted-foreground">
            Sign in to access your documents and spaces
          </p>
          {devModeBypass && (
            <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
              <p className="text-sm text-yellow-800 font-medium">
                🔧 Development Mode Active
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Authentication bypass enabled - you'll be automatically signed in
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleGoogleLogin}
            className="w-full mb-4"
            size="lg"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path 
                fill="currentColor" 
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path 
                fill="currentColor" 
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path 
                fill="currentColor" 
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path 
                fill="currentColor" 
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}