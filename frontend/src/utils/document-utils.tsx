import { ReactNode } from 'react'
import { FileText, Image as ImageIcon, Volume2, FileVideo, Globe } from 'lucide-react'

export enum DocumentType {
  word = 'word',
  pdf = 'pdf',
  image = 'image',
  audio = 'audio',
  video = 'video',
  web = 'web',
  other = 'other'
}

export function getDocumentType(mimeType: string): DocumentType {
  if (mimeType.includes('pdf')) return DocumentType.pdf
  if (mimeType.includes('word') || mimeType.includes('document')) return DocumentType.word
  if (mimeType.startsWith('image/')) return DocumentType.image
  if (mimeType.startsWith('audio/')) return DocumentType.audio
  if (mimeType.startsWith('video/')) return DocumentType.video
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
      return <Volume2 className={`${className} text-yellow-600`} />
    case DocumentType.video:
      return <FileVideo className={`${className} text-purple-600`} />
    case DocumentType.web:
      return <Globe className={`${className} text-indigo-600`} />
    default:
      return <FileText className={`${className} text-gray-600`} />
  }
}

export function getFileIcon(type: DocumentType): ReactNode {
  return getTypeIcon(type, 'md')
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
      return 'web'
    default:
      return 'Other'
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
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function formatFileSize(bytes: number | null | undefined, docType?: DocumentType): string {
  if (docType === DocumentType.web) return 'Link'

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
