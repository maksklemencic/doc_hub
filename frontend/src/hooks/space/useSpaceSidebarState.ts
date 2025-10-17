import { useMemo } from 'react'
import { useSpaces } from '@/hooks/spaces/use-spaces'
import { useSpaceDocumentCounts } from '@/hooks/spaces/use-space-document-counts'
import { usePathname } from 'next/navigation'

export function useSpaceSidebarState() {
  const pathname = usePathname()

  // TanStack Query hooks
  const { data: spacesData = [], isLoading } = useSpaces()

  // Determine active space
  const pathMatch = pathname.match(/^\/spaces\/([^/]+)/)
  const activeSpaceId = pathMatch ? pathMatch[1] : null

  // Get document counts for all spaces (exclude temporary IDs from optimistic updates)
  const spaceIds = spacesData.filter(space => !space.id.startsWith('temp-')).map(space => space.id)
  const { data: documentCounts = {} } = useSpaceDocumentCounts(spaceIds)

  // Sort spaces by display_order (nulls last) and map to include extra props
  const spaces = useMemo(() => {
    return [...spacesData]
      .sort((a, b) => {
        if (a.display_order === null && b.display_order === null) return 0
        if (a.display_order === null) return 1
        if (b.display_order === null) return -1
        return (a.display_order ?? 0) - (b.display_order ?? 0)
      })
      .map((space) => ({
        ...space,
        isActive: space.id === activeSpaceId,
        documentCount: documentCounts[space.id] || 0,
      }))
  }, [spacesData, activeSpaceId, documentCounts])

  return {
    spaces,
    isLoading,
    activeSpaceId,
    totalSpaces: spaces.length,
  }
}