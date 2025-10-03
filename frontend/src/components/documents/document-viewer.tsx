'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Plus, Minus, ArrowUpDown, FileText } from 'lucide-react'
import { documentsApi } from '@/lib/api'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import Image from 'next/image'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DocumentViewerProps {
  documentId: string
  filename: string
}

export function DocumentViewer({ documentId, filename }: DocumentViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [docType, setDocType] = useState<string>('pdf')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.0)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleWheel = (e: Event) => {
      const wheelEvent = e as WheelEvent
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        wheelEvent.preventDefault()
        const delta = wheelEvent.deltaY
        const zoomChange = delta > 0 ? -0.1 : 0.1
        setScale((prev) => Math.min(2.0, Math.max(0.5, prev + zoomChange)))
      }
    }

    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')

    if (scrollElement) {
      scrollElement.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      if (scrollElement) {
        scrollElement.removeEventListener('wheel', handleWheel)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let currentUrl: string | null = null

    const loadDocument = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await documentsApi.getDocumentFile(documentId)
        currentUrl = result.url

        if (mounted) {
          setPdfUrl(result.url)
          setDocType(result.docType)
        } else {
          URL.revokeObjectURL(result.url)
        }
      } catch (err) {
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
  }, [documentId])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
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

  if (!pdfUrl) return null

  const getScaledWidth = () => {
    if (typeof window === 'undefined') return 600
    const containerWidth = window.innerWidth - 100

    if (scale === -1) {
      return containerWidth
    }

    const baseWidth = Math.min(600, containerWidth)
    return baseWidth * scale
  }

  const scaledWidth = getScaledWidth()

  return (
    <div className="h-full flex flex-col bg-background relative">
      {docType !== 'image' && docType !== 'web' && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale(Math.min(2.0, scale === -1 ? 1.1 : scale + 0.1))}
            disabled={scale >= 2.0}
            className="h-8 w-8 p-0"
            title="Zoom in (10%)"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <div className="text-xs font-medium text-center py-1 min-w-[40px]">
            {scale === -1 ? 'Fit' : `${Math.round(scale * 100)}%`}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale(Math.max(0.5, scale === -1 ? 0.9 : scale - 0.1))}
            disabled={scale <= 0.5 && scale !== -1}
            className="h-8 w-8 p-0"
            title="Zoom out (10%)"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="h-px bg-border my-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale(-1)}
            className="h-8 w-8 p-0"
            title="Fit to screen"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale(1.0)}
            className="h-8 w-8 p-0 text-xs"
            title="Reset to 100%"
          >
            1:1
          </Button>
        </div>
      )}

      <ScrollArea className="h-full">
        <div className="p-6 flex flex-col items-center" ref={scrollAreaRef}>
          {docType === 'image' || docType === 'web' ? (
            <div className="w-full flex flex-col items-center justify-center">
              <div className="relative w-full max-w-4xl">
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
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  className="mb-4 shadow-lg"
                  width={scaledWidth}
                  renderTextLayer={true}
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
