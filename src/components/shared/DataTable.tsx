import { useState, useMemo, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    Search,
    ChevronLeft,
    ChevronRight,
    X,
    Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "./LoadingSpinner";

export interface Column<T> {
    key: string;
    header: string;
    accessor: (row: T) => ReactNode;
    sortable?: boolean;
    sortValue?: (row: T) => string | number;
    exportValue?: (row: T) => string | number | boolean;
    className?: string;
    headerClassName?: string;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyExtractor: (row: T) => string;
    loading?: boolean;
    searchable?: boolean;
    searchPlaceholder?: string;
    searchKeys?: (keyof T)[];
    pageSize?: number;
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
    rowClassName?: (row: T) => string;
    stickyHeader?: boolean;
    exportable?: boolean;
    exportFilename?: string;
}

type SortDirection = "asc" | "desc" | null;

export default function DataTable<T extends Record<string, unknown>>({
    data,
    columns,
    keyExtractor,
    loading = false,
    searchable = false,
    searchPlaceholder = "Search...",
    searchKeys,
    pageSize = 10,
    emptyMessage = "No data available",
    onRowClick,
    rowClassName,
    stickyHeader = false,
    exportable = false,
    exportFilename = "data",
}: DataTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const handleSort = (key: string, column: Column<T>) => {
        if (!column.sortable) return;

        if (sortKey === key) {
            if (sortDirection === "asc") {
                setSortDirection("desc");
            } else if (sortDirection === "desc") {
                setSortKey(null);
                setSortDirection(null);
            }
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;

        const query = searchQuery.toLowerCase();
        return data.filter((row) => {
            const keysToSearch = searchKeys || (Object.keys(row) as (keyof T)[]);
            return keysToSearch.some((key) => {
                const value = row[key];
                return String(value).toLowerCase().includes(query);
            });
        });
    }, [data, searchQuery, searchKeys]);

    const sortedData = useMemo(() => {
        if (!sortKey || !sortDirection) return filteredData;

        const column = columns.find((c) => c.key === sortKey);
        if (!column) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aValue = column.sortValue?.(a) ?? String(column.accessor(a));
            const bValue = column.sortValue?.(b) ?? String(column.accessor(b));

            if (typeof aValue === "number" && typeof bValue === "number") {
                return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
            }

            const aStr = String(aValue);
            const bStr = String(bValue);
            return sortDirection === "asc"
                ? aStr.localeCompare(bStr)
                : bStr.localeCompare(aStr);
        });
    }, [filteredData, sortKey, sortDirection, columns]);

    const getExportValue = useCallback((row: T, column: Column<T>): string => {
        if (column.exportValue) {
            const val = column.exportValue(row);
            return String(val);
        }
        if (column.sortValue) {
            return String(column.sortValue(row));
        }
        const accessed = column.accessor(row);
        if (typeof accessed === "string" || typeof accessed === "number" || typeof accessed === "boolean") {
            return String(accessed);
        }
        return "";
    }, []);

    const exportToCSV = useCallback(() => {
        const headers = columns.map(c => c.header);
        const rows = sortedData.map(row =>
            columns.map(col => {
                const value = getExportValue(row, col);
                return `"${value.replace(/"/g, '""')}"`;
            })
        );

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const timestamp = new Date().toISOString().split("T")[0];
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${exportFilename}-${timestamp}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        setShowExportMenu(false);
    }, [columns, sortedData, exportFilename, getExportValue]);

    const exportToJSON = useCallback(() => {
        const jsonData = sortedData.map(row => {
            const obj: Record<string, string> = {};
            columns.forEach(col => {
                obj[col.key] = getExportValue(row, col);
            });
            return obj;
        });

        const timestamp = new Date().toISOString().split("T")[0];
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${exportFilename}-${timestamp}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        setShowExportMenu(false);
    }, [columns, sortedData, exportFilename, getExportValue]);

    const totalPages = Math.ceil(sortedData.length / pageSize);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, currentPage, pageSize]);

    const SortIcon = ({ column }: { column: Column<T> }) => {
        if (!column.sortable) return null;

        if (sortKey !== column.key) {
            return <ChevronsUpDown size={14} className="text-muted-foreground" />;
        }

        return sortDirection === "asc" ? (
            <ChevronUp size={14} className="text-primary" />
        ) : (
            <ChevronDown size={14} className="text-primary" />
        );
    };

    if (loading) {
        return (
            <div className="glass rounded-2xl p-6">
                {searchable && (
                    <div className="mb-4 h-10 bg-white/10 rounded-lg animate-pulse w-64" />
                )}
                <TableSkeleton rows={pageSize} cols={columns.length} />
            </div>
        );
    }

    return (
        <div className="glass rounded-2xl overflow-hidden">
            {(searchable || exportable) && (
                <div className="p-4 border-b border-white/10 flex items-center justify-between gap-4">
                    {searchable ? (
                        <div className="relative max-w-sm flex-1">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder={searchPlaceholder}
                                className="w-full pl-10 pr-10 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    ) : <div />}
                    {exportable && (
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <Download size={16} />
                                Export
                            </button>
                            {showExportMenu && (
                                <div className="absolute right-0 mt-2 w-40 bg-popover border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
                                    <button
                                        onClick={exportToCSV}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors"
                                    >
                                        Export as CSV
                                    </button>
                                    <button
                                        onClick={exportToJSON}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors"
                                    >
                                        Export as JSON
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className={cn(stickyHeader && "sticky top-0 bg-background/95 backdrop-blur z-10")}>
                        <tr className="border-b border-white/10">
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    onClick={() => handleSort(column.key, column)}
                                    className={cn(
                                        "text-left px-6 py-4 text-sm font-semibold text-muted-foreground",
                                        column.sortable && "cursor-pointer hover:text-foreground select-none",
                                        column.headerClassName
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        {column.header}
                                        <SortIcon column={column} />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <AnimatePresence mode="popLayout">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length}
                                        className="px-6 py-12 text-center text-muted-foreground"
                                    >
                                        {emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row, index) => (
                                    <motion.tr
                                        key={keyExtractor(row)}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ delay: index * 0.02 }}
                                        onClick={() => onRowClick?.(row)}
                                        className={cn(
                                            "border-b border-white/5 transition-colors",
                                            onRowClick && "cursor-pointer hover:bg-white/5",
                                            rowClassName?.(row)
                                        )}
                                    >
                                        {columns.map((column) => (
                                            <td
                                                key={column.key}
                                                className={cn("px-6 py-4", column.className)}
                                            >
                                                {column.accessor(row)}
                                            </td>
                                        ))}
                                    </motion.tr>
                                ))
                            )}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
                    <span className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * pageSize + 1} to{" "}
                        {Math.min(currentPage * pageSize, sortedData.length)} of{" "}
                        {sortedData.length} results
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={cn(
                                            "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                                            currentPage === pageNum
                                                ? "bg-primary text-white"
                                                : "hover:bg-white/10"
                                        )}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
