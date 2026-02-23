export type NodeType = 'file' | 'component' | 'hook' | 'util' | 'api' | 'config' | 'model' | 'test' | 'middleware' | 'service' | 'other';

export interface CodeMetrics {
    linesOfCode: number;
    cyclomaticComplexity: number;
    commentRatio: number;
}

export interface LayerClassification {
    layer: 'presentation' | 'business' | 'data' | 'infrastructure' | 'test' | 'config';
    confidence: number;
}

export interface RiskDetail {
    level: 'low' | 'medium' | 'high';
    score: number;
    factors: string[];
}

export interface SecurityInsight {
    type: 'hardcoded-secret' | 'sql-injection-risk' | 'unsafe-eval' | 'no-auth-check' | 'unsafe-regex';
    filePath: string;
    line?: number;
    severity: 'info' | 'warning' | 'critical';
    message: string;
}

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
    /** Code-level metrics */
    metrics?: CodeMetrics;
    /** Architectural layer classification */
    layerClassification?: LayerClassification;
    /** Detailed risk breakdown */
    riskDetail?: RiskDetail;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: 'static' | 'dynamic';
    /** Human-readable: "source → target" for tooltips */
    label?: string;
    /** Captured imports for this edge */
    imports?: string[];
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
    /** Primary language of the repository */
    primaryLanguage?: string;
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
    /** Lightweight security scan results */
    securityInsights?: SecurityInsight[];
    /** Architectural layer → file count */
    layerBreakdown?: Record<string, number>;
    /** Composite code quality score 0-100 */
    codeQualityScore?: number;
}
