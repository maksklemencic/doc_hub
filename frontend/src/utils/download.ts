import { DocumentResponse } from '@/lib/api'
import { DocumentType, getDocumentType, isUrlBasedType } from './document-utils'
import { documentLogger } from './logger'

/**
 * Get the authentication token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

/**
 * Build the download URL for a document
 */
function buildDownloadUrl(documentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  return `${baseUrl}/documents/view/${documentId}`
}

/**
 * Extract filename from Content-Disposition header or use fallback
 */
function extractFilename(response: Response, fallbackFilename: string): string {
  const contentDisposition = response.headers.get('content-disposition')
  if (contentDisposition) {
    const filename = contentDisposition.split('filename=')[1]?.replace(/"/g, '')
    if (filename) return filename
  }
  return fallbackFilename
}

/**
 * Trigger a download using a blob URL
 */
function triggerDownload(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up the blob URL after a short delay to ensure download starts
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl)
  }, 100)
}

/**
 * Download a single document by ID
 * @param documentId - The ID of the document to download
 * @param filename - Optional filename to use for the download
 * @returns Promise that resolves when download is complete
 */
export async function downloadDocument(
  documentId: string,
  filename?: string
): Promise<void> {
  try {
    const token = getAuthToken()
    const downloadUrl = buildDownloadUrl(documentId)

    const response = await fetch(downloadUrl, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    const blob = await response.blob()
    const finalFilename = filename || extractFilename(response, 'document')

    triggerDownload(blob, finalFilename)

    documentLogger.info(`Document downloaded successfully`, {
      action: 'downloadDocument',
      documentId,
      filename: finalFilename
    })
  } catch (error) {
    documentLogger.error(`Failed to download document:`, error, {
      action: 'downloadDocument',
      documentId
    })
    throw error
  }
}

/**
 * Download multiple documents (bulk download)
 * @param documents - Array of documents to download
 * @param options - Configuration options
 * @returns Promise that resolves with download statistics
 */
export async function downloadMultipleDocuments(
  documents: DocumentResponse[],
  options: {
    skipUrlBased?: boolean
    delayBetweenDownloads?: number
    onSuccess?: (count: number) => void
    onError?: (count: number) => void
  } = {}
): Promise<{ successCount: number; failedCount: number }> {
  const {
    skipUrlBased = true,
    delayBetweenDownloads = 100,
    onSuccess,
    onError
  } = options

  let successCount = 0
  let failedCount = 0

  // Filter out web-based documents if skipUrlBased is true
  const downloadableDocuments = skipUrlBased
    ? documents.filter(doc => {
        const docType = getDocumentType(doc.mime_type)
        return !isUrlBasedType(docType)
      })
    : documents

  if (downloadableDocuments.length === 0) {
    throw new Error('No downloadable documents available')
  }

  // Download documents sequentially
  for (const doc of downloadableDocuments) {
    try {
      await downloadDocument(doc.id, doc.filename)
      successCount++

      // Add delay between downloads to prevent overwhelming the browser
      if (delayBetweenDownloads > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenDownloads))
      }
    } catch (error) {
      documentLogger.error(`Failed to download ${doc.filename}:`, error, {
        action: 'bulkDownloadDocument',
        documentId: doc.id,
        filename: doc.filename
      })
      failedCount++
    }
  }

  // Call callbacks if provided
  if (successCount > 0 && onSuccess) {
    onSuccess(successCount)
  }
  if (failedCount > 0 && onError) {
    onError(failedCount)
  }

  return { successCount, failedCount }
}

/**
 * Check if a document type is downloadable (not URL-based)
 */
export function isDocumentDownloadable(document: DocumentResponse): boolean {
  const docType = getDocumentType(document.mime_type)
  return !isUrlBasedType(docType)
}

/**
 * Get download statistics for a set of documents
 */
export function getDownloadStats(documents: DocumentResponse[]): {
  total: number
  downloadable: number
  nonDownloadable: number
} {
  const downloadable = documents.filter(doc => isDocumentDownloadable(doc))

  return {
    total: documents.length,
    downloadable: downloadable.length,
    nonDownloadable: documents.length - downloadable.length
  }
}