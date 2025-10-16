'use client'

import { User, Brain, Database, Palette, FileText, Video, Mic, Sparkles, Edit3, Globe, Youtube, Image, LogOut, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileAvatar } from '@/components/ui/profile-avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/hooks/auth/use-auth'
import { useSpacesContext } from '@/contexts/spaces-context'
import { useSpaceDocumentCounts } from '@/hooks/spaces/use-space-document-counts'
import { useSidebar } from '@/contexts/sidebar-context'
import { useSettingsScroll } from '@/hooks/use-settings-scroll'
import { settingsLogger } from '@/utils/logger'
import { useState, useEffect, useRef, useMemo } from 'react'
import { AIModel, LLMData, Space, ThemeMode } from '@/types/settings'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { spaces } = useSpacesContext()
  const { data: documentCounts } = useSpaceDocumentCounts(
    spaces.map(space => space.id)
  )

  // Use global sidebar context for state management
  const { isExpanded } = useSidebar()

  // Calculate menu position based on sidebar state
  const menuLeftPosition = isExpanded ? 'left-64' : 'left-22'

  // Section refs for smooth scrolling
  const profileRef = useRef<HTMLDivElement>(null)
  const aiModelRef = useRef<HTMLDivElement>(null)
  const spacesRef = useRef<HTMLDivElement>(null)
  const appearanceRef = useRef<HTMLDivElement>(null)
  const dangerousRef = useRef<HTMLDivElement>(null)

  // Navigation sections
  const sections = useMemo(() => [
    { id: 'profile', label: 'Personal', ref: profileRef },
    { id: 'ai-model', label: 'AI Model', ref: aiModelRef },
    { id: 'spaces', label: 'Spaces', ref: spacesRef },
    { id: 'appearance', label: 'Appearance', ref: appearanceRef },
    { id: 'dangerous', label: 'Dangerous', ref: dangerousRef }
  ], [profileRef, aiModelRef, spacesRef, appearanceRef, dangerousRef])

  // Use custom hook for scroll detection
  const { activeSection, setActiveSection } = useSettingsScroll(sections)

  // Personal Information state
  const [firstName, setFirstName] = useState(user?.name?.split(' ')[0] || '')
  const [lastName, setLastName] = useState(user?.name?.split(' ').slice(1).join(' ') || '')
  const [email] = useState(user?.email || '')
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Mock LLM data for now - in a real app, this would come from an API
  const [selectedModel, setSelectedModel] = useState('groq-llama-3-70b')
  const [llmData] = useState<LLMData>({
    modelName: 'Groq LLaMA-3 70B',
    rateLimits: {
      requestsPerMinute: 30,
      requestsRemaining: 28,
      tokensPerMinute: 6000,
      tokensRemaining: 4500
    },
    systemPrompt: 'You are a helpful AI assistant that provides accurate and concise answers based on the provided documents. Always cite your sources and be honest about limitations.'
  })

  // Available AI models
  const availableModels: AIModel[] = [
    { value: 'groq-llama-3-70b', label: 'Groq LLaMA-3 70B', provider: 'Groq' },
    { value: 'groq-mixtral-8x7b', label: 'Groq Mixtral 8x7B', provider: 'Groq' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet', provider: 'Anthropic' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'OpenAI' },
  ]

  // Theme settings state
  const [primaryColor, setPrimaryColor] = useState('#3b82f6')
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')

  // Confirmation dialogs state
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false)

  // Error state
  const [saveError, setSaveError] = useState<string | null>(null)

  // Calculate total document size
  const totalDocuments = Object.values(documentCounts || {}).reduce((sum, count) => sum + count, 0)
  const totalSize = '245.3 MB' // Mock data - would calculate from actual documents

  // Handle navigation click
  const scrollToSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId)

    // Update activeSection immediately for immediate visual feedback
    setActiveSection(sectionId)

    if (section?.ref.current) {
      // Use reliable scrollIntoView method
      section.ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }
  }

  // Handle personal information changes
  useEffect(() => {
    const originalFirstName = user?.name?.split(' ')[0] || ''
    const originalLastName = user?.name?.split(' ').slice(1).join(' ') || ''

    const hasNameChanged = firstName !== originalFirstName || lastName !== originalLastName
    setHasChanges(hasNameChanged)
  }, [firstName, lastName, user?.name])

  // Handle save personal information
  const handleSavePersonalInfo = async () => {
    setSaveError(null)
    setIsSaving(true)
    try {
      // In a real app, this would make an API call
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      setHasChanges(false)
    } catch (error) {
      setSaveError('Failed to save personal information. Please try again.')
      settingsLogger.error('Failed to save personal information', error, {
        action: 'savePersonalInfo',
        firstName,
        lastName,
        hasChanges,
        userId: user?.id
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle logout
  const handleLogout = () => {
    setShowLogoutDialog(true)
  }

  // Handle delete account
  const handleDeleteAccount = () => {
    setShowDeleteAccountDialog(true)
  }

  // Confirm logout
  const confirmLogout = () => {
    logout()
  }

  // Confirm delete account
  const confirmDeleteAccount = () => {
    // This would make an API call to delete the account
    settingsLogger.info('Delete account functionality would be implemented here', {
      action: 'deleteAccount',
      userId: user?.id,
      email: user?.email
    })
  }

  
  // Get space icon and color
  const getSpaceIcon = (space: { icon?: string; icon_color?: string }) => {
    if (space.icon) {
      // Try to map space icon to actual icon component
      const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
        'FileText': FileText,
        'Video': Video,
        'Mic': Mic,
        'Sparkles': Sparkles,
        'Edit3': Edit3,
        'Globe': Globe,
        'Youtube': Youtube,
        'Image': Image
      }
      return iconMap[space.icon] || FileText
    }
    return FileText
  }

  const getSpaceColor = (space: { icon_color?: string }) => {
    if (space.icon_color) return space.icon_color
    return 'text-gray-600'
  }

  return (
    <div className="h-full bg-white">
      {/* Floating Navigation Menu */}
      <div className={`fixed w-48 top-30 ${menuLeftPosition} z-10 bg-white p-3 space-y-1 transition-all duration-200 ease-in-out`}>
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border my-3" />
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={`w-full text-left px-4 py-2 text-sm font-medium transition-all duration-200 relative hover:cursor-pointer rounded ${
              activeSection === section.id
                ? 'text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {activeSection === section.id && (
              <div className="absolute left-1 top-0 bottom-0 w-1 bg-primary/70 -translate-x-px" />
            )}
            {section.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <main className="h-full">
          <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto p-8 space-y-16">

              {/* Personal Information Section */}
              <div ref={profileRef} className="space-y-6 mt-12">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold text-foreground">Personal Information</h2>
                </div>

                <div className="space-y-6">
                  <div className="flex items-start space-x-6">
                    <ProfileAvatar user={user} size="lg" />

                    <div className="flex-1 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="First name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Last name"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          value={email}
                          disabled
                          className="bg-muted"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span>Signed in with Google</span>
                      </div>

                      {saveError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-700">{saveError}</p>
                        </div>
                      )}

                      <Button
                        onClick={handleSavePersonalInfo}
                        disabled={!hasChanges || isSaving}
                        className="w-fit"
                      >
                        {isSaving ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Divider */}
              <div className="border-t border-border" />

              {/* AI Model Section */}
              <div ref={aiModelRef} className="space-y-6">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold text-foreground">AI Model Configuration</h2>
                </div>

                <div className="space-y-6">
                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="ai-model">Select AI Model</Label>
                    <p className="text-sm text-muted-foreground">Choose the AI model for your interactions</p>
                    <Combobox
                      options={availableModels.map((model) => ({
                        value: model.value,
                        label: model.label,
                        description: model.provider
                      }))}
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                      placeholder="Select an AI model"
                      emptyText="No AI model found."
                    />
                  </div>

                  {/* Rate Limits */}
                  <div className="space-y-2">
                    <h3 className="font-medium">Rate Limits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Requests</span>
                          <span className="text-sm font-medium">
                            {llmData.rateLimits.requestsRemaining}/{llmData.rateLimits.requestsPerMinute}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${(llmData.rateLimits.requestsRemaining / llmData.rateLimits.requestsPerMinute) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Tokens</span>
                          <span className="text-sm font-medium">
                            {llmData.rateLimits.tokensRemaining.toLocaleString()}/{llmData.rateLimits.tokensPerMinute.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-accent h-2 rounded-full"
                            style={{ width: `${(llmData.rateLimits.tokensRemaining / llmData.rateLimits.tokensPerMinute) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* System Prompt */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">System Prompt</h3>
                      <Button variant="outline" size="sm" disabled>
                        Customize
                      </Button>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {llmData.systemPrompt}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Divider */}
              <div className="border-t border-border" />

              {/* Spaces Section */}
              <div ref={spacesRef} className="space-y-6">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold text-foreground">Spaces Overview</h2>
                </div>

                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{spaces.length}</div>
                      <div className="text-sm text-muted-foreground">Total Spaces</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">{totalDocuments}</div>
                      <div className="text-sm text-muted-foreground">Total Documents</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">{totalSize}</div>
                      <div className="text-sm text-muted-foreground">Total Size</div>
                    </div>
                  </div>

                  {/* Space List */}
                  <div className="space-y-2">
                    <h3 className="font-medium">Space Details</h3>
                    <div className="space-y-2">
                      {spaces.map((space) => {
                        const Icon = getSpaceIcon(space)
                        return (
                          <div key={space.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Icon className={`h-4 w-4 ${getSpaceColor(space)}`} />
                              </div>
                              <div>
                                <div className="font-medium">{space.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {documentCounts?.[space.id] || 0} documents
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {(Math.random() * 50 + 10).toFixed(1)} MB
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ~{Math.floor((Math.random() * 20) + 5)} files
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Divider */}
              <div className="border-t border-border" />

              {/* Appearance Section */}
              <div ref={appearanceRef} className="space-y-6">
                <div className="flex items-center gap-3">
                  <Palette className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
                </div>

                <div className="space-y-6">
                  {/* Primary Color */}
                  <div className="space-y-2">
                    <Label htmlFor="primary-color">Primary Color</Label>
                    <p className="text-sm text-muted-foreground">Choose the primary color for your interface</p>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-2">
                        {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map((color) => (
                          <button
                            key={color}
                            onClick={() => setPrimaryColor(color)}
                            className={`w-8 h-8 rounded-lg border-2 transition-all ${
                              primaryColor === color
                                ? 'border-gray-900'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg border border-gray-300"
                          style={{ backgroundColor: primaryColor }}
                        />
                        <span className="text-sm text-muted-foreground">{primaryColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Theme Mode */}
                  <div className="space-y-2">
                    <Label htmlFor="theme-mode">Theme Mode</Label>
                    <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
                    <Select value={themeMode} onValueChange={(value: 'light' | 'dark' | 'system') => setThemeMode(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select theme mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section Divider */}
              <div className="border-t border-border" />

              {/* Dangerous Section */}
              <div ref={dangerousRef} className="space-y-6">
                <div className="flex items-center gap-3">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  <h2 className="text-xl font-semibold text-red-600">Dangerous Zone</h2>
                </div>

                <Card className="border-red-200">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-red-900">Logout</h3>
                          <p className="text-sm text-red-700">
                            Sign out of your account and return to the login page
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleLogout}
                          className="border-red-300 text-red-700 hover:bg-red-100"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Logout
                        </Button>
                      </div>

                      <div className="border-t border-red-200 pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-red-900">Delete Account</h3>
                            <p className="text-sm text-red-700">
                              Permanently delete your account and all associated data
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeleteAccount}
                            className="border-red-300 text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Extra bottom padding */}
              <div className="h-12" />
            </div>
          </ScrollArea>
        </main>

        {/* Confirmation Dialogs */}
        <ConfirmDialog
          open={showLogoutDialog}
          onOpenChange={setShowLogoutDialog}
          title="Logout"
          description="Are you sure you want to logout? You will need to sign in again to access your account."
          confirmText="Logout"
          cancelText="Cancel"
          onConfirm={confirmLogout}
          icon={LogOut}
          variant="default"
        />

        <ConfirmDialog
          open={showDeleteAccountDialog}
          onOpenChange={setShowDeleteAccountDialog}
          title="Delete Account"
          description="Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted."
          confirmText="Delete Account"
          cancelText="Cancel"
          onConfirm={confirmDeleteAccount}
          icon={Trash2}
          variant="destructive"
        />
    </div>
  )
}