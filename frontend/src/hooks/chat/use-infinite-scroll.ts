import { useRef, useEffect, useState, useCallback } from 'react'

interface UseInfiniteScrollOptions {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  threshold?: number
}

interface UseInfiniteScrollReturn {
  scrollAreaRef: React.RefObject<HTMLDivElement | null>
  isLoadingMore: boolean
}

export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  threshold = 100
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const previousScrollHeightRef = useRef(0)

  const handleScroll = useCallback((event: Event) => {
    const target = event.target as HTMLDivElement
    const scrollTop = target.scrollTop

    // Load more when scrolled near top
    if (scrollTop < threshold && hasNextPage && !isFetchingNextPage) {
      setIsLoadingMore(true)
      previousScrollHeightRef.current = target.scrollHeight
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, threshold])

  // Attach scroll listener to viewport
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollContainer) return

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Preserve scroll position when new items are loaded
  useEffect(() => {
    if (!isLoadingMore) return

    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollContainer) return

    const currentScrollHeight = scrollContainer.scrollHeight
    const previousScrollHeight = previousScrollHeightRef.current
    const scrollDiff = currentScrollHeight - previousScrollHeight

    if (scrollDiff > 0) {
      scrollContainer.scrollTop += scrollDiff
    }

    setIsLoadingMore(false)
  }, [isLoadingMore])

  return {
    scrollAreaRef,
    isLoadingMore
  }
}
