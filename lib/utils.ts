import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Normalize and validate GitHub URL. Safe for client. */
export function normalizeGitHubUrl(input: string): { url: string; error?: string } {
    const raw = input.trim();
    if (!raw) return { url: "", error: "Please enter a repository URL." };
    let url = raw;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
        const u = new URL(url);
        if (!/^(https?):\/\/(www\.)?github\.com$/i.test(u.origin)) {
            return { url: raw, error: "Only GitHub repositories are supported (e.g. https://github.com/owner/repo)." };
        }
        const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
        if (parts.length < 2) {
            return { url: raw, error: "URL should be in the form: github.com/owner/repo" };
        }
        const repoName = (parts[1] ?? "").replace(/\.git$/i, "");
        const normalized = `https://github.com/${parts[0]}/${repoName}`;
        return { url: normalized };
    } catch {
        return { url: raw, error: "Invalid URL. Use e.g. https://github.com/owner/repo" };
    }
}
