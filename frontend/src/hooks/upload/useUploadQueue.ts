import { useState, useRef, useCallback, useEffect } from 'react';
import { useUploadFile, useUploadWebDocument, useUploadYouTubeVideo } from '@/hooks/documents/use-upload';
import { useDeleteDocument } from '@/hooks/documents/use-documents';
import { useSpaceDocuments } from '@/hooks/documents/use-documents';
import { UploadItem, UseUploadQueueResult } from '@/types/upload';
import { uploadLogger } from '@/utils/logger';

export function useUploadQueue(spaceId: string): UseUploadQueueResult {
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const uploadingIds = useRef(new Set<string>());

  const uploadFileMutation = useUploadFile();
  const uploadWebDocumentMutation = useUploadWebDocument();
  const uploadYouTubeVideoMutation = useUploadYouTubeVideo();
  const deleteDocumentMutation = useDeleteDocument();

  // Get space documents to check if uploaded documents still exist
  const { data: documentsData } = useSpaceDocuments(spaceId);

  // Remove completed upload items if their documents no longer exist in the space
  useEffect(() => {
    if (!documentsData?.documents) return;

    const existingDocumentIds = new Set(documentsData.documents.map(doc => doc.id));

    setQueue(prev =>
      prev.filter(item =>
        item.status !== "completed" || !item.documentId || existingDocumentIds.has(item.documentId)
      )
    );
  }, [documentsData?.documents]);

  const addToQueue = useCallback((items: Omit<UploadItem, 'id' | 'status' | 'progress'>[]) => {
    const newItems: UploadItem[] = items.map((item, index) => ({
      ...item,
      id: Date.now().toString() + index,
      status: "waiting",
      progress: 0,
    }));

    setQueue(prev => [...newItems, ...prev]);

    // Start processing the queue
    setTimeout(() => processQueue(), 100);
  }, []);

  const removeFromQueue = useCallback((itemId: string) => {
    setQueue(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    uploadingIds.current.clear();
  }, []);

  const cancelUpload = useCallback((itemId: string) => {
    const item = queue.find(i => i.id === itemId);
    if (!item) return;

    // Abort the request if it has an AbortController
    if (item.abortController) {
      item.abortController.abort();
    }

    // Mark as cancelled
    setQueue(prev =>
      prev.map(i =>
        i.id === itemId
          ? { ...i, status: "cancelled", error: "Upload cancelled", abortController: undefined }
          : i
      )
    );

    // Remove from uploading set
    uploadingIds.current.delete(itemId);

    // Process next in queue
    setTimeout(() => processQueue(), 200);
  }, [queue]);

  const uploadFile = useCallback(async (uploadItem: UploadItem) => {
    if (!uploadItem.file) return;

    if (uploadingIds.current.has(uploadItem.id)) {
      return;
    }

    uploadingIds.current.add(uploadItem.id);

    // Create AbortController for this upload
    const abortController = new AbortController();

    setQueue(prev =>
      prev.map(item =>
        item.id === uploadItem.id
          ? { ...item, status: "uploading", progress: 0, abortController }
          : item
      )
    );

    try {
      const response = await uploadFileMutation.mutateAsync({
        file: uploadItem.file,
        spaceId,
        signal: abortController.signal,
      });

      setQueue(prev =>
        prev.map(item =>
          item.id === uploadItem.id
            ? { ...item, status: "completed", progress: 100, documentId: response.document_id, abortController: undefined }
            : item
        )
      );

      uploadingIds.current.delete(uploadItem.id);

      setTimeout(() => processQueue(), 200);
    } catch (error) {
      // Silently ignore abort errors - they're expected when cancelling
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        uploadingIds.current.delete(uploadItem.id);
        setTimeout(() => processQueue(), 200);
        return;
      }

      uploadLogger.error('File upload failed', error, {
        action: 'uploadFile',
        fileName: uploadItem.file.name,
        fileSize: uploadItem.file.size,
        fileType: uploadItem.file.type,
        spaceId
      });

      setQueue(prev =>
        prev.map(item =>
          item.id === uploadItem.id
            ? {
                ...item,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
                abortController: undefined,
              }
            : item
        )
      );

      uploadingIds.current.delete(uploadItem.id);

      setTimeout(() => processQueue(), 200);
    }
  }, [uploadFileMutation, spaceId]);

  const uploadUrl = useCallback(async (uploadItem: UploadItem) => {
    if (!uploadItem.url) return;

    if (uploadingIds.current.has(uploadItem.id)) {
      return;
    }

    uploadingIds.current.add(uploadItem.id);

    // Create AbortController for this upload
    const abortController = new AbortController();

    setQueue(prev =>
      prev.map(item =>
        item.id === uploadItem.id
          ? { ...item, status: "uploading", progress: 0, abortController }
          : item
      )
    );

    try {
      let response;

      if (uploadItem.type === "youtube") {
        // YouTube upload
        response = await uploadYouTubeVideoMutation.mutateAsync({
          url: uploadItem.url,
          space_id: spaceId,
          segment_duration: 60,
          languages: ['en'],
          signal: abortController.signal,
        });
      } else {
        // Regular web document upload
        response = await uploadWebDocumentMutation.mutateAsync({
          url: uploadItem.url,
          space_id: spaceId,
          signal: abortController.signal,
        });
      }

      setQueue(prev =>
        prev.map(item =>
          item.id === uploadItem.id
            ? { ...item, status: "completed", progress: 100, documentId: response.document_id, abortController: undefined }
            : item
        )
      );

      uploadingIds.current.delete(uploadItem.id);

      setTimeout(() => processQueue(), 200);
    } catch (error) {
      // Silently ignore abort errors - they're expected when cancelling
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        uploadingIds.current.delete(uploadItem.id);
        setTimeout(() => processQueue(), 200);
        return;
      }

      uploadLogger.error('URL upload failed', error, {
        action: 'uploadUrl',
        url: uploadItem.url,
        uploadType: uploadItem.type,
        spaceId
      });

      setQueue(prev =>
        prev.map(item =>
          item.id === uploadItem.id
            ? {
                ...item,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
                abortController: undefined,
              }
            : item
        )
      );

      uploadingIds.current.delete(uploadItem.id);

      setTimeout(() => processQueue(), 200);
    }
  }, [uploadWebDocumentMutation, uploadYouTubeVideoMutation, spaceId]);

  const processQueue = useCallback(() => {
    if (isProcessing) return;

    setQueue(prev => {
      const nextWaiting = prev.find(item => item.status === "waiting");
      const hasUploading = prev.some(item => item.status === "uploading" || item.status === "pending");

      if (nextWaiting && !hasUploading) {
        setIsProcessing(true);

        // Start the next upload
        setTimeout(() => {
          if (nextWaiting.type === "file") {
            uploadFile(nextWaiting);
          } else {
            uploadUrl(nextWaiting);
          }
          setIsProcessing(false);
        }, 100);

        return prev.map(item =>
          item.id === nextWaiting.id
            ? { ...item, status: "pending" }
            : item
        );
      }

      return prev;
    });
  }, [isProcessing, uploadFile, uploadUrl]);

  const handleDeleteUploadedDocument = useCallback(async (itemId: string) => {
    const item = queue.find(i => i.id === itemId);
    if (!item?.documentId) {
      // If no document ID, just remove from the list
      removeFromQueue(itemId);
      return;
    }

    try {
      await deleteDocumentMutation.mutateAsync(item.documentId);
      removeFromQueue(itemId);
    } catch (error) {
      uploadLogger.error('Failed to delete uploaded document', error, {
        action: 'deleteUploadedDocument',
        documentId: item.documentId,
        documentName: item.name
      });
    }
  }, [queue, removeFromQueue, deleteDocumentMutation]);

  return {
    queue,
    isProcessing,
    uploadingIds: uploadingIds.current,
    addToQueue,
    removeFromQueue,
    clearQueue,
    cancelUpload,
    processQueue,
    handleDeleteUploadedDocument
  };
}