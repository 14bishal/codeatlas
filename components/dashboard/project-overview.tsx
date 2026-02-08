"use client";

import { DependencyGraph, ArchitecturalPattern } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Code,
    Layers,
    FileText,
    Activity,
    GitBranch,
    AlertTriangle,
    ArrowDownToLine,
    ArrowUpFromLine,
    CircleDot,
    LayoutGrid,
    Eye,
} from "lucide-react";

interface ProjectOverviewProps {
    graph: DependencyGraph | null;
    isLoading?: boolean;
}

function getShortPath(fullPath: string): string {
    const parts = fullPath.replace(/\\/g, "/").split("/");
    return parts.slice(-2).join("/") || fullPath;
}

export function ProjectOverview({ graph, isLoading }: ProjectOverviewProps) {
    const stats = graph?.stats;
    if (!stats) {
        return (
            <div className="flex h-full min-h-[200px] items-center justify-center p-8 text-muted-foreground">
                <div className="text-center">
                    {isLoading ? (
                        <>
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <p className="mt-4 font-medium">Analyzing repository…</p>
                            <p className="mt-1 text-sm">Detecting languages, frameworks, and dependencies.</p>
                        </>
                    ) : (
                        <>
                            <p>No project data available.</p>
                            <p className="mt-2 text-sm">The repo may have no analyzable JS/TS files or analysis failed.</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    const languages = Object.entries(stats.languages).sort(([, a], [, b]) => b - a);

    return (
        <div className="space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Visualize — tips */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" />
                        Visualize
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1.5">
                    <p>• Switch to <strong className="text-foreground">Architecture</strong> tab for the dependency graph view.</p>
                    <p>• Hover edges to see <strong className="text-foreground">source → target</strong> relationships.</p>
                    <p>• Risky nodes (high coupling / large files) are <strong className="text-foreground">highlighted</strong>; use the filter to show only risky nodes.</p>
                </CardContent>
            </Card>

            {/* Detects — Languages, Frameworks, Entry points, Patterns (with versions) */}
            <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    Detects
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalFiles}</div>
                            <p className="text-xs text-muted-foreground">Source files analyzed</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Language(s)</CardTitle>
                            <Code className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold capitalize">
                                {languages.slice(0, 3).map(([lang]) => lang).join(", ") || "—"}
                            </div>
                            {stats.languageVersions?.node && (
                                <p className="text-xs text-muted-foreground">Node {stats.languageVersions.node}</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Framework(s)</CardTitle>
                            <Layers className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {(stats.frameworkVersions?.length ? stats.frameworkVersions : stats.frameworks.map((name) => ({ name, version: undefined as string | undefined }))).map((fw) => (
                                    <Badge key={fw.name} variant="secondary" className="font-mono text-xs">
                                        {fw.name}
                                        {fw.version ? `@${fw.version}` : ""}
                                    </Badge>
                                ))}
                                {!stats.frameworkVersions?.length && !stats.frameworks.length && (
                                    <span className="text-sm text-muted-foreground">No major frameworks detected</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 mt-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Entry Points
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats.entryPoints.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {stats.entryPoints.map((ep) => (
                                        <div key={ep} className="flex items-center gap-2 text-sm font-mono bg-muted/50 px-2 py-1.5 rounded truncate" title={ep}>
                                            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                            <span className="truncate">{ep}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No conventional entry points detected.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4" />
                                Architectural Patterns
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(stats.architecturalPatterns?.length ?? 0) > 0 ? (
                                <ul className="space-y-1.5 text-sm">
                                    {stats.architecturalPatterns!.map((p: ArchitecturalPattern) => (
                                        <li key={p.name} className="flex items-start gap-2">
                                            <Badge variant={p.confidence === "high" ? "default" : "secondary"} className="shrink-0 text-xs">
                                                {p.name}
                                            </Badge>
                                            {p.hint && <span className="text-muted-foreground text-xs truncate">{p.hint}</span>}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">Conventional file-based structure.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Dependency & Data Flow */}
            <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-primary" />
                    Dependency & Data Flow
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {graph?.highFanInIds && graph.highFanInIds.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <ArrowDownToLine className="h-4 w-4" />
                                    High Fan-in
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground mb-2">Most imported files (core dependencies)</p>
                                <ul className="space-y-1 text-sm font-mono truncate">
                                    {graph.highFanInIds.slice(0, 5).map((id) => {
                                        const node = graph.nodes.find((n) => n.id === id);
                                        return (
                                            <li key={id} className="truncate" title={node?.path ?? id}>
                                                {node ? getShortPath(node.path) || node.label : getShortPath(id)}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {graph?.highFanOutIds && graph.highFanOutIds.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <ArrowUpFromLine className="h-4 w-4" />
                                    High Fan-out
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground mb-2">Files that import the most</p>
                                <ul className="space-y-1 text-sm font-mono truncate">
                                    {graph.highFanOutIds.slice(0, 5).map((id) => {
                                        const node = graph.nodes.find((n) => n.id === id);
                                        return (
                                            <li key={id} className="truncate" title={node?.path ?? id}>
                                                {node ? getShortPath(node.path) || node.label : getShortPath(id)}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {graph?.circularDependencies && graph.circularDependencies.length > 0 && (
                        <Card className="md:col-span-2 border-amber-500/30 bg-amber-500/5">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="h-4 w-4" />
                                    Circular Dependencies
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground mb-2">{graph.circularDependencies.length} cycle(s) detected</p>
                                <ul className="space-y-1.5 text-sm">
                                    {graph.circularDependencies.slice(0, 3).map((cycle, i) => (
                                        <li key={i} className="font-mono text-xs truncate" title={cycle.pathLabels.join(" → ")}>
                                            {cycle.pathLabels.slice(0, 3).join(" → ")}
                                            {cycle.pathLabels.length > 3 ? "…" : ""}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <CircleDot className="h-4 w-4" />
                                Core vs Peripheral
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                In the graph: <strong className="text-foreground">Core</strong> = high fan-in; <strong className="text-foreground">Peripheral</strong> = low connectivity; <strong className="text-foreground">Connector</strong> = high fan-out.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Language distribution — title fixed, list scrollable */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Language Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-2 pr-1">
                        {languages.map(([lang, count]) => (
                            <div key={lang} className="flex items-center gap-2 min-h-[20px]">
                                <div className="w-16 text-xs font-medium capitalize shrink-0">{lang}</div>
                                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden min-w-0">
                                    <div
                                        className="h-full bg-primary rounded-full"
                                        style={{ width: `${Math.min(100, (count / stats.totalFiles) * 100)}%` }}
                                    />
                                </div>
                                <div className="w-8 text-xs text-muted-foreground text-right shrink-0">{count}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
