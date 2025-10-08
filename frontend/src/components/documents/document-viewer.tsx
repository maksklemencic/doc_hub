'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Plus, Minus, ArrowUpDown, FileText } from 'lucide-react'
import { documentsApi } from '@/lib/api'
import { SpaceStorage } from '@/utils/localStorage'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import Image from 'next/image'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DocumentViewerProps {
  documentId: string
  filename: string
  mimeType?: string
  zoomState?: { scale: number; isFitToWidth: boolean }
  onZoomStateChange?: (state: { scale: number; isFitToWidth: boolean }) => void
}

export function DocumentViewer({
  documentId,
  filename,
  mimeType,
  zoomState,
  onZoomStateChange
}: DocumentViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [docType, setDocType] = useState<string>('pdf')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(zoomState?.scale ?? 1.0)
  const [isFitToWidth, setIsFitToWidth] = useState<boolean>(zoomState?.isFitToWidth ?? true)
  const [containerWidth, setContainerWidth] = useState<number>(600)
  const [manualZoomInput, setManualZoomInput] = useState<string>(
    zoomState ? (zoomState.isFitToWidth ? 'Fit' : Math.round(zoomState.scale * 100).toString()) : 'Fit'
  )
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const contentContainerRef = useRef<HTMLDivElement>(null)
  const onZoomStateChangeRef = useRef(onZoomStateChange)

  // Keep ref up to date
  useEffect(() => {
    onZoomStateChangeRef.current = onZoomStateChange
  }, [onZoomStateChange])

  // Load zoom state from localStorage on mount
  useEffect(() => {
    const storedZoom = SpaceStorage.get<{ scale: number; isFitToWidth: boolean }>(documentId, 'zoom')
    if (storedZoom && !zoomState) { // Only use stored zoom if no explicit zoomState prop
      setScale(storedZoom.scale)
      setIsFitToWidth(storedZoom.isFitToWidth)
      setManualZoomInput(storedZoom.isFitToWidth ? 'Fit' : Math.round(storedZoom.scale * 100).toString())
    }
  }, [documentId, zoomState])

  // Debounced save to localStorage
  const debouncedSaveZoom = useMemo(
    () => {
      let timeoutId: NodeJS.Timeout
      return () => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          const zoomData = { scale, isFitToWidth }
          SpaceStorage.set(documentId, 'zoom', zoomData)
        }, 300)
      }
    },
    [documentId, scale, isFitToWidth]
  )

  // Save zoom changes to localStorage (only when not using explicit zoomState prop)
  useEffect(() => {
    if (!zoomState) {
      debouncedSaveZoom()
    }
  }, [scale, isFitToWidth, zoomState, debouncedSaveZoom])

  // Track container width with ResizeObserver - run after pdfUrl loads
  useEffect(() => {
    if (!pdfUrl) return

    const container = contentContainerRef.current
    if (!container) return

    const updateWidth = () => {
      const width = container.offsetWidth
      setContainerWidth(width)
    }

    // Initial measurement with RAF to ensure layout is done
    requestAnimationFrame(() => {
      updateWidth()
      requestAnimationFrame(updateWidth)
    })

    const resizeObserver = new ResizeObserver(() => {
      updateWidth()
    })

    resizeObserver.observe(container)
    let parent = container.parentElement
    let depth = 0
    while (parent && depth < 5) {
      resizeObserver.observe(parent)
      parent = parent.parentElement
      depth++
    }

    // Fallback: poll for width changes
    let lastKnownWidth = container.offsetWidth
    const pollInterval = setInterval(() => {
      const currentWidth = container.offsetWidth
      if (currentWidth !== lastKnownWidth) {
        lastKnownWidth = currentWidth
        updateWidth()
      }
    }, 200)

    return () => {
      resizeObserver.disconnect()
      clearInterval(pollInterval)
    }
  }, [pdfUrl])

  // Persist zoom state changes
  useEffect(() => {
    if (onZoomStateChangeRef.current) {
      onZoomStateChangeRef.current({ scale, isFitToWidth })
    }
  }, [scale, isFitToWidth])

  // Handle wheel zoom (Ctrl/Cmd + scroll) for both PDFs and images
  useEffect(() => {
    if (!pdfUrl) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
        const delta = e.deltaY
        const zoomChange = delta > 0 ? -0.1 : 0.1
        setScale((prev) => {
          const newScale = Math.min(5.0, Math.max(0.5, prev + zoomChange))
          setManualZoomInput(Math.round(newScale * 100).toString())
          return newScale
        })
        setIsFitToWidth(false)
      }
    }

    const container = contentContainerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel as any, { passive: false })
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel as any)
      }
    }
  }, [pdfUrl])

  useEffect(() => {
    let mounted = true
    let currentUrl: string | null = null

    const loadDocument = async () => {
      setIsLoading(true)
      setError(null)

      // Check if document type is supported for preview
      const unsupportedTypes = ['text/youtube', 'audio/', 'video/', 'html']
      const isUnsupported = unsupportedTypes.some(type => mimeType?.includes(type))

      if (isUnsupported) {
        if (mounted) {
          setIsLoading(false)
          setDocType('unsupported')
        }
        return
      }

      try {
        const result = await documentsApi.getDocumentFile(documentId)
        currentUrl = result.url

        if (mounted) {
          setPdfUrl(result.url)
          setDocType(result.docType)
        } else {
          URL.revokeObjectURL(result.url)
        }
      } catch (err: any) {
        console.error('Failed to load document:', err)
        if (mounted) {
          setError('Failed to load document')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadDocument()

    return () => {
      mounted = false
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [documentId, mimeType])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  // Helper function to adjust zoom level
  const adjustZoom = (delta: number) => {
    if (isFitToWidth) {
      const newScale = 1.0 + delta
      setScale(newScale)
      setManualZoomInput(Math.round(newScale * 100).toString())
      setIsFitToWidth(false)
    } else {
      const newScale = Math.min(5.0, Math.max(0.5, scale + delta))
      setScale(newScale)
      setManualZoomInput(Math.round(newScale * 100).toString())
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner className="mr-2" />
        <span className="text-muted-foreground">Loading document...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Failed to load document</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (docType === 'unsupported') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Preview not supported</h3>
          <p className="text-muted-foreground">
            This document type cannot be previewed in the browser.
          </p>
        </div>
      </div>
    )
  }

  if (!pdfUrl) return null

  const getScaledWidth = () => {
    const availableWidth = containerWidth - 48 // 24px padding on each side

    if (isFitToWidth) {
      return availableWidth
    }

    // For PDFs: 100% scale = 600px baseline
    const baseWidth = Math.min(600, availableWidth * 0.7)
    return baseWidth * scale
  }

  const scaledWidth = getScaledWidth()
  const imageScaleValue = isFitToWidth ? 1.0 : scale

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Zoom Controls - Floating overlay on the right side */}
      {docType !== 'web' && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2 opacity-50 hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => adjustZoom(0.1)}
            disabled={!isFitToWidth && scale >= 5.0}
            className="h-8 w-8 p-0"
            title="Zoom in (10%)"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Manual zoom input */}
          <div className="flex items-center gap-1 px-1">
            <Input
              type="text"
              value={manualZoomInput}
              onChange={(e) => {
                const value = e.target.value
                setManualZoomInput(value)
              }}
              onBlur={() => {
                const numValue = parseInt(manualZoomInput)
                if (!isNaN(numValue) && numValue >= 50 && numValue <= 500) {
                  setScale(numValue / 100)
                  setIsFitToWidth(false)
                } else {
                  setManualZoomInput(isFitToWidth ? 'Fit' : Math.round(scale * 100).toString())
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const numValue = parseInt(manualZoomInput)
                  if (!isNaN(numValue) && numValue >= 50 && numValue <= 500) {
                    setScale(numValue / 100)
                    setIsFitToWidth(false)
                  } else {
                    setManualZoomInput(isFitToWidth ? 'Fit' : Math.round(scale * 100).toString())
                  }
                  e.currentTarget.blur()
                }
              }}
              className="h-7 w-14 text-xs text-center px-1"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => adjustZoom(-0.1)}
            disabled={!isFitToWidth && scale <= 0.5}
            className="h-8 w-8 p-0"
            title="Zoom out (10%)"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="h-px bg-border my-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsFitToWidth(true)
              setManualZoomInput('Fit')
            }}
            className="h-8 w-8 p-0"
            title="Fit to width"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setScale(1.0)
              setManualZoomInput('100')
              setIsFitToWidth(false)
            }}
            className="h-8 w-8 p-0 text-xs"
            title="Reset to 100%"
          >
            1:1
          </Button>
        </div>
      )}

      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="p-6 flex flex-col items-center" ref={contentContainerRef}>
          {docType === 'image' || docType === 'web' || mimeType?.startsWith('image/') ? (
            <div className="w-full flex flex-col items-center justify-center overflow-auto">
              <div
                className="relative"
                style={{
                  width: isFitToWidth ? '100%' : `${imageScaleValue * 100}%`,
                  transition: 'width 0.2s ease-out'
                }}
              >
                <Image
                  src={pdfUrl}
                  alt={filename}
                  width={0}
                  height={0}
                  sizes="100vw"
                  style={{ width: '100%', height: 'auto' }}
                  className="rounded-lg shadow-lg"
                  unoptimized
                />
              </div>
            </div>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-12">
                  <Spinner className="mr-2" />
                  <span className="text-muted-foreground">Loading PDF...</span>
                </div>
              }
              error={
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Failed to render document</h3>
                </div>
              }
            >
              {Array.from(new Array(numPages), (el, index) => (
                <Page
                  key={`page_${index + 1}_${Math.floor(scaledWidth / 10)}`}
                  pageNumber={index + 1}
                  className="mb-4 shadow-lg"
                  width={scaledWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={true}
                />
              ))}
            </Document>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
