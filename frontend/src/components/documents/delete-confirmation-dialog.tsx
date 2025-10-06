import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Trash2 } from 'lucide-react'

interface DeleteConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentName?: string
  selectedCount?: number
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  documentName,
  selectedCount,
  isDeleting,
  onConfirm,
  onCancel
}: DeleteConfirmationDialogProps) {
  const isMultiple = (selectedCount ?? 0) > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete Document{isMultiple ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {documentName ? (
              <>
                Are you sure you want to delete "<strong>{documentName}</strong>"?
                This action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to delete <strong>{selectedCount} document{isMultiple ? 's' : ''}</strong>?
                This action cannot be undone and will permanently remove {isMultiple ? 'these documents' : 'this document'}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {documentName ? 'Document' : `${selectedCount} Document${isMultiple ? 's' : ''}`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
