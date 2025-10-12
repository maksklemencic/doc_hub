'use client'

import { FileText } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/shared/empty-state'
import { DocumentsToolbar } from '@/components/documents/documents-toolbar'
import { DocumentsGrid } from '@/components/documents/documents-grid'
import { DocumentsTable } from '@/components/documents/documents-table'
import { DocumentResponse } from '@/lib/api'
import { DocumentType } from '@/utils/document-utils'
import { SortBy, SortOrder } from '@/hooks/spaces/use-document-filtering'

interface DocumentsPaneProps {
  documents: DocumentResponse[]
  filteredDocuments: DocumentResponse[]
  isLoading: boolean
  error: any
  viewMode: 'list' | 'grid'
  searchTerm: string
  onSearchChange: (value: string) => void
  sortBy: SortBy
  sortOrder: SortOrder
  onSortChange: (sortBy: SortBy) => void
  selectedTypes: Set<DocumentType>
  onTypeFilterChange: (type: DocumentType) => void
  onClearFilters: () => void
  selectedDocuments: Set<string>
  onDeselectAll: () => void
  onDocumentClick: (documentId: string) => void
  onSelectDocument: (documentId: string) => void
  onSelectAll: () => void
  onDeleteDocument: (documentId: string) => void
  onDeleteSelected: () => void
  onBulkOpen: () => void
  onBulkOpenInRightPane: () => void
  onBulkAddToContext: () => void
  onBulkDownload: () => void
  onOpenInRightPane: (document: DocumentResponse) => void
  onOpenInRightPaneById: (documentId: string) => void
  onAddToContext: (documentId: string) => void
  gridColumns: number
}

export function DocumentsPane({
  documents,
  filteredDocuments,
  isLoading,
  error,
  viewMode,
  searchTerm,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  selectedTypes,
  onTypeFilterChange,
  onClearFilters,
  selectedDocuments,
  onDeselectAll,
  onDocumentClick,
  onSelectDocument,
  onSelectAll,
  onDeleteDocument,
  onDeleteSelected,
  onBulkOpen,
  onBulkOpenInRightPane,
  onBulkAddToContext,
  onBulkDownload,
  onOpenInRightPane,
  onOpenInRightPaneById,
  onAddToContext,
  gridColumns,
}: DocumentsPaneProps) {
  return (
    <div className="h-full flex flex-col relative min-w-0 bg-background">
      <div className="h-full flex flex-col min-w-0">
        {documents.length > 0 && (
          <DocumentsToolbar
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
            selectedTypes={selectedTypes}
            onTypeFilterChange={onTypeFilterChange}
            onClearFilters={onClearFilters}
            selectedDocumentsCount={selectedDocuments.size}
            onDeselectAll={onDeselectAll}
          />
        )}

        <div className="flex-1 overflow-hidden">
          {documents.length === 0 && !isLoading && !error ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={FileText}
                title="No documents found"
                description="Get started by adding your first document"
              />
            </div>
          ) : (
            <ScrollArea className="h-full px-6 scrollbar-thin">
              <div className="pb-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner className="mr-2" />
                    <span className="text-muted-foreground">Loading documents...</span>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <EmptyState
                      icon={FileText}
                      title="Failed to load documents"
                      description="There was an error loading the documents for this space."
                    />
                  </div>
                ) : viewMode === 'list' ? (
                  <DocumentsTable
                    documents={filteredDocuments}
                    selectedDocuments={selectedDocuments}
                    onDocumentClick={onDocumentClick}
                    onSelectDocument={onSelectDocument}
                    onSelectAll={onSelectAll}
                    onDeleteDocument={onDeleteDocument}
                    onDeleteSelected={onDeleteSelected}
                    onBulkOpen={onBulkOpen}
                    onBulkOpenInRightPane={onBulkOpenInRightPane}
                    onBulkAddToContext={onBulkAddToContext}
                    onBulkDownload={onBulkDownload}
                    onOpenInRightPane={onOpenInRightPaneById}
                    onAddToContext={onAddToContext}
                  />
                ) : (
                  <DocumentsGrid
                    documents={filteredDocuments}
                    selectedDocuments={selectedDocuments}
                    gridColumns={gridColumns}
                    onDocumentClick={onDocumentClick}
                    onSelectDocument={onSelectDocument}
                    onDeleteDocument={onDeleteDocument}
                    onDeleteSelected={onDeleteSelected}
                    onBulkOpen={onBulkOpen}
                    onBulkOpenInRightPane={onBulkOpenInRightPane}
                    onBulkAddToContext={onBulkAddToContext}
                    onBulkDownload={onBulkDownload}
                    onDeselectAll={onDeselectAll}
                    onOpenInRightPane={onOpenInRightPane}
                    onAddToContext={onAddToContext}
                  />
                )}

                {filteredDocuments.length === 0 && !isLoading && !error && searchTerm && (
                  <div className="text-center py-12">
                    <EmptyState
                      icon={FileText}
                      title="No documents found"
                      description="Try adjusting your search terms"
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  )
}
