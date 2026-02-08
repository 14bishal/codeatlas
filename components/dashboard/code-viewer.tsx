"use client";

import Editor from "@monaco-editor/react";

interface CodeViewerProps {
    code?: string;
    language?: string;
}

export function CodeViewer({ code = "// Select a file to view its content", language = "javascript" }: CodeViewerProps) {
    return (
        <div className="h-full w-full overflow-hidden rounded-md border border-border bg-card">
            <div className="flex h-10 items-center border-b border-border px-4 bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground">Code View</span>
            </div>
            <div className="h-[calc(100%-2.5rem)]">
                <Editor
                    height="100%"
                    defaultLanguage={language}
                    value={code} // Use value for controlled, defaultValue for uncontrolled. Let's use value if we update it.
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        readOnly: true,
                        domReadOnly: true,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        fontFamily: "var(--font-geist-mono), monospace",
                    }}
                    loading={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading Editor...</div>}
                />
            </div>
        </div>
    );
}
