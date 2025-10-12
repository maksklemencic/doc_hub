'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Video,
  Mic,
  Sparkles,
  Edit3,
  Image as ImageIcon,
  Globe,
  Eye,
  Target,
  Download,
  Trash2,
  ExternalLink,
  ArrowRight,
  SquareSplitHorizontal,
  Youtube
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DocumentType, getDocumentIcon, getTypeBadge, isUrlBasedType } from '@/utils/document-utils'
import { isValidUrl } from '@/utils'

interface DocumentCardProps {
  id: string
  filename: string
  type: DocumentType
  size?: string
  timestamp?: string
  pageCount?: string
  url?: string
  isSelected: boolean
  selectedCount?: number
  onSelect: () => void
  onClick: () => void
  onDelete?: () => void
  onDeleteSelected?: () => void
  onBulkOpen?: () => void
  onBulkOpenInRightPane?: () => void
  onBulkAddToContext?: () => void
  onBulkDownload?: () => void
  onOpenInRightPane?: () => void
  onAddToContext?: (documentId: string) => void
}

export function DocumentCard({
  id,
  filename,
  type,
  size,
  timestamp,
  pageCount,
  url,
  isSelected,
  selectedCount = 0,
  onSelect,
  onClick,
  onDelete,
  onDeleteSelected,
  onBulkOpen,
  onBulkOpenInRightPane,
  onBulkAddToContext,
  onBulkDownload,
  onOpenInRightPane,
  onAddToContext
}: DocumentCardProps) {
  const badge = getTypeBadge(type)

  // Use centralized helper to check if document type is URL-based
  const isUrlBased = isUrlBasedType(type)

    // Download function for documents
    const handleDownload = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const downloadUrl = `${baseUrl}/documents/view/${id}`

        const response = await fetch(downloadUrl, {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        })

        if (!response.ok) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()

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
        console.error('Download failed:', error)
      }
    }

  const cardContent = (
    <div
      className={cn(
        "group relative bg-card border rounded-lg p-4 card-hover",
        isSelected ? "border-teal-500 bg-teal-50" : "border-border"
      )}
    >
      {/* Checkbox - moved out of content flow to allow full width content */}
      <div
        className="absolute top-3 left-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="bg-white"
        />
      </div>

      {/* Header row - Icon on left, Badge and actions on right */}
      <div className="flex items-center justify-between mb-3">
        {/* Icon positioned to the right of checkbox */}
        <div className="ml-10">
          {getDocumentIcon(type)}
        </div>

        {/* Badge and open actions pushed to the far right */}
        <div className="flex items-center gap-2">
          {/* Badge - left of actions */}
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              badge.className
            )}
          >
            {badge.text}
          </Badge>

          {/* Always visible open actions - right of badge */}
          {!isUrlBased && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-700 hover:bg-teal-100 hover:text-teal-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick()
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open document</p>
              </TooltipContent>
            </Tooltip>
          )}
          {onOpenInRightPane && !isUrlBased && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-700 hover:bg-teal-100 hover:text-teal-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenInRightPane()
                  }}
                >
                  <SquareSplitHorizontal className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open in right pane</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Content - full width, no narrow first column */}
      <div className="space-y-1">
        <h3 className="font-medium text-sm text-gray-900 line-clamp-2">
          {filename}
        </h3>
        {/* URL - shown for YouTube and Web documents */}
        {isUrlBased && url && isValidUrl(url) && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline block truncate line-clamp-1"
            title={url}
          >
            {url}
          </a>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {pageCount && <span>{pageCount}</span>}
          {pageCount && size && !isUrlBased && <span>•</span>}
          {size && !isUrlBased && <span>{size}</span>}
        </div>
      </div>

      {/* Separator line */}
      <hr className="my-2 border-gray-200" />

      {/* Bottom section - Date and hover actions */}
      <div className="flex items-center justify-between">
        {/* Date - always visible */}
        <p className="text-xs text-gray-400">
          {timestamp || 'No date'}
        </p>

        {/* Hover actions - shown on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {!isUrlBased && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-teal-100 hover:text-teal-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload()
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-teal-100 hover:text-teal-600"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddToContext?.(id)
                }}
              >
                <Target className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Set chat context</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-red-100 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.()
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete document</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {cardContent}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-72">
        {/* Header showing document name/type or selection count */}
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b mb-1">
          {selectedCount > 1 ? (
            <span>{selectedCount} documents</span>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <span className="truncate flex-1" title={filename}>
                {filename.length > 30 ? filename.substring(0, 30) + '...' : filename}
              </span>
              <Badge
                variant="outline"
                className={cn("text-xs font-medium flex-shrink-0", badge.className)}
              >
                {badge.text}
              </Badge>
            </div>
          )}
        </div>
        {selectedCount > 1 ? (
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
            {/* Only show Open for non-URL documents, or Open Link for URL docs */}
            {!isUrlBased && (
              <ContextMenuItem
                onClick={onClick}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <Eye className="mr-2 h-4 w-4" />
                Open
              </ContextMenuItem>
            )}
            {onOpenInRightPane && !isUrlBased && (
              <ContextMenuItem
                onClick={onOpenInRightPane}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <SquareSplitHorizontal className="mr-2 h-4 w-4" />
                Open in Right Pane
              </ContextMenuItem>
            )}
            {isUrlBased && url && (
              <ContextMenuItem
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Link in New Tab
              </ContextMenuItem>
            )}
            {/* Download available for non-URL docs */}
            {!isUrlBased && (
              <ContextMenuItem
                onClick={handleDownload}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            {onAddToContext && (
              <ContextMenuItem
                onClick={() => onAddToContext?.(id)}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <Target className="mr-2 h-4 w-4" />
                Set Chat Context
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            {onDelete && (
              <ContextMenuItem
                onClick={() => onDelete()}
                className="text-destructive focus:bg-red-50 focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
