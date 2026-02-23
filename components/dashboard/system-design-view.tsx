"use client";

import { DependencyGraph, ProjectStats, SecurityInsight } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Cpu,
    Globe,
    Layers,
    Server,
    Zap,
    Code,
    LayoutTemplate,
    ShieldAlert,
    ShieldCheck,
    Activity,
    PieChart,
    AlertTriangle,
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

    const { stats, nodes, securityInsights, layerBreakdown, codeQualityScore } = data;

    // --- Heuristic Helpers ---

    const getAppType = (stats: ProjectStats) => {
        const fw = stats.frameworks;
        if (fw.includes("Next.js")) return "Next.js Full-Stack Application";
        if (fw.includes("React") && fw.includes("Express")) return "MERN Stack Application";
        if (fw.includes("React")) return "React Single Page Application (SPA)";
        if (fw.includes("React Native")) return "React Native Mobile App";
        if (fw.includes("Django")) return "Django Web Application";
        if (fw.includes("Flask")) return "Flask Microservice";
        if (fw.includes("FastAPI")) return "FastAPI Backend Service";
        if (fw.includes("Spring Boot")) return "Spring Boot Application";
        if (fw.includes("Ruby on Rails")) return "Ruby on Rails Application";
        if (fw.includes("Laravel")) return "Laravel PHP Application";
        if (fw.includes("Express") || fw.includes("Fastify") || fw.includes("NestJS")) return "Node.js Backend API";
        if (fw.includes("Gin") || fw.includes("Echo") || fw.includes("Fiber")) return "Go Web Service";
        if (fw.includes("Actix") || fw.includes("Rocket")) return "Rust Web Service";
        if (fw.includes("Ktor")) return "Kotlin Backend Service";
        if (fw.includes("Electron")) return "Electron Desktop Application";

        // Fallback to primary language
        const lang = stats.primaryLanguage;
        if (lang === "py") return "Python Project";
        if (lang === "go") return "Go Project";
        if (lang === "java") return "Java Project";
        if (lang === "rs") return "Rust Project";
        if (lang === "rb") return "Ruby Project";
        if (lang === "php") return "PHP Project";
        if (lang === "cs") return "C# Project";
        if (lang === "kt") return "Kotlin Project";
        if (lang === "swift") return "Swift Project";
        if (lang === "dart") return "Flutter/Dart Project";
        if (lang === "c" || lang === "cpp" || lang === "cc") return "C/C++ Project";
        return "Software Project";
    };

    const getArchitectureDescription = (stats: ProjectStats) => {
        const patterns = stats.architecturalPatterns?.map((p) => p.name) || [];
        if (patterns.includes("MVT (Model-View-Template)"))
            return "This project uses Django's Model-View-Template architecture for building web applications with a clear separation of data, logic, and presentation.";
        if (patterns.includes("MVC (Model-View-Controller)"))
            return "This project follows the Model-View-Controller pattern, separating application concerns into models (data), views (presentation), and controllers (logic).";
        if (patterns.includes("Layered Architecture (Spring MVC)"))
            return "This project follows Spring's layered architecture with controllers, services, and repositories for clear separation of concerns.";
        if (patterns.includes("App Router / File-based routing"))
            return "This project uses the Next.js App Router for file-system based routing with React Server Components.";
        if (patterns.includes("Pages Router (Next.js)"))
            return "This project uses the classic Next.js Pages Router for directory-based routing.";
        if (patterns.includes("Microservice / REST API"))
            return "This project is structured as a microservice/REST API, exposing endpoints for client consumption.";
        if (patterns.includes("Clean Architecture / REST API"))
            return "This project follows a clean architecture pattern for building web APIs with clear dependency boundaries.";
        if (patterns.includes("Layered (lib/components + types)"))
            return "The codebase follows a scalable layered architecture, separating core logic from UI components.";
        return "The project follows a conventional modular structure, organizing code into logical directories.";
    };

    const coreComponents = nodes.filter((n) => n.moduleRole === "core").slice(0, 5);
    const entryPoints = stats.entryPoints.slice(0, 5);

    // Quality score color
    const qualityColor =
        (codeQualityScore ?? 100) >= 80 ? "text-green-500" :
            (codeQualityScore ?? 100) >= 60 ? "text-yellow-500" :
                (codeQualityScore ?? 100) >= 40 ? "text-orange-500" : "text-red-500";

    const qualityBg =
        (codeQualityScore ?? 100) >= 80 ? "bg-green-500/10 border-green-500/20" :
            (codeQualityScore ?? 100) >= 60 ? "bg-yellow-500/10 border-yellow-500/20" :
                (codeQualityScore ?? 100) >= 40 ? "bg-orange-500/10 border-orange-500/20" : "bg-red-500/10 border-red-500/20";

    // Security counts
    const criticalCount = securityInsights?.filter((s) => s.severity === "critical").length ?? 0;
    const warningCount = securityInsights?.filter((s) => s.severity === "warning").length ?? 0;

    // Layer colors
    const layerColors: Record<string, string> = {
        presentation: "bg-blue-500",
        business: "bg-purple-500",
        data: "bg-green-500",
        infrastructure: "bg-orange-500",
        test: "bg-yellow-500",
        config: "bg-gray-500",
    };

    const totalLayerFiles = Object.values(layerBreakdown ?? {}).reduce((a, b) => a + b, 0) || 1;

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
                                        {pattern.hint && (
                                            <span className="ml-1 opacity-50 text-[10px]">({pattern.hint})</span>
                                        )}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Code Quality Score */}
                    <Card className={qualityBg}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Activity className="w-4 h-4" />
                                Code Quality Score
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <div className={`text-5xl font-bold ${qualityColor}`}>
                                    {codeQualityScore ?? "—"}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                    <p>
                                        {(codeQualityScore ?? 100) >= 80
                                            ? "Excellent — well-structured and maintainable."
                                            : (codeQualityScore ?? 100) >= 60
                                                ? "Good — some areas need improvement."
                                                : (codeQualityScore ?? 100) >= 40
                                                    ? "Fair — consider refactoring high-risk files."
                                                    : "Needs attention — significant complexity detected."}
                                    </p>
                                    <p className="text-xs opacity-60">
                                        Based on complexity, documentation, coupling, and risk analysis.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Security Overview */}
                    <Card className={criticalCount > 0 ? "border-red-500/30" : ""}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                {criticalCount > 0 ? (
                                    <ShieldAlert className="w-4 h-4 text-red-500" />
                                ) : (
                                    <ShieldCheck className="w-4 h-4 text-green-500" />
                                )}
                                Security Overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(criticalCount + warningCount) === 0 ? (
                                <p className="text-sm text-green-600">No security issues detected.</p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex gap-4 text-sm">
                                        {criticalCount > 0 && (
                                            <span className="flex items-center gap-1 text-red-500">
                                                <AlertTriangle className="w-3.5 h-3.5" /> {criticalCount} critical
                                            </span>
                                        )}
                                        {warningCount > 0 && (
                                            <span className="flex items-center gap-1 text-yellow-600">
                                                <AlertTriangle className="w-3.5 h-3.5" /> {warningCount} warning{warningCount !== 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                        {securityInsights?.slice(0, 10).map((issue: SecurityInsight, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                <Badge variant={issue.severity === "critical" ? "destructive" : "outline"} className="text-[10px] shrink-0">
                                                    {issue.severity}
                                                </Badge>
                                                <span className="font-mono truncate opacity-70">{issue.filePath}</span>
                                                <span className="text-muted-foreground truncate">{issue.message}</span>
                                            </div>
                                        ))}
                                        {(securityInsights?.length ?? 0) > 10 && (
                                            <p className="text-xs text-muted-foreground">…and {(securityInsights?.length ?? 0) - 10} more</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Layer Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <PieChart className="w-4 h-4" />
                                Architectural Layers
                            </CardTitle>
                            <CardDescription>
                                How files are distributed across layers
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {layerBreakdown && Object.keys(layerBreakdown).length > 0 ? (
                                <>
                                    {/* Stacked Bar */}
                                    <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                                        {Object.entries(layerBreakdown)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([layer, count]) => (
                                                <div
                                                    key={layer}
                                                    className={`${layerColors[layer] ?? "bg-gray-400"} transition-all`}
                                                    style={{ width: `${Math.max((count / totalLayerFiles) * 100, 2)}%` }}
                                                    title={`${layer}: ${count} files`}
                                                />
                                            ))}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                                        {Object.entries(layerBreakdown)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([layer, count]) => (
                                                <div key={layer} className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${layerColors[layer] ?? "bg-gray-400"}`} />
                                                    <span className="capitalize">{layer}</span>
                                                    <span className="text-muted-foreground">({count})</span>
                                                </div>
                                            ))}
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Layer data unavailable.</p>
                            )}
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
                                    {Object.entries(stats.languages)
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 12)
                                        .map(([lang, count]) => (
                                            <Badge key={lang} variant="outline" className="uppercase text-[10px]">
                                                {lang} <span className="opacity-50 ml-1">{count}</span>
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
                                    {coreComponents.map((node) => (
                                        <li key={node.id} className="flex items-center gap-2 text-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            <span className="font-mono text-xs truncate" title={node.path}>{node.label}</span>
                                            <span className="ml-auto text-xs text-muted-foreground">{node.fanIn} refs</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No distributed core modules detected.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Entry Points & Flow */}
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
                                        {entryPoints.map((ep) => (
                                            <div key={ep} className="bg-muted px-2 py-1 rounded text-xs font-mono truncate flex items-center gap-2">
                                                <LayoutTemplate className="w-3 h-3 opacity-50" />
                                                {ep}
                                            </div>
                                        ))}
                                        {entryPoints.length === 0 && <p className="text-sm text-muted-foreground italic">No standard entry points detected.</p>}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Application Structure */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Server className="w-4 h-4" />
                                Application Structure
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm space-y-2 text-muted-foreground">
                                <div>
                                    <strong className="text-foreground">Total Files:</strong> {stats.totalFiles}
                                </div>
                                <div>
                                    <strong className="text-foreground">Analyzed Nodes:</strong> {nodes.length} with {data.edges.length} dependencies
                                </div>
                                <div>
                                    <strong className="text-foreground">Primary Language:</strong>{" "}
                                    <Badge variant="outline" className="uppercase text-[10px]">{stats.primaryLanguage ?? "N/A"}</Badge>
                                </div>
                                <div>
                                    This codebase is
                                    {nodes.length > 100 ? " a large-scale project " : nodes.length > 30 ? " a medium-sized project " : " a small project "}
                                    with {data.circularDependencies?.length
                                        ? `${data.circularDependencies.length} circular dependency cycle${data.circularDependencies.length > 1 ? "s" : ""} detected.`
                                        : "no circular dependencies."}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recommendations */}
                    <Card className="opacity-80">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Code className="w-4 h-4" />
                                Recommendations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="text-sm space-y-1.5 list-disc pl-4 text-muted-foreground">
                                {(data.circularDependencies?.length ?? 0) > 0 && (
                                    <li className="text-orange-500">Resolve {data.circularDependencies?.length} circular dependency cycle{(data.circularDependencies?.length ?? 0) > 1 ? "s" : ""} to improve maintainability.</li>
                                )}
                                {criticalCount > 0 && (
                                    <li className="text-red-500">Address {criticalCount} critical security issue{criticalCount > 1 ? "s" : ""} immediately.</li>
                                )}
                                {(codeQualityScore ?? 100) < 60 && (
                                    <li>Consider refactoring high-complexity files to improve quality score.</li>
                                )}
                                {stats.frameworks.includes("React") && <li>Consider component composition to reduce prop drilling.</li>}
                                {stats.frameworks.includes("Next.js") && <li>Leverage Server Actions for mutation logic to simplify API layers.</li>}
                                {stats.frameworks.includes("Django") && <li>Use Django REST framework for API endpoints and serialization.</li>}
                                {stats.frameworks.includes("Spring Boot") && <li>Follow layered architecture with @Service/@Repository annotations.</li>}
                                {!stats.frameworks.includes("TypeScript") && stats.primaryLanguage && ["ts", "tsx", "js", "jsx"].includes(stats.primaryLanguage) && (
                                    <li>Migrating to TypeScript is recommended for better scalability.</li>
                                )}
                                <li>Ensure separate concerns between presentation, business logic, and data layers.</li>
                            </ul>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
