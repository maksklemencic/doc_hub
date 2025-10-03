'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Spinner } from '@/components/ui/spinner'
import { ROUTES } from '@/constants'

export default function CallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const hasProcessed = useRef(false)

  useEffect(() => {
    if (hasProcessed.current) {
      return
    }
    hasProcessed.current = true
    const handleCallback = () => {
      const error = searchParams.get('error')
      const access_token = searchParams.get('access_token')
      const expires_in = searchParams.get('expires_in')
      const user_id = searchParams.get('user_id')
      const user_email = searchParams.get('user_email')
      const user_name = searchParams.get('user_name')

      if (error) {
        router.push(ROUTES.LOGIN + '?error=oauth_failed')
        return
      }

      if (!access_token || !user_id || !user_email || !user_name) {
        router.push(ROUTES.LOGIN + '?error=missing_params')
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
            created_at: new Date().toISOString()
          }
        }

        login(authData)

        router.push(ROUTES.HOME)
      } catch (error) {
        router.push(ROUTES.LOGIN + '?error=auth_failed')
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