"use client";

import type React from "react";
import { useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Cloud } from "lucide-react";
import { FileDropZone } from "@/components/upload/FileDropZone";
import { UploadProgressList } from "@/components/upload/UploadProgressList";
import { UrlImportSection } from "@/components/upload/UrlImportSection";
import { useUploadQueue } from "@/hooks/upload/useUploadQueue";
import { useUrlImport } from "@/hooks/upload/useUrlImport";
import { useFileValidation } from "@/hooks/upload/useFileValidation";
import { validateUrl, isYouTubeUrl, extractUrlFromText } from "@/utils/upload-validation";
import { UploadItem } from "@/types/upload";

interface DocumentUploadProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spaceId: string;
}

export function DocumentUpload({ open, onOpenChange, spaceId }: DocumentUploadProps) {
    const { validateFiles } = useFileValidation();

    const {
        queue,
        removeFromQueue,
        cancelUpload,
        handleDeleteUploadedDocument,
        addToQueue
    } = useUploadQueue(spaceId);

    const urlImport = useUrlImport(addToQueue);

    // Auto-paste handler when dialog is open
    useEffect(() => {
        if (!open) return;

        const handlePaste = async (e: ClipboardEvent) => {
            e.preventDefault();

            // Handle file paste
            const items = e.clipboardData?.items;
            if (items) {
                const files: File[] = [];
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        if (file) {
                            files.push(file);
                        }
                    }
                }
                if (files.length > 0) {
                    handleFiles(files);
                    return;
                }
            }

            // Handle URL paste
            const pastedText = e.clipboardData?.getData('text');
            if (pastedText && pastedText.trim()) {
                const extractedUrl = extractUrlFromText(pastedText);
                if (extractedUrl) {
                    await urlImport.handleUrlImport(extractedUrl);
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, [open, urlImport]);

    const handleFiles = (fileList: File[]) => {
        // Validate files
        const validationResults = validateFiles(fileList);
        const validFiles = fileList.filter((file, index) => validationResults[index].valid);

        if (validFiles.length === 0) {
            // All files are invalid
            return;
        }

        const newFiles: Omit<UploadItem, 'id' | 'status' | 'progress'>[] = validFiles.map((file) => ({
            type: "file" as const,
            file,
            name: file.name,
        }));

        addToQueue(newFiles);
    };

    const handleUrlImport = async (url: string) => {
        // Validate URL
        const validation = validateUrl(url);
        if (!validation.valid) {
            throw new Error(validation.error || 'Invalid URL');
        }

        const isYouTube = isYouTubeUrl(url);

        const urlItem: Omit<UploadItem, 'id' | 'status' | 'progress'> = {
            type: isYouTube ? "youtube" : "url",
            url: url.trim(),
            name: url.trim(),
        };

        addToQueue([urlItem]);
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
                    <FileDropZone onFilesDrop={handleFiles} />

                    {/* Upload Items List */}
                    <UploadProgressList
                        items={queue}
                        onDeleteItem={handleDeleteUploadedDocument}
                        onCancelUpload={cancelUpload}
                    />

                    {/* Divider */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-sm text-muted-foreground">OR</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* URL Import */}
                    <UrlImportSection onUrlImport={handleUrlImport} />
                </div>
            </DialogContent>
        </Dialog>
    );
}