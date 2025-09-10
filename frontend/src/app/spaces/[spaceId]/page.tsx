'use client'

import { useParams } from 'next/navigation'

export default function SpacePage() {
  const params = useParams()
  const spaceId = params.spaceId as string

  // For now, just display the space name as header
  // Later we'll fetch the actual space data
  const getSpaceName = (id: string) => {
    // Mock data matching the sidebar - in real app this would come from an API
    const spaces = [
      { id: '1', name: 'Work Projects' },
      { id: '2', name: 'Personal Documents' },
      { id: '3', name: 'Team Shared' },
    ]
    return spaces.find(space => space.id === id)?.name || 'Space'
  }

  const spaceName = getSpaceName(spaceId)

  return (
    <div className="p-2 h-full bg-background">
      <div className="bg-white h-full py-6 px-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {spaceName}
          </h1>
          <p className="text-muted-foreground">
            Space ID: {spaceId}
          </p>
        </div>

        {/* Content placeholder */}
        <div className="space-y-4">
          <p>This is the {spaceName} space page.</p>
          <p>Here you'll be able to view and manage documents in this space.</p>
        </div>
      </div>
    </div>
  )
}