'use client'

import { Suspense } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { FileText } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface LazyPdfViewerProps {
  pdfUrl: string
  numPages: number
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void
  scaledWidth: number
}

function PdfViewer({
  pdfUrl,
  numPages,
  onDocumentLoadSuccess,
  scaledWidth
}: LazyPdfViewerProps) {
  return (
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
  )
}

export function LazyPdfViewer(props: LazyPdfViewerProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Spinner className="mr-2" />
        <span className="text-muted-foreground">Loading PDF viewer...</span>
      </div>
    }>
      <PdfViewer {...props} />
    </Suspense>
  )
}
