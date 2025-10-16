"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { LucideIcon } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: "default" | "destructive" | "warning"
  loading?: boolean
  disabled?: boolean
  icon?: LucideIcon
  className?: string
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
  loading = false,
  disabled = false,
  icon: Icon,
  className
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    if (!loading && !disabled) {
      onConfirm()
      if (!loading) {
        onOpenChange(false)
      }
    }
  }

  const handleCancel = () => {
    if (!loading && !disabled) {
      onCancel?.()
      onOpenChange(false)
    }
  }

  const getVariantClasses = () => {
    switch (variant) {
      case "destructive":
        return "border-red-200 text-red-900"
      case "warning":
        return "border-yellow-200 text-yellow-900"
      default:
        return ""
    }
  }

  const getConfirmButtonVariant = () => {
    switch (variant) {
      case "destructive":
        return "destructive" as const
      case "warning":
        return "default" as const
      default:
        return "default" as const
    }
  }

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case "warning":
        return "bg-yellow-600 hover:bg-yellow-700 text-white"
      default:
        return ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-md ${className} ${getVariantClasses()}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5" />}
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-left">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading || disabled}
          >
            {cancelText}
          </Button>
          <Button
            variant={getConfirmButtonVariant()}
            onClick={handleConfirm}
            disabled={loading || disabled}
            className={getConfirmButtonClasses()}
          >
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {confirmText.replace(/^(Delete|Logout|Remove)/, '$1ing...')}
              </>
            ) : (
              <>
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {confirmText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}