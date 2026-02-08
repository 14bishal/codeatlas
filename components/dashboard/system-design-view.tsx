"use client";

import { DependencyGraph, ProjectStats } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Cpu,
    Database,
    Globe,
    Layers,
    Server,
    Zap,
    Code,
    LayoutTemplate
} from "lucide-react";

interface SystemDesignViewProps {
    data: DependencyGraph | null;
    isLoading: boolean;
}

export function SystemDesignView({ data, isLoading }: SystemDesignViewProps) {
    if (isLoading) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p>Generating system design overview…</p>
            </div>
        );
    }

    if (!data || !data.stats) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                <p>No system data available.</p>
            </div>
        );
    }

    const { stats, nodes } = data;

    // --- Heuristic Helpers ---

    const getAppType = (stats: ProjectStats) => {
        if (stats.frameworks.includes("Next.js")) return "Next.js Full-Stack Application";
        if (stats.frameworks.includes("React") && stats.frameworks.includes("Express")) return "MERN Stack Application";
        if (stats.frameworks.includes("React")) return "React Single Page Application (SPA)";
        if (stats.frameworks.includes("Express")) return "Node.js/Express Backend API";
        return "JavaScript/TypeScript Project";
    };

    const getArchitectureDescription = (stats: ProjectStats) => {
        const patterns = stats.architecturalPatterns?.map(p => p.name) || [];
        if (patterns.includes("App Router / File-based routing")) {
            return "This project uses the Next.js App Router for file-system based routing. It likely leverages React Server Components for performance and SEO.";
        }
        if (patterns.includes("Pages Router (Next.js)")) {
            return "This project uses the classic Next.js Pages Router. It handles routing based on the 'pages' directory structure.";
        }
        if (patterns.includes("Layered (lib/components + types)")) {
            return "The codebase follows a scalable layered architecture, separating core logic (lib/utils) from UI components and type definitions.";
        }
        return "The project follows a conventional modular structure, organizing code into logical directories.";
    };

    const coreComponents = nodes.filter(n => n.moduleRole === "core").slice(0, 5);
    const entryPoints = stats.entryPoints.slice(0, 5);

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header Section */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">{getAppType(stats)}</h1>
                    <p className="text-lg text-muted-foreground">
                        System Analysis & Design Overview
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">

                    {/* High Level Architecture */}
                    <Card className="md:col-span-2 border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="w-5 h-5 text-primary" />
                                High-Level Architecture
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="leading-relaxed">
                                {getArchitectureDescription(stats)}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {stats.architecturalPatterns?.map((pattern) => (
                                    <Badge key={pattern.name} variant="outline" className="bg-background/50">
                                        {pattern.name}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tech Stack */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Layers className="w-4 h-4" />
                                Tech Stack
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <span className="text-sm font-medium text-muted-foreground block mb-2">Frameworks & Libraries</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {stats.frameworkVersions?.map((fw) => (
                                        <Badge key={fw.name} variant="secondary">
                                            {fw.name} {fw.version && <span className="opacity-50 ml-1 text-[10px]">{fw.version}</span>}
                                        </Badge>
                                    ))}
                                    {stats.frameworkVersions?.length === 0 && <span className="text-sm text-muted-foreground italic">None detected</span>}
                                </div>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-muted-foreground block mb-2">Languages</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(stats.languages).map(([lang]) => (
                                        <Badge key={lang} variant="outline" className="uppercase text-[10px]">
                                            {lang}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Core Modules */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Cpu className="w-4 h-4" />
                                Core Modules
                            </CardTitle>
                            <CardDescription>
                                Highly referenced components (High Fan-in)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {coreComponents.length > 0 ? (
                                <ul className="space-y-2">
                                    {coreComponents.map(node => (
                                        <li key={node.id} className="flex items-center gap-2 text-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            <span className="font-mono text-xs truncate" title={node.path}>{node.label}</span>
                                            {/* <span className="ml-auto text-xs text-muted-foreground">{node.fanIn} refs</span> */}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No distributed core modules detected.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Data Flow / Entry */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Zap className="w-4 h-4" />
                                Entry Points & Flow
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Public Interface</span>
                                    <div className="mt-1.5 space-y-1">
                                        {entryPoints.map(ep => (
                                            <div key={ep} className="bg-muted px-2 py-1 rounded text-xs font-mono truncate flex items-center gap-2">
                                                <LayoutTemplate className="w-3 h-3 opacity-50" />
                                                {ep}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-border">
                                    <p className="text-sm text-muted-foreground">
                                        Data typically flows from these entry points into feature components and then down to core utilities and UI primitives.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project Structure Insight */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Server className="w-4 h-4" />
                                Application Structure
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm space-y-2 text-muted-foreground">
                                <p>
                                    <strong className="text-foreground">Total Files:</strong> {stats.totalFiles}
                                </p>
                                <p>
                                    <strong className="text-foreground">Complexity:</strong> {nodes.length} analzyed nodes with {data.edges.length} dependencies.
                                </p>
                                <p>
                                    This codebase appears to be
                                    {nodes.length > 100 ? " a large-scale project " : nodes.length > 30 ? " a medium-sized project " : " a small project "}
                                    with {stats.languages['ts'] ? "strong typing usage (TypeScript)." : "dynamic typing (JavaScript)."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Future / Suggested Improvements (Static placeholder for now, could be dynamic) */}
                    <Card className="opacity-75">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Code className="w-4 h-4" />
                                Recommended Patterns
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                                {stats.frameworks.includes("React") && <li>Consider component composition to reduce prop drilling.</li>}
                                {stats.frameworks.includes("Next.js") && <li>Leverage Server Actions for mutation logic to simplify API layers.</li>}
                                {!stats.frameworks.includes("TypeScript") && <li>Migrating to TypeScript is recommended for better scalability.</li>}
                                <li>Ensure separate concerns between UI (components) and Business Logic (hooks/utils).</li>
                            </ul>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
