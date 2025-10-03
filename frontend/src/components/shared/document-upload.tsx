"use client";

import type React from "react";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Cloud, Upload, X, FileText, Trash2, Check, Link, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadFile, useUploadWebDocument } from "@/hooks/use-upload";
import { useDeleteDocument } from "@/hooks/use-documents";
import { useSpaceDocuments } from "@/hooks/use-documents";

interface UploadItem {
    id: string;
    type: "file" | "url";
    file?: File;
    url?: string;
    name: string;
    status: "pending" | "uploading" | "completed" | "error" | "waiting";
    progress: number;
    error?: string;
    documentId?: string;
}

interface DocumentUploadProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spaceId: string;
}

export function DocumentUpload({ open, onOpenChange, spaceId }: DocumentUploadProps) {
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isProcessingQueue = useRef(false);
    const uploadingIds = useRef(new Set<string>());

    const uploadFileMutation = useUploadFile();
    const uploadWebDocumentMutation = useUploadWebDocument();
    const deleteDocumentMutation = useDeleteDocument();

    // Queue processing function
    const processQueue = () => {
        if (isProcessingQueue.current) return;

        setUploadItems(prev => {
            const nextWaiting = prev.find(item => item.status === "waiting");
            const hasUploading = prev.some(item => item.status === "uploading" || item.status === "pending");

            if (nextWaiting && !hasUploading) {
                isProcessingQueue.current = true;

                // Start the next upload
                setTimeout(() => {
                    if (nextWaiting.type === "file") {
                        uploadFile(nextWaiting);
                    } else {
                        uploadUrl(nextWaiting);
                    }
                    isProcessingQueue.current = false;
                }, 100);

                return prev.map(f =>
                    f.id === nextWaiting.id
                        ? { ...f, status: "pending" }
                        : f
                );
            }

            return prev;
        });
    };

    // Get space documents to check if uploaded documents still exist
    const { data: documentsData } = useSpaceDocuments(spaceId);

    // Remove completed upload items if their documents no longer exist in the space
    useEffect(() => {
        if (!documentsData?.documents) return;

        const existingDocumentIds = new Set(documentsData.documents.map(doc => doc.id));

        setUploadItems(prev =>
            prev.filter(item =>
                item.status !== "completed" || !item.documentId || existingDocumentIds.has(item.documentId)
            )
        );
    }, [documentsData?.documents]);

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 KB";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Number.parseFloat((bytes / Math.pow(k, i)).toFixed(0)) + " " + sizes[i]
        );
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        handleFiles(droppedFiles);
    }, []);

    const handleFiles = (fileList: File[]) => {
        const newFiles: UploadItem[] = fileList.map((file, index) => ({
            id: Date.now().toString() + index,
            type: "file",
            file,
            name: file.name,
            status: "waiting" as const,
            progress: 0,
        }));

        setUploadItems((prev) => [...newFiles, ...prev]);

        // Start processing the queue
        setTimeout(processQueue, 100);
    };

    const uploadFile = async (uploadItem: UploadItem) => {
        if (!uploadItem.file) return;

        if (uploadingIds.current.has(uploadItem.id)) {
            return;
        }

        uploadingIds.current.add(uploadItem.id);

        setUploadItems((prev) =>
            prev.map((f) =>
                f.id === uploadItem.id
                    ? { ...f, status: "uploading", progress: 0 }
                    : f
            )
        );

        try {
            const response = await uploadFileMutation.mutateAsync({
                file: uploadItem.file,
                spaceId,
            });

            setUploadItems((prev) =>
                prev.map((f) =>
                    f.id === uploadItem.id
                        ? { ...f, status: "completed", progress: 100, documentId: response.document_id }
                        : f
                )
            );

            uploadingIds.current.delete(uploadItem.id);

            setTimeout(processQueue, 200);
        } catch (error) {
            setUploadItems((prev) =>
                prev.map((f) =>
                    f.id === uploadItem.id
                        ? {
                              ...f,
                              status: "error",
                              error: error instanceof Error ? error.message : "Upload failed",
                          }
                        : f
                )
            );

            uploadingIds.current.delete(uploadItem.id);

            setTimeout(processQueue, 200);
        }
    };

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(Array.from(e.target.files));
        }
    };

    const removeUploadItem = (itemId: string) => {
        setUploadItems((prev) => prev.filter((item) => item.id !== itemId));
    };

    const handleDeleteUploadedDocument = async (uploadItem: UploadItem) => {
        if (!uploadItem.documentId) {
            // If no document ID, just remove from the list
            removeUploadItem(uploadItem.id);
            return;
        }

        try {
            await deleteDocumentMutation.mutateAsync(uploadItem.documentId);
            removeUploadItem(uploadItem.id);
        } catch (error) {
        }
    };

    const handleUrlUpload = async () => {
        if (!urlInput.trim()) return;

        const urlItem: UploadItem = {
            id: Date.now().toString(),
            type: "url",
            url: urlInput.trim(),
            name: urlInput.trim(),
            status: "waiting",
            progress: 0,
        };

        setUploadItems((prev) => [urlItem, ...prev]);
        setUrlInput("");

        setTimeout(processQueue, 100);
    };

    const uploadUrl = async (uploadItem: UploadItem) => {
        if (!uploadItem.url) return;

        if (uploadingIds.current.has(uploadItem.id)) {
            return;
        }

        uploadingIds.current.add(uploadItem.id);

        setUploadItems((prev) =>
            prev.map((f) =>
                f.id === uploadItem.id
                    ? { ...f, status: "uploading", progress: 0 }
                    : f
            )
        );

        try {
            const response = await uploadWebDocumentMutation.mutateAsync({
                url: uploadItem.url,
                space_id: spaceId,
            });

            setUploadItems((prev) =>
                prev.map((f) =>
                    f.id === uploadItem.id
                        ? { ...f, status: "completed", progress: 100, documentId: response.document_id }
                        : f
                )
            );

            uploadingIds.current.delete(uploadItem.id);

            setTimeout(processQueue, 200);
        } catch (error) {
            setUploadItems((prev) =>
                prev.map((f) =>
                    f.id === uploadItem.id
                        ? {
                              ...f,
                              status: "error",
                              error: error instanceof Error ? error.message : "Upload failed",
                          }
                        : f
                )
            );

            uploadingIds.current.delete(uploadItem.id);

            setTimeout(processQueue, 200);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && urlInput.trim()) {
            handleUrlUpload();
        }
    };

    const getUploadIcon = (uploadItem: UploadItem) => {
        if (uploadItem.type === "url") {
            return (
                <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center">
                    <span className="text-indigo-600 text-xs font-semibold">URL</span>
                </div>
            );
        }

        if (!uploadItem.file) return <FileText className="w-8 h-8 text-gray-400" />;

        const file = uploadItem.file;
        const type = file.type;
        if (type.includes("pdf")) {
            return (
                <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                    <span className="text-red-600 text-xs font-semibold">PDF</span>
                </div>
            );
        }
        if (type.startsWith("image/")) {
            return (
                <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                    <span className="text-green-600 text-xs font-semibold">IMG</span>
                </div>
            );
        }
        if (type.includes("word") || type.includes("document")) {
            return (
                <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 text-xs font-semibold">DOC</span>
                </div>
            );
        }
        return <FileText className="w-8 h-8 text-gray-400" />;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0">
                <DialogHeader className="p-6 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <Cloud className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-semibold">
                                    Upload files
                                </DialogTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Select and upload the files of your choice
                                </p>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="px-6 pb-6 space-y-6 min-w-0">
                    {/* Drop Zone */}
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                            isDragOver
                                ? "border-blue-400 bg-blue-50"
                                : "border-gray-300 hover:border-gray-400"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">
                            Choose a file or drag & drop it here.
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            PDF, Word documents, and images up to 50 MB.
                        </p>
                        <Button
                            variant="outline"
                            onClick={handleBrowseClick}
                            className="bg-white"
                        >
                            Browse File
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            multiple
                            accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.tiff"
                            onChange={handleFileInputChange}
                        />
                    </div>

                    {/* Upload Items List */}
                    {uploadItems.length > 0 && (
                        <div className="space-y-3 max-h-[320px] overflow-y-auto overflow-x-hidden pr-1">
                            {uploadItems.map((uploadItem) => (
                                <div
                                    key={uploadItem.id}
                                    className="flex items-center gap-3 p-3 border rounded-lg min-w-0"
                                >
                                    {getUploadIcon(uploadItem)}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1 min-w-0">
                                            <p className="text-sm font-medium truncate min-w-0 flex-1" title={uploadItem.type === "url" ? uploadItem.url : uploadItem.name}>
                                                {uploadItem.name}
                                            </p>
                                            <button
                                                onClick={() => uploadItem.status === "completed" && uploadItem.documentId ? handleDeleteUploadedDocument(uploadItem) : removeUploadItem(uploadItem.id)}
                                                className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
                                                disabled={uploadItem.status === "uploading"}
                                            >
                                                {uploadItem.status === "completed" ? (
                                                    <Trash2 className="w-4 h-4" />
                                                ) : (
                                                    <X className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {uploadItem.type === "file" && uploadItem.file && (
                                                <>
                                                    <span>
                                                        {formatFileSize(uploadItem.file.size)}
                                                    </span>
                                                    <span>•</span>
                                                </>
                                            )}
                                            {uploadItem.type === "url" && (
                                                <>
                                                    <span>Web Document</span>
                                                    <span>•</span>
                                                </>
                                            )}
                                            {uploadItem.status === "pending" && (
                                                <span>Pending...</span>
                                            )}
                                            {uploadItem.status === "waiting" && (
                                                <span className="text-gray-500">Waiting...</span>
                                            )}
                                            {uploadItem.status === "uploading" && (
                                                <div className="flex items-center gap-1">
                                                    <Spinner size="sm" className="w-3 h-3" />
                                                    <span>Uploading...</span>
                                                </div>
                                            )}
                                            {uploadItem.status === "completed" && (
                                                <div className="flex items-center gap-1 text-green-600">
                                                    <Check className="w-3 h-3" />
                                                    <span>Completed</span>
                                                </div>
                                            )}
                                            {uploadItem.status === "error" && (
                                                <div className="flex items-center gap-1 text-red-600">
                                                    <AlertCircle className="w-3 h-3" />
                                                    <span>Failed</span>
                                                </div>
                                            )}
                                        </div>
                                        {uploadItem.status === "error" && uploadItem.error && (
                                            <p className="text-xs text-red-600 mt-1">
                                                {uploadItem.error}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-sm text-muted-foreground">OR</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* URL Import */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium">Import from URL Link</h3>
                                <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center">
                                    <span className="text-xs text-gray-500">?</span>
                                </div>
                            </div>
                            <Button
                                onClick={handleUrlUpload}
                                disabled={!urlInput.trim()}
                                size="sm"
                                variant="outline"
                            >
                                Import URL
                            </Button>
                        </div>
                        <div className="relative">
                            <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Paste file URL"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="pl-10"
                                disabled={false}
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
