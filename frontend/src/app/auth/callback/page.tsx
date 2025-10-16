'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/auth/use-auth'
import { Spinner } from '@/components/ui/spinner'
import { ROUTES } from '@/constants'
import { spacesApi } from '@/lib/api'

export default function CallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const hasProcessed = useRef(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    if (hasProcessed.current) {
      return
    }
    hasProcessed.current = true
    const handleCallback = async () => {
      const error = searchParams.get('error')
      const access_token = searchParams.get('access_token')
      const expires_in = searchParams.get('expires_in')
      const user_id = searchParams.get('user_id')
      const user_email = searchParams.get('user_email')
      const user_name = searchParams.get('user_name')
      const user_picture = searchParams.get('user_picture')

      if (error) {
        router.push(ROUTES.LANDING + '?error=oauth_failed')
        return
      }

      if (!access_token || !user_id || !user_email || !user_name) {
        router.push(ROUTES.LANDING + '?error=missing_params')
        return
      }

      try {
        const authData = {
          access_token,
          token_type: 'bearer',
          expires_in: parseInt(expires_in || '3600'),
          user: {
            id: user_id,
            email: user_email,
            name: decodeURIComponent(user_name),
            picture: user_picture ? decodeURIComponent(user_picture) : undefined,
            created_at: new Date().toISOString()
          }
        }

        login(authData)

        setIsRedirecting(true)

        // Try to get user's first space and redirect there
        try {
          const spacesData = await spacesApi.getSpaces(1, 0)
          if (spacesData.spaces && spacesData.spaces.length > 0) {
            router.push(ROUTES.SPACES(spacesData.spaces[0].id))
          } else {
            // No spaces yet, stay on landing or redirect to a "create first space" page
            router.push(ROUTES.LANDING)
          }
        } catch (err) {
          // If fetching spaces fails, just go to landing
          router.push(ROUTES.LANDING)
        }
      } catch (error) {
        router.push(ROUTES.LANDING + '?error=auth_failed')
      }
    }

    handleCallback()
  }, [searchParams, login, router])

  return (
    <main className="min-h-screen flex items-center justify-center">
        <Spinner />
    </main>
  )
}