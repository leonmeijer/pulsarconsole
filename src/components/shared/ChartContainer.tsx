import { type ReactNode } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface ChartContainerProps {
    title?: string;
    subtitle?: string;
    children: ReactNode;
    className?: string;
    height?: number;
    loading?: boolean;
}

export default function ChartContainer({
    title,
    subtitle,
    children,
    className,
    height = 300,
    loading = false,
}: ChartContainerProps) {
    if (loading) {
        return (
            <div className={cn("glass p-6 rounded-2xl", className)}>
                {title && <div className="h-6 bg-white/10 rounded w-1/3 mb-2 animate-pulse" />}
                {subtitle && <div className="h-4 bg-white/10 rounded w-1/2 mb-4 animate-pulse" />}
                <div className="animate-pulse bg-white/5 rounded-lg" style={{ height }} />
            </div>
        );
    }

    return (
        <div className={cn("glass p-6 rounded-2xl", className)}>
            {(title || subtitle) && (
                <div className="mb-4">
                    {title && <h3 className="text-lg font-semibold">{title}</h3>}
                    {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
                </div>
            )}
            <div style={{ width: "100%", height }}>
                {children}
            </div>
        </div>
    );
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        color?: string;
        name?: string;
        value?: number;
    }>;
    label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div className="glass p-3 rounded-lg shadow-xl border border-white/20">
            <p className="text-sm font-medium mb-2">{label}</p>
            {payload.map((entry, index: number) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-muted-foreground">{entry.name}:</span>
                    <span className="font-medium">{entry.value?.toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
};

interface TimeSeriesChartProps<T> {
    data: T[];
    lines: {
        dataKey: keyof T;
        name: string;
        color: string;
        type?: "line" | "area";
    }[];
    xAxisKey: keyof T;
    height?: number;
    showGrid?: boolean;
    showLegend?: boolean;
}

export function TimeSeriesChart<T extends Record<string, unknown>>({
    data,
    lines,
    xAxisKey,
    height = 300,
    showGrid = true,
    showLegend = true,
}: TimeSeriesChartProps<T>) {
    const hasArea = lines.some((l) => l.type === "area");

    const Chart = hasArea ? AreaChart : LineChart;

    return (
        <ResponsiveContainer width="100%" height={height}>
            <Chart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                {showGrid && (
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.1)"
                        vertical={false}
                    />
                )}
                <XAxis
                    dataKey={xAxisKey as string}
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                        return value;
                    }}
                />
                <Tooltip content={<CustomTooltip />} />
                {showLegend && (
                    <Legend
                        wrapperStyle={{ paddingTop: "20px" }}
                        iconType="circle"
                        iconSize={8}
                    />
                )}
                {lines.map((line) =>
                    line.type === "area" ? (
                        <Area
                            key={line.dataKey as string}
                            type="monotone"
                            dataKey={line.dataKey as string}
                            name={line.name}
                            stroke={line.color}
                            fill={line.color}
                            fillOpacity={0.2}
                            strokeWidth={2}
                        />
                    ) : (
                        <Line
                            key={line.dataKey as string}
                            type="monotone"
                            dataKey={line.dataKey as string}
                            name={line.name}
                            stroke={line.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 2 }}
                        />
                    )
                )}
            </Chart>
        </ResponsiveContainer>
    );
}

interface BarChartProps<T> {
    data: T[];
    bars: {
        dataKey: keyof T;
        name: string;
        color: string;
    }[];
    xAxisKey: keyof T;
    height?: number;
    showGrid?: boolean;
    showLegend?: boolean;
    stacked?: boolean;
}

export function SimpleBarChart<T extends Record<string, unknown>>({
    data,
    bars,
    xAxisKey,
    height = 300,
    showGrid = true,
    showLegend = true,
    stacked = false,
}: BarChartProps<T>) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                {showGrid && (
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.1)"
                        vertical={false}
                    />
                )}
                <XAxis
                    dataKey={xAxisKey as string}
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                        return value;
                    }}
                />
                <Tooltip content={<CustomTooltip />} />
                {showLegend && (
                    <Legend
                        wrapperStyle={{ paddingTop: "20px" }}
                        iconType="circle"
                        iconSize={8}
                    />
                )}
                {bars.map((bar) => (
                    <Bar
                        key={bar.dataKey as string}
                        dataKey={bar.dataKey as string}
                        name={bar.name}
                        fill={bar.color}
                        radius={[4, 4, 0, 0]}
                        stackId={stacked ? "stack" : undefined}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}
