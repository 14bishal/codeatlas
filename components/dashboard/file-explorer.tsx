"use client";

import { Folder, FileCode, ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/lib/actions";

interface FileExplorerProps {
    data: FileNode;
    onSelectFile?: (file: FileNode) => void;
}

function FileItem({ item, depth = 0, onSelectFile }: { item: FileNode, depth?: number, onSelectFile?: (file: FileNode) => void }) {
    const [isOpen, setIsOpen] = useState(depth === 0); // Open root by default
    const isFolder = item.type === "folder";

    const handleClick = () => {
        if (isFolder) {
            setIsOpen(!isOpen);
        } else {
            onSelectFile?.(item);
        }
    };

    return (
        <div>
            <div
                className={cn(
                    "flex items-center gap-1.5 py-1 px-2 hover:bg-muted/50 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors select-none",
                    { "bg-muted/30 text-foreground": isOpen && isFolder }
                )}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleClick}
            >
                <span className="opacity-70 shrink-0">
                    {isFolder ? (
                        isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                    ) : <div className="w-4" />}
                </span>

                {isFolder ? (
                    <Folder className="h-4 w-4 text-primary shrink-0" />
                ) : (
                    <FileCode className="h-4 w-4 text-blue-400 shrink-0" />
                )}

                <span className="truncate">{item.name}</span>
            </div>

            {isOpen && item.children && (
                <div>
                    {item.children.map((child: FileNode) => (
                        <FileItem key={child.path} item={child} depth={depth + 1} onSelectFile={onSelectFile} />
                    ))}
                </div>
            )}
        </div>
    );
}

export function FileExplorer({ data, onSelectFile }: FileExplorerProps) {
    if (!data) return <div className="p-4 text-sm text-red-400">No data found</div>;

    return (
        <div className="h-full bg-card flex flex-col">
            <div className="h-10 flex items-center px-4 border-b border-border shrink-0">
                <span className="font-semibold text-sm">Explorer</span>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
                {/* If root is the connection folder, skip rendering the root node itself and render children? 
             Actually usually we want to see the root folder name. */}
                <FileItem item={data} onSelectFile={onSelectFile} />
            </div>
        </div>
    );
}
