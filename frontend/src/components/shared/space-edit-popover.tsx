'use client'

import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import * as Icons from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { SpaceResponse, UpdateSpaceRequest } from '@/lib/api'

// Preset icons for spaces
const PRESET_ICONS = [
  'Folder',
  'FolderOpen',
  'FileText',
  'Book',
  'BookOpen',
  'Library',
  'Files',
  'Archive',
  'Briefcase',
  'Package',
  'Inbox',
  'Star',
  'Heart',
  'Bookmark',
  'Tag',
  'Globe',
  'Home',
  'Building',
  'GraduationCap',
  'Lightbulb',
  'Rocket',
  'Zap',
  'Coffee',
  'Music',
  'Camera',
  'Code',
  'Database',
  'Server',
  'Cloud',
  'Wifi',
] as const

// Preset colors for icons (two rows of 6 colors each, ordered warm to cool)
const PRESET_COLORS = [
  // Row 1 - Warm colors
  { name: 'Red', value: 'text-red-600', bgColor: 'bg-red-600' },
  { name: 'Orange', value: 'text-orange-600', bgColor: 'bg-orange-600' },
  { name: 'Amber', value: 'text-amber-500', bgColor: 'bg-amber-500' },
  { name: 'Yellow', value: 'text-yellow-400', bgColor: 'bg-yellow-400' },
  { name: 'Lime', value: 'text-lime-600', bgColor: 'bg-lime-600' },
  { name: 'Green', value: 'text-green-600', bgColor: 'bg-green-600' },
  // Row 2 - Cool colors
  { name: 'Cyan', value: 'text-cyan-600', bgColor: 'bg-cyan-600' },
  { name: 'Blue', value: 'text-blue-600', bgColor: 'bg-blue-600' },
  { name: 'Purple', value: 'text-purple-600', bgColor: 'bg-purple-600' },
  { name: 'Pink', value: 'text-pink-600', bgColor: 'bg-pink-600' },
  { name: 'Gray', value: 'text-gray-600', bgColor: 'bg-gray-600' },
  { name: 'Black', value: 'text-black', bgColor: 'bg-black' },
] as const

interface SpaceEditPopoverProps {
  space?: SpaceResponse // Optional for create mode
  mode: 'create' | 'edit'
  children: React.ReactNode
  onUpdate?: (data: UpdateSpaceRequest) => Promise<void>
  onCreate?: (data: { name: string; icon: string; icon_color: string }) => Promise<void>
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SpaceEditPopover({ space, mode, children, onUpdate, onCreate, disabled, open: controlledOpen, onOpenChange: externalOnOpenChange }: SpaceEditPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen

  // Generate random defaults for create mode
  const getRandomIcon = () => PRESET_ICONS[Math.floor(Math.random() * PRESET_ICONS.length)]
  const getRandomColor = () => PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].value

  const [name, setName] = useState(space?.name || '')
  const [icon, setIcon] = useState(space?.icon || getRandomIcon())
  const [iconColor, setIconColor] = useState(space?.icon_color || getRandomColor())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [canCloseOnOutsideClick, setCanCloseOnOutsideClick] = useState(false)

  // Update values when space changes or when popover opens
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && space) {
        setName(space.name)
        setIcon(space.icon || 'Folder')
        setIconColor(space.icon_color || 'text-blue-600')
      } else if (mode === 'create') {
        setName('')
        setIcon(getRandomIcon())
        setIconColor(getRandomColor())
      }
    }
  }, [open, mode, space?.name, space?.icon, space?.icon_color])

  const handleSubmit = async () => {
    if (!name.trim() || isSubmitting) return

    const trimmedName = name.trim()

    setIsSubmitting(true)
    try {
      if (mode === 'create') {
        await onCreate?.({ name: trimmedName, icon, icon_color: iconColor })
      } else if (mode === 'edit' && space) {
        // Check if anything changed
        const hasChanges =
          trimmedName !== space.name ||
          icon !== space.icon ||
          iconColor !== space.icon_color

        if (!hasChanges) {
          handleOpenChange(false)
          return
        }

        const updateData: UpdateSpaceRequest = {}

        if (trimmedName !== space.name) {
          updateData.name = trimmedName
        }
        if (icon !== space.icon) {
          updateData.icon = icon
        }
        if (iconColor !== space.icon_color) {
          updateData.icon_color = iconColor
        }

        await onUpdate?.(updateData)
      }
      handleOpenChange(false)
    } catch (error) {
      console.error(`Failed to ${mode} space:`, error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset to original values when closing
      if (mode === 'edit' && space) {
        setName(space.name)
        setIcon(space.icon || 'Folder')
        setIconColor(space.icon_color || 'text-blue-600')
      } else {
        setName('')
      }
      setCanCloseOnOutsideClick(false)
    } else {
      // When opening, delay allowing outside clicks to prevent immediate close
      setCanCloseOnOutsideClick(false)
      setTimeout(() => {
        setCanCloseOnOutsideClick(true)
      }, 200)
    }

    if (controlledOpen === undefined) {
      setInternalOpen(newOpen)
    }
    externalOnOpenChange?.(newOpen)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      handleOpenChange(false)
    }
  }

  // Get the icon component
  const IconComponent = (Icons as any)[icon] || Icons.Folder

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        side="right"
        align="center"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Only allow closing if enough time has passed since opening
          if (!canCloseOnOutsideClick) {
            e.preventDefault()
          }
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="space-name">Space Name</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter space name..."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_ICONS.map((iconName) => {
                const Icon = (Icons as any)[iconName]
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className={cn(
                      "p-2 rounded-md transition-colors flex items-center justify-center group",
                      "hover:bg-primary hover:text-primary-foreground",
                      icon === iconName && "bg-primary text-primary-foreground ring-2 ring-primary"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5",
                      icon !== iconName && "group-hover:text-primary-foreground"
                    )} />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setIconColor(color.value)}
                  className="relative flex items-center justify-center"
                >
                  <div className={cn(
                    "h-6 w-6 rounded-full transition-all",
                    color.bgColor,
                    iconColor === color.value && "ring-2 ring-primary ring-offset-1"
                  )} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
            >
              <Check className="h-4 w-4 mr-1" />
              {isSubmitting ? (mode === 'create' ? 'Creating...' : 'Saving...') : (mode === 'create' ? 'Create' : 'Save')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
