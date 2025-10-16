import { useState, useEffect, useCallback } from 'react'
import { DocumentResponse } from '@/lib/api'
import { getDocumentType, DocumentType } from '@/utils/document-utils'
import { useDeleteDocument, useDeleteDocumentSilent } from '@/hooks/documents/use-documents'
import toast from 'react-hot-toast'
import { documentLogger } from '@/utils/logger'
import { downloadMultipleDocuments } from '@/utils/download'

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

      // Check if sets are actually different (content, not just size)
      const hasChanges = updatedSelections.size !== selectedDocuments.size ||
        !Array.from(updatedSelections).every(id => selectedDocuments.has(id))

      if (hasChanges) {
        setSelectedDocuments(updatedSelections)
      }
    }
  }, [filteredDocuments, selectedDocuments])

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
        documentLogger.error('Failed to delete document:', error, { action: 'deleteDocument', documentId: documentToDelete })
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
        documentLogger.error('Failed to delete documents:', error, { action: 'bulkDelete', documentIds: selectedIds })
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

  // Bulk download selected documents using centralized utility
  const handleBulkDownload = async () => {
    const selectedIds = Array.from(selectedDocuments)

    // Get selected documents that can be downloaded
    const documentsToDownload = documents.filter(doc => selectedIds.includes(doc.id))

    try {
      const { successCount, failedCount } = await downloadMultipleDocuments(
        documentsToDownload,
        {
          skipUrlBased: true,
          delayBetweenDownloads: 100,
          onSuccess: (count) => {
            if (failedCount === 0) {
              toast.success(`Downloaded ${count} document${count > 1 ? 's' : ''} successfully`)
            }
          },
          onError: (count) => {
            if (successCount > 0) {
              toast.error(`Downloaded ${successCount} document${successCount > 1 ? 's' : ''}, ${count} failed`)
            } else {
              toast.error('Failed to download documents. Please try again.')
            }
          }
        }
      )
    } catch (error) {
      // Handle case where no downloadable documents
      toast.error(error instanceof Error ? error.message : 'Failed to download documents')
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
