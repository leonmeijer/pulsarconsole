import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Copy, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JsonTreeViewerProps {
    data: unknown;
    defaultExpandDepth?: number;
    className?: string;
}

interface JsonNodeProps {
    keyName?: string;
    value: unknown;
    path: string;
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
    depth: number;
    isLast: boolean;
}

function getValueColor(value: unknown): string {
    if (value === null) return "text-muted-foreground italic";
    switch (typeof value) {
        case "string":
            return "text-green-400";
        case "number":
            return "text-amber-400";
        case "boolean":
            return "text-blue-400";
        default:
            return "text-foreground";
    }
}

function formatPrimitive(value: unknown): string {
    if (value === null) return "null";
    if (typeof value === "string") return `"${value}"`;
    return String(value);
}

function collectExpandablePaths(val: unknown, path: string, maxDepth?: number, depth = 0): string[] {
    const paths: string[] = [];
    if (val !== null && typeof val === "object") {
        if (maxDepth !== undefined && depth >= maxDepth) return paths;
        paths.push(path);
        if (Array.isArray(val)) {
            val.forEach((item, i) => {
                paths.push(...collectExpandablePaths(item, `${path}[${i}]`, maxDepth, depth + 1));
            });
        } else {
            Object.entries(val as Record<string, unknown>).forEach(([k, v]) => {
                paths.push(...collectExpandablePaths(v, `${path}.${k}`, maxDepth, depth + 1));
            });
        }
    }
    return paths;
}

const STRING_TRUNCATE_LENGTH = 500;

function JsonNode({ keyName, value, path, expandedPaths, onToggle, depth, isLast }: JsonNodeProps) {
    const isExpandable = value !== null && typeof value === "object";
    const isExpanded = expandedPaths.has(path);
    const isArray = Array.isArray(value);
    const [stringExpanded, setStringExpanded] = useState(false);

    const copyValue = (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    if (!isExpandable) {
        const isLongString = typeof value === "string" && value.length > STRING_TRUNCATE_LENGTH;
        const displayValue = isLongString && !stringExpanded
            ? `"${value.slice(0, STRING_TRUNCATE_LENGTH)}…`
            : formatPrimitive(value);

        return (
            <div
                className="flex items-start font-mono text-sm leading-relaxed group"
                style={{ paddingLeft: depth * 16 }}
            >
                {keyName !== undefined && (
                    <span className="shrink-0">
                        <span className="text-primary">&quot;{keyName}&quot;</span>
                        <span className="text-muted-foreground mr-1">:{" "}</span>
                    </span>
                )}
                <span className="min-w-0">
                    <span className={cn(getValueColor(value), "break-all")}>{displayValue}</span>
                    {isLongString && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setStringExpanded(!stringExpanded); }}
                            className="ml-2 text-xs text-amber-400 hover:text-amber-300 font-sans font-bold uppercase"
                        >
                            {stringExpanded ? "[COLLAPSE]" : "[EXPAND]"}
                        </button>
                    )}
                    {isLongString && !stringExpanded ? null : !isLast && <span className="text-muted-foreground shrink-0">,</span>}
                </span>
                <button
                    onClick={copyValue}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-0.5 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                    title="Copy value"
                >
                    <Copy size={10} />
                </button>
            </div>
        );
    }

    const count = isArray
        ? (value as unknown[]).length
        : Object.keys(value as Record<string, unknown>).length;
    const openBracket = isArray ? "[" : "{";
    const closeBracket = isArray ? "]" : "}";
    const summary = isArray ? `${count} items` : `${count} keys`;

    return (
        <div className="font-mono text-sm">
            <div
                className="flex items-center cursor-pointer hover:bg-white/5 rounded leading-relaxed group"
                style={{ paddingLeft: depth * 16 }}
                onClick={() => onToggle(path)}
            >
                {isExpanded ? (
                    <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                ) : (
                    <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                )}
                {keyName !== undefined && (
                    <>
                        <span className="text-primary ml-1">&quot;{keyName}&quot;</span>
                        <span className="text-muted-foreground mr-1">: </span>
                    </>
                )}
                <span className="text-muted-foreground">{openBracket}</span>
                {!isExpanded && (
                    <>
                        <span className="text-muted-foreground text-xs mx-1">{summary}</span>
                        <span className="text-muted-foreground">{closeBracket}</span>
                        {!isLast && <span className="text-muted-foreground">,</span>}
                    </>
                )}
                <button
                    onClick={copyValue}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-0.5 text-muted-foreground hover:text-foreground transition-opacity"
                    title="Copy value"
                >
                    <Copy size={10} />
                </button>
            </div>

            {isExpanded && (
                <>
                    {isArray
                        ? (value as unknown[]).map((item, i) => (
                              <JsonNode
                                  key={i}
                                  value={item}
                                  path={`${path}[${i}]`}
                                  expandedPaths={expandedPaths}
                                  onToggle={onToggle}
                                  depth={depth + 1}
                                  isLast={i === count - 1}
                              />
                          ))
                        : Object.entries(value as Record<string, unknown>).map(([k, v], i) => (
                              <JsonNode
                                  key={k}
                                  keyName={k}
                                  value={v}
                                  path={`${path}.${k}`}
                                  expandedPaths={expandedPaths}
                                  onToggle={onToggle}
                                  depth={depth + 1}
                                  isLast={i === count - 1}
                              />
                          ))}
                    <div style={{ paddingLeft: depth * 16 }}>
                        <span className="text-muted-foreground">
                            {closeBracket}
                            {!isLast && ","}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}

export default function JsonTreeViewer({ data, defaultExpandDepth = 2, className }: JsonTreeViewerProps) {
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
        () => new Set(collectExpandablePaths(data, "root", defaultExpandDepth))
    );

    const handleToggle = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        setExpandedPaths(new Set(collectExpandablePaths(data, "root")));
    }, [data]);

    const collapseAll = useCallback(() => {
        setExpandedPaths(new Set());
    }, []);

    const copyAll = useCallback(() => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        toast.success("Copied to clipboard");
    }, [data]);

    return (
        <div className={cn("", className)}>
            <div className="flex items-center gap-1 mb-2">
                <button
                    onClick={expandAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1"
                    title="Expand all"
                >
                    <ChevronsUpDown size={12} />
                    Expand all
                </button>
                <button
                    onClick={collapseAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1"
                    title="Collapse all"
                >
                    <ChevronsDownUp size={12} />
                    Collapse all
                </button>
                <div className="flex-1" />
                <button
                    onClick={copyAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1"
                    title="Copy JSON"
                >
                    <Copy size={12} />
                    Copy
                </button>
            </div>
            <JsonNode
                value={data}
                path="root"
                expandedPaths={expandedPaths}
                onToggle={handleToggle}
                depth={0}
                isLast={true}
            />
        </div>
    );
}
