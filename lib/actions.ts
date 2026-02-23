"use server";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { extract } from "tar";
import { normalizeGitHubUrl } from "./utils";

const TEMP_DIR = path.join(os.tmpdir(), "ai-codebase-explainer");

export type FileNode = {
    id: string;
    name: string;
    type: 'file' | 'folder';
    path: string;
    children?: FileNode[];
};

function userFriendlyCloneError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("repository not found") || lower.includes("404")) return "Repository not found. Check the URL or that the repo is public.";
    if (lower.includes("authentication") || lower.includes("auth") || lower.includes("permission")) return "Access denied. Only public repositories are supported.";
    if (lower.includes("private")) return "Private repositories are not supported. Use a public repo.";
    if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("enotfound")) return "Network error. Check your connection and try again.";
    if (lower.includes("could not read from remote")) return "Could not read from repository. It may be private or unavailable.";
    if (lower.includes("invalid url") || lower.includes("invalid path")) return "Invalid repository URL.";
    return message || "Something went wrong. Please try again.";
}

function parseGitHubOwnerRepo(url: string): { owner: string; repo: string } | null {
    try {
        const u = new URL(url);
        if (!/github\.com$/i.test(u.hostname)) return null;
        const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
        if (parts.length >= 2) {
            return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
        }
    } catch {
        // ignore
    }
    return null;
}



// Internal helper to ensure repo exists or clone it
async function ensureRepo(owner: string, repo: string): Promise<{ success: boolean; id: string; path: string; error?: string }> {
    const uniqueId = `${owner}@${repo}`;
    const localPath = path.join(TEMP_DIR, uniqueId);
    const tarballPath = path.join(TEMP_DIR, `${uniqueId}.tar.gz`);

    try {
        await fs.access(localPath);
        // If it exists, we assume it's good (in a real app, might want to check if empty or pull updates)
        return {
            success: true,
            id: uniqueId,
            path: localPath,
        };
    } catch {
        // Does not exist, proceed to clone
    }

    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        // Clean up any partials
        await fs.rm(localPath, { recursive: true, force: true }).catch(() => { });

        const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/HEAD`;
        const res = await fetch(tarballUrl, {
            redirect: "follow",
            headers: { "User-Agent": "AI-Codebase-Explainer" },
        });

        if (!res.ok) {
            const text = await res.text();
            if (res.status === 404) return { success: false, id: uniqueId, path: "", error: "Repository not found. Check the URL or that the repo is public." };
            return { success: false, id: uniqueId, path: "", error: userFriendlyCloneError(text || `HTTP ${res.status}`) };
        }

        const buf = await res.arrayBuffer();
        await fs.writeFile(tarballPath, new Uint8Array(buf));

        await fs.mkdir(localPath, { recursive: true });
        await extract({ file: tarballPath, cwd: localPath, strip: 1 });

        await fs.unlink(tarballPath).catch(() => { });

        return {
            success: true,
            id: uniqueId,
            path: localPath,
        };
    } catch (error: unknown) {
        await fs.unlink(tarballPath).catch(() => { });
        const message = error instanceof Error ? error.message : String(error);
        console.error("Clone error:", error);
        return { success: false, id: uniqueId, path: "", error: userFriendlyCloneError(message) };
    }
}

export async function cloneRepository(repoUrl: string) {
    const { url, error: validationError } = normalizeGitHubUrl(repoUrl);
    if (validationError) return { success: false, error: validationError };

    const parsed = parseGitHubOwnerRepo(url);
    if (!parsed) return { success: false, error: "Invalid GitHub URL." };

    const { owner, repo } = parsed;
    const result = await ensureRepo(owner, repo);

    if (!result.success) {
        return { success: false, error: result.error };
    }

    return {
        success: true,
        id: result.id,
        path: result.path,
        message: `Successfully downloaded to ${result.path}`,
    };
}

export async function getRepoFileTree(id: string): Promise<FileNode | null> {
    const repoPath = path.join(TEMP_DIR, id);
    console.log("🚀 ~ getRepoFileTree ~ repoPath:", repoPath)

    try {
        await fs.access(repoPath);
        return await buildFileTree(repoPath, id);
    } catch {
        console.error("Repo not found:", id);
        return null;
    }
}

async function buildFileTree(currentPath: string, rootId: string): Promise<FileNode> {
    const stats = await fs.stat(currentPath);
    const name = path.basename(currentPath);
    const relativePath = currentPath.split(rootId)[1] || "/";

    const node: FileNode = {
        id: currentPath, // Using absolute path as ID for simplicity
        name: name,
        type: stats.isDirectory() ? 'folder' : 'file',
        path: relativePath,
    };

    if (stats.isDirectory()) {
        const children = await fs.readdir(currentPath);
        const validChildren = children.filter(
            (child) =>
                !child.startsWith(".git") &&
                child !== "node_modules" &&
                child !== ".next" &&
                child !== "dist" &&
                child !== "build"
        );

        node.children = await Promise.all(
            validChildren.map((child) => buildFileTree(path.join(currentPath, child), rootId))
        );

        // Sort: Folders first, then files
        node.children.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
    }

    return node;
}

const SKIP_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip", ".bin"]);

export async function getFileContent(repoId: string, filePath: string) {
    try {
        const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
        const absolutePath = path.join(TEMP_DIR, repoId, safePath);

        if (!absolutePath.startsWith(path.join(TEMP_DIR, repoId))) {
            throw new Error("Invalid path");
        }

        const ext = path.extname(safePath).toLowerCase();
        if (SKIP_EXTENSIONS.has(ext)) {
            return `// Binary or non-text file (${ext}). Preview not available.`;
        }

        const content = await fs.readFile(absolutePath, "utf-8");
        if (content.length > 500_000) {
            return content.slice(0, 500_000) + "\n\n// ... file truncated (too large to display)";
        }
        return content;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("ENOENT")) return "// File not found.";
        if (message.includes("EISDIR")) return "// This is a directory.";
        if (message.includes("Invalid path")) return "// Invalid path.";
        console.error("Error reading file:", err);
        return "// Error reading file content.";
    }
}

import { analyzeRepoDependencies } from "./analysis";
import type { DependencyGraph } from "./types";

// ── Analysis Result Cache (30 min TTL) ──
const analysisCache = new Map<string, { data: DependencyGraph; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000;

export async function analyzeRepo(repoId: string) {
    try {
        // Check cache first
        const cached = analysisCache.get(repoId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return { success: true, data: cached.data };
        }

        // 1. Try to analyze directly
        const repoPath = path.join(TEMP_DIR, repoId);
        try {
            await fs.access(repoPath);
        } catch {
            // 2. If missing, try to restore
            if (repoId.includes("@")) {
                const [owner, ...rest] = repoId.split("@");
                const repo = rest.join("@");
                if (owner && repo) {
                    await ensureRepo(owner, repo);
                }
            }
        }

        const graph = await analyzeRepoDependencies(repoId);

        // Store in cache
        analysisCache.set(repoId, { data: graph, timestamp: Date.now() });

        return { success: true, data: graph };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Analysis error:", error);
        return { success: false, error: message };
    }
}
