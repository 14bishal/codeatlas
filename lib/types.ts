export type NodeType = 'file' | 'component' | 'hook' | 'util' | 'api' | 'config' | 'other';

export interface GraphNode {
    id: string;
    label: string;
    type: NodeType;
    path: string;
    riskLevel: 'low' | 'medium' | 'high';
    /** Number of files that import this file */
    fanIn?: number;
    /** Number of files this file imports */
    fanOut?: number;
    /** Core = high fan-in and/or central; peripheral = low connectivity */
    moduleRole?: 'core' | 'peripheral' | 'connector';
    /** If this node is part of a circular dependency */
    inCycle?: boolean;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: 'static' | 'dynamic';
    /** Human-readable: "source → target" for tooltips */
    label?: string;
}

export interface DetectedFramework {
    name: string;
    version?: string;
}

export interface ArchitecturalPattern {
    name: string;
    confidence: 'low' | 'medium' | 'high';
    hint?: string;
}

export interface ProjectStats {
    languages: Record<string, number>;
    /** Language version when detectable (e.g. node, python) */
    languageVersions?: Record<string, string>;
    frameworks: string[];
    /** Framework/lib name → version from package.json */
    frameworkVersions?: DetectedFramework[];
    entryPoints: string[];
    totalFiles: number;
    /** Detected patterns: e.g. feature-based, layered, MVC */
    architecturalPatterns?: ArchitecturalPattern[];
}

/** A cycle of file IDs (path or id) */
export interface CircularDependency {
    ids: string[];
    pathLabels: string[];
}

export interface DependencyGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats?: ProjectStats;
    /** All detected circular dependency cycles */
    circularDependencies?: CircularDependency[];
    /** File IDs with unusually high fan-in (e.g. top 5) */
    highFanInIds?: string[];
    /** File IDs with unusually high fan-out (e.g. top 5) */
    highFanOutIds?: string[];
}
