'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { FileText, Sparkles, FolderOpen } from 'lucide-react'
import Image from 'next/image'
import { ROUTES } from '@/constants'
import { spacesApi } from '@/lib/api'

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  // Redirect authenticated users to their first space
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const redirectToSpace = async () => {
        try {
          const spacesData = await spacesApi.getSpaces(1, 0)
          if (spacesData.spaces && spacesData.spaces.length > 0) {
            router.push(ROUTES.SPACES(spacesData.spaces[0].id))
          }
        } catch (err) {
          // If fetching spaces fails, just stay on landing page
          console.error('Failed to fetch spaces:', err)
        }
      }
      redirectToSpace()
    }
  }, [isAuthenticated, isLoading, router])

  const handleGoogleSignIn = () => {
    const loginUrl = `${process.env.NEXT_PUBLIC_API_URL}/auth/login`
    window.location.href = loginUrl
  }

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-white via-secondary/20 to-white overflow-hidden flex flex-col">
      {/* Navbar */}
      <nav className="w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground">DocHub</span>
        </div>
        <Button
          variant="outline"
          onClick={handleGoogleSignIn}
          className="border-primary/30 hover:bg-primary/5"
        >
          Sign In
        </Button>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text */}
          <div className="space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
              <Sparkles className="h-4 w-4" />
              <span>AI-Powered Document Management</span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Organize Your
              <span className="block text-primary mt-2">Documents Smarter</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg">
              Transform how you manage documents with AI assistance. Upload, organize, and extract insights from PDFs, videos, and more—all in one beautifully simple workspace.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                size="lg"
                onClick={handleGoogleSignIn}
                className="text-lg px-8 gap-3 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
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
                Sign in with Google
              </Button>
            </div>

          </div>

          {/* Right Column - App Preview */}
          <div className="relative animate-fade-in lg:block hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 blur-3xl rounded-full" />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">
              <Image
                src="/app-preview.png"
                alt="DocHub Application Preview"
                width={1200}
                height={800}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-16 animate-fade-in">
          <div className="group p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">Smart Spaces</h3>
            </div>
            <p className="text-muted-foreground">
              Organize documents in custom spaces with intelligent categorization
            </p>
          </div>

          <div className="group p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <Sparkles className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">AI Analysis</h3>
            </div>
            <p className="text-muted-foreground">
              Get instant insights and answers from your documents using AI
            </p>
          </div>

          <div className="group p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">Multi-Format</h3>
            </div>
            <p className="text-muted-foreground">
              Support for PDFs, documents, videos, audio files, and more
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
