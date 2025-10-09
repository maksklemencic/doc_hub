import { DocumentCard } from '@/components/documents/document-card'
import { DocumentResponse } from '@/lib/api'
import { getDocumentType, formatFileSize, formatDate, getPageCount, getFileSize, DocumentType } from '@/utils/document-utils'

interface DocumentsGridProps {
  documents: DocumentResponse[]
  selectedDocuments: Set<string>
  gridColumns: number
  onDocumentClick: (documentId: string) => void
  onSelectDocument: (documentId: string) => void
  onDeleteDocument: (documentId: string) => void
  onDeleteSelected?: () => void
  onBulkOpen?: () => void
  onBulkOpenInRightPane?: () => void
  onBulkAddToContext?: () => void
  onBulkDownload?: () => void
  onDeselectAll: () => void
  onOpenInRightPane: (document: DocumentResponse) => void
  onAddToContext: (documentId: string) => void
}

export function DocumentsGrid({
  documents,
  selectedDocuments,
  gridColumns,
  onDocumentClick,
  onSelectDocument,
  onDeleteDocument,
  onDeleteSelected,
  onBulkOpen,
  onBulkOpenInRightPane,
  onBulkAddToContext,
  onBulkDownload,
  onDeselectAll,
  onOpenInRightPane,
  onAddToContext,
}: DocumentsGridProps) {
  return (
    <div
      className="grid gap-4 px-0 py-6"
      style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
      onClick={onDeselectAll}
    >
      {documents.map((document) => {
        const docType = getDocumentType(document.mime_type)
        return (
          <DocumentCard
            key={document.id}
            id={document.id}
            filename={document.filename}
            type={docType}
            size={formatFileSize(getFileSize(document), docType)}
            timestamp={formatDate(document.created_at)}
            pageCount={getPageCount(document, docType)}
            url={document.url}
            isSelected={selectedDocuments.has(document.id)}
            selectedCount={selectedDocuments.size}
            onSelect={() => onSelectDocument(document.id)}
            onClick={() => onDocumentClick(document.id)}
            onDelete={() => onDeleteDocument(document.id)}
            onDeleteSelected={onDeleteSelected}
            onBulkOpen={onBulkOpen}
            onBulkOpenInRightPane={onBulkOpenInRightPane}
            onBulkAddToContext={onBulkAddToContext}
            onBulkDownload={onBulkDownload}
            onOpenInRightPane={() => onOpenInRightPane(document)}
            onAddToContext={() => onAddToContext(document.id)}
          />
        )
      })}
    </div>
  )
}
