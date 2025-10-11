'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { FileText } from 'lucide-react'
import { ZoomControls } from './zoom-controls'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { documentsApi } from '@/lib/api'
import { SpaceStorage } from '@/utils/localStorage'
import { usePaneWidthContext } from '@/contexts/pane-width-context'
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

  // Use unified pane width context
  const {
    leftWidth,
    rightWidth,
    isSplit,
    mode,
    updateSplitterWidths
  } = usePaneWidthContext()

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

  // Remove auto-fit logic - manual fit-to-width only
  // User must click "Fit to Width" button for auto-scaling

  // Simple container width tracking for PDF rendering
  useEffect(() => {
    if (!pdfUrl) return

    const container = contentContainerRef.current
    if (!container) return

    // Simple single ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const width = entry.contentRect.width
        if (width > 0) {
          setContainerWidth(width)
        }
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
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
    // For fixed zoom: use 600px baseline (like PDFs) multiplied by scale
    // This ensures 100% = ~600px, 200% = 1200px, etc.
    if (!isFitToWidth) {
      return 600 * scale // Consistent pixel size for fixed zoom
    }

    // For fit-to-width: scale to container
    const availableWidth = containerWidth - 48 // 24px padding on each side
    return Math.max(availableWidth, 200) // Minimum width
  }

  const scaledWidth = getScaledWidth()
  const imageScaleValue = isFitToWidth ? 1.0 : scale

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Zoom Controls */}
      {docType !== 'web' && (
        <ZoomControls
          manualZoomInput={manualZoomInput}
          setManualZoomInput={setManualZoomInput}
          adjustZoom={adjustZoom}
          setScale={setScale}
          setIsFitToWidth={setIsFitToWidth}
          scale={scale}
          isFitToWidth={isFitToWidth}
        />
      )}

      {/* Scrollable container for wide documents */}
      <ScrollArea className="h-full">
        <div
          className={`${isFitToWidth ? 'p-2' : 'p-6'} flex flex-col items-center min-w-fit`}
          ref={contentContainerRef}
        >
          {docType === 'image' || docType === 'web' || mimeType?.startsWith('image/') ? (
            <div className="w-full flex flex-col items-center justify-center">
              <div
                className="relative"
                style={{
                  width: `${scaledWidth}px`, // Use same scaling logic as PDFs
                  minWidth: `${scaledWidth}px`, // Prevent shrinking below document width
                  // transition: 'width 0.5s ease-out'
                }}
              >
                <Image
                  src={pdfUrl}
                  alt={filename}
                  width={0}
                  height={0}
                  sizes="100vw"
                  style={{
                    width: '100%', // Fill the scaled container
                    height: 'auto'
                  }}
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
              <div className="flex flex-col items-center">
                {Array.from(new Array(numPages), (el, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    className="mb-4 shadow-lg"
                    width={scaledWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={true}
                  />
                ))}
              </div>
            </Document>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
