import Image from "next/image";
import { LandingPageForm } from "@/components/landing-page";

export default function Home() {
    return (
        <div className="relative flex relative min-h-screen flex-col items-center justify-center overflow-hidden bg-background text-foreground">
            {/* Decorative blurs — minimal layout impact */}
            <Image
                src="/CodeAtlas.png"
                alt="CodeAtlas"
                width={140}
                height={60}
                className="rounded-sm absolute top-0 left-0"
            />
            <div
                className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[100px] animate-pulse"
                style={{ animationDuration: "4s" }}
                aria-hidden
            />
            <div
                className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-accent/20 blur-[100px] animate-pulse"
                style={{ animationDuration: "6s" }}
                aria-hidden
            />

            <div className="z-10 flex flex-1 flex-col items-center justify-center text-center max-w-2xl px-4">
                <div className="mb-6 flex items-center justify-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                        AI-Powered Code Analysis
                    </span>
                </div>

                {/* LCP: server-rendered hero so it's in initial HTML */}
                <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-7xl">
                    <span className="bg-gradient-to-r from-primary via-blue-400 to-accent bg-clip-text text-transparent">
                        Understand Code
                    </span>
                    <br />
                    <span className="text-foreground">in Seconds</span>
                </h1>

                <p className="mb-10 text-lg text-muted-foreground md:text-xl">
                    Paste a GitHub repository URL and get architecture, dependencies, and risks in one view.
                </p>

                <LandingPageForm />
            </div>

            {/* Footer — copyright with CodeAtlas icon and name */}
            <footer className="z-10 w-full shrink-0 py-6 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <p>© {new Date().getFullYear()} CodeAtlas. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
