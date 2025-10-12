import { useState, useCallback } from 'react'

export function useDocumentSelection() {
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())

  const toggleDocument = useCallback((docId: string) => {
    setSelectedDocuments((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(docId)) {
        newSet.delete(docId)
      } else {
        newSet.add(docId)
      }
      return newSet
    })
  }, [])

  const selectAll = useCallback((docIds: string[]) => {
    setSelectedDocuments(new Set(docIds))
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedDocuments(new Set())
  }, [])

  const isSelected = useCallback(
    (docId: string) => selectedDocuments.has(docId),
    [selectedDocuments]
  )

  const toggleAll = useCallback(
    (docIds: string[]) => {
      if (selectedDocuments.size === docIds.length) {
        deselectAll()
      } else {
        selectAll(docIds)
      }
    },
    [selectedDocuments.size, selectAll, deselectAll]
  )

  return {
    selectedDocuments,
    toggleDocument,
    selectAll,
    deselectAll,
    isSelected,
    toggleAll,
    selectedCount: selectedDocuments.size,
  }
}
