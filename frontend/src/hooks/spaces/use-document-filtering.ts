import { useState, useMemo } from 'react'
import { DocumentResponse } from '@/lib/api'
import { getDocumentType, DocumentType, getFileSize } from '@/utils/document-utils'

export type SortBy = 'date' | 'name' | 'size'
export type SortOrder = 'asc' | 'desc'

interface UseDocumentFilteringProps {
  documents: DocumentResponse[]
}

export function useDocumentFiltering({ documents }: UseDocumentFilteringProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<DocumentType>>(new Set())
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Apply filtering and sorting with memoization
  const filteredAndSortedDocuments = useMemo(() => {
    return documents
      .filter(doc => {
        // Search filter
        const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase())

        // Type filter
        const docType = getDocumentType(doc.mime_type)
        const matchesType = selectedTypes.size === 0 || selectedTypes.has(docType)

        return matchesSearch && matchesType
      })
      .sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
          case 'date':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            break
          case 'name':
            comparison = a.filename.toLowerCase().localeCompare(b.filename.toLowerCase())
            break
          case 'size':
            const aSize = getFileSize(a, getDocumentType(a.mime_type))
            const bSize = getFileSize(b, getDocumentType(b.mime_type))
            comparison = aSize - bSize
            break
        }

        return sortOrder === 'asc' ? comparison : -comparison
      })
  }, [documents, searchTerm, selectedTypes, sortBy, sortOrder])

  const handleSort = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new sort field with appropriate default order
      setSortBy(newSortBy)
      setSortOrder(newSortBy === 'date' ? 'desc' : 'asc')
    }
  }

  const handleTypeFilter = (type: DocumentType) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  const clearAllFilters = () => {
    setSelectedTypes(new Set())
    setSearchTerm('')
  }

  return {
    searchTerm,
    setSearchTerm,
    selectedTypes,
    sortBy,
    sortOrder,
    filteredDocuments: filteredAndSortedDocuments,
    handleSort,
    handleTypeFilter,
    clearAllFilters,
  }
}
