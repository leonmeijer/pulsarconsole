import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: LucideIcon;
    trend?: {
        value: number;
        direction: "up" | "down" | "neutral";
    };
    className?: string;
    variant?: "default" | "success" | "warning" | "danger";
    loading?: boolean;
    onClick?: () => void;
}

const variantColors = {
    default: "from-primary/20 to-primary/5",
    success: "from-green-500/20 to-green-500/5",
    warning: "from-yellow-500/20 to-yellow-500/5",
    danger: "from-red-500/20 to-red-500/5",
};

const iconVariantColors = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-500",
    warning: "bg-yellow-500/10 text-yellow-500",
    danger: "bg-red-500/10 text-red-500",
};

export default function MetricCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    className,
    variant = "default",
    loading = false,
    onClick,
}: MetricCardProps) {
    const TrendIcon = trend?.direction === "up"
        ? TrendingUp
        : trend?.direction === "down"
            ? TrendingDown
            : Minus;

    const trendColor = trend?.direction === "up"
        ? "text-green-500"
        : trend?.direction === "down"
            ? "text-red-500"
            : "text-muted-foreground";

    if (loading) {
        return (
            <div className={cn("glass p-6 rounded-2xl animate-pulse", className)}>
                <div className="h-4 bg-white/10 rounded w-1/2 mb-4" />
                <div className="h-8 bg-white/10 rounded w-3/4 mb-2" />
                <div className="h-3 bg-white/10 rounded w-1/3" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={cn(
                "glass p-6 rounded-2xl relative overflow-hidden group transition-all duration-300",
                onClick ? "cursor-pointer hover:border-primary/50 hover:bg-white/5 active:scale-[0.98]" : "",
                className
            )}
        >
            <div className={cn(
                "absolute top-0 right-0 w-32 h-32 bg-gradient-radial rounded-full -mr-16 -mt-16 blur-3xl opacity-50",
                variantColors[variant]
            )} />

            <div className="relative">
                <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground font-medium">
                        {title}
                    </span>
                    {Icon && (
                        <div className={cn("p-2 rounded-lg", iconVariantColors[variant])}>
                            <Icon size={18} />
                        </div>
                    )}
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight">
                        {value}
                    </span>
                    {trend && (
                        <span className={cn("flex items-center gap-0.5 text-sm font-medium", trendColor)}>
                            <TrendIcon size={14} />
                            {Math.abs(trend.value)}%
                        </span>
                    )}
                </div>

                {subtitle && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {subtitle}
                    </p>
                )}
            </div>
        </motion.div>
    );
}
