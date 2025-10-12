import { ReactNode } from 'react'
import { FileText, Image as ImageIcon, Mic, Video, Globe, Youtube } from 'lucide-react'

export enum DocumentType {
  word = 'word',
  pdf = 'pdf',
  image = 'image',
  audio = 'audio',
  video = 'video',
  web = 'web',
  youtube = 'youtube',
  other = 'other'
}

export function getDocumentType(mimeType: string): DocumentType {
  if (mimeType.includes('pdf')) return DocumentType.pdf
  if (mimeType.includes('word') || mimeType.includes('document')) return DocumentType.word
  if (mimeType.startsWith('image/')) return DocumentType.image
  if (mimeType.startsWith('audio/')) return DocumentType.audio
  if (mimeType.startsWith('video/')) return DocumentType.video
  if (mimeType.includes('youtube')) return DocumentType.youtube
  if (mimeType.includes('html')) return DocumentType.web
  return DocumentType.other
}

export function getTypeIcon(type: DocumentType, size: 'sm' | 'md' = 'sm'): ReactNode {
  const className = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  switch (type) {
    case DocumentType.pdf:
      return <FileText className={`${className} text-red-600`} />
    case DocumentType.word:
      return <FileText className={`${className} text-blue-600`} />
    case DocumentType.image:
      return <ImageIcon className={`${className} text-green-600`} />
    case DocumentType.audio:
      return <Mic className={`${className} text-yellow-600`} />
    case DocumentType.video:
      return <Video className={`${className} text-purple-600`} />
    case DocumentType.web:
      return <Globe className={`${className} text-indigo-600`} />
    case DocumentType.youtube:
      return <Youtube className={`${className} text-red-600`} />
    default:
      return <FileText className={`${className} text-gray-600`} />
  }
}

export function getFileIcon(type: DocumentType): ReactNode {
  return getTypeIcon(type, 'md')
}

// Get icon for document type - styled like document cards (with rounded border and shadow)
export function getDocumentIcon(type: DocumentType): ReactNode {
  switch (type) {
    case DocumentType.pdf:
      return (
        <div className="p-2 rounded-lg border-2 border-red-300 shadow-sm shadow-red-200">
          <FileText className="w-6 h-6 text-red-600" />
        </div>
      )
    case DocumentType.word:
      return (
        <div className="p-2 rounded-lg border-2 border-blue-300 shadow-sm shadow-blue-200">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
      )
    case DocumentType.video:
      return (
        <div className="p-2 rounded-lg border-2 border-purple-300 shadow-sm shadow-purple-200">
          <Video className="w-6 h-6 text-purple-600" />
        </div>
      )
    case DocumentType.audio:
      return (
        <div className="p-2 rounded-lg border-2 border-yellow-300 shadow-sm shadow-yellow-200">
          <Mic className="w-6 h-6 text-yellow-600" />
        </div>
      )
    case DocumentType.image:
      return (
        <div className="p-2 rounded-lg border-2 border-green-300 shadow-sm shadow-green-200">
          <ImageIcon className="w-6 h-6 text-green-600" />
        </div>
      )
    case DocumentType.web:
      return (
        <div className="p-2 rounded-lg border-2 border-indigo-300 shadow-sm shadow-indigo-200">
          <Globe className="w-6 h-6 text-indigo-600" />
        </div>
      )
    case DocumentType.youtube:
      return (
        <div className="p-2 rounded-lg border-2 border-red-300 shadow-sm shadow-red-200">
          <Youtube className="w-6 h-6 text-red-600" />
        </div>
      )
    default:
      return <FileText className="w-6 h-6 text-gray-600" />
  }
}

export function getTypeName(type: DocumentType): string {
  switch (type) {
    case DocumentType.pdf:
      return 'PDF'
    case DocumentType.word:
      return 'Word'
    case DocumentType.image:
      return 'Image'
    case DocumentType.audio:
      return 'Audio'
    case DocumentType.video:
      return 'Video'
    case DocumentType.web:
      return 'Web'
    case DocumentType.youtube:
      return 'YouTube'
    default:
      return 'Other'
  }
}

export function getTypeBadge(type: DocumentType) {
  switch (type) {
    case DocumentType.pdf:
      return { text: 'Pdf', className: 'bg-red-200 text-red-900 border-red-500' }
    case DocumentType.word:
      return { text: 'Word', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    case DocumentType.video:
      return { text: 'Video', className: 'bg-purple-100 text-purple-700 border-purple-200' }
    case DocumentType.audio:
      return { text: 'Audio', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
    case DocumentType.image:
      return { text: 'Image', className: 'bg-green-100 text-green-700 border-green-200' }
    case DocumentType.web:
      return { text: 'Web', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
    case DocumentType.youtube:
      return { text: 'Youtube', className: 'bg-red-100 text-red-700 border-red-200' }
    default:
      return { text: 'Other', className: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
}

export function getFileTypeColor(type: DocumentType): string {
  switch (type) {
    case DocumentType.pdf:
      return 'bg-red-100 text-red-800'
    case DocumentType.word:
      return 'bg-blue-100 text-blue-800'
    case DocumentType.image:
      return 'bg-green-100 text-green-800'
    case DocumentType.audio:
      return 'bg-yellow-100 text-yellow-800'
    case DocumentType.video:
      return 'bg-purple-100 text-purple-800'
    case DocumentType.web:
      return 'bg-indigo-100 text-indigo-800'
    case DocumentType.youtube:
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function formatFileSize(bytes: number | null | undefined, docType?: DocumentType): string {
  if (docType === DocumentType.web || docType === DocumentType.youtube) return '-'

  if (bytes === null || bytes === undefined) return 'Unknown'

  const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes

  if (isNaN(numBytes)) return 'Unknown'

  if (numBytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(numBytes) / Math.log(k))
  return parseFloat((numBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function getPageCount(document: any, docType: DocumentType): string | undefined {
  // Only show page count for PDF and Word documents
  if (docType !== DocumentType.pdf && docType !== DocumentType.word) {
    return undefined
  }

  // Check if document has page_count metadata
  if (document.page_count && document.page_count > 0) {
    return `${document.page_count} pages`
  }

  return undefined
}

// Helper function to get file size from backend
export function getFileSize(document: any, docType?: DocumentType): number {
  // Web and YouTube documents should be treated as size 0 for sorting
  if (docType === DocumentType.web || docType === DocumentType.youtube) return 0
  return document.file_size || 0
}

// Helper to check if document type is URL-based (YouTube or Web)
export function isUrlBasedType(type: DocumentType): boolean {
  return type === DocumentType.youtube || type === DocumentType.web
}

// Helper to check if document type is previewable (not audio, video, or web)
export function isPreviewableType(type: DocumentType): boolean {
  return type !== DocumentType.audio && type !== DocumentType.video && type !== DocumentType.web && type !== DocumentType.youtube
}

// Helper to check if document is an image
export function isImageType(type: DocumentType): boolean {
  return type === DocumentType.image
}

// Helper to check if document is a PDF
export function isPdfType(type: DocumentType): boolean {
  return type === DocumentType.pdf
}

// Check if mime type is supported for preview based on type patterns
export function isSupportedForPreview(mimeType?: string): boolean {
  if (!mimeType) return false

  const unsupportedTypes = ['text/youtube', 'audio/', 'video/', 'html']
  return !unsupportedTypes.some(type => mimeType.includes(type))
}

// Helper to get document type from file (for upload preview)
export function getDocumentTypeFromFile(file: File): DocumentType {
  return getDocumentType(file.type)
}

// Check if a document type is downloadable (not URL-based)
export function isDownloadable(type: DocumentType): boolean {
  return !isUrlBasedType(type)
}
