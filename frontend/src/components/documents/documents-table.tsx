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
import { Eye, ExternalLink, Target, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentResponse } from '@/lib/api'
import {
  getDocumentType,
  getFileIcon,
  getFileTypeColor,
  formatFileSize,
  formatDate,
  getFileSize,
  DocumentType
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
  onAddToContext,
}: DocumentsTableProps) {
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
                className="hover:bg-muted/50 cursor-pointer"
                onClick={() => onDocumentClick(document.id)}
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
                <TableCell className="font-medium max-w-0">
                  <div className="truncate" title={document.filename}>
                    {document.filename}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", getFileTypeColor(docType))}>
                    {docType.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFileSize(getFileSize(document), docType)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(document.created_at)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {/* Open or Open Link button */}
                    {(docType === DocumentType.youtube || docType === DocumentType.web) && document.url ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(document.url, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Open in new tab</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDocumentClick(document.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View document</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {/* Add to Context button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAddToContext?.(document.id)}
                        >
                          <Target className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add to chat context</p>
                      </TooltipContent>
                    </Tooltip>
                    {/* Delete button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
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
                <ContextMenuContent className="w-60">
                  {/* Header showing document name/type or selection count */}
                  <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b mb-1">
                    {selectedDocuments.size > 1 ? (
                      <span>{selectedDocuments.size} documents</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="truncate" title={document.filename}>{truncatedFilename}</span>
                        <Badge variant="secondary" className="text-xs">
                          {docType.toUpperCase()}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {selectedDocuments.size > 1 ? (
                    <>
                      <ContextMenuItem
                        onClick={onBulkOpen}
                        className="focus:bg-teal-50 focus:text-teal-900"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Selected Documents
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={onBulkOpenInRightPane}
                        className="focus:bg-teal-50 focus:text-teal-900"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Open Selected in Right Pane
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={onBulkAddToContext}
                        className="focus:bg-teal-50 focus:text-teal-900"
                      >
                        <Target className="mr-2 h-4 w-4" />
                        Add Selected to Chat Context
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
                      <ContextMenuItem
                        onClick={() => onDocumentClick(document.id)}
                        className="focus:bg-teal-50 focus:text-teal-900"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </ContextMenuItem>
                      {(docType === DocumentType.youtube || docType === DocumentType.web) && document.url && (
                        <ContextMenuItem
                          onClick={() => window.open(document.url, '_blank', 'noopener,noreferrer')}
                          className="focus:bg-teal-50 focus:text-teal-900"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Link in New Tab
                        </ContextMenuItem>
                      )}
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={() => onAddToContext?.(document.id)}
                        className="focus:bg-teal-50 focus:text-teal-900"
                      >
                        <Target className="mr-2 h-4 w-4" />
                        Add to Chat Context
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
