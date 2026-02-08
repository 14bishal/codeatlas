"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Github, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { cloneRepository } from "@/lib/actions";
import { normalizeGitHubUrl } from "@/lib/utils";

export function LandingPageForm() {
    const [url, setUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleAnalyze = async () => {
        setError(null);
        const { error: validationError } = normalizeGitHubUrl(url);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        try {
            const result = await cloneRepository(url);
            if (result.success) {
                router.push(`/dashboard?id=${result.id}`);
            } else {
                setError(result.error ?? "Failed to clone repository.");
                setIsLoading(false);
            }
        } catch (err) {
            console.error(err);
            setError("Something went wrong. Please try again.");
            setIsLoading(false);
        }
    };

    const handleUrlChange = (value: string) => {
        setUrl(value);
        if (error) setError(null);
    };

    return (
        <div className="flex w-full max-w-md flex-col  gap-3 sm:flex-row">
            <div className="relative w-full flex flex-col gap-1">
                <div className="relative">
                    <Github className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="https://github.com/username/repo"
                        className={`h-12 w-full pl-10 bg-secondary/50 border-border focus:ring-primary/50 ${error ? "border-destructive focus:ring-destructive/50" : ""}`}
                        value={url}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        disabled={isLoading}
                        aria-invalid={!!error}
                        aria-describedby={error ? "url-error" : undefined}
                    />
                </div>
                {/* Reserve space for error to prevent CLS when it appears */}
                <div className="min-h-[1.25rem] flex flex-col justify-end">
                    <AnimatePresence>
                        {error && (
                            <motion.p
                                id="url-error"
                                initial={{ opacity: 0, y: -2 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -2 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center gap-1.5 text-sm text-destructive text-start"
                            >
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {error}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <Button
                size="lg"
                className="h-12 w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                onClick={handleAnalyze}
                disabled={isLoading || !url.trim()}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cloning…
                    </>
                ) : (
                    <>
                        Analyze
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                )}
            </Button>
        </div>
    );
}
