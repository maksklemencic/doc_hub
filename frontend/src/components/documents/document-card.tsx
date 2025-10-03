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
  MessageSquare,
  Share2,
  Trash2,
  ExternalLink,
  PanelRightOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export enum DocumentType {
  word = 'word',
  pdf = 'pdf',
  image = 'image',
  audio = 'audio',
  video = 'video',
  web = 'web',
  note = 'note',
  aiNote = 'aiNote',
  other = 'other'
}

interface DocumentCardProps {
  id: string
  filename: string
  type: DocumentType
  size?: string
  timestamp?: string
  pageCount?: string
  isSelected: boolean
  onSelect: () => void
  onClick: () => void
  onDelete?: () => void
  onOpenInRightPane?: () => void
  onAddToContext?: () => void
}

// Get icon for document type - small size for card
const getDocumentIcon = (type: DocumentType) => {
  switch (type) {
    case DocumentType.pdf:
      return <FileText className="w-6 h-6 text-gray-600" />
    case DocumentType.video:
      return <Video className="w-6 h-6 text-gray-600" />
    case DocumentType.audio:
      return <Mic className="w-6 h-6 text-gray-600" />
    case DocumentType.aiNote:
      return <Sparkles className="w-6 h-6 text-gray-600" />
    case DocumentType.note:
      return <Edit3 className="w-6 h-6 text-gray-600" />
    case DocumentType.image:
      return <ImageIcon className="w-6 h-6 text-gray-600" />
    case DocumentType.web:
      return <Globe className="w-6 h-6 text-gray-600" />
    default:
      return <FileText className="w-6 h-6 text-gray-600" />
  }
}

// Get badge color and text for document type
const getTypeBadge = (type: DocumentType) => {
  switch (type) {
    case DocumentType.pdf:
      return { text: 'PDF', className: 'bg-amber-100 text-amber-700 border-amber-200' }
    case DocumentType.video:
      return { text: 'Video', className: 'bg-purple-100 text-purple-700 border-purple-200' }
    case DocumentType.audio:
      return { text: 'Audio', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    case DocumentType.aiNote:
      return { text: 'AI Note', className: 'bg-teal-100 text-teal-700 border-teal-200' }
    case DocumentType.note:
      return { text: 'Note', className: 'bg-purple-100 text-purple-700 border-purple-200' }
    case DocumentType.image:
      return { text: 'Image', className: 'bg-green-100 text-green-700 border-green-200' }
    case DocumentType.web:
      return { text: 'Web', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
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
  isSelected,
  onSelect,
  onClick,
  onDelete,
  onOpenInRightPane,
  onAddToContext
}: DocumentCardProps) {
  const badge = getTypeBadge(type)

  const cardContent = (
    <div
      className={cn(
        "group relative bg-card border rounded-lg p-4 card-hover cursor-pointer",
        isSelected ? "border-primary bg-primary/5" : "border-border"
      )}
      onClick={onClick}
    >
      {/* Checkbox - top left */}
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

      {/* Badge - top right */}
      <Badge
        variant="outline"
        className={cn(
          "absolute top-3 right-3 text-xs font-medium",
          badge.className
        )}
      >
        {badge.text}
      </Badge>

      {/* Icon - shifted right when checkbox present */}
      <div className="mb-3">
        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center ml-7">
          {getDocumentIcon(type)}
        </div>
      </div>

      {/* Content - aligned under icon */}
      <div className="space-y-1">
        <h3 className="font-medium text-sm text-gray-900 line-clamp-2 pr-16 ml-7">
          {filename}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 ml-7">
          {pageCount && <span>{pageCount}</span>}
          {pageCount && size && <span>•</span>}
          {size && <span>{size}</span>}
        </div>
        {timestamp && (
          <p className="text-xs text-gray-400 ml-7">
            {timestamp}
          </p>
        )}
      </div>

      {/* Quick actions - shown on hover, bottom right */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-teal-100 hover:text-teal-600"
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          title="View"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-teal-100 hover:text-teal-600"
          onClick={(e) => e.stopPropagation()}
          title="Ask Question"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-gray-100"
          onClick={(e) => e.stopPropagation()}
          title="Share"
        >
          <Share2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-red-100 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.()
          }}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {cardContent}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem
          onClick={onClick}
          className="focus:bg-teal-50 focus:text-teal-900"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open
        </ContextMenuItem>
        {onOpenInRightPane && (
          <ContextMenuItem
            onClick={onOpenInRightPane}
            className="focus:bg-teal-50 focus:text-teal-900"
          >
            <PanelRightOpen className="mr-2 h-4 w-4" />
            Open in Right Pane
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        {onAddToContext && (
          <>
            <ContextMenuItem
              onClick={onAddToContext}
              className="focus:bg-teal-50 focus:text-teal-900"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Add to Chat Context
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {onDelete && (
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-destructive focus:bg-red-50 focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
