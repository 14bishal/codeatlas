"use client";

import { ArchitectureView } from "@/components/dashboard/architecture-view";
import { ProjectOverview } from "@/components/dashboard/project-overview";
import { useState, useEffect } from "react";
import type { FileNode } from "@/lib/actions";
import { analyzeRepo } from "@/lib/actions";
import { useSearchParams, useRouter } from "next/navigation";
import DashboardLoading from "@/app/dashboard/loading";
import { DependencyGraph } from "@/lib/types";
import { Home, Share2, LogOut, AlertCircle } from "lucide-react";
import Link from "next/link";
import SidebarItem from "./SidebarItem";

// interface DashboardLayoutProps {
//     fileTree: FileNode | null;
// }

type ViewType = "overview" | "architecture" | "files";

export function DashboardLayout() {
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();
    const [activeView, setActiveView] = useState<ViewType>("overview");
    const [graphData, setGraphData] = useState<DependencyGraph | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const searchParams = useSearchParams();
    const repoId = searchParams.get("id");
    console.log("🚀 ~ DashboardLayout ~ repoId:", repoId)

    // Hydration guard: mount state needed for client-only UI
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydration guard
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!repoId) return;
        let cancelled = false;
        const id = setTimeout(() => {
            if (!cancelled) setIsAnalyzing(true);
        }, 0);
        analyzeRepo(repoId).then((result) => {
            if (!cancelled && result.success && result.data) setGraphData(result.data);
            if (!cancelled) setIsAnalyzing(false);
        });
        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [repoId]);

    if (!isMounted) return <DashboardLoading />;

    if (repoId) {
        return (
            <div className="h-screen w-screen bg-background text-foreground flex flex-col items-center justify-center gap-6 p-8">
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 max-w-md text-center">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                    <h2 className="font-semibold text-lg text-foreground">Repository not found</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                        The repository may be missing, invalid, or no longer available. Try cloning again from the home page.
                    </p>
                    <Link
                        href="/"
                        className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Home className="mr-2 h-4 w-4" />
                        Back to home
                    </Link>
                </div>
            </div>
        );
    }

    

    return (
        <div className="h-screen w-screen bg-background text-foreground flex overflow-hidden">

            {/* SIDEBAR Navigation */}
            <aside className="w-16 shrink-0 border-r border-border bg-card/50 flex flex-col items-center py-4 gap-4 z-20">
                <div onClick={() => router.push("/")} className="h-10 w-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-sm mb-4 cursor-pointer">
                    CA
                </div>

                <div className="flex flex-col gap-3 w-full items-center">
                    <SidebarItem setActiveView={setActiveView} icon={Home} label="Overview" view="overview" isActive={activeView === "overview"} />
                    <SidebarItem setActiveView={setActiveView} icon={Share2} label="Architecture" view="architecture" isActive={activeView === "architecture"} />
                    {/* <SidebarItem icon={FolderOpen} label="File Explorer" view="files" isActive={activeView === "files"} /> */}
                </div>

                <div className="mt-auto flex flex-col gap-3 w-full items-center">
                    <div className="relative flex w-full justify-center group/tooltip">
                        <Link
                            href="/"
                            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                            aria-label="Back to home"
                        >
                            <LogOut className="w-5 h-5" />
                        </Link>
                        <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground shadow-md group-hover/tooltip:block" role="tooltip">
                            Back to home
                        </span>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT Area */}
            <div className="flex-1 flex flex-col overflow-hidden relative">

                {/* Header */}
                <header className="h-14 shrink-0 border-b border-border flex items-center px-6 justify-between bg-card/30 backdrop-blur-sm z-10">
                    <div>
                        <h1 className="font-semibold text-lg">
                            {activeView === "overview" && "Project Overview"}
                            {activeView === "architecture" && "Architecture & Dependencies"}
                            {activeView === "files" && "Code Explorer"}
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {/* {fileTree ? fileTree.name : "Analyzing Repository..."} */}
                            Analyzing Repository...
                        </p>
                    </div>

                    {/* Actions or Status could go here */}
                    {isAnalyzing && (
                        <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            Analyzing Codebase...
                        </div>
                    )}
                </header>

                <main className="flex-1 overflow-hidden relative bg-muted/10">
                    {activeView === "overview" && (
                        <div className="h-full overflow-y-auto w-full">
                            <ProjectOverview graph={graphData} isLoading={isAnalyzing} />
                        </div>
                    )}

                    {activeView === "architecture" && (
                        <div className="h-full w-full">
                            <ArchitectureView data={graphData} isLoading={isAnalyzing} />
                        </div>
                    )}

                    {/* {activeView === "files" && (
                        <div className="h-full w-full p-2">
                            <FileBrowserView fileTree={fileTree!} repoId={repoId} />
                        </div>
                    )} */}
                </main>
            </div>
        </div>
    )
}

