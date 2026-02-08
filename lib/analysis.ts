import fs from "fs/promises";
import os from "os";
import path from "path";
import {
    ArchitecturalPattern,
    CircularDependency,
    DependencyGraph,
    GraphEdge,
    GraphNode,
    NodeType,
    ProjectStats,
} from "./types";

const TEMP_DIR = path.join(os.tmpdir(), "ai-codebase-explainer");
const TOP_FAN_THRESHOLD = 5; // Top N files for high fan-in / fan-out

const IMPORT_REGEX = /import\s+(?:[\w\s{},*]+)\s+from\s+['"](.+)['"]/g;


async function getFileContent(filePath: string): Promise<string> {
    try {
        return await fs.readFile(filePath, "utf-8");
    } catch {
        return "";
    }
}

function determineNodeType(filename: string, content: string): NodeType {
    if (filename.endsWith("config.js") || filename.endsWith("config.ts") || filename.endsWith(".json")) return 'config';
    if (filename.includes("use") && (filename.endsWith(".ts") || filename.endsWith(".tsx"))) return 'hook';
    if (filename.endsWith("api") || filename.includes("/api/")) return 'api';
    if (filename.endsWith(".tsx") || filename.endsWith(".jsx")) {
        // Simple heuristic: if it exports a function starting with Uppercase, it's likely a component
        if (/export\s+(?:default\s+)?function\s+[A-Z]/.test(content) || /export\s+(?:const|let|var)\s+[A-Z]/.test(content)) {
            return 'component';
        }
    }
    if (filename.includes("util") || filename.includes("helper") || filename.includes("lib/")) return 'util';
    return 'file';
}

function calculateRisk(content: string, incomingEdges: number): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    if (content.length > 5000) riskScore += 1; // Large file
    if (incomingEdges > 5) riskScore += 1; // Highly coupled
    if (content.includes("any")) riskScore += 1; // TypeScript strictness violation

    if (riskScore >= 3) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
}

function resolveImportPath(currentDir: string, importPath: string): string {
    if (importPath.startsWith(".")) {
        return path.resolve(currentDir, importPath);
    }
    // Handle aliases like @/ if we know the root, but for now strict relative paths are safest to resolve without full tsconfig parsing
    // We will attempt to handle basic @/ alias if we assume it maps to source root, but let's stick to relative for basic implementation
    return importPath; // Return as is if not relative (likely external lib)
}

export async function analyzeRepoDependencies(repoId: string): Promise<DependencyGraph> {
    const rootPath = path.join(TEMP_DIR, repoId);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const fileMap = new Map<string, string>(); // Path -> Node ID

    const frameworkVersionsMap = new Map<string, string>();
    const stats: ProjectStats = {
        languages: {},
        frameworks: [],
        entryPoints: [],
        totalFiles: 0,
    };
    let rootPackageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; engines?: Record<string, string> } | null = null;

    // 1. Recursive Scan
    async function scan(currentPath: string) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = fullPath.replace(rootPath, "");

            if (entry.isDirectory()) {
                if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") continue;
                await scan(fullPath);
            } else if (entry.isFile()) {
                stats.totalFiles++;

                // Track Languages
                const ext = path.extname(entry.name).toLowerCase();
                if (ext) {
                    const lang = ext.replace(".", "");
                    stats.languages[lang] = (stats.languages[lang] || 0) + 1;
                }

                // Check for package.json for frameworks + versions
                if (entry.name === "package.json") {
                    try {
                        const pkgContent = await getFileContent(fullPath);
                        const pkg = JSON.parse(pkgContent);
                        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
                        const detectedFrameworks: string[] = [];
                        const fwToPkg: Record<string, string> = {
                            next: "next",
                            react: "react",
                            vue: "vue",
                            svelte: "svelte",
                            tailwindcss: "tailwindcss",
                            typescript: "typescript",
                            express: "express",
                        };
                        const fwToName: Record<string, string> = {
                            next: "Next.js",
                            react: "React",
                            vue: "Vue",
                            svelte: "Svelte",
                            tailwindcss: "TailwindCSS",
                            typescript: "TypeScript",
                            express: "Express",
                        };
                        for (const [pkgKey, name] of Object.entries(fwToName)) {
                            const ver = allDeps[fwToPkg[pkgKey]];
                            if (ver) {
                                detectedFrameworks.push(name);
                                frameworkVersionsMap.set(name, ver.replace(/^[\^~]/, ""));
                            }
                        }
                        stats.frameworks = Array.from(new Set([...stats.frameworks, ...detectedFrameworks]));
                        if (relativePath.split(path.sep).filter(Boolean).length <= 1) {
                            rootPackageJson = pkg;
                        }
                    } catch {
                        // ignore broken json
                    }
                }

                // Check for Entry Points
                if (
                    entry.name === "page.tsx" ||
                    entry.name === "page.jsx" ||
                    entry.name === "layout.tsx" ||
                    entry.name === "index.ts" ||
                    entry.name === "index.js" ||
                    entry.name === "App.tsx" ||
                    entry.name === "main.ts"
                ) {
                    // Only track top-level or significant entry points to avoid noise
                    if (relativePath.split(path.sep).length <= 3) {
                        stats.entryPoints.push(relativePath);
                    }
                }

                if (!entry.name.match(/\.(ts|tsx|js|jsx)$/)) continue; // Analyze JS/TS files only

                const content = await getFileContent(fullPath);
                const type = determineNodeType(entry.name, content);

                const node: GraphNode = {
                    id: fullPath,
                    label: entry.name,
                    type,
                    path: relativePath,
                    riskLevel: 'low' // Will update later
                };

                nodes.push(node);
                fileMap.set(fullPath, node.id);
            }
        }
    }

    try {
        await scan(rootPath);
    } catch (error) {
        console.error("Scan failed", error);
        return { nodes: [], edges: [], stats, circularDependencies: [], highFanInIds: [], highFanOutIds: [] };
    }

    // 2. Parse Imports and Build Edges
    const incomingEdgeCounts = new Map<string, number>();
    const outgoingEdgeCounts = new Map<string, number>();
    const addedEdges = new Set<string>();
    const idToNode = new Map<string, GraphNode>();
    for (const n of nodes) idToNode.set(n.id, n);

    for (const node of nodes) {
        const content = await getFileContent(node.id);
        const currentDir = path.dirname(node.id);

        let match;
        IMPORT_REGEX.lastIndex = 0;

        while ((match = IMPORT_REGEX.exec(content)) !== null) {
            const importPath = match[1];

            let resolvedPath = "";
            if (importPath.startsWith("@/")) {
                resolvedPath = path.join(rootPath, importPath.replace("@/", ""));
            } else if (importPath.startsWith(".")) {
                resolvedPath = resolveImportPath(currentDir, importPath);
            } else {
                continue;
            }

            let targetNodeId = fileMap.get(resolvedPath);
            if (!targetNodeId) {
                const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
                for (const ext of extensions) {
                    if (fileMap.has(resolvedPath + ext)) {
                        targetNodeId = fileMap.get(resolvedPath + ext);
                        break;
                    }
                }
            }

            if (targetNodeId) {
                const edgeId = `${node.id}-${targetNodeId}`;
                if (!addedEdges.has(edgeId)) {
                    const sourceLabel = node.label || path.basename(node.id);
                    const targetLabel = idToNode.get(targetNodeId)?.label || path.basename(targetNodeId);
                    edges.push({
                        id: edgeId,
                        source: node.id,
                        target: targetNodeId,
                        type: "static",
                        label: `${sourceLabel} → ${targetLabel}`,
                    });
                    addedEdges.add(edgeId);
                    incomingEdgeCounts.set(targetNodeId, (incomingEdgeCounts.get(targetNodeId) || 0) + 1);
                    outgoingEdgeCounts.set(node.id, (outgoingEdgeCounts.get(node.id) || 0) + 1);
                }
            }
        }
    }

    // 3. Fan-in / Fan-out and risk
    for (const node of nodes) {
        const content = await getFileContent(node.id);
        const fanIn = incomingEdgeCounts.get(node.id) || 0;
        const fanOut = outgoingEdgeCounts.get(node.id) || 0;
        node.fanIn = fanIn;
        node.fanOut = fanOut;
        node.riskLevel = calculateRisk(content, fanIn);
    }

    // 4. High fan-in / fan-out (top N)
    const sortedByFanIn = [...nodes].sort((a, b) => (b.fanIn ?? 0) - (a.fanIn ?? 0));
    const sortedByFanOut = [...nodes].sort((a, b) => (b.fanOut ?? 0) - (a.fanOut ?? 0));
    const highFanInIds = sortedByFanIn.slice(0, TOP_FAN_THRESHOLD).map((n) => n.id).filter((id) => (idToNode.get(id)?.fanIn ?? 0) > 0);
    const highFanOutIds = sortedByFanOut.slice(0, TOP_FAN_THRESHOLD).map((n) => n.id).filter((id) => (idToNode.get(id)?.fanOut ?? 0) > 0);

    // 5. Circular dependencies (Tarjan-style SCCs of size > 1, or DFS cycles)
    const circularDependencies = findCircularDependencies(nodes, edges, idToNode);
    const cycleNodeIds = new Set<string>();
    for (const cycle of circularDependencies) {
        for (const id of cycle.ids) cycleNodeIds.add(id);
    }
    for (const node of nodes) {
        node.inCycle = cycleNodeIds.has(node.id);
    }

    // 6. Core vs peripheral
    const fanInThreshold = Math.max(1, sortedByFanIn[0]?.fanIn ?? 0);
    const fanOutThreshold = Math.max(1, sortedByFanOut[0]?.fanOut ?? 0);
    for (const node of nodes) {
        const fi = node.fanIn ?? 0;
        const fo = node.fanOut ?? 0;
        if (fi >= Math.max(2, fanInThreshold * 0.5) && fo <= 3) node.moduleRole = "core";
        else if (fo >= Math.max(2, fanOutThreshold * 0.5) && fi <= 3) node.moduleRole = "connector";
        else if (fi <= 1 && fo <= 1) node.moduleRole = "peripheral";
        else node.moduleRole = "connector";
    }

    // 7. Stats: framework versions, language versions, architectural patterns
    stats.frameworkVersions = stats.frameworks.map((name) => ({
        name,
        version: frameworkVersionsMap.get(name),
    }));
    const rootPkg = rootPackageJson as { engines?: { node?: string } } | null;
    if (rootPkg?.engines?.node) {
        stats.languageVersions = stats.languageVersions || {};
        stats.languageVersions["node"] = rootPkg.engines.node.replace(/^[\^~>=]+/, "");
    }
    stats.architecturalPatterns = detectArchitecturalPatterns(stats);

    return {
        nodes,
        edges,
        stats,
        circularDependencies,
        highFanInIds,
        highFanOutIds,
    };
}

function findCircularDependencies(
    nodes: GraphNode[],
    edges: GraphEdge[],
    idToNode: Map<string, GraphNode>
): CircularDependency[] {
    const idToIndex = new Map<string, number>();
    nodes.forEach((n, i) => idToIndex.set(n.id, i));
    const indexToId = nodes.map((n) => n.id);
    const n = nodes.length;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (const e of edges) {
        const si = idToIndex.get(e.source);
        const ti = idToIndex.get(e.target);
        if (si !== undefined && ti !== undefined && si !== ti) adj[si].push(ti);
    }

    const cycles: CircularDependency[] = [];
    const stack: number[] = [];
    const onStack = new Set<number>();
    const index = new Map<number, number>();
    const lowlink = new Map<number, number>();
    let idx = 0;

    function strongConnect(v: number) {
        index.set(v, idx);
        lowlink.set(v, idx);
        idx++;
        stack.push(v);
        onStack.add(v);

        for (const w of adj[v]) {
            if (!index.has(w)) {
                strongConnect(w);
                lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
            } else if (onStack.has(w)) {
                lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
            }
        }

        if (lowlink.get(v) === index.get(v)) {
            const scc: number[] = [];
            let w: number;
            do {
                w = stack.pop()!;
                onStack.delete(w);
                scc.push(w);
            } while (w !== v);
            if (scc.length > 1) {
                const ids = scc.map((i) => indexToId[i]);
                const pathLabels = scc.map((i) => {
                    const id = indexToId[i];
                    const node = idToNode.get(id);
                    return (node?.path ?? path.basename(id)) as string;
                });
                cycles.push({ ids, pathLabels });
            }
        }
    }

    for (let i = 0; i < n; i++) {
        if (!index.has(i)) strongConnect(i);
    }
    return cycles;
}

function detectArchitecturalPatterns(stats: ProjectStats): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = [];
    const hasApp = stats.entryPoints.some((ep) => ep.includes("app/") || ep.includes("page"));
    const hasPages = stats.entryPoints.some((ep) => ep.includes("pages/"));
    const hasApi = stats.frameworks.some((f) => f === "Next.js" || f === "Express") && stats.entryPoints.some((ep) => ep.toLowerCase().includes("api"));
    const hasLib = Object.keys(stats.languages).some(() => true) && (stats.frameworks.includes("React") || stats.frameworks.includes("Next.js"));

    if (hasApp && (stats.frameworks.includes("Next.js") || stats.frameworks.includes("React"))) {
        patterns.push({
            name: "App Router / File-based routing",
            confidence: "high",
            hint: "app/ directory with page/layout files",
        });
    }
    if (hasPages) {
        patterns.push({
            name: "Pages Router (Next.js)",
            confidence: "medium",
            hint: "pages/ directory detected",
        });
    }
    if (hasApi) {
        patterns.push({
            name: "API routes / Backend layer",
            confidence: "medium",
            hint: "API entry points present",
        });
    }
    if (hasLib && stats.frameworks.includes("TypeScript")) {
        patterns.push({
            name: "Layered (lib/components + types)",
            confidence: "low",
            hint: "TypeScript + React/Next with common structure",
        });
    }
    if (patterns.length === 0) {
        patterns.push({
            name: "Conventional file-based structure",
            confidence: "low",
            hint: "Standard entry points and file layout",
        });
    }
    return patterns;
}
