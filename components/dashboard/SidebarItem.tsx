import type { ComponentType } from "react";
import { type FC } from "react";
import { cn } from "@/lib/utils";

export type ViewType = "overview" | "architecture" | "files" | "design";

interface SidebarItemProps {
    icon: ComponentType<{ className?: string }>;
    label: string;
    view: ViewType;
    isActive: boolean;
    setActiveView: (v: ViewType) => void;
}

const SidebarItem: FC<SidebarItemProps> = ({ icon: Icon, label, view, isActive, setActiveView }) => (
    <div className="relative flex w-full justify-center group/tooltip">
        <button
            onClick={() => setActiveView(view)}
            className={cn(
                "cursor-pointer w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative",
                isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            aria-label={label}
        >
            <Icon className="w-5 h-5" />
        </button>
        <span
            className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground shadow-md group-hover/tooltip:block"
            role="tooltip"
        >
            {label}
        </span>
    </div>
);


export default SidebarItem;