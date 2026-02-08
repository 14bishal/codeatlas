"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    Position,
    MarkerType,
    Panel,
    getBezierPath,
    EdgeProps,
    NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { DependencyGraph, GraphNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Filter, LayoutGrid } from "lucide-react";

interface ArchitectureViewProps {
    data: DependencyGraph | null;
    isLoading: boolean;
}

const nodeWidth = 220;
const nodeHeight = 56;

type NodeData = {
    label: string;
    type: string;
    path: string;
    riskLevel: "low" | "medium" | "high";
    moduleRole?: "core" | "peripheral" | "connector";
    inCycle?: boolean;
};

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = "LR") {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });
    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            targetPosition: direction === "LR" ? Position.Left : Position.Top,
            sourcePosition: direction === "LR" ? Position.Right : Position.Bottom,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });
    return { nodes: layoutedNodes, edges };
}

function DependencyNode({ data, selected }: NodeProps<Node<NodeData>>) {
    const riskLevel = data.riskLevel ?? "low";
    const inCycle = data.inCycle ?? false;
    return (
        <div
            className={cn(
                "rounded-lg border-2 px-3 py-2 shadow-sm transition-all min-w-[200px] max-w-[220px]",
                "bg-card text-card-foreground",
                riskLevel === "high" && "border-destructive/80 ring-2 ring-destructive/30",
                riskLevel === "medium" && "border-amber-500/80 ring-2 ring-amber-500/20",
                riskLevel === "low" && "border-border",
                inCycle && "ring-2 ring-amber-400/40",
                selected && "ring-2 ring-primary"
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium truncate" title={data.path}>
                    {data.label}
                </span>
                <span
                    className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        data.type === "component" && "bg-blue-500/20 text-blue-300",
                        data.type === "hook" && "bg-green-500/20 text-green-300",
                        data.type === "api" && "bg-purple-500/20 text-purple-300",
                        data.type === "util" && "bg-cyan-500/20 text-cyan-300",
                        data.type === "config" && "bg-muted text-muted-foreground",
                        !["component", "hook", "api", "util", "config"].includes(data.type) && "bg-muted text-muted-foreground"
                    )}
                >
                    {data.type}
                </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                {riskLevel !== "low" && (
                    <span className={cn(riskLevel === "high" ? "text-destructive" : "text-amber-500")}>
                        {riskLevel} risk
                    </span>
                )}
                {data.moduleRole && <span>{data.moduleRole}</span>}
                {inCycle && (
                    <span className="text-amber-500 flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" /> cycle
                    </span>
                )}
            </div>
        </div>
    );
}

function EdgeWithHover({ id, data, ...props }: EdgeProps) {
    const [hovered, setHovered] = useState(false);
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        sourcePosition: props.sourcePosition ?? Position.Right,
        targetX: props.targetX,
        targetY: props.targetY,
        targetPosition: props.targetPosition ?? Position.Left,
    });
    const label = (data?.label as string) ?? "";

    return (
        <g
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="cursor-default"
        >
            <path
                id={id}
                d={edgePath}
                fill="none"
                stroke={hovered ? "var(--primary)" : "var(--border)"}
                strokeWidth={hovered ? 2.5 : 1.5}
                className="transition-[stroke,stroke-width]"
            />
            {hovered && label && (
                <foreignObject
                    x={labelX - 120}
                    y={labelY - 14}
                    width={240}
                    height={28}
                    className="pointer-events-none"
                >
                    <div className="flex items-center justify-center h-full w-full">
                        <span className="rounded bg-primary/95 text-primary-foreground text-xs px-2 py-1 shadow-lg border border-primary-foreground/20 truncate max-w-full">
                            {label}
                        </span>
                    </div>
                </foreignObject>
            )}
        </g>
    );
}

const nodeTypes = { dependencyNode: DependencyNode };
const edgeTypes = { default: EdgeWithHover };

export function ArchitectureView({ data, isLoading }: ArchitectureViewProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [showRiskyOnly, setShowRiskyOnly] = useState(false);
    const [allNodes, setAllNodes] = useState<Node[]>([]);
    const [allEdges, setAllEdges] = useState<Edge[]>([]);

    useEffect(() => {
        if (!data || data.nodes.length === 0) return;
        const initialNodes: Node[] = data.nodes.map((node: GraphNode) => ({
            id: node.id,
            type: "dependencyNode",
            data: {
                label: node.label,
                type: node.type,
                path: node.path,
                riskLevel: node.riskLevel,
                moduleRole: node.moduleRole,
                inCycle: node.inCycle,
            },
            position: { x: 0, y: 0 },
        }));

        const initialEdges: Edge[] = data.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: "default",
            data: { label: edge.label },
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: "var(--border)" },
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges
        );
        const apply = () => {
            setAllNodes(layoutedNodes);
            setAllEdges(layoutedEdges);
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        };
        const id = setTimeout(apply, 0);
        return () => clearTimeout(id);
    }, [data, setNodes, setEdges]);

    useEffect(() => {
        if (allNodes.length === 0) return;
        if (showRiskyOnly) {
            const riskyIds = new Set(
                allNodes
                    .filter((n) => {
                        const d = n.data as NodeData;
                        return d.riskLevel === "high" || d.riskLevel === "medium";
                    })
                    .map((n) => n.id)
            );
            const filteredNodes = allNodes.filter((n) => riskyIds.has(n.id));
            const filteredEdges = allEdges.filter(
                (e) => riskyIds.has(e.source) && riskyIds.has(e.target)
            );
            setNodes(filteredNodes);
            setEdges(filteredEdges);
        } else {
            setNodes(allNodes);
            setEdges(allEdges);
        }
    }, [showRiskyOnly, allNodes, allEdges, setNodes, setEdges]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    if (isLoading) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p>Analyzing codebase architecture…</p>
            </div>
        );
    }

    if (!data || data.nodes.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                <LayoutGrid className="h-12 w-12 opacity-50" />
                <p>No architecture data available.</p>
                <p className="text-sm">Repo may have no JS/TS files or analysis failed.</p>
            </div>
        );
    }

    return (
        <div className="h-full w-full relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                className="bg-muted/10"
            >
                <Controls className="!border-border !bg-card" />
                <Background color="var(--border)" gap={16} />

                <Panel position="top-left" className="m-3 flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => setShowRiskyOnly((v) => !v)}
                        className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                            showRiskyOnly
                                ? "border-destructive/50 bg-destructive/10 text-destructive"
                                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Filter className="h-4 w-4" />
                        {showRiskyOnly ? "Show all" : "Risky only"}
                    </button>
                    <div className="rounded-lg border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
                        <p className="font-semibold text-foreground mb-2">Legend</p>
                        <ul className="space-y-1.5 text-muted-foreground">
                            <li className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full border-2 border-destructive/80 bg-destructive/20" />
                                High risk
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full border-2 border-amber-500/80 bg-amber-500/20" />
                                Medium risk
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full border border-border" />
                                Low risk
                            </li>
                            <li className="flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3 text-amber-500" />
                                In circular dependency
                            </li>
                            <li className="pt-1 border-t border-border mt-1">
                                Hover edges to see relationships
                            </li>
                        </ul>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
