import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Search,
    Building2,
    Folder,
    MessageSquare,
    Server,
    ArrowRight,
    Radio,
    Loader2,
    User,
} from "lucide-react";
import api from "@/api/client";

interface SearchResult {
    type: "tenant" | "namespace" | "topic" | "subscription" | "consumer" | "broker";
    name: string;
    path: string;
    description?: string;
    tenant?: string;
    namespace?: string;
    topic?: string;
    subscription?: string;
}

interface SearchResponse {
    results: SearchResult[];
    query: string;
    total: number;
}

function getTypeIcon(type: SearchResult["type"]) {
    switch (type) {
        case "tenant":
            return <Building2 className="w-4 h-4 text-blue-400" />;
        case "namespace":
            return <Folder className="w-4 h-4 text-green-400" />;
        case "topic":
            return <MessageSquare className="w-4 h-4 text-purple-400" />;
        case "subscription":
            return <Radio className="w-4 h-4 text-yellow-400" />;
        case "consumer":
            return <User className="w-4 h-4 text-cyan-400" />;
        case "broker":
            return <Server className="w-4 h-4 text-orange-400" />;
    }
}

function getTypeLabel(type: SearchResult["type"]) {
    switch (type) {
        case "tenant":
            return "Tenant";
        case "namespace":
            return "Namespace";
        case "topic":
            return "Topic";
        case "subscription":
            return "Subscription";
        case "consumer":
            return "Consumer";
        case "broker":
            return "Broker";
    }
}

function useSearch(query: string, enabled: boolean) {
    return useQuery<SearchResponse>({
        queryKey: ["search", query],
        queryFn: async () => {
            const { data } = await api.get<SearchResponse>("/api/v1/search", {
                params: { q: query, limit: 15 },
            });
            return data;
        },
        enabled: enabled && query.trim().length > 0,
        staleTime: 30000,
    });
}

export default function GlobalSearch() {
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Debounce the query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 200);
        return () => clearTimeout(timer);
    }, [query]);

    const { data, isLoading } = useSearch(debouncedQuery, isOpen);
    const results = data?.results || [];

    // Reset selected index when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [results]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) {
            if (e.key === "Enter" && query.trim()) {
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % results.length);
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
                break;
            case "Enter":
                e.preventDefault();
                if (results[selectedIndex]) {
                    navigateToResult(results[selectedIndex]);
                }
                break;
            case "Escape":
                setIsOpen(false);
                inputRef.current?.blur();
                break;
        }
    };

    const navigateToResult = (result: SearchResult) => {
        navigate(result.path);
        setQuery("");
        setIsOpen(false);
        inputRef.current?.blur();
    };

    return (
        <div className="relative max-w-md w-full">
            <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={18}
            />
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search topics, subscriptions, brokers..."
                className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all hover:bg-white/10 text-sm"
            />

            {isOpen && query.trim() && (
                <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-popover border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 glass"
                >
                    {isLoading ? (
                        <div className="p-6 text-center">
                            <Loader2 className="w-6 h-6 text-muted-foreground mx-auto animate-spin" />
                            <p className="text-muted-foreground text-sm mt-2">Searching...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="py-2 max-h-[400px] overflow-y-auto">
                            {results.map((result, index) => (
                                <button
                                    key={`${result.type}-${result.path}`}
                                    onClick={() => navigateToResult(result)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                                        index === selectedIndex
                                            ? "bg-white/10"
                                            : "hover:bg-white/5"
                                    }`}
                                >
                                    <div className="p-2 bg-white/5 rounded-lg">
                                        {getTypeIcon(result.type)}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate text-popover-foreground">
                                                {result.name}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 bg-white/10 rounded text-muted-foreground flex-shrink-0">
                                                {getTypeLabel(result.type)}
                                            </span>
                                        </div>
                                        {result.description && (
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                {result.description}
                                            </p>
                                        )}
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-center">
                            <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-muted-foreground text-sm">No results found</p>
                            <p className="text-muted-foreground/60 text-xs mt-1">
                                Try searching for topics, subscriptions, or brokers
                            </p>
                        </div>
                    )}

                    <div className="px-4 py-2 border-t border-white/10 bg-white/5">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-muted-foreground">↑↓</kbd>
                                navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-muted-foreground">↵</kbd>
                                open
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-muted-foreground">esc</kbd>
                                close
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
