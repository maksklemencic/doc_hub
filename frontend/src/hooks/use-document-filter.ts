import { useState, useMemo, useCallback } from 'react'
import { DocumentResponse } from '@/lib/api'

type SortField = 'name' | 'date' | 'size'
type SortOrder = 'asc' | 'desc'

export interface DocumentFilterState {
  searchQuery: string
  selectedTypes: Set<string>
  sortField: SortField
  sortOrder: SortOrder
}

export function useDocumentFilter(documents: DocumentResponse[] = []) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const toggleType = useCallback((type: string) => {
    setSelectedTypes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }, [])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedTypes(new Set())
  }, [])

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        return field
      }
      setSortOrder('asc')
      return field
    })
  }, [])

  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((doc) =>
        doc.filename.toLowerCase().includes(query)
      )
    }

    if (selectedTypes.size > 0) {
      filtered = filtered.filter((doc) => selectedTypes.has(doc.mime_type))
    }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = a.filename.localeCompare(b.filename)
          break
        case 'date':
          comparison =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'size':
          comparison = a.file_size - b.file_size
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [documents, searchQuery, selectedTypes, sortField, sortOrder])

  const availableTypes = useMemo(() => {
    const types = new Set<string>()
    documents.forEach((doc) => types.add(doc.mime_type))
    return Array.from(types)
  }, [documents])

  return {
    searchQuery,
    setSearchQuery,
    selectedTypes,
    toggleType,
    sortField,
    sortOrder,
    toggleSort,
    clearFilters,
    filteredAndSortedDocuments,
    availableTypes,
    hasActiveFilters: searchQuery !== '' || selectedTypes.size > 0,
  }
}
