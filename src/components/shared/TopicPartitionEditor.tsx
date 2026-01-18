import { useState, useEffect } from "react";
import { X, Layers, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useUpdateTopicPartitions } from "@/api/hooks";

interface TopicPartitionEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tenant: string;
    namespace: string;
    topic: string;
    currentPartitions: number;
    onSuccess?: () => void;
}

export function TopicPartitionEditor({
    open,
    onOpenChange,
    tenant,
    namespace,
    topic,
    currentPartitions,
    onSuccess,
}: TopicPartitionEditorProps) {
    const [partitions, setPartitions] = useState(currentPartitions);
    const updatePartitions = useUpdateTopicPartitions(tenant, namespace, topic);

    useEffect(() => {
        if (open) {
            setPartitions(currentPartitions);
        }
    }, [open, currentPartitions]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (partitions < currentPartitions) {
            toast.error("Cannot decrease partition count");
            return;
        }

        if (partitions === currentPartitions) {
            toast.info("No changes to apply");
            return;
        }

        try {
            await updatePartitions.mutateAsync({ partitions });
            toast.success(`Partitions updated to ${partitions}`);
            onSuccess?.();
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to update partitions");
        }
    };

    if (!open) return null;

    const isPartitioned = currentPartitions > 0;
    const canModify = isPartitioned;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => onOpenChange(false)}
            />
            <div className="relative w-full max-w-md mx-4 modal-solid rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Layers size={20} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">Topic Partitions</h2>
                            <p className="text-sm text-muted-foreground">{topic}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {!canModify ? (
                    <div className="space-y-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-yellow-500 mt-0.5" size={20} />
                                <div>
                                    <p className="font-medium text-yellow-400">Non-Partitioned Topic</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        This topic was created without partitions. You cannot add partitions
                                        to an existing non-partitioned topic. To use partitions, create a new
                                        partitioned topic.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="w-full py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Current Partitions
                            </label>
                            <div className="text-2xl font-bold text-primary">
                                {currentPartitions}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="partitions" className="block text-sm font-medium mb-2">
                                New Partition Count
                            </label>
                            <input
                                id="partitions"
                                type="number"
                                min={currentPartitions}
                                value={partitions}
                                onChange={(e) => setPartitions(parseInt(e.target.value) || currentPartitions)}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                You can only increase the number of partitions. This operation cannot be undone.
                            </p>
                        </div>

                        {partitions > currentPartitions && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <p className="text-sm text-blue-400">
                                    Adding <span className="font-bold">{partitions - currentPartitions}</span> new partition(s)
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="flex-1 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={updatePartitions.isPending || partitions <= currentPartitions}
                                className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {updatePartitions.isPending ? "Updating..." : "Update Partitions"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
