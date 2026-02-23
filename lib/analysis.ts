import fs from "fs/promises";
import os from "os";
import path from "path";
import {
    ArchitecturalPattern,
    CircularDependency,
    CodeMetrics,
    DependencyGraph,
    GraphEdge,
    GraphNode,
    LayerClassification,
    NodeType,
    ProjectStats,
    RiskDetail,
    SecurityInsight,
} from "./types";

const TEMP_DIR = path.join(os.tmpdir(), "ai-codebase-explainer");
const TOP_FAN_THRESHOLD = 5;
const MAX_FILES = 5000;
const IO_BATCH_SIZE = 50;

// ───────────────────────────────────────────────────────────────────
// Language Parser Registry
// ───────────────────────────────────────────────────────────────────

interface LanguageParser {
    name: string;
    extensions: string[];
    importPatterns: RegExp[];
    /** Extract imported module path from a regex match */
    extractImportPath: (match: RegExpMatchArray) => string | null;
    /** Extract imported specifiers from a regex match */
    extractSpecifiers: (match: RegExpMatchArray) => string[];
    entryPoints: string[];
    manifestFiles: string[];
    skipDirs: string[];
}

// Helper: parse JS/TS-style import specifiers: "React, { useState }" → ["React", "useState"]
function parseJsImportSpecifiers(specifiers: string): string[] {
    if (!specifiers) return [];
    return specifiers
        .split(",")
        .map((s) => s.trim())
        .map((s) => {
            const asMatch = s.match(/([^\s]+)\s+as\s+([^\s]+)/);
            if (asMatch) return asMatch[1];
            return s.replace(/[{}]/g, "").trim();
        })
        .filter(Boolean)
        .filter((s) => s !== "type" && s !== "from");
}

const LANGUAGE_PARSERS: LanguageParser[] = [
    // ── JavaScript / TypeScript ──
    {
        name: "javascript",
        extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
        importPatterns: [
            /import\s+(?:([\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]/g,
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],
        extractImportPath: (m) => m[2] ?? m[1] ?? null,
        extractSpecifiers: (m) => {
            // ES import: group 1 is specifiers, group 2 is path
            if (m[0].startsWith("import") && m[1]) return parseJsImportSpecifiers(m[1]);
            return [];
        },
        entryPoints: ["page.tsx", "page.jsx", "layout.tsx", "index.ts", "index.js", "index.tsx", "index.jsx", "App.tsx", "App.jsx", "main.ts", "main.js", "server.ts", "server.js"],
        manifestFiles: ["package.json"],
        skipDirs: ["node_modules", ".next", "dist", "build", ".turbo"],
    },
    // ── Python ──
    {
        name: "python",
        extensions: [".py", ".pyw"],
        importPatterns: [
            /^\s*import\s+([\w.]+)/gm,
            /^\s*from\s+([\w.]+)\s+import\s+(.+)/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: (m) => {
            if (m[2]) return m[2].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
            return [];
        },
        entryPoints: ["main.py", "app.py", "manage.py", "wsgi.py", "asgi.py", "__main__.py", "setup.py"],
        manifestFiles: ["requirements.txt", "pyproject.toml", "setup.py", "setup.cfg", "Pipfile"],
        skipDirs: ["__pycache__", ".venv", "venv", "env", ".mypy_cache", ".pytest_cache"],
    },
    // ── Go ──
    {
        name: "go",
        extensions: [".go"],
        importPatterns: [
            /import\s+"([^"]+)"/g,
            /import\s+\w+\s+"([^"]+)"/g,
            /import\s+\(([\s\S]*?)\)/g,
        ],
        extractImportPath: (m) => {
            // Single import
            if (m[1] && !m[1].includes("\n")) return m[1];
            // Multi-import block: extract first import for edge, individual handled during parse
            return null;
        },
        extractSpecifiers: () => [],
        entryPoints: ["main.go", "cmd/main.go"],
        manifestFiles: ["go.mod", "go.sum"],
        skipDirs: ["vendor"],
    },
    // ── Java ──
    {
        name: "java",
        extensions: [".java"],
        importPatterns: [
            /^\s*import\s+(?:static\s+)?([a-zA-Z0-9_.]+(?:\.\*)?)\s*;/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: (m) => {
            const full = m[1] ?? "";
            const parts = full.split(".");
            return parts.length > 0 ? [parts[parts.length - 1]] : [];
        },
        entryPoints: ["Main.java", "Application.java", "App.java"],
        manifestFiles: ["pom.xml", "build.gradle", "build.gradle.kts"],
        skipDirs: ["target", ".gradle", "build", ".idea"],
    },
    // ── Rust ──
    {
        name: "rust",
        extensions: [".rs"],
        importPatterns: [
            /^\s*use\s+([\w:]+(?:::\{[^}]+\})?)\s*;/gm,
            /^\s*mod\s+(\w+)\s*;/gm,
            /^\s*extern\s+crate\s+(\w+)\s*;/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: (m) => {
            const path = m[1] ?? "";
            const braceMatch = path.match(/::?\{([^}]+)\}/);
            if (braceMatch) return braceMatch[1].split(",").map((s) => s.trim());
            const parts = path.split("::");
            return parts.length > 0 ? [parts[parts.length - 1]] : [];
        },
        entryPoints: ["main.rs", "lib.rs"],
        manifestFiles: ["Cargo.toml"],
        skipDirs: ["target"],
    },
    // ── C / C++ ──
    {
        name: "c_cpp",
        extensions: [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx"],
        importPatterns: [
            /^\s*#include\s*"([^"]+)"/gm,
            /^\s*#include\s*<([^>]+)>/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: () => [],
        entryPoints: ["main.c", "main.cpp", "main.cc"],
        manifestFiles: ["CMakeLists.txt", "Makefile", "meson.build", "conanfile.txt"],
        skipDirs: ["build", "cmake-build-debug", "cmake-build-release"],
    },
    // ── Ruby ──
    {
        name: "ruby",
        extensions: [".rb"],
        importPatterns: [
            /^\s*require\s+['"]([^'"]+)['"]/gm,
            /^\s*require_relative\s+['"]([^'"]+)['"]/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: () => [],
        entryPoints: ["app.rb", "config.ru", "Rakefile"],
        manifestFiles: ["Gemfile", "Gemfile.lock"],
        skipDirs: [".bundle", "vendor/bundle"],
    },
    // ── PHP ──
    {
        name: "php",
        extensions: [".php"],
        importPatterns: [
            /^\s*use\s+([A-Za-z0-9_\\]+)\s*;/gm,
            /^\s*(?:require|include)(?:_once)?\s*['"]([^'"]+)['"]/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: () => [],
        entryPoints: ["index.php", "artisan", "public/index.php"],
        manifestFiles: ["composer.json"],
        skipDirs: ["vendor"],
    },
    // ── C# ──
    {
        name: "csharp",
        extensions: [".cs"],
        importPatterns: [
            /^\s*using\s+(?:static\s+)?([A-Za-z0-9_.]+)\s*;/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: () => [],
        entryPoints: ["Program.cs", "Startup.cs"],
        manifestFiles: [".csproj", ".sln"],
        skipDirs: ["bin", "obj"],
    },
    // ── Kotlin ──
    {
        name: "kotlin",
        extensions: [".kt", ".kts"],
        importPatterns: [
            /^\s*import\s+([a-zA-Z0-9_.]+(?:\.\*)?)/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: (m) => {
            const full = m[1] ?? "";
            const parts = full.split(".");
            return parts.length > 0 ? [parts[parts.length - 1]] : [];
        },
        entryPoints: ["Main.kt", "Application.kt", "App.kt"],
        manifestFiles: ["build.gradle.kts", "build.gradle"],
        skipDirs: ["build", ".gradle"],
    },
    // ── Swift ──
    {
        name: "swift",
        extensions: [".swift"],
        importPatterns: [
            /^\s*import\s+(\w+)/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: () => [],
        entryPoints: ["main.swift", "App.swift", "AppDelegate.swift"],
        manifestFiles: ["Package.swift"],
        skipDirs: [".build", "Pods"],
    },
    // ── Dart / Flutter ──
    {
        name: "dart",
        extensions: [".dart"],
        importPatterns: [
            /^\s*import\s+['"]([^'"]+)['"]/gm,
        ],
        extractImportPath: (m) => m[1] ?? null,
        extractSpecifiers: () => [],
        entryPoints: ["main.dart", "lib/main.dart"],
        manifestFiles: ["pubspec.yaml"],
        skipDirs: [".dart_tool", "build"],
    },
];

// Build lookup maps
const extToParser = new Map<string, LanguageParser>();
for (const parser of LANGUAGE_PARSERS) {
    for (const ext of parser.extensions) extToParser.set(ext, parser);
}

const allSupportedExts = new Set(LANGUAGE_PARSERS.flatMap((p) => p.extensions));
const allSkipDirs = new Set([".git", ...LANGUAGE_PARSERS.flatMap((p) => p.skipDirs)]);
const allManifestFiles = new Set(LANGUAGE_PARSERS.flatMap((p) => p.manifestFiles));
const allEntryPoints = new Set(LANGUAGE_PARSERS.flatMap((p) => p.entryPoints));

// ───────────────────────────────────────────────────────────────────
// Manifest Parsers (framework/dependency detection)
// ───────────────────────────────────────────────────────────────────

type ManifestParser = (content: string, fwMap: Map<string, string>) => string[];

function parseNodeManifest(content: string, fwMap: Map<string, string>): string[] {
    try {
        const pkg = JSON.parse(content);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const fwMapping: Record<string, string> = {
            next: "Next.js", react: "React", vue: "Vue", svelte: "Svelte",
            tailwindcss: "TailwindCSS", typescript: "TypeScript", express: "Express",
            "react-native": "React Native", angular: "Angular", nuxt: "Nuxt",
            gatsby: "Gatsby", nestjs: "NestJS", fastify: "Fastify", koa: "Koa",
            electron: "Electron", vite: "Vite",
        };
        const detected: string[] = [];
        for (const [pkg, name] of Object.entries(fwMapping)) {
            const ver = allDeps[pkg];
            if (ver) {
                detected.push(name);
                fwMap.set(name, ver.replace(/^[\^~]/, ""));
            }
        }
        return detected;
    } catch {
        return [];
    }
}

function parsePythonRequirements(content: string, fwMap: Map<string, string>): string[] {
    const detected: string[] = [];
    const fwMapping: Record<string, string> = {
        django: "Django", flask: "Flask", fastapi: "FastAPI", tornado: "Tornado",
        celery: "Celery", sqlalchemy: "SQLAlchemy", pandas: "Pandas",
        numpy: "NumPy", tensorflow: "TensorFlow", pytorch: "PyTorch",
        streamlit: "Streamlit", pytest: "Pytest",
    };
    for (const line of content.split("\n")) {
        const match = line.match(/^([a-zA-Z0-9_-]+)\s*(?:[>=<~!]+\s*(.+))?/);
        if (match) {
            const pkgName = match[1].toLowerCase();
            for (const [key, name] of Object.entries(fwMapping)) {
                if (pkgName === key || pkgName === key.replace(/-/g, "_")) {
                    detected.push(name);
                    if (match[2]) fwMap.set(name, match[2].trim());
                }
            }
        }
    }
    return detected;
}

function parseGoMod(content: string, fwMap: Map<string, string>): string[] {
    const detected: string[] = [];
    const fwMapping: Record<string, string> = {
        "github.com/gin-gonic/gin": "Gin",
        "github.com/gorilla/mux": "Gorilla Mux",
        "github.com/labstack/echo": "Echo",
        "github.com/gofiber/fiber": "Fiber",
        "gorm.io/gorm": "GORM",
    };
    for (const line of content.split("\n")) {
        const match = line.match(/^\s*([\w./\-@]+)\s+(v[\d.]+)/);
        if (match) {
            for (const [pkg, name] of Object.entries(fwMapping)) {
                if (match[1].includes(pkg)) {
                    detected.push(name);
                    fwMap.set(name, match[2]);
                }
            }
        }
    }
    // Detect Go version
    const goVer = content.match(/^go\s+([\d.]+)/m);
    if (goVer) fwMap.set("Go", goVer[1]);
    return detected;
}

function parseCargoToml(content: string, fwMap: Map<string, string>): string[] {
    const detected: string[] = [];
    const fwMapping: Record<string, string> = {
        actix: "Actix", rocket: "Rocket", tokio: "Tokio",
        serde: "Serde", diesel: "Diesel", warp: "Warp",
    };
    for (const [key, name] of Object.entries(fwMapping)) {
        const re = new RegExp(`${key}\\s*=\\s*(?:\\{[^}]*version\\s*=\\s*"([^"]+)"|"([^"]+)")`, "m");
        const match = content.match(re);
        if (match) {
            detected.push(name);
            fwMap.set(name, (match[1] ?? match[2]).replace(/^[\^~]/, ""));
        }
    }
    return detected;
}

function parsePomXml(content: string, fwMap: Map<string, string>): string[] {
    const detected: string[] = [];
    if (content.includes("spring-boot")) { detected.push("Spring Boot"); }
    if (content.includes("spring-framework") || content.includes("spring-core")) { detected.push("Spring"); }
    if (content.includes("hibernate")) { detected.push("Hibernate"); }
    if (content.includes("junit")) { detected.push("JUnit"); }
    if (content.includes("lombok")) { detected.push("Lombok"); }
    // Try to extract version for spring-boot
    const sbVer = content.match(/<spring-boot\.version>([\d.]+)<\/spring-boot\.version>/);
    if (sbVer) fwMap.set("Spring Boot", sbVer[1]);
    return detected;
}

function parseGradle(content: string, fwMap: Map<string, string>): string[] {
    const detected: string[] = [];
    if (content.includes("spring-boot")) { detected.push("Spring Boot"); }
    if (content.includes("kotlin-stdlib")) { detected.push("Kotlin"); }
    if (content.includes("junit")) { detected.push("JUnit"); }
    if (content.includes("ktor")) { detected.push("Ktor"); }
    return detected;
}

function parseGemfile(content: string, fwMap: Map<string, string>): string[] {
    const detected: string[] = [];
    const fwMapping: Record<string, string> = {
        rails: "Ruby on Rails", sinatra: "Sinatra", rspec: "RSpec",
        sidekiq: "Sidekiq", puma: "Puma",
    };
    for (const line of content.split("\n")) {
        const match = line.match(/gem\s+['"]([^'"]+)['"](?:.*['"]([^'"]+)['"])?/);
        if (match) {
            const gemName = match[1].toLowerCase();
            for (const [key, name] of Object.entries(fwMapping)) {
                if (gemName === key) {
                    detected.push(name);
                    if (match[2]) fwMap.set(name, match[2]);
                }
            }
        }
    }
    return detected;
}

function parseComposerJson(content: string, fwMap: Map<string, string>): string[] {
    try {
        const pkg = JSON.parse(content);
        const allDeps = { ...pkg.require, ...pkg["require-dev"] };
        const detected: string[] = [];
        const fwMapping: Record<string, string> = {
            "laravel/framework": "Laravel",
            "symfony/symfony": "Symfony",
            "slim/slim": "Slim",
        };
        for (const [pkgName, name] of Object.entries(fwMapping)) {
            if (allDeps[pkgName]) {
                detected.push(name);
                fwMap.set(name, String(allDeps[pkgName]).replace(/^[\^~]/, ""));
            }
        }
        return detected;
    } catch {
        return [];
    }
}

function parsePyproject(content: string, fwMap: Map<string, string>): string[] {
    // Simple TOML parsing for common fields
    return parsePythonRequirements(content, fwMap); // Reuse for dependency lines
}

const MANIFEST_PARSERS: Record<string, ManifestParser> = {
    "package.json": parseNodeManifest,
    "requirements.txt": parsePythonRequirements,
    "pyproject.toml": parsePyproject,
    "setup.py": parsePythonRequirements,
    "Pipfile": parsePythonRequirements,
    "go.mod": parseGoMod,
    "Cargo.toml": parseCargoToml,
    "pom.xml": parsePomXml,
    "build.gradle": parseGradle,
    "build.gradle.kts": parseGradle,
    "Gemfile": parseGemfile,
    "composer.json": parseComposerJson,
};

// ───────────────────────────────────────────────────────────────────
// Content Cache (P0 - read once, reuse everywhere)
// ───────────────────────────────────────────────────────────────────

const contentCache = new Map<string, string>();

async function getCachedContent(filePath: string): Promise<string> {
    const cached = contentCache.get(filePath);
    if (cached !== undefined) return cached;
    try {
        const content = await fs.readFile(filePath, "utf-8");
        contentCache.set(filePath, content);
        return content;
    } catch {
        contentCache.set(filePath, "");
        return "";
    }
}

// ───────────────────────────────────────────────────────────────────
// Multi-language node type heuristics
// ───────────────────────────────────────────────────────────────────

function determineNodeType(filename: string, filePath: string, content: string): NodeType {
    const lower = filename.toLowerCase();
    const lowerPath = filePath.toLowerCase();

    // Tests
    if (lower.includes(".test.") || lower.includes(".spec.") || lower.includes("_test.") ||
        lowerPath.includes("__tests__") || lowerPath.includes("/test/") || lowerPath.includes("/tests/") ||
        lowerPath.includes("/spec/")) return "test";

    // Config
    if (lower.includes("config") || lower.endsWith(".json") || lower.endsWith(".yaml") ||
        lower.endsWith(".yml") || lower.endsWith(".toml") || lower.endsWith(".ini") ||
        lower === ".env" || lower.startsWith(".env.") || lower === "makefile" ||
        lower === "dockerfile" || lower === "cmakelists.txt") return "config";

    // API / routes
    if (lowerPath.includes("/api/") || lowerPath.includes("/routes/") ||
        lowerPath.includes("/endpoints/") || lowerPath.includes("/controllers/") ||
        lower.includes("controller") || lower.includes("handler")) return "api";

    // Middleware
    if (lower.includes("middleware") || lower.includes("interceptor")) return "middleware";

    // Models / data
    if (lower.includes("model") || lower.includes("schema") || lower.includes("entity") ||
        lower.includes("migration") || lowerPath.includes("/models/") ||
        lowerPath.includes("/entities/")) return "model";

    // Services / business logic
    if (lower.includes("service") || lower.includes("usecase") || lower.includes("interactor") ||
        lowerPath.includes("/services/") || lowerPath.includes("/domain/")) return "service";

    // React hooks
    if (lower.startsWith("use") && (lower.endsWith(".ts") || lower.endsWith(".tsx"))) return "hook";

    // Components
    if (lower.endsWith(".tsx") || lower.endsWith(".jsx") || lower.endsWith(".vue") || lower.endsWith(".svelte")) {
        if (/export\s+(?:default\s+)?function\s+[A-Z]/.test(content) ||
            /export\s+(?:const|let|var)\s+[A-Z]/.test(content) ||
            /export\s+default\s+class\s+[A-Z]/.test(content)) {
            return "component";
        }
    }

    // Utilities
    if (lower.includes("util") || lower.includes("helper") || lower.includes("lib/") ||
        lower.includes("common") || lower.includes("shared")) return "util";

    return "file";
}

// ───────────────────────────────────────────────────────────────────
// Code Metrics
// ───────────────────────────────────────────────────────────────────

function calculateCodeMetrics(content: string): CodeMetrics {
    const lines = content.split("\n");
    const linesOfCode = lines.filter((l) => l.trim().length > 0).length;

    // Cyclomatic complexity: count decision points
    const complexityPatterns = [
        /\bif\b/g, /\belse\s+if\b/g, /\bfor\b/g, /\bwhile\b/g,
        /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g, /&&/g, /\|\|/g,
        /\?\s*[^:]*\s*:/g, // ternary
        /\bmatch\b/g, // Rust match
        /\belif\b/g, // Python elif
        /\bexcept\b/g, // Python except
    ];
    const cyclomaticComplexity = 1 + complexityPatterns.reduce(
        (sum, p) => sum + (content.match(p)?.length ?? 0), 0
    );

    // Comment ratio
    const commentLines = lines.filter((l) => {
        const t = l.trim();
        return t.startsWith("//") || t.startsWith("#") || t.startsWith("/*") ||
            t.startsWith("*") || t.startsWith("--") || t.startsWith("'''") ||
            t.startsWith('"""');
    }).length;
    const commentRatio = linesOfCode > 0 ? commentLines / linesOfCode : 0;

    return { linesOfCode, cyclomaticComplexity, commentRatio };
}

// ───────────────────────────────────────────────────────────────────
// Layer Classification
// ───────────────────────────────────────────────────────────────────

function classifyLayer(filePath: string, nodeType: NodeType): LayerClassification {
    const lower = filePath.toLowerCase();

    if (nodeType === "test") return { layer: "test", confidence: 0.95 };
    if (nodeType === "config") return { layer: "config", confidence: 0.9 };

    if (/\b(controller|handler|route|api|endpoint|view|page|component|template|ui)\b/.test(lower))
        return { layer: "presentation", confidence: 0.8 };

    if (/\b(service|usecase|domain|business|interactor|logic|command|query)\b/.test(lower))
        return { layer: "business", confidence: 0.75 };

    if (/\b(repo|repository|dao|model|schema|migration|database|entity|store|db)\b/.test(lower))
        return { layer: "data", confidence: 0.8 };

    if (/\b(docker|k8s|kubernetes|ci|deploy|infra|terraform|ansible|helm|nginx|config)\b/.test(lower))
        return { layer: "infrastructure", confidence: 0.85 };

    // Use node type as fallback
    if (nodeType === "component" || nodeType === "hook") return { layer: "presentation", confidence: 0.6 };
    if (nodeType === "api" || nodeType === "middleware") return { layer: "presentation", confidence: 0.65 };
    if (nodeType === "model") return { layer: "data", confidence: 0.7 };
    if (nodeType === "service") return { layer: "business", confidence: 0.65 };

    return { layer: "infrastructure", confidence: 0.3 };
}

// ───────────────────────────────────────────────────────────────────
// Security Scanning (lightweight)
// ───────────────────────────────────────────────────────────────────

function scanForSecurityIssues(filePath: string, content: string): SecurityInsight[] {
    const issues: SecurityInsight[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Hardcoded secrets
        if (/(?:api[_-]?key|secret|password|token|auth|credential)\s*[:=]\s*['"][^'"]{8,}/i.test(line) &&
            !/example|placeholder|your[_-]|changeme|xxx|test/i.test(line)) {
            issues.push({
                type: "hardcoded-secret",
                filePath,
                line: i + 1,
                severity: "critical",
                message: `Potential hardcoded secret detected`,
            });
        }

        // eval() usage
        if (/\beval\s*\(/.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("#")) {
            issues.push({
                type: "unsafe-eval",
                filePath,
                line: i + 1,
                severity: "warning",
                message: `Usage of eval() — potential code injection risk`,
            });
        }

        // SQL injection risk
        if (/(?:query|execute|raw)\s*\(\s*[`'"].*(?:\$\{|\+\s*\w)/.test(line)) {
            issues.push({
                type: "sql-injection-risk",
                filePath,
                line: i + 1,
                severity: "warning",
                message: `Possible SQL injection via string interpolation`,
            });
        }
    }

    return issues;
}

// ───────────────────────────────────────────────────────────────────
// Enhanced Risk Scoring
// ───────────────────────────────────────────────────────────────────

function calculateRiskV2(
    node: GraphNode,
    content: string,
    metrics: CodeMetrics,
): RiskDetail {
    const factors: string[] = [];
    let score = 0;

    if (metrics.linesOfCode > 500) { score += 15; factors.push("Large file (>500 LOC)"); }
    if (metrics.linesOfCode > 1000) { score += 10; factors.push("Very large file (>1000 LOC)"); }
    if (metrics.cyclomaticComplexity > 20) { score += 20; factors.push("High complexity"); }
    else if (metrics.cyclomaticComplexity > 10) { score += 10; factors.push("Moderate complexity"); }
    if (metrics.commentRatio < 0.05 && metrics.linesOfCode > 100) { score += 10; factors.push("Low documentation"); }
    if ((node.fanIn ?? 0) > 10) { score += 20; factors.push("Heavily depended on (high fan-in)"); }
    else if ((node.fanIn ?? 0) > 5) { score += 10; factors.push("Moderate fan-in"); }
    if ((node.fanOut ?? 0) > 15) { score += 10; factors.push("Too many dependencies (high fan-out)"); }
    if (node.inCycle) { score += 15; factors.push("In circular dependency"); }
    if (/\bany\b/.test(content) && (node.path.endsWith(".ts") || node.path.endsWith(".tsx"))) {
        score += 5; factors.push("Uses 'any' type");
    }

    const level = score > 50 ? "high" : score > 25 ? "medium" : "low";
    return { level, score, factors };
}

// ───────────────────────────────────────────────────────────────────
// Import resolution helpers
// ───────────────────────────────────────────────────────────────────

function resolveImportPath(currentDir: string, importPath: string): string {
    if (importPath.startsWith(".")) {
        return path.resolve(currentDir, importPath);
    }
    return importPath;
}

// ───────────────────────────────────────────────────────────────────
// Parallel batch processing (P0)
// ───────────────────────────────────────────────────────────────────

async function processInBatches<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
        await Promise.all(items.slice(i, i + batchSize).map(fn));
    }
}

// ───────────────────────────────────────────────────────────────────
// Multi-language import extraction
// ───────────────────────────────────────────────────────────────────

interface ParsedImport {
    importPath: string;
    specifiers: string[];
}

function extractImports(content: string, parser: LanguageParser): ParsedImport[] {
    const results: ParsedImport[] = [];

    for (const pattern of parser.importPatterns) {
        // Recreate the regex to reset lastIndex
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;

        while ((match = regex.exec(content)) !== null) {
            const importPath = parser.extractImportPath(match);
            if (!importPath) continue;

            // Handle Go multi-import blocks
            if (importPath.includes("\n")) {
                const lines = importPath.split("\n");
                for (const line of lines) {
                    const cleaned = line.trim().replace(/^[\w.]+\s+/, "").replace(/"/g, "").trim();
                    if (cleaned) results.push({ importPath: cleaned, specifiers: [] });
                }
                continue;
            }

            const specifiers = parser.extractSpecifiers(match);
            results.push({ importPath, specifiers });
        }
    }

    return results;
}

// ───────────────────────────────────────────────────────────────────
// MAIN ANALYSIS FUNCTION
// ───────────────────────────────────────────────────────────────────

export async function analyzeRepoDependencies(repoId: string): Promise<DependencyGraph> {
    const rootPath = path.join(TEMP_DIR, repoId);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const fileMap = new Map<string, string>();
    const securityInsights: SecurityInsight[] = [];

    const frameworkVersionsMap = new Map<string, string>();
    const stats: ProjectStats = {
        languages: {},
        frameworks: [],
        entryPoints: [],
        totalFiles: 0,
    };
    let rootPackageJson: Record<string, unknown> | null = null;

    // Clear content cache for fresh analysis
    contentCache.clear();

    // ── Step 1: Recursive Scan ──
    async function scan(currentPath: string) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            if (stats.totalFiles > MAX_FILES) return; // Early termination for huge repos

            const fullPath = path.join(currentPath, entry.name);
            const relativePath = fullPath.replace(rootPath, "");

            if (entry.isDirectory()) {
                if (allSkipDirs.has(entry.name)) continue;
                await scan(fullPath);
            } else if (entry.isFile()) {
                stats.totalFiles++;
                const ext = path.extname(entry.name).toLowerCase();

                // Track languages
                if (ext) {
                    const lang = ext.replace(".", "");
                    stats.languages[lang] = (stats.languages[lang] || 0) + 1;
                }

                // ── Manifest detection (multi-language) ──
                const manifestParser = MANIFEST_PARSERS[entry.name];
                if (manifestParser) {
                    const manifestContent = await getCachedContent(fullPath);
                    const detected = manifestParser(manifestContent, frameworkVersionsMap);
                    stats.frameworks = Array.from(new Set([...stats.frameworks, ...detected]));

                    // Save root-level package.json for engine detection
                    if (entry.name === "package.json" && relativePath.split(path.sep).filter(Boolean).length <= 1) {
                        try { rootPackageJson = JSON.parse(manifestContent); } catch { /* ignore */ }
                    }
                }

                // ── Entry point detection (multi-language) ──
                if (allEntryPoints.has(entry.name) && relativePath.split(path.sep).length <= 4) {
                    stats.entryPoints.push(relativePath);
                }

                // Only analyze code files
                if (!allSupportedExts.has(ext)) continue;

                const content = await getCachedContent(fullPath);
                const type = determineNodeType(entry.name, relativePath, content);

                const node: GraphNode = {
                    id: fullPath,
                    label: entry.name,
                    type,
                    path: relativePath,
                    riskLevel: "low",
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

    // Determine primary language
    const langEntries = Object.entries(stats.languages).sort((a, b) => b[1] - a[1]);
    if (langEntries.length > 0) {
        stats.primaryLanguage = langEntries[0][0];
    }

    // ── Step 2: Parse Imports and Build Edges (with batched I/O) ──
    const incomingEdgeCounts = new Map<string, number>();
    const outgoingEdgeCounts = new Map<string, number>();
    const addedEdges = new Set<string>();
    const idToNode = new Map<string, GraphNode>();
    for (const n of nodes) idToNode.set(n.id, n);

    await processInBatches(nodes, IO_BATCH_SIZE, async (node) => {
        const content = await getCachedContent(node.id);
        const ext = path.extname(node.id).toLowerCase();
        const parser = extToParser.get(ext);
        if (!parser) return;

        const currentDir = path.dirname(node.id);
        const imports = extractImports(content, parser);

        for (const imp of imports) {
            let resolvedPath = "";

            if (parser.name === "javascript") {
                // JS/TS specific resolution
                if (imp.importPath.startsWith("@/")) {
                    resolvedPath = path.join(rootPath, imp.importPath.replace("@/", ""));
                } else if (imp.importPath.startsWith(".")) {
                    resolvedPath = resolveImportPath(currentDir, imp.importPath);
                } else {
                    continue; // External package
                }
            } else if (imp.importPath.startsWith(".") || imp.importPath.startsWith("/")) {
                resolvedPath = resolveImportPath(currentDir, imp.importPath);
            } else if (parser.name === "c_cpp" && !imp.importPath.includes("/")) {
                // Local header: #include "foo.h" — resolve relative
                resolvedPath = path.join(currentDir, imp.importPath);
            } else if (parser.name === "python") {
                // Python relative: from .module import X
                if (imp.importPath.startsWith(".")) {
                    const cleaned = imp.importPath.replace(/^\.+/, "");
                    resolvedPath = path.join(currentDir, ...cleaned.split("."));
                } else {
                    // Absolute import — try to resolve from rootPath
                    resolvedPath = path.join(rootPath, ...imp.importPath.split("."));
                }
            } else if (parser.name === "go") {
                // Go imports are module paths; try to match within the project
                // e.g. "github.com/user/repo/pkg/foo" → rootPath/pkg/foo
                const parts = imp.importPath.split("/");
                // Try last 1, 2, 3 segments to match project files
                for (let segs = 1; segs <= Math.min(parts.length, 4); segs++) {
                    const tryPath = path.join(rootPath, ...parts.slice(parts.length - segs));
                    if (fileMap.has(tryPath) || fileMap.has(tryPath + ".go")) {
                        resolvedPath = tryPath;
                        break;
                    }
                }
                if (!resolvedPath) continue;
            } else if (parser.name === "java" || parser.name === "kotlin" || parser.name === "csharp") {
                // Package-style imports: com.example.Foo → try to find matching file
                const parts = imp.importPath.split(".");
                if (parts[parts.length - 1] === "*") continue; // Wildcard
                const tryPath = path.join(rootPath, ...parts.slice(0, -1), parts[parts.length - 1]);
                resolvedPath = tryPath;
            } else if (parser.name === "rust") {
                // Rust use/mod: try relative resolution
                const cleaned = imp.importPath.replace(/::\{[^}]+\}/, "").replace(/::/g, "/");
                resolvedPath = path.join(currentDir, cleaned);
            } else if (parser.name === "ruby") {
                resolvedPath = imp.importPath.startsWith("/")
                    ? path.join(rootPath, imp.importPath)
                    : path.join(currentDir, imp.importPath);
            } else {
                continue;
            }

            if (!resolvedPath) continue;

            // Try to find actual file with extensions
            let targetNodeId = fileMap.get(resolvedPath);
            if (!targetNodeId) {
                const parser2 = extToParser.get(ext);
                const tryExts = parser2
                    ? [...parser2.extensions, ...parser2.extensions.map((e) => `/index${e}`)]
                    : [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
                for (const tryExt of tryExts) {
                    if (fileMap.has(resolvedPath + tryExt)) {
                        targetNodeId = fileMap.get(resolvedPath + tryExt);
                        break;
                    }
                }
            }

            if (targetNodeId && targetNodeId !== node.id) {
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
                        imports: imp.specifiers,
                    });
                    addedEdges.add(edgeId);
                    incomingEdgeCounts.set(targetNodeId, (incomingEdgeCounts.get(targetNodeId) || 0) + 1);
                    outgoingEdgeCounts.set(node.id, (outgoingEdgeCounts.get(node.id) || 0) + 1);
                } else {
                    const existingEdge = edges.find((e) => e.id === edgeId);
                    if (existingEdge) {
                        existingEdge.imports = Array.from(new Set([...(existingEdge.imports || []), ...imp.specifiers]));
                    }
                }
            }
        }
    });

    // ── Step 3: Metrics, Risk, Layer, Security (with batched I/O) ──
    const layerBreakdown: Record<string, number> = {};
    let totalQualityScore = 0;

    await processInBatches(nodes, IO_BATCH_SIZE, async (node) => {
        const content = await getCachedContent(node.id);

        // Fan-in / fan-out
        const fanIn = incomingEdgeCounts.get(node.id) || 0;
        const fanOut = outgoingEdgeCounts.get(node.id) || 0;
        node.fanIn = fanIn;
        node.fanOut = fanOut;

        // Code metrics
        const metrics = calculateCodeMetrics(content);
        node.metrics = metrics;

        // Layer classification
        const layer = classifyLayer(node.path, node.type);
        node.layerClassification = layer;
        layerBreakdown[layer.layer] = (layerBreakdown[layer.layer] || 0) + 1;

        // Enhanced risk
        const risk = calculateRiskV2(node, content, metrics);
        node.riskLevel = risk.level;
        node.riskDetail = risk;

        // Per-node quality score contribution
        const nodeQuality = Math.max(0, 100 - risk.score);
        totalQualityScore += nodeQuality;

        // Security scan
        const issues = scanForSecurityIssues(node.path, content);
        securityInsights.push(...issues);
    });

    // ── Step 4: Circular dependencies (Tarjan's SCC) ──
    const circularDependencies = findCircularDependencies(nodes, edges, idToNode);
    const cycleNodeIds = new Set<string>();
    for (const cycle of circularDependencies) {
        for (const id of cycle.ids) cycleNodeIds.add(id);
    }
    for (const node of nodes) {
        node.inCycle = cycleNodeIds.has(node.id);
        // Re-score risk if in cycle (since inCycle was false during initial scoring)
        if (node.inCycle && node.riskDetail && !node.riskDetail.factors.includes("In circular dependency")) {
            node.riskDetail.score += 15;
            node.riskDetail.factors.push("In circular dependency");
            node.riskDetail.level = node.riskDetail.score > 50 ? "high" : node.riskDetail.score > 25 ? "medium" : "low";
            node.riskLevel = node.riskDetail.level;
        }
    }

    // ── Step 5: High fan-in / fan-out ──
    const sortedByFanIn = [...nodes].sort((a, b) => (b.fanIn ?? 0) - (a.fanIn ?? 0));
    const sortedByFanOut = [...nodes].sort((a, b) => (b.fanOut ?? 0) - (a.fanOut ?? 0));
    const highFanInIds = sortedByFanIn.slice(0, TOP_FAN_THRESHOLD).map((n) => n.id).filter((id) => (idToNode.get(id)?.fanIn ?? 0) > 0);
    const highFanOutIds = sortedByFanOut.slice(0, TOP_FAN_THRESHOLD).map((n) => n.id).filter((id) => (idToNode.get(id)?.fanOut ?? 0) > 0);

    // ── Step 6: Module roles ──
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

    // ── Step 7: Stats, frameworks, patterns ──
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

    // Code quality score (average across all files)
    const codeQualityScore = nodes.length > 0 ? Math.round(totalQualityScore / nodes.length) : 100;

    // Clear cache after analysis to free memory
    contentCache.clear();

    return {
        nodes,
        edges,
        stats,
        circularDependencies,
        highFanInIds,
        highFanOutIds,
        securityInsights,
        layerBreakdown,
        codeQualityScore,
    };
}

// ───────────────────────────────────────────────────────────────────
// Tarjan's SCC (Circular Dependency Detection)
// ───────────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────────
// Architectural Pattern Detection (enhanced)
// ───────────────────────────────────────────────────────────────────

function detectArchitecturalPatterns(stats: ProjectStats): ArchitecturalPattern[] {
    const patterns: ArchitecturalPattern[] = [];
    const hasApp = stats.entryPoints.some((ep) => ep.includes("app/") || ep.includes("page"));
    const hasPages = stats.entryPoints.some((ep) => ep.includes("pages/"));
    const hasApi = stats.entryPoints.some((ep) => ep.toLowerCase().includes("api"));
    const fw = stats.frameworks;

    // JavaScript / TypeScript patterns
    if (hasApp && (fw.includes("Next.js") || fw.includes("React"))) {
        patterns.push({ name: "App Router / File-based routing", confidence: "high", hint: "app/ directory with page/layout files" });
    }
    if (hasPages) {
        patterns.push({ name: "Pages Router (Next.js)", confidence: "medium", hint: "pages/ directory detected" });
    }
    if (hasApi && (fw.includes("Next.js") || fw.includes("Express") || fw.includes("Fastify") || fw.includes("NestJS"))) {
        patterns.push({ name: "API routes / Backend layer", confidence: "medium", hint: "API entry points present" });
    }

    // Python patterns
    if (fw.includes("Django")) {
        patterns.push({ name: "MVT (Model-View-Template)", confidence: "high", hint: "Django framework detected" });
    }
    if (fw.includes("Flask") || fw.includes("FastAPI")) {
        patterns.push({ name: "Microservice / REST API", confidence: "medium", hint: `${fw.includes("Flask") ? "Flask" : "FastAPI"} framework detected` });
    }

    // Java / Kotlin patterns
    if (fw.includes("Spring Boot") || fw.includes("Spring")) {
        patterns.push({ name: "Layered Architecture (Spring MVC)", confidence: "high", hint: "Spring framework detected" });
    }

    // Go patterns
    if (fw.includes("Gin") || fw.includes("Echo") || fw.includes("Fiber")) {
        patterns.push({ name: "Clean Architecture / REST API", confidence: "medium", hint: `${fw[0]} Go web framework detected` });
    }

    // Rust patterns
    if (fw.includes("Actix") || fw.includes("Rocket") || fw.includes("Warp")) {
        patterns.push({ name: "Rust Web Service", confidence: "medium", hint: `${fw[0]} Rust web framework detected` });
    }

    // Ruby patterns
    if (fw.includes("Ruby on Rails")) {
        patterns.push({ name: "MVC (Model-View-Controller)", confidence: "high", hint: "Ruby on Rails framework detected" });
    }

    // PHP patterns
    if (fw.includes("Laravel")) {
        patterns.push({ name: "MVC (Model-View-Controller)", confidence: "high", hint: "Laravel framework detected" });
    }
    if (fw.includes("Symfony")) {
        patterns.push({ name: "Layered Service Architecture", confidence: "medium", hint: "Symfony framework detected" });
    }

    // General patterns
    if (fw.includes("TypeScript") && (fw.includes("React") || fw.includes("Next.js"))) {
        patterns.push({ name: "Layered (lib/components + types)", confidence: "low", hint: "TypeScript + React/Next with common structure" });
    }

    // Monorepo detection
    if (stats.entryPoints.length > 5) {
        patterns.push({ name: "Monorepo / Multi-package", confidence: "low", hint: "Many entry points detected" });
    }

    if (patterns.length === 0) {
        patterns.push({ name: "Conventional file-based structure", confidence: "low", hint: "Standard entry points and file layout" });
    }
    return patterns;
}
