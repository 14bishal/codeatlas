import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
    return <div className={`rounded bg-muted animate-pulse ${className ?? ""}`} />;
}

export default function DashboardLoading() {
    return (
        <div className="h-screen w-screen bg-background text-foreground flex overflow-hidden">
            {/* Sidebar — matches dashboard layout */}
            <aside className="w-16 shrink-0 border-r border-border bg-card/50 flex flex-col items-center py-4 gap-4 z-20">
                <Skeleton className="h-10 w-10 rounded-xl mb-4" />
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="mt-auto">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                </div>
            </aside>

            {/* Main — header + overview-style content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-14 shrink-0 border-b border-border flex items-center px-6 justify-between bg-card/30">
                    <div className="space-y-1">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-3 w-28" />
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto">
                    <div className="space-y-6 p-4 md:p-6">
                        {/* Visualize card */}
                        <Card className="border-primary/20 bg-primary/5">
                            <CardHeader className="pb-2">
                                <Skeleton className="h-4 w-20" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-4/5" />
                                <Skeleton className="h-3 w-3/4" />
                            </CardContent>
                        </Card>

                        {/* Detects section */}
                        <div>
                            <Skeleton className="h-6 w-24 mb-3" />
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-4 w-4" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-8 w-12 mb-1" />
                                        <Skeleton className="h-3 w-28" />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-4" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-6 w-16 mb-1" />
                                        <Skeleton className="h-3 w-20" />
                                    </CardContent>
                                </Card>
                                <Card className="md:col-span-2">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <Skeleton className="h-4 w-28" />
                                        <Skeleton className="h-4 w-4" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            <Skeleton className="h-6 w-16 rounded-md" />
                                            <Skeleton className="h-6 w-14 rounded-md" />
                                            <Skeleton className="h-6 w-20 rounded-md" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="grid gap-4 mt-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <Skeleton className="h-4 w-28" />
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <Skeleton className="h-8 w-full rounded" />
                                        <Skeleton className="h-8 w-3/4 rounded" />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <Skeleton className="h-4 w-36" />
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <Skeleton className="h-5 w-full rounded" />
                                        <Skeleton className="h-5 w-4/5 rounded" />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Dependency & Data Flow */}
                        <div>
                            <Skeleton className="h-6 w-48 mb-3" />
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <Skeleton className="h-4 w-24" />
                                    </CardHeader>
                                    <CardContent className="space-y-1">
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-20" />
                                        <Skeleton className="h-3 w-24" />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <Skeleton className="h-4 w-28" />
                                    </CardHeader>
                                    <CardContent className="space-y-1">
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-16" />
                                    </CardContent>
                                </Card>
                                <Card className="md:col-span-2">
                                    <CardHeader className="pb-2">
                                        <Skeleton className="h-4 w-32" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-3 w-full" />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Language Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Language Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Skeleton className="h-3 w-12" />
                                            <Skeleton className="h-2 flex-1 rounded-full" />
                                            <Skeleton className="h-3 w-6" />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
