import { useState, useEffect, useCallback } from 'react'
import { DocumentResponse } from '@/lib/api'
import { getDocumentType, DocumentType } from '@/utils/document-utils'
import { useDeleteDocument, useDeleteDocumentSilent } from '@/hooks/documents/use-documents'
import toast from 'react-hot-toast'

interface UseBulkActionsProps {
  filteredDocuments: DocumentResponse[]
  documents: DocumentResponse[]
  onAddToContext: (documentIds: string[]) => void
}

export function useBulkActions({
  filteredDocuments,
  documents,
  onAddToContext
}: UseBulkActionsProps) {
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteDocumentMutation = useDeleteDocument()
  const deleteDocumentSilentMutation = useDeleteDocumentSilent()

  // Clear selections when filtering changes, but keep selections for still-visible documents
  useEffect(() => {
    if (selectedDocuments.size > 0) {
      const visibleDocumentIds = new Set(filteredDocuments.map(doc => doc.id))
      const updatedSelections = new Set(
        Array.from(selectedDocuments).filter(id => visibleDocumentIds.has(id))
      )

      // Only update if selections actually changed
      if (updatedSelections.size !== selectedDocuments.size) {
        setSelectedDocuments(updatedSelections)
      }
    }
  }, [filteredDocuments])

  const handleSelectDocument = useCallback((documentId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(documentId)) {
        newSet.delete(documentId)
      } else {
        newSet.add(documentId)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set())
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)))
    }
  }, [selectedDocuments.size, filteredDocuments])

  const handleDeselectAll = useCallback(() => {
    setSelectedDocuments(new Set())
  }, [])

  const handleDeleteDocument = useCallback((documentId: string) => {
    setDocumentToDelete(documentId)
    setDeleteDialogOpen(true)
  }, [])

  const handleBulkDelete = useCallback(() => {
    setDeleteDialogOpen(true)
  }, [])

  const handleConfirmDelete = async () => {
    if (!documentToDelete && selectedDocuments.size === 0) return

    if (documentToDelete) {
      // Single document delete
      setIsDeleting(true)
      try {
        await deleteDocumentMutation.mutateAsync(documentToDelete)
      } catch (error) {
        console.error('Failed to delete document:', error)
        toast.error('Failed to delete document. Please try again.')
      } finally {
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        setDocumentToDelete(null)
      }
    } else {
      // Bulk delete
      setIsDeleting(true)
      const count = selectedDocuments.size
      const selectedIds = Array.from(selectedDocuments)

      try {
        await Promise.all(
          selectedIds.map(docId =>
            deleteDocumentSilentMutation.mutateAsync(docId)
          )
        )
        toast.success(`${count} document${count > 1 ? 's' : ''} deleted successfully`)
      } catch (error) {
        console.error('Failed to delete documents:', error)
        toast.error('Failed to delete documents. Please try again.')
      } finally {
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        setSelectedDocuments(new Set())
      }
    }
  }

  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false)
    setDocumentToDelete(null)
  }, [])

  // Bulk add selected documents to chat context
  const handleBulkAddToContext = useCallback(() => {
    const selectedIds = Array.from(selectedDocuments)
    onAddToContext(selectedIds)
    toast.success(`Added ${selectedIds.length} documents to chat context`)
  }, [selectedDocuments, onAddToContext])

  // Bulk download selected documents - skip web-based ones
  const handleBulkDownload = async () => {
    const selectedIds = Array.from(selectedDocuments)

    // Filter out web-based documents
    const downloadableDocuments = documents.filter(doc => {
      const docType = getDocumentType(doc.mime_type)
      return !(docType === DocumentType.youtube || docType === DocumentType.web) && selectedIds.includes(doc.id)
    })

    if (downloadableDocuments.length === 0) {
      toast.error('No downloadable documents selected. Web and YouTube documents cannot be downloaded.')
      return
    }

    let successCount = 0
    let failedCount = 0

    // Download documents sequentially
    for (const doc of downloadableDocuments) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const downloadUrl = `${baseUrl}/documents/view/${doc.id}`

        const response = await fetch(downloadUrl, {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        })

        if (!response.ok) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()
        const contentDisposition = response.headers.get('content-disposition')
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || doc.filename
          : doc.filename

        // Create blob URL and trigger download
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)

        successCount++
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Failed to download ${doc.filename}:`, error)
        failedCount++
      }
    }

    // Show success/error message
    if (successCount === downloadableDocuments.length) {
      toast.success(`Downloaded ${successCount} document${successCount > 1 ? 's' : ''} successfully`)
    } else if (successCount > 0) {
      toast.error(`Downloaded ${successCount} document${successCount > 1 ? 's' : ''}, ${failedCount} failed`)
    } else {
      toast.error('Failed to download documents. Please try again.')
    }
  }

  return {
    selectedDocuments,
    deleteDialogOpen,
    documentToDelete,
    isDeleting,
    handleSelectDocument,
    handleSelectAll,
    handleDeselectAll,
    handleDeleteDocument,
    handleBulkDelete,
    handleConfirmDelete,
    handleCancelDelete,
    handleBulkAddToContext,
    handleBulkDownload,
    setDeleteDialogOpen,
  }
}
