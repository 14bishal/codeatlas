
"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { FileExplorer } from "@/components/dashboard/file-explorer";
import { CodeViewer } from "@/components/dashboard/code-viewer";
import { useState, useEffect } from "react";
import type { FileNode } from "@/lib/actions";
import { getFileContent } from "@/lib/actions";

interface FileBrowserViewProps {
    fileTree: FileNode | null;
    repoId: string | null;
}

export function FileBrowserView({ fileTree, repoId }: FileBrowserViewProps) {
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [fileContent, setFileContent] = useState<string>("");

    useEffect(() => {
        if (!selectedFile || !repoId) return;
        const tid = setTimeout(() => setFileContent("// Loading..."), 0);
        getFileContent(repoId, selectedFile.path).then((content) => {
            setFileContent(content);
        });
        return () => clearTimeout(tid);
    }, [selectedFile, repoId]);

    return (
        <div className="h-full w-full rounded-lg border bg-card/20 overflow-hidden">
            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                {/* LEFT PANEL: File Explorer */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-card/50 flex flex-col border-r border-border">
                    {fileTree ? (
                        <FileExplorer data={fileTree} onSelectFile={setSelectedFile} />
                    ) : (
                        <div className="p-4 text-muted-foreground">Loading tree...</div>
                    )}
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* RIGHT PANEL: Code Viewer */}
                <ResizablePanel defaultSize={80} minSize={30} className="flex flex-col bg-background">
                    <div className="h-10 border-b border-border flex items-center px-4 bg-muted/20 shrink-0 justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                            {selectedFile ? selectedFile.name : "Select a file to view code"}
                        </span>
                        {selectedFile && (
                            <span className="text-xs text-muted-foreground opacity-50">{selectedFile.path}</span>
                        )}
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        <CodeViewer
                            code={selectedFile ? fileContent : "// Select a file from the explorer to view code"}
                            language={selectedFile?.name.split('.').pop() || 'typescript'}
                        />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
