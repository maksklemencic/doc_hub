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
import { DocumentType } from '@/utils/document-utils'
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

// Get icon for document type - small size for card
const getDocumentIcon = (type: DocumentType) => {
  switch (type) {
    case DocumentType.pdf:
      return (
        <div className="p-2 rounded-lg border-2 border-red-300 shadow-sm shadow-red-200">
          <FileText className="w-6 h-6 text-red-600" />
        </div>
      )
    case DocumentType.word:
      return (
        <div className="p-2 rounded-lg border-2 border-blue-300 shadow-sm shadow-blue-200">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
      )
    case DocumentType.video:
      return (
        <div className="p-2 rounded-lg border-2 border-purple-300 shadow-sm shadow-purple-200">
          <Video className="w-6 h-6 text-purple-600" />
        </div>
      )
    case DocumentType.audio:
      return (
        <div className="p-2 rounded-lg border-2 border-yellow-300 shadow-sm shadow-yellow-200">
          <Mic className="w-6 h-6 text-yellow-600" />
        </div>
      )
    case DocumentType.image:
      return (
        <div className="p-2 rounded-lg border-2 border-green-300 shadow-sm shadow-green-200">
          <ImageIcon className="w-6 h-6 text-green-600" />
        </div>
      )
    case DocumentType.web:
      return (
        <div className="p-2 rounded-lg border-2 border-indigo-300 shadow-sm shadow-indigo-200">
          <Globe className="w-6 h-6 text-indigo-600" />
        </div>
      )
    case DocumentType.youtube:
      return (
        <div className="p-2 rounded-lg border-2 border-red-300 shadow-sm shadow-red-200">
          <Youtube className="w-6 h-6 text-red-600" />
        </div>
      )
    default:
      return <FileText className="w-6 h-6 text-gray-600" />
  }
}

// Get badge color and text for document type
const getTypeBadge = (type: DocumentType) => {
  switch (type) {
    case DocumentType.pdf:
      return { text: 'Pdf', className: 'bg-red-200 text-red-900 border-red-500' }
    case DocumentType.word:
      return { text: 'Word', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    case DocumentType.video:
      return { text: 'Video', className: 'bg-purple-100 text-purple-700 border-purple-200' }
    case DocumentType.audio:
      return { text: 'Audio', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    case DocumentType.image:
      return { text: 'Image', className: 'bg-green-100 text-green-700 border-green-200' }
    case DocumentType.web:
      return { text: 'Web', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
    case DocumentType.youtube:
      return { text: 'Youtube', className: 'bg-red-100 text-red-700 border-red-200' }
    default:
      return { text: 'Other', className: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
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

  // Helper to check if document type is URL-based
  const isUrlBasedType = type === DocumentType.youtube || type === DocumentType.web

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
          {!isUrlBasedType && (
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
          {onOpenInRightPane && !isUrlBasedType && (
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
        {isUrlBasedType && url && isValidUrl(url) && (
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
          {pageCount && size && !isUrlBasedType && <span>•</span>}
          {size && !isUrlBasedType && <span>{size}</span>}
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
          {!isUrlBasedType && (
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
            {!isUrlBasedType && (
              <ContextMenuItem
                onClick={onClick}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <Eye className="mr-2 h-4 w-4" />
                Open
              </ContextMenuItem>
            )}
            {onOpenInRightPane && !isUrlBasedType && (
              <ContextMenuItem
                onClick={onOpenInRightPane}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <SquareSplitHorizontal className="mr-2 h-4 w-4" />
                Open in Right Pane
              </ContextMenuItem>
            )}
            {isUrlBasedType && url && (
              <ContextMenuItem
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Link in New Tab
              </ContextMenuItem>
            )}
            {/* Download available for non-URL docs */}
            {!isUrlBasedType && (
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
