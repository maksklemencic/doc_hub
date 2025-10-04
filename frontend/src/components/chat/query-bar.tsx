'use client'

import { useRef, useEffect } from 'react'
import { Search, Send, MoreVertical, PanelLeft, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface QueryBarProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  contextText: string
  disabled?: boolean
  variant?: 'default' | 'mini'
  onOpenInPane?: (pane: 'left' | 'right') => void
  className?: string
  style?: React.CSSProperties
}

export function QueryBar({
  value,
  onChange,
  onSend,
  placeholder = 'Ask about your documents...',
  contextText,
  disabled = false,
  variant = 'default',
  onOpenInPane,
  className,
  style,
}: QueryBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    target.style.height = 'auto'
    target.style.height = target.scrollHeight + 'px'
  }

  // Auto-focus textarea when typing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with special keys, shortcuts, or if already focused on input
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.key === 'Tab' ||
        e.key === 'Enter' ||
        e.key === 'Escape' ||
        e.key.startsWith('Arrow') ||
        e.key.startsWith('F') ||
        document.activeElement === textareaRef.current ||
        (document.activeElement && document.activeElement.tagName === 'INPUT') ||
        (document.activeElement && document.activeElement.tagName === 'TEXTAREA')
      ) {
        return
      }

      // If it's a printable character, focus the textarea
      if (e.key.length === 1 && textareaRef.current) {
        textareaRef.current.focus()
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const content = (
    <div className={className} style={style}>
      <div className="flex items-center gap-2 p-3 relative">
        {!value && (
          <Search className="absolute left-3 top-[16.5px] h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`flex-1 bg-transparent text-sm resize-none focus:outline-none min-h-[24px] max-h-[200px] transition-all ${!value ? 'pl-8' : 'pl-0'}`}
          rows={1}
          disabled={disabled}
          style={{
            height: 'auto',
            overflowY: value.split('\n').length > 4 ? 'auto' : 'hidden',
          }}
          onInput={handleInput}
        />
        <Button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          size="icon"
          className="h-8 w-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Context:</span>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
            {contextText}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
            Llama 3.1 8B
          </button>
          {variant === 'mini' && onOpenInPane && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenInPane('left')} className="focus:bg-teal-50 focus:text-teal-900">
                  <PanelLeft className="mr-2 h-4 w-4" />
                  Open in Left Pane
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenInPane('right')} className="focus:bg-teal-50 focus:text-teal-900">
                  <PanelRight className="mr-2 h-4 w-4" />
                  Open in Right Pane
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )

  // Wrap with context menu for mini variant
  if (variant === 'mini' && onOpenInPane) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {content}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onOpenInPane('left')} className="focus:bg-teal-50 data-[highlighted]:bg-teal-50">
            <PanelLeft className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-teal-900 data-[highlighted]:text-teal-900" />
            <span className="text-foreground group-hover:text-teal-900 data-[highlighted]:text-teal-900">Open in Left Pane</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onOpenInPane('right')} className="focus:bg-teal-50 data-[highlighted]:bg-teal-50">
            <PanelRight className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-teal-900 data-[highlighted]:text-teal-900" />
            <span className="text-foreground group-hover:text-teal-900 data-[highlighted]:text-teal-900">Open in Right Pane</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return content
}
