import { getRepoFileTree } from "@/lib/actions";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { redirect } from "next/navigation";

interface PageProps {
    searchParams: Promise<{ id?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
    const { id } = await searchParams;

    if (!id) {
        redirect("/");
    }

    // const fileTree = await getRepoFileTree(id);

    return <DashboardLayout />;
}