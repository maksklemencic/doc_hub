"use client";

import type React from "react";

import { useState, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Cloud, Upload, X, FileText, Trash2, Check, Link } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUpload {
    id: string;
    name: string;
    size: number;
    totalSize: number;
    status: "uploading" | "completed" | "error";
    progress: number;
    type: string;
}

interface DocumentUploadProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DocumentUpload({ open, onOpenChange }: DocumentUploadProps) {
    const [files, setFiles] = useState<FileUpload[]>([
        {
            id: "1",
            name: "my-cv.pdf",
            size: 0,
            totalSize: 120 * 1024, // 120 KB
            status: "uploading",
            progress: 25,
            type: "pdf",
        },
        {
            id: "2",
            name: "google-certificate.pdf",
            size: 94 * 1024, // 94 KB
            totalSize: 94 * 1024,
            status: "completed",
            progress: 100,
            type: "pdf",
        },
    ]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        const newFiles: FileUpload[] = fileList.map((file, index) => ({
            id: Date.now().toString() + index,
            name: file.name,
            size: 0,
            totalSize: file.size,
            status: "uploading" as const,
            progress: 0,
            type: file.type.includes("pdf") ? "pdf" : "file",
        }));

        setFiles((prev) => [...prev, ...newFiles]);

        // Simulate upload progress
        newFiles.forEach((file) => {
            simulateUpload(file.id);
        });
    };

    const simulateUpload = (fileId: string) => {
        const interval = setInterval(() => {
            setFiles((prev) =>
                prev.map((file) => {
                    if (file.id === fileId && file.status === "uploading") {
                        const newProgress = Math.min(
                            file.progress + Math.random() * 20,
                            100
                        );
                        const newSize = Math.floor((newProgress / 100) * file.totalSize);

                        if (newProgress >= 100) {
                            clearInterval(interval);
                            return {
                                ...file,
                                progress: 100,
                                size: file.totalSize,
                                status: "completed" as const,
                            };
                        }

                        return {
                            ...file,
                            progress: newProgress,
                            size: newSize,
                        };
                    }
                    return file;
                })
            );
        }, 500);
    };

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(Array.from(e.target.files));
        }
    };

    const removeFile = (fileId: string) => {
        setFiles((prev) => prev.filter((file) => file.id !== fileId));
    };

    const getFileIcon = (type: string) => {
        if (type === "pdf") {
            return (
                <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                    <span className="text-red-600 text-xs font-semibold">PDF</span>
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

                <div className="px-6 pb-6 space-y-6">
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
                            JPEG, PNG, PDF, and MP4 formats, up to 50 MB.
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
                            accept=".jpg,.jpeg,.png,.pdf,.mp4"
                            onChange={handleFileInputChange}
                        />
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="space-y-3">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-3 p-3 border rounded-lg"
                                >
                                    {getFileIcon(file.type)}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-sm font-medium truncate">
                                                {file.name}
                                            </p>
                                            <button
                                                onClick={() => removeFile(file.id)}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                {file.status === "completed" ? (
                                                    <Trash2 className="w-4 h-4" />
                                                ) : (
                                                    <X className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>
                                                {formatFileSize(file.size)} of{" "}
                                                {formatFileSize(file.totalSize)}
                                            </span>
                                            <span>•</span>
                                            {file.status === "uploading" && (
                                                <div className="flex items-center gap-1">
                                                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                                    <span>Uploading...</span>
                                                </div>
                                            )}
                                            {file.status === "completed" && (
                                                <div className="flex items-center gap-1 text-green-600">
                                                    <Check className="w-3 h-3" />
                                                    <span>Completed</span>
                                                </div>
                                            )}
                                        </div>
                                        {file.status === "uploading" && (
                                            <Progress value={file.progress} className="mt-2 h-1" />
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
                        <div className="flex items-center gap-2 mb-3">
                            <h3 className="text-sm font-medium">Import from URL Link</h3>
                            <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-xs text-gray-500">?</span>
                            </div>
                        </div>
                        <div className="relative">
                            <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Paste file URL"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
