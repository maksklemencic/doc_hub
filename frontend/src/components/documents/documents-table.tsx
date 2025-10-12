import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Eye, ExternalLink, Target, Trash2, Download, SquareSplitHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentResponse } from '@/lib/api'
import {
  getDocumentType,
  getDocumentIcon,
  getFileIcon,
  getTypeBadge,
  getFileTypeColor,
  formatFileSize,
  formatDate,
  getFileSize,
  DocumentType,
  isUrlBasedType
} from '@/utils/document-utils'

interface DocumentsTableProps {
  documents: DocumentResponse[]
  selectedDocuments: Set<string>
  onDocumentClick: (documentId: string) => void
  onSelectDocument: (documentId: string) => void
  onSelectAll: () => void
  onDeleteDocument: (documentId: string) => void
  onDeleteSelected?: () => void
  onBulkOpen?: () => void
  onBulkOpenInRightPane?: () => void
  onBulkAddToContext?: () => void
  onBulkDownload?: () => void
  onOpenInRightPane?: (documentId: string) => void
  onAddToContext?: (documentId: string) => void
}

export function DocumentsTable({
  documents,
  selectedDocuments,
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
  onAddToContext,
}: DocumentsTableProps) {
  // Download function for documents
  const handleDownload = async (documentId: string) => {
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const downloadUrl = `${baseUrl}/documents/view/${documentId}`

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
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'document'
        : 'document'

      // Create blob URL and trigger download
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename // Suggest the original filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL after download
      URL.revokeObjectURL(blobUrl)
      } catch (error) {
      }
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedDocuments.size === documents.length && documents.length > 0}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead className="min-w-[200px]">Name</TableHead>
            <TableHead className="w-[80px]">Type</TableHead>
            <TableHead className="w-[100px]">Size</TableHead>
            <TableHead className="w-[120px]">Date Added</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => {
            const docType = getDocumentType(document.mime_type)
            const truncatedFilename = document.filename.length > 30
              ? document.filename.substring(0, 30) + '...'
              : document.filename

            const tableRow = (
              <TableRow
                key={document.id}
                className="hover:bg-muted/50"
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedDocuments.has(document.id)}
                    onCheckedChange={() => onSelectDocument(document.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="text-muted-foreground">
                    {getFileIcon(docType)}
                  </div>
                </TableCell>
                <TableCell className="font-medium max-w-0" onClick={(e) => e.stopPropagation()}>
                  <div className="truncate" title={document.filename}>
                    {document.filename}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-medium", getTypeBadge(docType).className)}
                  >
                    {getTypeBadge(docType).text}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFileSize(getFileSize(document, docType), docType)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(document.created_at)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {/* Open actions - Eye for non-URL docs, hidden spacer for URL docs */}
                    {!isUrlBasedType(docType) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-teal-100 hover:text-teal-600"
                            onClick={() => onDocumentClick(document.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Open document</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isUrlBasedType(docType) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 pointer-events-none"
                        disabled
                      >
                        <div className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Open in right pane (only for non-URL docs) */}
                    {!isUrlBasedType(docType) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-teal-100 hover:text-teal-600"
                            onClick={() => onOpenInRightPane?.(document.id)}
                          >
                            <SquareSplitHorizontal className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Open in right pane</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isUrlBasedType(docType) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 pointer-events-none"
                        disabled
                      >
                        <div className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Download for non-URL docs, ExternalLink for URL docs */}
                    {!isUrlBasedType(docType) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-teal-100 hover:text-teal-600"
                            onClick={() => handleDownload(document.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isUrlBasedType(docType) && document.url && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-teal-100 hover:text-teal-600"
                            onClick={() => window.open(document.url, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Open link</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Add to Context button (always present) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-teal-100 hover:text-teal-600"
                          onClick={() => onAddToContext?.(document.id)}
                        >
                          <Target className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Set chat context</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Delete button (always present) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-red-100 hover:text-red-600"
                          onClick={() => onDeleteDocument(document.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete document</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            )

            return (
              <ContextMenu key={document.id}>
                <ContextMenuTrigger asChild>
                  {tableRow}
                </ContextMenuTrigger>
                <ContextMenuContent className="w-72">
                  {/* Header showing document name/type or selection count */}
                  <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b mb-1">
                    {selectedDocuments.size > 1 ? (
                      <span>{selectedDocuments.size} documents</span>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <span className="truncate flex-1" title={document.filename}>
                          {truncatedFilename}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs font-medium flex-shrink-0", getTypeBadge(docType).className)}
                        >
                          {getTypeBadge(docType).text}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {selectedDocuments.size > 1 ? (
                    <>
                      <ContextMenuItem
                        onClick={() => onBulkDownload?.()}
                        className="focus:bg-teal-50 focus:text-teal-900"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Selected
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={onBulkAddToContext}
                        className="focus:bg-teal-50 focus:text-teal-900"
                      >
                        <Target className="mr-2 h-4 w-4" />
                        Set Selected Chat Context
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={() => onDeleteSelected?.()}
                        className="text-destructive focus:bg-red-50 focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected Documents
                      </ContextMenuItem>
                    </>
                  ) : (
                    <>
                      {!isUrlBasedType(docType) && (
                        <>
                          <ContextMenuItem
                            onClick={() => onDocumentClick(document.id)}
                            className="focus:bg-teal-50 focus:text-teal-900"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Open
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => onOpenInRightPane?.(document.id)}
                            className="focus:bg-teal-50 focus:text-teal-900"
                          >
                            <SquareSplitHorizontal className="mr-2 h-4 w-4" />
                            Open in Right Pane
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleDownload(document.id)}
                            className="focus:bg-teal-50 focus:text-teal-900"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </ContextMenuItem>
                        </>
                      )}
                      {isUrlBasedType(docType) && document.url && (
                        <ContextMenuItem
                          onClick={() => window.open(document.url, '_blank', 'noopener,noreferrer')}
                          className="focus:bg-teal-50 focus:text-teal-900"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open link
                        </ContextMenuItem>
                      )}
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={() => onAddToContext?.(document.id)}
                        className="focus:bg-teal-50 focus:text-teal-900"
                      >
                        <Target className="mr-2 h-4 w-4" />
                        Set Chat Context
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={() => onDeleteDocument(document.id)}
                        className="text-destructive focus:bg-red-50 focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
